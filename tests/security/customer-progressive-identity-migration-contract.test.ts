import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608180042_customer_progressive_identity.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-05 progressive identity migration 042 contract", () => {
  it("is atomic and adds staged delivery, versioned segments and immutable access audit", () => {
    expect(compact.startsWith("-- CUS-05:")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    for (const table of ["customer_itinerary_delivery_requests", "customer_segments", "customer_identity_audit_events"]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("customer_delivery_requests_append_only before update or delete");
    expect(compact).toContain("customer_identity_audit_append_only before update or delete");
    expect(compact).toContain("sequence_no bigint generated always as identity");
  });

  it("keeps service, analytics and marketing decisions separate and makes revocation deactivate marketing", () => {
    expect(compact).toContain("'product_analytics'");
    expect(compact).toContain("'marketing_communications'");
    expect(compact).toContain("'essential_service', 'granted'");
    expect(compact).toContain("when v_current_marketing.status in ('granted', 'revoked') then 'revoked'");
    expect(compact).toContain("v_marketing_status = 'granted' and v_has_identity");
    expect(compact).toContain("segment_key, rule_version, active");
  });

  it("links only protected contact, uses controlled merge and never stores contact in evidence", () => {
    expect(compact).toContain("p_identity_digest !~ '^[0-9a-f]{64}$'");
    expect(compact).toContain("p_identity_ciphertext");
    expect(compact).toContain("CUSTOMER_IDENTITY_MERGE_REVIEW_REQUIRED");
    expect(compact).toContain("CUSTOMER_JOURNEY_OWNERSHIP_REQUIRED");
    expect(compact).toContain("v_existing_request.profile_id <> v_source_canonical_id");
    expect(compact).not.toMatch(/jsonb_build_object\([^)]*p_identity_ciphertext/i);
    expect(compact).not.toMatch(/jsonb_build_object\([^)]*p_identity_digest/i);
  });

  it("audits Customer 360 reads and exposes writes only through service-role RPCs", () => {
    expect(compact).toContain("public.erp_account_has_active_role(");
    expect(compact).toContain("'director', null");
    expect(compact).toContain("'customer-360-viewed'");
    expect(compact).toContain("from public, anon, authenticated, service_role;");
    expect(compact).toContain("public.customer_submit_progressive_identity(");
    expect(compact).not.toContain("grant insert on table public.customer_identities");
  });
});
