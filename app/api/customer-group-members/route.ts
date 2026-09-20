import {
  VisitorGroupMemberActivateRequestSchema,
  VisitorGroupMemberJourneyQuerySchema,
} from "@/domain/visitor-group";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import {
  activateVisitorGroupMember,
  getVisitorGroupMemberJourney,
  VisitorGroupRepositoryError,
} from "@/lib/customer-data/visitor-group-repository";

const MAX_BODY_BYTES = 2 * 1024;
const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Khách trong đoàn tự khai tên mình.
 *
 * Không đòi cookie phiên, và đó là chủ ý: người quét mã của mình thường mở
 * bằng máy khác hẳn máy trưởng đoàn đã đặt chỗ. Mã thành viên chính là thứ
 * chứng minh — ai cầm mã thì đó là mã của họ.
 *
 * Việc này **không** ảnh hưởng gì tới cổng: không hàm nào trong đường soát vé
 * đọc tên hay trạng thái kích hoạt để quyết định cho vào hay không.
 */
export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trực tuyến chưa được bật." } },
      { status: 503, headers: NO_STORE },
    );
  }
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
    const input = VisitorGroupMemberActivateRequestSchema.parse(JSON.parse(rawBody));
    const member = await activateVisitorGroupMember({
      memberCode: input.member_code,
      displayName: input.display_name,
    });
    return Response.json({ accepted: true, member }, { status: 200, headers: NO_STORE });
  } catch (error) {
    const repositoryError = error instanceof VisitorGroupRepositoryError ? error : null;
    const status = repositoryError?.code === "MEMBER_NOT_FOUND"
      ? 404
      : repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED"
        ? 503
        : 400;
    return Response.json(
      {
        accepted: false,
        error: {
          code: repositoryError ? `VISITOR_GROUP_${repositoryError.code}` : "VISITOR_GROUP_INPUT_INVALID",
          message: repositoryError?.message ?? "Yêu cầu chưa hợp lệ.",
        },
      },
      { status, headers: NO_STORE },
    );
  }
}

/**
 * TC-10 — khách mở lại những nơi chính mình đã đi qua.
 *
 * Không gắn bộ chặn same-origin, cùng lý do với GET của mã đoàn: trình duyệt
 * không gửi header `Origin` cho một `fetch` GET cùng origin, gắn vào là tự
 * chặn chính mình. Mã thành viên là mười ký tự ngẫu nhiên, ai cầm mã thì xem
 * được — đúng như cầm tấm vé (TC-20). Dữ liệu trả về chỉ có của đúng người
 * cầm mã: không tên người khác, không gì của trưởng đoàn.
 *
 * Hàm cơ sở dữ liệu chưa được áp thì trả `VISITOR_GROUP_JOURNEY_NOT_READY`,
 * để trang nói thẳng phần này sắp có chứ không báo lỗi kết nối.
 */
export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trực tuyến chưa được bật." } },
      { status: 503, headers: NO_STORE },
    );
  }
  try {
    const input = VisitorGroupMemberJourneyQuerySchema.parse({
      member_code: new URL(request.url).searchParams.get("member_code") ?? "",
    });
    const journey = await getVisitorGroupMemberJourney(input.member_code);
    return Response.json({ accepted: true, journey }, { status: 200, headers: NO_STORE });
  } catch (error) {
    const repositoryError = error instanceof VisitorGroupRepositoryError ? error : null;
    const status = repositoryError?.code === "MEMBER_NOT_FOUND"
      ? 404
      : repositoryError?.code === "JOURNEY_NOT_READY"
        || repositoryError?.code === "CONFIGURATION_MISSING"
        || repositoryError?.code === "PERSISTENCE_FAILED"
        ? 503
        : 400;
    return Response.json(
      {
        accepted: false,
        error: {
          code: repositoryError ? `VISITOR_GROUP_${repositoryError.code}` : "VISITOR_GROUP_INPUT_INVALID",
          message: repositoryError?.message ?? "Yêu cầu chưa hợp lệ.",
        },
      },
      { status, headers: NO_STORE },
    );
  }
}
