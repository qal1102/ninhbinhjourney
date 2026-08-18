import { cookies } from "next/headers";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  CustomerContactRequestSchema,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  CustomerIdentityRepositoryError,
  isCustomerIdentityCollectionEnabled,
  submitCustomerContact,
} from "@/lib/customer-data/identity-repository";

const MAX_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isCustomerIdentityCollectionEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_IDENTITY_DISABLED", message: "Tính năng lưu liên hệ chưa được bật." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_IDENTITY_ORIGIN_REJECTED", message: "Chỉ nhận liên hệ first-party từ cùng origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_IDENTITY_PAYLOAD_TOO_LARGE", message: "Yêu cầu lưu liên hệ vượt giới hạn." } },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const anonymousId = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
  if (!anonymousId || !UUID_PATTERN.test(anonymousId)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_PROFILE_NOT_FOUND", message: "Hãy tạo và lưu hành trình trước khi để lại liên hệ." } },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { accepted: false, error: { code: "CUSTOMER_IDENTITY_PAYLOAD_TOO_LARGE", message: "Yêu cầu lưu liên hệ vượt giới hạn." } },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    const input = CustomerContactRequestSchema.parse(JSON.parse(rawBody));
    const result = await submitCustomerContact({
      requestId: input.request_id,
      journeyId: input.journey_id,
      anonymousId,
      contact: input.contact,
      marketingCommunications: input.marketing_communications,
    });
    return Response.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        request_id: result.requestId,
        delivery_status: result.deliveryStatus,
        contact_type: result.contactType,
        marketing_status: result.marketingStatus,
        marketing_policy_version: result.marketingPolicyVersion,
      },
      { status: result.duplicate ? 200 : 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const repositoryError = error instanceof CustomerIdentityRepositoryError ? error : null;
    const status = repositoryError?.code === "JOURNEY_NOT_OWNED" || repositoryError?.code === "PERMISSION_DENIED"
      ? 403
      : repositoryError?.code === "ID_COLLISION" || repositoryError?.code === "MERGE_REVIEW_REQUIRED"
        ? 409
        : repositoryError?.code === "RATE_LIMITED"
          ? 429
          : repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED"
            ? 503
            : 400;
    return Response.json(
      {
        accepted: false,
        error: {
          code: repositoryError ? `CUSTOMER_IDENTITY_${repositoryError.code}` : "CUSTOMER_IDENTITY_INPUT_INVALID",
          message: repositoryError?.message ?? "Email hoặc số điện thoại chưa đúng định dạng.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
