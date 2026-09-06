import {
  CustomerTicketLookupRequestSchema,
  normalizeCustomerOrderCode,
} from "@/domain/customer-booking";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import {
  CustomerBookingRepositoryError,
  isCustomerBookingEnabled,
  lookupCustomerOrderTickets,
} from "@/lib/customer-data/booking-repository";

const MAX_BODY_BYTES = 4 * 1024;

/**
 * TC-23 — lấy lại vé bằng mã đặt chỗ cộng liên hệ đã dùng khi đặt.
 *
 * Tuyến này KHÔNG đòi cookie phiên khách, và đó chính là lý do nó tồn tại:
 * khách mất màn hình cũ thì thường cũng đã sang máy khác. Cái thay cho phiên
 * là hai thứ chỉ chủ đơn mới có cùng lúc — mã đặt chỗ và liên hệ đã để lại.
 *
 * **Một câu trả lời cho hai trường hợp.** Sai mã, sai liên hệ, hay đơn trả
 * ngay nên không có liên hệ nào để đối chiếu — cả ba đi ra bằng đúng một thân
 * phản hồi và đúng một mã trạng thái. Tách chúng ra là biến một mã nhặt được
 * thành một cuộc dò số điện thoại.
 */
const NOT_FOUND_BODY = {
  accepted: true,
  found: false,
  throttled: false,
  message:
    "Em chưa tìm ra chuyến nào khớp mã đặt chỗ và liên hệ này ạ. Bạn xem lại giúp em mã đã ghi và số điện thoại hoặc email đã dùng lúc đặt.",
} as const;

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return jsonResponse(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Lối tra cứu vé chưa được bật." } },
      503,
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return jsonResponse(
      { accepted: false, error: { code: "CUSTOMER_LOOKUP_ORIGIN_REJECTED", message: "Chỉ nhận yêu cầu tra cứu first-party từ cùng origin." } },
      403,
    );
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return jsonResponse(
      { accepted: false, error: { code: "CUSTOMER_LOOKUP_PAYLOAD_TOO_LARGE", message: "Yêu cầu tra cứu vượt giới hạn." } },
      413,
    );
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(
        { accepted: false, error: { code: "CUSTOMER_LOOKUP_PAYLOAD_TOO_LARGE", message: "Yêu cầu tra cứu vượt giới hạn." } },
        413,
      );
    }
    const input = CustomerTicketLookupRequestSchema.parse(JSON.parse(rawBody));

    // Gõ sai khuôn mã là chuyện của ô nhập, nói thẳng được: câu này đúng cho
    // mọi chuỗi ký tự, nên nó không hé lộ mã nào có thật hay không.
    const orderCode = normalizeCustomerOrderCode(input.order_code);
    if (!orderCode) {
      return jsonResponse(
        {
          accepted: false,
          error: {
            code: "CUSTOMER_LOOKUP_CODE_MALFORMED",
            message: "Mã đặt chỗ có dạng NBJ- rồi mười hai ký tự, bạn xem lại giúp em ạ.",
          },
        },
        400,
      );
    }

    const result = await lookupCustomerOrderTickets({
      orderCode,
      contact: input.contact,
    });

    if (!result.found) {
      return result.throttled
        ? jsonResponse(
            {
              accepted: true,
              found: false,
              throttled: true,
              message:
                "Bạn vừa thử khá nhiều lần rồi ạ. Mời bạn nghỉ một lát rồi quay lại, hoặc gọi giúp em tới quầy để được mở vé ngay.",
            },
            429,
          )
        : jsonResponse(NOT_FOUND_BODY, 404);
    }

    return jsonResponse(
      {
        accepted: true,
        found: true,
        throttled: false,
        order: {
          code: result.orderCode,
          product_id: result.productId,
          visit_date: result.visitDate,
          party_size: result.partySize,
          adults: result.adults,
          children: result.children,
          total_vnd: result.totalVnd,
          currency: result.currency,
        },
        payment: {
          mode: result.paymentMode,
          status: result.paymentStatus,
          amount_due_vnd: result.amountDueVnd,
        },
        tickets: result.tickets,
      },
      200,
    );
  } catch (error) {
    const repositoryError = error instanceof CustomerBookingRepositoryError ? error : null;
    const status = repositoryError?.code === "CONFIGURATION_MISSING"
      || repositoryError?.code === "PERSISTENCE_FAILED"
      ? 503
      : 400;
    return jsonResponse(
      {
        accepted: false,
        error: {
          code: repositoryError ? `CUSTOMER_LOOKUP_${repositoryError.code}` : "CUSTOMER_LOOKUP_INPUT_INVALID",
          message: repositoryError?.message
            ?? "Bạn nhập giúp em mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt ạ.",
        },
      },
      status,
    );
  }
}
