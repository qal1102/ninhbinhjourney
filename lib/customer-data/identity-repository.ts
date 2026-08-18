import "server-only";

import {
  createCipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeCustomerContact,
  type CustomerIdentityType,
} from "@/domain/customer-identity";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CustomerIdentityRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "INPUT_INVALID"
      | "PROFILE_NOT_FOUND"
      | "JOURNEY_NOT_OWNED"
      | "MERGE_REVIEW_REQUIRED"
      | "ID_COLLISION"
      | "RATE_LIMITED"
      | "PERMISSION_DENIED"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomerIdentityRepositoryError";
  }
}

export function isCustomerConsentManagementEnabled() {
  return process.env.CUSTOMER_CONSENT_MANAGEMENT_ENABLED?.trim() === "true";
}

export function isCustomerIdentityCollectionEnabled() {
  return process.env.CUSTOMER_IDENTITY_COLLECTION_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CustomerIdentityRepositoryError(
      "Kho định danh khách hàng chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-customer-identity-server" } },
  });
}

function policyVersion(name: "analytics" | "service" | "marketing") {
  const key = `CUSTOMER_${name.toUpperCase()}_POLICY_VERSION`;
  const configured = process.env[key]?.trim();
  if (configured && configured.length <= 80) return configured;
  if (process.env.NODE_ENV !== "production") return `staged-${name}-v1`;
  throw new CustomerIdentityRepositoryError(
    `Thiếu phiên bản chính sách ${name} phía máy chủ.`,
    "CONFIGURATION_MISSING",
  );
}

