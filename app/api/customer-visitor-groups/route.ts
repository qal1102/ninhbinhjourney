import { cookies } from "next/headers";
import {
  VisitorGroupCreateRequestSchema,
  VisitorGroupStatusQuerySchema,
} from "@/domain/visitor-group";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  customerCookieHeader,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import {
  createVisitorGroup,
  getVisitorGroupStatus,
  VisitorGroupRepositoryError,
} from "@/lib/customer-data/visitor-group-repository";

const MAX_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function statusFor(code: VisitorGroupRepositoryError["code"] | null) {
  switch (code) {
    case "OWNERSHIP_REQUIRED":
      return 403;
    case "ORDER_NOT_FOUND":
    case "GROUP_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
      return 404;
    case "ORDER_NOT_CONFIRMED":
      return 409;
    case "CONFIGURATION_MISSING":
    case "PERSISTENCE_FAILED":
      return 503;
    default:
      return 400;
  }
}

function failure(error: unknown) {
  const repositoryError = error instanceof VisitorGroupRepositoryError ? error : null;
  return Response.json(
    {
      accepted: false,
      error: {
        code: repositoryError ? `VISITOR_GROUP_${repositoryError.code}` : "VISITOR_GROUP_INPUT_INVALID",
        message: repositoryError?.message ?? "Yêu cầu chưa hợp lệ.",
      },
    },
    { status: statusFor(repositoryError?.code ?? null), headers: NO_STORE },
  );
}

function disabled() {
  return Response.json(
    { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trực tuyến chưa được bật." } },
    { status: 503, headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) return disabled();
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "VISITOR_GROUP_ORIGIN_REJECTED", message: "Chỉ nhận yêu cầu first-party từ cùng origin." } },
      { status: 403, headers: NO_STORE },
    );
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { accepted: false, error: { code: "VISITOR_GROUP_PAYLOAD_TOO_LARGE", message: "Yêu cầu vượt giới hạn." } },
        { status: 413, headers: NO_STORE },
      );
    }
    const input = VisitorGroupCreateRequestSchema.parse(JSON.parse(rawBody));
    // Cookie của phiên đứng trên thân yêu cầu: thân do trình duyệt gửi lên nên
    // sửa được, còn cookie là thứ máy chủ đã cấp cho chính phiên này.
    const existing = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
    const anonymousId = existing && UUID_PATTERN.test(existing) ? existing : input.anonymous_id;
    const group = await createVisitorGroup({
      orderId: input.order_id,
      anonymousId,
      leaderName: input.leader_name,
      leaderPhone: input.leader_phone,
    });
    const response = Response.json({ accepted: true, group }, { status: 201, headers: NO_STORE });
    response.headers.append("Set-Cookie", customerCookieHeader(anonymousId));
    return response;
  } catch (error) {
    return failure(error);
  }
}

/**
 * Đọc trạng thái đoàn bằng mã đoàn.
 *
 * Cố ý **không** gắn bộ chặn same-origin ở đây: trình duyệt không gửi header
 * `Origin` cho một `fetch` GET cùng origin, nên gắn vào là tự chặn chính mình.
 * Mã đoàn là mười ký tự ngẫu nhiên và chính trưởng đoàn gửi nó cho cả đoàn —
 * ai cầm mã thì xem được, đúng như cầm tấm vé. Số điện thoại trưởng đoàn không
 * nằm trong dữ liệu trả về.
 */
export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) return disabled();
  try {
    const url = new URL(request.url);
    const input = VisitorGroupStatusQuerySchema.parse({
      group_code: url.searchParams.get("group_code") ?? "",
    });
    const group = await getVisitorGroupStatus(input.group_code);
    return Response.json({ accepted: true, group }, { status: 200, headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
