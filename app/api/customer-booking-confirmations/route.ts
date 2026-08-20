import { cookies } from "next/headers";
import { CustomerBookingConfirmationRequestSchema } from "@/domain/customer-booking";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  confirmCustomerSimulatedBooking,
  CustomerBookingRepositoryError,
  isCustomerBookingEnabled,
} from "@/lib/customer-data/booking-repository";

const MAX_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Xác nhận đặt chỗ chưa được bật." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_ORIGIN_REJECTED", message: "Chỉ nhận xác nhận first-party từ cùng origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const anonymousId = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
  if (!anonymousId || !UUID_PATTERN.test(anonymousId)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_PROFILE_NOT_FOUND", message: "Phiên khách không khớp lượt giữ chỗ." } },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { accepted: false, error: { code: "CUSTOMER_BOOKING_PAYLOAD_TOO_LARGE", message: "Yêu cầu xác nhận vượt giới hạn." } },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    const input = CustomerBookingConfirmationRequestSchema.parse(JSON.parse(rawBody));
    const result = await confirmCustomerSimulatedBooking({
      paymentRequestId: input.payment_request_id,
      holdId: input.hold_id,
      anonymousId,
    });
    return Response.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        order: { id: result.orderId, code: result.orderCode, status: result.orderStatus },
        payment: { id: result.paymentAttemptId, status: result.paymentStatus, mode: "simulation" },
        tickets: result.tickets,
      },
      { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const repositoryError = error instanceof CustomerBookingRepositoryError ? error : null;
    const status = repositoryError?.code === "OWNERSHIP_REQUIRED"
      ? 403
      : repositoryError?.code === "HOLD_EXPIRED" || repositoryError?.code === "ORDER_CONFIRMED" || repositoryError?.code === "ID_COLLISION"
        ? 409
        : repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED"
          ? 503
          : 400;
    return Response.json(
      { accepted: false, error: { code: repositoryError ? `CUSTOMER_BOOKING_${repositoryError.code}` : "CUSTOMER_PAYMENT_INPUT_INVALID", message: repositoryError?.message ?? "Yêu cầu xác nhận chưa hợp lệ." } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
