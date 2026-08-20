import { cookies } from "next/headers";
import { CustomerBookingHoldRequestSchema } from "@/domain/customer-booking";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  customerCookieHeader,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  createCustomerBookingHold,
  CustomerBookingRepositoryError,
  isCustomerBookingEnabled,
} from "@/lib/customer-data/booking-repository";

const MAX_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trực tuyến chưa được bật." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_ORIGIN_REJECTED", message: "Chỉ nhận giữ chỗ first-party từ cùng origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { accepted: false, error: { code: "CUSTOMER_BOOKING_PAYLOAD_TOO_LARGE", message: "Yêu cầu giữ chỗ vượt giới hạn." } },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    const input = CustomerBookingHoldRequestSchema.parse(JSON.parse(rawBody));
    const existingAnonymousId = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
    const anonymousId = existingAnonymousId && UUID_PATTERN.test(existingAnonymousId)
      ? existingAnonymousId
      : input.anonymous_id;
    const result = await createCustomerBookingHold({
      requestId: input.request_id,
      anonymousId,
      productId: input.product_id,
      visitDate: input.visit_date,
      partySize: input.party_size,
    });
    const response = Response.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        order: { id: result.orderId, code: result.orderCode },
        hold: { id: result.holdId, status: result.holdStatus, expires_at: result.expiresAt },
        amount: { total_vnd: result.totalVnd, currency: result.currency },
        slots: result.slots,
      },
      { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
    response.headers.append("Set-Cookie", customerCookieHeader(anonymousId));
    return response;
  } catch (error) {
    const repositoryError = error instanceof CustomerBookingRepositoryError ? error : null;
    const status = repositoryError?.code === "CAPACITY_UNAVAILABLE" || repositoryError?.code === "SLOT_PAUSED"
      ? 409
      : repositoryError?.code === "PROFILE_NOT_FOUND" || repositoryError?.code === "ID_COLLISION"
        ? 409
        : repositoryError?.code === "RATE_LIMITED"
          ? 429
          : repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED"
            ? 503
            : 400;
    return Response.json(
      { accepted: false, error: { code: repositoryError ? `CUSTOMER_BOOKING_${repositoryError.code}` : "CUSTOMER_BOOKING_INPUT_INVALID", message: repositoryError?.message ?? "Yêu cầu giữ chỗ chưa hợp lệ." } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
