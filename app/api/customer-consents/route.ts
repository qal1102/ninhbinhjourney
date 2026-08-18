import { cookies } from "next/headers";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  CustomerConsentPreferenceRequestSchema,
  customerCookieHeader,
  isSameOriginCustomerRequest,
} from "@/domain/customer-identity";
import {
  CustomerIdentityRepositoryError,
  isCustomerConsentManagementEnabled,
  recordCustomerPreferences,
} from "@/lib/customer-data/identity-repository";

const MAX_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isCustomerConsentManagementEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_CONSENT_DISABLED", message: "Trung tâm quyền riêng tư chưa được bật." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_CONSENT_ORIGIN_REJECTED", message: "Chỉ nhận lựa chọn first-party từ cùng origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_CONSENT_PAYLOAD_TOO_LARGE", message: "Yêu cầu quyền riêng tư vượt giới hạn." } },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { accepted: false, error: { code: "CUSTOMER_CONSENT_PAYLOAD_TOO_LARGE", message: "Yêu cầu quyền riêng tư vượt giới hạn." } },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    const input = CustomerConsentPreferenceRequestSchema.parse(JSON.parse(rawBody));
    const existing = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
    const anonymousId = existing && UUID_PATTERN.test(existing) ? existing : input.anonymous_id;
    const consent = await recordCustomerPreferences({
      anonymousId,
      productAnalytics: input.product_analytics,
      marketingCommunications: input.marketing_communications,
    });
    const response = Response.json(
      {
        accepted: true,
        duplicate: !consent.inserted,
        consent: {
          product_analytics: consent.product_analytics,
          marketing_communications: consent.marketing_communications,
          essential_service: "not-requested",
          policy_version: consent.policy_version,
          marketing_policy_version: consent.marketing_policy_version,
        },
      },
      { status: consent.inserted ? 202 : 200, headers: { "Cache-Control": "no-store" } },
    );
    response.headers.append("Set-Cookie", customerCookieHeader(anonymousId));
    return response;
  } catch (error) {
    const repositoryError = error instanceof CustomerIdentityRepositoryError ? error : null;
    return Response.json(
      {
        accepted: false,
        error: {
          code: repositoryError ? `CUSTOMER_CONSENT_${repositoryError.code}` : "CUSTOMER_CONSENT_INPUT_INVALID",
          message: repositoryError?.message ?? "Lựa chọn quyền riêng tư không hợp lệ.",
        },
      },
      {
        status: repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED" ? 503 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