function mapRepositoryError(error: unknown): CustomerIdentityRepositoryError {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("CUSTOMER_PREFERENCES_INPUT_INVALID") || message.includes("CUSTOMER_CONTACT_INPUT_INVALID")) {
    return new CustomerIdentityRepositoryError("Thông tin quyền riêng tư hoặc liên hệ không hợp lệ.", "INPUT_INVALID");
  }
  if (message.includes("CUSTOMER_PROFILE_NOT_FOUND")) {
    return new CustomerIdentityRepositoryError("Chưa tìm thấy hồ sơ ẩn danh của hành trình này.", "PROFILE_NOT_FOUND");
  }
  if (message.includes("CUSTOMER_JOURNEY_OWNERSHIP_REQUIRED")) {
    return new CustomerIdentityRepositoryError("Hành trình không thuộc phiên khách hiện tại.", "JOURNEY_NOT_OWNED");
  }
  if (message.includes("CUSTOMER_IDENTITY_MERGE_REVIEW_REQUIRED")) {
    return new CustomerIdentityRepositoryError("Liên hệ này cần được kiểm tra hợp nhất hồ sơ trước khi dùng.", "MERGE_REVIEW_REQUIRED");
  }
  if (message.includes("CUSTOMER_CONTACT_ID_COLLISION")) {
    return new CustomerIdentityRepositoryError("Mã gửi lại đã được dùng cho một yêu cầu khác.", "ID_COLLISION");
  }
  if (message.includes("CUSTOMER_CONTACT_RATE_LIMITED")) {
    return new CustomerIdentityRepositoryError("Đã có quá nhiều yêu cầu lưu hành trình trong một giờ.", "RATE_LIMITED");
  }
  if (message.includes("CUSTOMER_360_DIRECTOR_REQUIRED")) {
    return new CustomerIdentityRepositoryError("Chỉ giám đốc được đọc dữ liệu khách hàng đã bảo vệ.", "PERMISSION_DENIED");
  }
  return new CustomerIdentityRepositoryError(
    "Kho định danh khách hàng tạm thời chưa ghi nhận được yêu cầu.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

function contactProtectionConfig() {
  const encodedKey = process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64?.trim();
  const hashKey = process.env.CUSTOMER_IDENTITY_HASH_KEY?.trim();
  const keyVersion = process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION?.trim();
  let encryptionKey: Buffer | null = null;
  if (encodedKey) {
    try {
      const candidate = Buffer.from(encodedKey, "base64");
      if (candidate.length === 32) encryptionKey = candidate;
    } catch {
      encryptionKey = null;
    }
  }
  if (!encryptionKey || !hashKey || hashKey.length < 32 || !keyVersion || keyVersion.length > 40) {
    throw new CustomerIdentityRepositoryError(
      "Kho liên hệ chưa có khóa mã hóa và khóa băm hợp lệ.",
      "CONFIGURATION_MISSING",
    );
  }
  return { encryptionKey, hashKey, keyVersion };
}

export function protectCustomerContact(raw: string): {
  identityType: CustomerIdentityType;
  digest: string;
  ciphertext: string;
  keyVersion: string;
} {
  let parsed: ReturnType<typeof normalizeCustomerContact>;
  try {
    parsed = normalizeCustomerContact(raw);
  } catch {
    throw new CustomerIdentityRepositoryError(
      "Hãy nhập một email hoặc số điện thoại Việt Nam hợp lệ.",
      "INPUT_INVALID",
    );
  }
  const { encryptionKey, hashKey, keyVersion } = contactProtectionConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  cipher.setAAD(Buffer.from(`nbj-customer-contact:${parsed.identityType}:${keyVersion}`));
  const encrypted = Buffer.concat([
    cipher.update(parsed.normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const ciphertext = [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
  const digest = createHmac("sha256", hashKey)
    .update(`${parsed.identityType}:${parsed.normalized}`)
    .digest("hex");
  return { identityType: parsed.identityType, digest, ciphertext, keyVersion };
}

export type CustomerConsentSnapshot = {
  product_analytics: "granted" | "denied" | "revoked";
  marketing_communications: "granted" | "denied" | "revoked";
  policy_version: string;
};

export async function recordCustomerPreferences(input: {
  anonymousId: string;
  productAnalytics: boolean;
  marketingCommunications: boolean;
}) {
  const analyticsPolicy = policyVersion("analytics");
  const marketingPolicy = policyVersion("marketing");
  const { data, error } = await createAdminClient().rpc("customer_record_web_preferences", {
    p_tenant_id: TENANT_ID,
    p_anonymous_id: input.anonymousId,
    p_product_analytics_enabled: input.productAnalytics,
    p_marketing_enabled: input.marketingCommunications,
    p_analytics_policy_version: analyticsPolicy,
    p_marketing_policy_version: marketingPolicy,
    p_occurred_at: new Date().toISOString(),
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);
  return {
    product_analytics: String(row.analytics_status) as CustomerConsentSnapshot["product_analytics"],
    marketing_communications: String(row.marketing_status) as CustomerConsentSnapshot["marketing_communications"],
    policy_version: analyticsPolicy,
    marketing_policy_version: marketingPolicy,
    inserted: row.inserted === true,
  };
}

export async function submitCustomerContact(input: {
  requestId: string;
  journeyId: string;
  anonymousId: string;
  contact: string;
  marketingCommunications: boolean;
}) {
  const protectedContact = protectCustomerContact(input.contact);
  const marketingPolicyVersion = policyVersion("marketing");
  const { data, error } = await createAdminClient().rpc("customer_submit_progressive_identity", {
    p_tenant_id: TENANT_ID,
    p_request_id: input.requestId,
    p_journey_id: input.journeyId,
    p_anonymous_id: input.anonymousId,
    p_identity_type: protectedContact.identityType,
    p_identity_digest: protectedContact.digest,
    p_identity_ciphertext: protectedContact.ciphertext,
    p_encryption_key_version: protectedContact.keyVersion,
    p_marketing_enabled: input.marketingCommunications,
    p_service_policy_version: policyVersion("service"),
    p_marketing_policy_version: marketingPolicyVersion,
    p_occurred_at: new Date().toISOString(),
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);
  return {
    requestId: String(row.delivery_request_id),
    deliveryStatus: String(row.delivery_status) as "staged",
    contactType: protectedContact.identityType,
    marketingStatus: String(row.marketing_status),
    marketingPolicyVersion,
    duplicate: row.inserted !== true,
  };
}

export async function auditCustomer360Access(actorAccountId: string) {
  const { data, error } = await createAdminClient().rpc("customer_audit_360_access", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: actorAccountId,
  });
  if (error || !data) throw mapRepositoryError(error);
  return String(data);
}
