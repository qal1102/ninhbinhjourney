import { z } from "zod";

export const CUSTOMER_ANONYMOUS_COOKIE = "nbj-customer-journey-anonymous-id";
export const CUSTOMER_ANONYMOUS_COOKIE_SECONDS = 60 * 60 * 24 * 30;

export const CustomerConsentPreferenceRequestSchema = z
  .object({
    anonymous_id: z.string().uuid(),
    product_analytics: z.boolean(),
    marketing_communications: z.boolean(),
  })
  .strict();

export const CustomerContactRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    journey_id: z.string().uuid(),
    contact: z.string().trim().min(6).max(254),
    marketing_communications: z.boolean(),
  })
  .strict();

export type CustomerConsentPreferenceRequest = z.infer<
  typeof CustomerConsentPreferenceRequestSchema
>;
export type CustomerContactRequest = z.infer<typeof CustomerContactRequestSchema>;
export type CustomerIdentityType = "email" | "phone";

const EMAIL_SCHEMA = z.string().email().max(254);

export function normalizeCustomerContact(raw: string): {
  identityType: CustomerIdentityType;
  normalized: string;
} {
  const trimmed = raw.trim();
  const email = EMAIL_SCHEMA.safeParse(trimmed.toLowerCase());
  if (email.success) {
    return { identityType: "email", normalized: email.data };
  }

  const compact = trimmed.replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;
  if (!/^0\d{9}$/.test(normalized)) {
    throw new Error("CONTACT_INVALID");
  }
  return { identityType: "phone", normalized };
}

export function isSameOriginCustomerRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    origin === requestUrl.origin &&
    (!fetchSite || fetchSite === "same-origin")
  );
}

export function customerCookieHeader(anonymousId: string) {
  return `${CUSTOMER_ANONYMOUS_COOKIE}=${anonymousId}; Path=/; Max-Age=${CUSTOMER_ANONYMOUS_COOKIE_SECONDS}; SameSite=Lax; HttpOnly${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}
