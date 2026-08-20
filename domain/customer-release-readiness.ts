export type CustomerReleasePhaseId = "CUS-01" | "CUS-03" | "CUS-04" | "CUS-05" | "CUS-06" | "CUS-07" | "CUS-08";

export type CustomerReleaseTableProbe = {
  table: string;
  columns: string;
};

export type CustomerReleasePhase = {
  id: CustomerReleasePhaseId;
  migration: string;
  label: string;
  probes: readonly CustomerReleaseTableProbe[];
};

export const CUSTOMER_RELEASE_PHASES: readonly CustomerReleasePhase[] = [
  {
    id: "CUS-01",
    migration: "202608180039_customer_data_backbone.sql",
    label: "Identity, consent và event backbone",
    probes: [
      { table: "customer_profiles", columns: "id,tenant_id,anonymous_id" },
      { table: "customer_identities", columns: "id,profile_id,identity_type" },
      { table: "customer_consents", columns: "id,profile_id,purpose,status" },
      { table: "customer_sessions", columns: "id,profile_id,anonymous_id" },
      { table: "customer_events", columns: "event_id,profile_id,event_name" },
    ],
  },
  {
    id: "CUS-03",
    migration: "202608180040_customer_anonymous_journeys.sql",
    label: "Anonymous journey và Customer 360",
    probes: [{ table: "customer_journeys", columns: "id,profile_id,source_context" }],
  },
  {
    id: "CUS-04",
    migration: "202608180041_marketing_dynamic_qr.sql",
    label: "Dynamic QR và attribution",
    probes: [
      { table: "marketing_campaigns", columns: "id,tenant_id,name" },
      { table: "marketing_qr_sources", columns: "id,campaign_id,code" },
      { table: "marketing_qr_scans", columns: "id,qr_source_id,occurred_at" },
      { table: "marketing_qr_audit_events", columns: "id,event_type,occurred_at" },
    ],
  },
  {
    id: "CUS-05",
    migration: "202608180042_customer_progressive_identity.sql",
    label: "Progressive identity và protected contact",
    probes: [
      { table: "customer_itinerary_delivery_requests", columns: "id,profile_id,status" },
      { table: "customer_segments", columns: "id,profile_id,segment_key" },
      { table: "customer_identity_audit_events", columns: "id,profile_id,event_type" },
    ],
  },
  {
    id: "CUS-06",
    migration: "202608200043_customer_booking_on_erp_core.sql",
    label: "Booking trên lõi T8/T11a",
    probes: [
      { table: "customer_product_capacity_templates", columns: "tenant_id,product_id,site_id" },
      { table: "customer_booking_slots", columns: "id,site_id,capacity_snapshot" },
      { table: "customer_orders", columns: "id,profile_id,status" },
      { table: "customer_order_lines", columns: "id,order_id,product_id" },
      { table: "customer_booking_holds", columns: "id,profile_id,status" },
      { table: "customer_booking_hold_slots", columns: "hold_id,slot_id,quantity" },
      { table: "customer_payment_attempts", columns: "id,hold_id,status" },
      { table: "customer_order_tickets", columns: "order_id,ticket_id,slot_id" },
      { table: "customer_commerce_audit_events", columns: "id,event_type,occurred_at" },
    ],
  },
  {
    id: "CUS-07",
    migration: "202608200044_customer_recommendations_outbound_queue.sql",
    label: "Recommendation và outbound queue staged",
    probes: [
      { table: "customer_recommendation_rules", columns: "id,rule_key,rule_version" },
      { table: "customer_recommendations", columns: "id,profile_id,reason_code" },
      { table: "customer_outbound_actions", columns: "id,profile_id,status" },
      { table: "customer_outbound_action_events", columns: "id,action_id,event_type" },
    ],
  },
  {
    id: "CUS-08",
    migration: "202608200045_erp_offline_gate_sync.sql",
    label: "Offline gate và unified funnel",
    probes: [
      { table: "erp_gate_offline_manifests", columns: "id,site_id,device_id" },
      { table: "erp_gate_offline_sync_batches", columns: "id,manifest_id,item_count" },
      { table: "erp_gate_offline_sync_items", columns: "id,batch_id,reconciliation_status" },
    ],
  },
] as const;

export const CUSTOMER_RELEASE_FLAGS = [
  { name: "CUSTOMER_DATA_INGESTION_ENABLED", phases: ["CUS-01"], dependsOn: [] },
  { name: "CUSTOMER_JOURNEY_PERSISTENCE_ENABLED", phases: ["CUS-01", "CUS-03"], dependsOn: ["CUSTOMER_DATA_INGESTION_ENABLED"] },
  { name: "CUSTOMER_QR_ROUTING_ENABLED", phases: ["CUS-01", "CUS-04"], dependsOn: ["CUSTOMER_DATA_INGESTION_ENABLED"] },
  { name: "CUSTOMER_CONSENT_MANAGEMENT_ENABLED", phases: ["CUS-01", "CUS-03", "CUS-05"], dependsOn: ["CUSTOMER_JOURNEY_PERSISTENCE_ENABLED"] },
  { name: "NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED", phases: ["CUS-01", "CUS-05"], dependsOn: ["CUSTOMER_DATA_INGESTION_ENABLED", "CUSTOMER_CONSENT_MANAGEMENT_ENABLED"] },
  { name: "CUSTOMER_IDENTITY_COLLECTION_ENABLED", phases: ["CUS-01", "CUS-03", "CUS-05"], dependsOn: ["CUSTOMER_CONSENT_MANAGEMENT_ENABLED"] },
  { name: "CUSTOMER_BOOKING_ENABLED", phases: ["CUS-01", "CUS-03", "CUS-06"], dependsOn: ["CUSTOMER_JOURNEY_PERSISTENCE_ENABLED"] },
  { name: "CUSTOMER_RECOMMENDATIONS_ENABLED", phases: ["CUS-01", "CUS-03", "CUS-05", "CUS-06", "CUS-07"], dependsOn: ["CUSTOMER_CONSENT_MANAGEMENT_ENABLED", "CUSTOMER_IDENTITY_COLLECTION_ENABLED", "CUSTOMER_BOOKING_ENABLED"] },
  { name: "ERP_OFFLINE_GATE_ENABLED", phases: ["CUS-08"], dependsOn: [] },
  { name: "CUSTOMER_FUNNEL_DASHBOARD_ENABLED", phases: ["CUS-01", "CUS-03", "CUS-04", "CUS-06", "CUS-08"], dependsOn: ["CUSTOMER_DATA_INGESTION_ENABLED", "CUSTOMER_QR_ROUTING_ENABLED", "CUSTOMER_BOOKING_ENABLED"] },
] as const;

