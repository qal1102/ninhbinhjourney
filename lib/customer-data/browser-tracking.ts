export const CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY =
  "nbj-customer-analytics-consent";
export const CUSTOMER_ANONYMOUS_ID_STORAGE_KEY = "nbj-customer-anonymous-id";
export const CUSTOMER_SESSION_ID_STORAGE_KEY = "nbj-customer-session-id";
export const CUSTOMER_CONSENT_CHANGED_EVENT = "nbj-customer-consent-changed";

export type CustomerConsentStatus =
  | "granted"
  | "denied"
  | "revoked"
  | "not-requested";

export type CustomerConsentPreferences = {
  product_analytics: CustomerConsentStatus;
  marketing_communications: CustomerConsentStatus;
  essential_service?: CustomerConsentStatus;
  policy_version: string;
  marketing_policy_version?: string;
};

export type CustomerAnalyticsConsent = {
  product_analytics: "granted";
  policy_version: string;
  essential_service?: "granted" | "denied" | "revoked" | "not-requested";
  marketing_communications?:
    | "granted"
    | "denied"
    | "revoked"
    | "not-requested";
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateCustomerAnonymousId(storage: Storage) {
  const existing = storage.getItem(CUSTOMER_ANONYMOUS_ID_STORAGE_KEY);
  if (existing && UUID_V4_PATTERN.test(existing)) return existing;
  const id = crypto.randomUUID();
  storage.setItem(CUSTOMER_ANONYMOUS_ID_STORAGE_KEY, id);
  return id;
}

const DIRECT_PII_PATTERN =
  /(^|[^\w.%+-])[\w.%+-]+@[\w.-]+\.[a-z]{2,}($|[^\w.%+-])|(^|\D)(?:\+?84|0)[\d .-]{8,12}($|\D)/i;

function safeValue(value: string | null) {
  const trimmed = value?.trim().slice(0, 160) ?? "";
  return trimmed && !DIRECT_PII_PATTERN.test(trimmed) ? trimmed : null;
}

export function getVisitorPageType(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname === "/explore") return "explore";
  if (pathname === "/plan") return "planner";
  if (pathname === "/packages") return "packages";
  if (pathname.startsWith("/packages/")) return "package";
  if (pathname.startsWith("/destination/")) return "destination";
  if (pathname.startsWith("/booking/")) return "booking";
  if (pathname.startsWith("/pass/")) return "pass";
  return null;
}

export function sourceContextFromBrowser(
  search: URLSearchParams,
  referrer: string,
  currentOrigin: string,
) {
  const source: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "qr_source_id",
    "campaign_id",
    "placement_id",
    "partner_id",
    "click_id",
  ] as const) {
    const value = safeValue(search.get(key));
    if (value) source[key] = value;
  }

  if (!source.utm_source) {
    const legacySource = safeValue(search.get("source"));
    if (legacySource) source.utm_source = legacySource;
  }

  let referrerClass = "direct";
  if (referrer) {
    try {
      referrerClass = new URL(referrer).origin === currentOrigin ? "internal" : "external";
    } catch {
      referrerClass = "unknown";
    }
  }
  source.referrer_class = referrerClass;
  return source;
}

export function parseCustomerConsentPreferences(raw: string | null) {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.policy_version !== "string" ||
      record.policy_version.trim().length === 0 ||
      record.policy_version.length > 80
    ) {
      return null;
    }

    const status = (key: string) => {
      const status = record[key];
      return status === "granted" ||
        status === "denied" ||
        status === "revoked" ||
        status === "not-requested"
        ? status
        : null;
    };

    const analytics = status("product_analytics");
    const marketing = status("marketing_communications") ?? "not-requested";
    if (!analytics) return null;

    return {
      product_analytics: analytics,
      marketing_communications: marketing,
      policy_version: record.policy_version.trim(),
      marketing_policy_version:
        typeof record.marketing_policy_version === "string"
          ? record.marketing_policy_version.trim().slice(0, 80)
          : undefined,
      essential_service: status("essential_service") ?? undefined,
    } satisfies CustomerConsentPreferences;
  } catch {
    return null;
  }
}

export function parseCustomerAnalyticsConsent(raw: string | null) {
  const preferences = parseCustomerConsentPreferences(raw);
  if (!preferences || preferences.product_analytics !== "granted") return null;
  return {
    product_analytics: "granted" as const,
    policy_version: preferences.policy_version,
    essential_service: preferences.essential_service,
    marketing_communications: preferences.marketing_communications,
  } satisfies CustomerAnalyticsConsent;
}

export function isCustomerAnalyticsEnabled() {
  return process.env.NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED === "true";
}
