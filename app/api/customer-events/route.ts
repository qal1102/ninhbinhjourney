import { CustomerEventRequestSchema } from "@/domain/customer-events";
import {
  CustomerEventRepositoryError,
  ingestCustomerEvent,
  isCustomerEventIngestionEnabled,
} from "@/lib/customer-data/event-repository";

const MAX_BODY_BYTES = 32 * 1024;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function reject(status: number, code: string, message: string) {
  return Response.json(
    { accepted: false, error: { code, message } },
    { status, headers: NO_STORE_HEADERS },
  );
}

function isSameOriginBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin) return false;
  return !fetchSite || fetchSite === "same-origin";
}

export async function POST(request: Request) {
  if (!isCustomerEventIngestionEnabled()) {
    return reject(
      503,
      "CUSTOMER_DATA_INGESTION_DISABLED",
      "Bộ thu dữ liệu khách hàng chưa được bật cho môi trường này.",
    );
  }

  if (!isSameOriginBrowserRequest(request)) {
    return reject(
      403,
      "CUSTOMER_EVENT_ORIGIN_REJECTED",
      "Chỉ nhận event first-party từ cùng origin.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return reject(
      413,
      "CUSTOMER_EVENT_TOO_LARGE",
      "Payload event vượt giới hạn cho phép.",
    );
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return reject(
      413,
      "CUSTOMER_EVENT_TOO_LARGE",
      "Payload event vượt giới hạn cho phép.",
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return reject(
      400,
      "CUSTOMER_EVENT_JSON_INVALID",
      "Payload event không phải JSON hợp lệ.",
    );
  }

  const parsed = CustomerEventRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return reject(
      400,
      "CUSTOMER_EVENT_CONTRACT_INVALID",
      "Event không khớp tracking contract hiện hành.",
    );
  }

  try {
    const result = await ingestCustomerEvent(parsed.data);
    return Response.json(
      {
        accepted: true,
        eventId: result.eventId,
        duplicate: !result.inserted,
      },
      {
        status: result.inserted ? 202 : 200,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    if (error instanceof CustomerEventRepositoryError) {
      if (error.code === "PII_FORBIDDEN") {
        return reject(400, "CUSTOMER_EVENT_PII_FORBIDDEN", error.message);
      }
      if (error.code === "CONSENT_REQUIRED") {
        return reject(403, "CUSTOMER_ANALYTICS_CONSENT_REQUIRED", error.message);
      }
      if (error.code === "ID_COLLISION") {
        return reject(409, "CUSTOMER_EVENT_ID_COLLISION", error.message);
      }
      if (error.code === "CONFIGURATION_MISSING") {
        return reject(503, "CUSTOMER_DATA_CONFIGURATION_MISSING", error.message);
      }
    }

    return reject(
      503,
      "CUSTOMER_EVENT_PERSISTENCE_FAILED",
      "Kho dữ liệu khách hàng tạm thời chưa nhận được event.",
    );
  }
}
