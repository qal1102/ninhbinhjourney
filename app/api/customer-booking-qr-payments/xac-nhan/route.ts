import { cookies } from "next/headers";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  customerCookieHeader,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  confirmCustomerBooking,
  CustomerBookingRepositoryError,
  isCustomerBookingEnabled,
} from "@/lib/customer-data/booking-repository";
import { moPhieu, PhieuQrError } from "@/lib/customer-data/phieu-qr-thanh-toan";

/**
 * Điện thoại vừa quét mã QR bấm "Xác nhận chuyển khoản".
 *
 * Máy này không có cookie của máy đặt chỗ, nên danh nghĩa khách lấy từ phiếu
 * đã mã hoá trong mã QR; chỉ máy chủ mở được phiếu ấy. Bấm hai lần vẫn ra
 * đúng một đơn, vì mã yêu cầu trong phiếu là khoá chống trùng.
 */

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trên web đang tạm đóng." } },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_ORIGIN_REJECTED", message: "Chỉ nhận yêu cầu từ trang thanh toán." } },
      { status: 403, headers: NO_STORE },
    );
  }
  try {
    const body = (await request.json().catch(() => null)) as { phieu?: unknown } | null;
    if (typeof body?.phieu !== "string" || body.phieu.length > 2048) {
      throw new PhieuQrError("Mã QR này không đọc được.", "PHIEU_HONG");
    }
    const phieu = moPhieu(body.phieu);
    const result = await confirmCustomerBooking({
      paymentRequestId: phieu.paymentRequestId,
      holdId: phieu.holdId,
      anonymousId: phieu.anonymousId,
      paymentMode: "qr-transfer",
      contact: phieu.contact,
    });
    // Điện thoại vừa trả tiền thường là chiếc khách mang tới cổng. Máy chưa
    // có phiên khách nào thì nhận luôn phiên của người đặt, để /ho-so mở
    // thẳng hộ chiếu. Máy đã có phiên riêng thì để nguyên, không ghi đè.
    const daCoPhien = Boolean((await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value);
    return Response.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        order: { id: result.orderId, code: result.orderCode, status: result.orderStatus },
        payment: { status: result.paymentStatus, mode: result.paymentMode },
        tickets: result.tickets,
      },
      {
        status: result.duplicate ? 200 : 201,
        headers: daCoPhien ? NO_STORE : { ...NO_STORE, "Set-Cookie": customerCookieHeader(phieu.anonymousId) },
      },
    );
  } catch (error) {
    if (error instanceof PhieuQrError) {
      return Response.json(
        { accepted: false, error: { code: `CUSTOMER_QR_${error.code}`, message: error.message } },
        { status: error.code === "CONFIGURATION_MISSING" ? 503 : 400, headers: NO_STORE },
      );
    }
    const loi = error instanceof CustomerBookingRepositoryError ? error : null;
    const status = loi?.code === "HOLD_EXPIRED" || loi?.code === "ORDER_CONFIRMED" ? 409
      : loi?.code === "CONFIGURATION_MISSING" || loi?.code === "PERSISTENCE_FAILED" ? 503 : 400;
    return Response.json(
      {
        accepted: false,
        error: {
          code: loi ? `CUSTOMER_BOOKING_${loi.code}` : "CUSTOMER_PAYMENT_INPUT_INVALID",
          message: loi?.message ?? "Chưa xác nhận được, mời bạn thử lại.",
        },
      },
      { status, headers: NO_STORE },
    );
  }
}
