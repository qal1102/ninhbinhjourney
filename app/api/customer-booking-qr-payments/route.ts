import { cookies } from "next/headers";
import { CustomerQrPaymentRequestSchema } from "@/domain/customer-booking";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  CustomerBookingRepositoryError,
  docKetQuaQr,
  isCustomerBookingEnabled,
  moHenTraQr,
} from "@/lib/customer-data/booking-repository";
import { niemPhieu, PhieuQrError } from "@/lib/customer-data/phieu-qr-thanh-toan";

/**
 * Thanh toán bằng mã QR, bản giả lập.
 *
 * POST: máy đặt chỗ xin mã QR cho lượt giữ đang có. Trả về đường dẫn mà mã
 *       QR trỏ tới; điện thoại quét mã sẽ mở trang /thanh-toan/[phiếu].
 * GET:  máy đặt chỗ hỏi đều đặn "khách trả chưa?". Chỉ đọc; trả rồi thì nhận
 *       lại nguyên đơn và vé, như lối xác nhận thường.
 */

const MAX_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

function tuChoi(status: number, code: string, message: string) {
  return Response.json({ accepted: false, error: { code, message } }, { status, headers: NO_STORE });
}

async function phienKhach() {
  const anonymousId = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
  return anonymousId && UUID_PATTERN.test(anonymousId) ? anonymousId : null;
}

function maTrangThai(error: CustomerBookingRepositoryError | null) {
  if (!error) return 400;
  if (error.code === "QR_LAPSE_LIMIT" || error.code === "OWNERSHIP_REQUIRED") return 403;
  if (error.code === "HOLD_EXPIRED" || error.code === "ORDER_CONFIRMED") return 409;
  if (error.code === "CONFIGURATION_MISSING" || error.code === "PERSISTENCE_FAILED") return 503;
  return 400;
}

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return tuChoi(503, "CUSTOMER_BOOKING_DISABLED", "Đặt chỗ trên web đang tạm đóng.");
  }
  if (!isSameOriginCustomerRequest(request)) {
    return tuChoi(403, "CUSTOMER_BOOKING_ORIGIN_REJECTED", "Chỉ nhận yêu cầu từ chính trang đặt chỗ.");
  }
  const anonymousId = await phienKhach();
  if (!anonymousId) {
    return tuChoi(409, "CUSTOMER_PROFILE_NOT_FOUND", "Phiên khách không khớp lượt giữ chỗ.");
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return tuChoi(413, "CUSTOMER_BOOKING_PAYLOAD_TOO_LARGE", "Yêu cầu vượt giới hạn.");
    }
    const input = CustomerQrPaymentRequestSchema.parse(JSON.parse(rawBody));
    const { expiresAt } = await moHenTraQr({
      holdId: input.hold_id,
      anonymousId,
      contact: input.contact,
    });
    const phieu = niemPhieu({
      holdId: input.hold_id,
      paymentRequestId: input.payment_request_id,
      anonymousId,
      contact: input.contact,
      amountVnd: input.amount_vnd,
      productId: input.product_id,
      expiresAt: new Date(expiresAt).getTime(),
    });
    const origin = new URL(request.url).origin;
    return Response.json(
      { accepted: true, pay_url: `${origin}/thanh-toan/${phieu}`, expires_at: expiresAt },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof PhieuQrError) return tuChoi(503, `CUSTOMER_QR_${error.code}`, error.message);
    const loi = error instanceof CustomerBookingRepositoryError ? error : null;
    return tuChoi(
      maTrangThai(loi),
      loi ? `CUSTOMER_BOOKING_${loi.code}` : "CUSTOMER_PAYMENT_INPUT_INVALID",
      loi?.message ?? "Mời bạn để lại số điện thoại hoặc email trước khi lấy mã QR.",
    );
  }
}

export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return tuChoi(503, "CUSTOMER_BOOKING_DISABLED", "Đặt chỗ trên web đang tạm đóng.");
  }
  const anonymousId = await phienKhach();
  const url = new URL(request.url);
  const holdId = url.searchParams.get("hold_id") ?? "";
  const paymentRequestId = url.searchParams.get("payment_request_id") ?? "";
  if (!anonymousId || !UUID_PATTERN.test(holdId) || !UUID_PATTERN.test(paymentRequestId)) {
    return tuChoi(400, "CUSTOMER_PAYMENT_INPUT_INVALID", "Yêu cầu chưa hợp lệ.");
  }
  try {
    const result = await docKetQuaQr({ holdId, paymentRequestId, anonymousId });
    if (!result) return Response.json({ accepted: true, paid: false }, { headers: NO_STORE });
    return Response.json(
      {
        accepted: true,
        paid: true,
        order: { id: result.orderId, code: result.orderCode, status: result.orderStatus },
        payment: {
          id: result.paymentAttemptId,
          status: result.paymentStatus,
          mode: result.paymentMode,
          amount_due_vnd: result.amountDueVnd,
        },
        tickets: result.tickets,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const loi = error instanceof CustomerBookingRepositoryError ? error : null;
    return tuChoi(
      maTrangThai(loi),
      loi ? `CUSTOMER_BOOKING_${loi.code}` : "CUSTOMER_PAYMENT_INPUT_INVALID",
      loi?.message ?? "Chưa đọc được trạng thái thanh toán.",
    );
  }
}
