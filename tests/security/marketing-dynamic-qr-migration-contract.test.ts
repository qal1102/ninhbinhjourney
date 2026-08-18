import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608180041_marketing_dynamic_qr.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-04 dynamic QR migration 041 contract", () => {
  it("creates one production-shaped campaign/source/scan lineage atomically", () => {
    expect(compact.startsWith("-- CUS-04:")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    for (const table of ["marketing_campaigns", "marketing_qr_sources", "marketing_qr_scans", "marketing_qr_audit_events"]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("references public.marketing_campaigns(id, tenant_id)");
    expect(compact).toContain("references public.marketing_qr_sources(id, tenant_id)");
  });

  it("prevents open redirects and keeps scan/audit history append-only", () => {
    expect(compact).toContain("destination_path like '/%'");
    expect(compact).toContain("destination_path not like '//%'");
    expect(compact).toContain("position('://' in destination_path) = 0");
    expect(compact).toContain("marketing_qr_scans_append_only before update or delete");
    expect(compact).toContain("marketing_qr_audit_append_only before update or delete");
  });

  it("uses service-only RPCs with optimistic destination updates and no direct writes", () => {
    for (const rpc of ["marketing_create_campaign", "marketing_create_qr_source", "marketing_update_qr_destination", "marketing_resolve_qr_redirect"]) {
      expect(compact).toContain(`create or replace function public.${rpc}(`);
    }
    expect(compact).toContain("security definer set search_path = ''");
    expect(compact).toContain("MARKETING_QR_VERSION_CONFLICT");
    expect(compact).toContain("MARKETING_QR_NOT_ACTIVE");
    expect(compact).toContain("revoke all on table public.marketing_campaigns, public.marketing_qr_sources,");
    expect(compact).toContain("grant select on table public.marketing_campaigns, public.marketing_qr_sources,");
    expect(compact).not.toContain("grant insert on table public.marketing_qr_scans");
  });
});