export type CustomerReleaseEnvironmentCheck = {
  id: string;
  label: string;
  ready: boolean;
};

export type CustomerReleaseFlagState = {
  name: string;
  enabled: boolean;
  ready: boolean;
  blockers: string[];
};

function configured(value: string | undefined, max = 200) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && trimmed.length <= max;
}

function approvedPolicy(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 && normalized.length <= 80 && !normalized.includes("draft") && !normalized.includes("staged");
}

function validHttpsUrl(value: string | undefined, expectedHost?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && (!expectedHost || url.hostname === expectedHost);
  } catch {
    return false;
  }
}

function validEncryptionKey(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(normalized)) return false;
  return (normalized.length * 3) / 4 - 1 === 32;
}

export function inspectCustomerReleaseEnvironment(env: Record<string, string | undefined>): CustomerReleaseEnvironmentCheck[] {
  return [
    { id: "vercel-production", label: "Vercel đang ở production environment", ready: env.VERCEL_ENV === "production" },
    { id: "production-project", label: "Đúng project production ninhbinhjourney", ready: (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim() === "ninhbinhjourney.vercel.app" },
    { id: "site-origin", label: "NEXT_PUBLIC_SITE_URL trỏ đúng production origin", ready: validHttpsUrl(env.NEXT_PUBLIC_SITE_URL, "ninhbinhjourney.vercel.app") },
    { id: "experience-mode", label: "Public experience mode là production", ready: env.NEXT_PUBLIC_EXPERIENCE_MODE?.trim() === "production" },
    { id: "brand-concepts", label: "Brand concepts thử nghiệm đã tắt", ready: env.NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED?.trim() === "false" },
    { id: "supabase-url", label: "Supabase URL hợp lệ", ready: validHttpsUrl(env.NEXT_PUBLIC_SUPABASE_URL) },
    { id: "supabase-publishable", label: "Supabase publishable key đã cấu hình", ready: configured(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 500) },
    { id: "supabase-secret", label: "Supabase server secret đã cấu hình", ready: configured(env.SUPABASE_SECRET_KEY, 1000) },
    { id: "erp-persistence", label: "ERP production dùng Supabase persistence", ready: env.ERP_PERSISTENCE_MODE?.trim() === "supabase" },
    { id: "analytics-policy", label: "Analytics policy version không còn draft/staged", ready: approvedPolicy(env.CUSTOMER_ANALYTICS_POLICY_VERSION) },
    { id: "service-policy", label: "Service policy version không còn draft/staged", ready: approvedPolicy(env.CUSTOMER_SERVICE_POLICY_VERSION) },
    { id: "marketing-policy", label: "Marketing policy version không còn draft/staged", ready: approvedPolicy(env.CUSTOMER_MARKETING_POLICY_VERSION) },
    { id: "contact-encryption", label: "Contact encryption key đúng 32 byte", ready: validEncryptionKey(env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64) },
    { id: "identity-hash", label: "Identity HMAC key đạt tối thiểu 32 ký tự", ready: (env.CUSTOMER_IDENTITY_HASH_KEY?.trim().length ?? 0) >= 32 },
    { id: "contact-key-version", label: "Contact key version hợp lệ", ready: configured(env.CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION, 40) },
  ];
}

export function inspectCustomerReleaseFlags(
  env: Record<string, string | undefined>,
  phaseReady: Readonly<Record<CustomerReleasePhaseId, boolean>>,
): CustomerReleaseFlagState[] {
  return CUSTOMER_RELEASE_FLAGS.map((flag) => {
    const enabled = env[flag.name]?.trim() === "true";
    const blockers = [
      ...flag.phases.filter((phase) => !phaseReady[phase]).map((phase) => `${phase} schema chưa sẵn sàng`),
      ...flag.dependsOn.filter((dependency) => env[dependency]?.trim() !== "true").map((dependency) => `${dependency} chưa bật`),
      ...(flag.name === "ERP_OFFLINE_GATE_ENABLED" && env.ERP_PERSISTENCE_MODE?.trim() !== "supabase"
        ? ["ERP_PERSISTENCE_MODE chưa là supabase"]
        : []),
    ];
    return { name: flag.name, enabled, ready: blockers.length === 0, blockers };
  });
}
