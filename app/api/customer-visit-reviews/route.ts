import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { VisitReviewQuerySchema, VisitReviewSubmitSchema } from "@/domain/visit-review";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import {
  getVisitReviewsOfMember,
  submitVisitReview,
  VisitReviewRepositoryError,
} from "@/lib/customer-data/visit-review-repository";

const MAX_BODY_BYTES = 4 * 1024;
const NO_STORE = { "Cache-Control": "no-store" } as const;

function tuChoi(code: string, message: string, status: number) {
  return Response.json({ accepted: false, error: { code, message } }, { status, headers: NO_STORE });
}

function mapStatus(error: VisitReviewRepositoryError | null): number {
  switch (error?.code) {
    case "MEMBER_NOT_FOUND":
      return 404;
    case "KHONG_CO_DAU_CHAN":
      return 403;
    case "NOT_READY":
    case "CONFIGURATION_MISSING":
    case "PERSISTENCE_FAILED":
      return 503;
    default:
      return 400;
  }
}

function traLoiLoi(error: unknown) {
  const loi = error instanceof VisitReviewRepositoryError ? error : null;
  return tuChoi(
    loi ? `VISIT_REVIEW_${loi.code}` : "VISIT_REVIEW_INPUT_INVALID",
    loi?.message ?? "Yêu cầu chưa hợp lệ.",
    mapStatus(loi),
  );
}

/**
 * TC-12 — khách kể lại một câu về nơi mình vừa vào.
 *
 * Cửa vào là mã thành viên, giống mọi trang khách trong hệ đoàn: ai cầm mã thì
 * đó là mã của họ (TC-20). Nhưng cầm mã KHÔNG đủ để viết — hàm SQL còn đòi
 * đúng một lượt quét `accepted` của chính người ấy tại chính nơi ấy. Không có
 * dấu chân thì không có lời; luật ấy nằm dưới cơ sở dữ liệu, không nằm ở đây.
 *
 * POST đòi cùng origin vì nó ghi dữ liệu; GET thì không, cùng lý do với các
 * đường đọc khác trong hệ đoàn (trình duyệt không gửi `Origin` cho GET cùng
 * origin, gắn vào là tự chặn chính mình).
 */
export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return tuChoi("CUSTOMER_BOOKING_DISABLED", "Đặt chỗ trực tuyến chưa được bật.", 503);
  }
  if (!isSameOriginCustomerRequest(request)) {
    return tuChoi("VISIT_REVIEW_ORIGIN_REJECTED", "Chỉ nhận yêu cầu first-party từ cùng origin.", 403);
  }
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return tuChoi("VISIT_REVIEW_BODY_TOO_LARGE", "Nội dung gửi lên dài quá mức cho phép.", 413);
    }
    const input = VisitReviewSubmitSchema.parse(JSON.parse(rawBody));
    const review = await submitVisitReview({
      memberCode: input.member_code,
      siteId: input.site_id,
      rating: input.rating,
      comment: input.comment,
    });
    return Response.json({ accepted: true, review }, { status: 200, headers: NO_STORE });
  } catch (error) {
    return traLoiLoi(error);
  }
}

export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return tuChoi("CUSTOMER_BOOKING_DISABLED", "Đặt chỗ trực tuyến chưa được bật.", 503);
  }
  try {
    const input = VisitReviewQuerySchema.parse({
      member_code: new URL(request.url).searchParams.get("member_code") ?? "",
    });
    const reviews = await getVisitReviewsOfMember(input.member_code);
    return Response.json({ accepted: true, reviews }, { status: 200, headers: NO_STORE });
  } catch (error) {
    return traLoiLoi(error);
  }
}
