import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608070037_erp_capacity_thresholds.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP capacity migration 037 contract", () => {
  it("applies atomically", () => {
    expect(compact.startsWith("-- T11a:")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("derives hourly capacity from physical inputs in the database", () => {
    expect(compact).toContain("hourly_capacity integer generated always as");
    expect(compact).toContain("vehicle_count::numeric * seats_per_vehicle::numeric * 60::numeric");
    expect(compact).toContain("/ round_trip_minutes");
    expect(compact).toContain("floor(");
  });

  it("requires a declared source and seeds only transparent estimates", () => {
    expect(compact).toContain("source_kind in ('estimate', 'customer', 'measured')");
    expect(compact).toContain("source_note text not null");
    expect(compact).toContain("'estimate'");
    expect(compact).toContain("chưa được khách xác nhận");
  });

  it("serializes director-only updates with optimistic concurrency", () => {
    expect(compact).toContain("for update;");
    expect(compact).toContain("'director'");
    expect(compact).toContain("'CAPACITY_DIRECTOR_REQUIRED'");
    expect(compact).toContain("'CAPACITY_VERSION_CONFLICT'");
    expect(compact).toContain("version = version + 1");
  });

  it("defines four response bands with an action, owner and SLA", () => {
    for (const level of ["green", "yellow", "orange", "red"]) {
      expect(compact).toContain(`('${level}',`);
    }
    for (const column of ["action_text", "owner_role", "sla_minutes"]) {
      expect(compact).toContain(column);
    }
  });

  it("keeps configuration history append-only", () => {
    expect(compact).toContain("create table if not exists public.erp_capacity_audit_events");
    expect(compact).toContain("before update or delete on public.erp_capacity_audit_events");
    expect(compact).toContain("'CAPACITY_AUDIT_IMMUTABLE'");
    expect(compact).toContain("'before', jsonb_build_object(");
    expect(compact).toContain("'after', jsonb_build_object(");
  });

  it("keeps tables behind RLS and exposes writes only through the RPC", () => {
    for (const table of [
      "erp_capacity_thresholds",
      "erp_capacity_response_rules",
      "erp_capacity_audit_events",
    ]) {
      expect(compact).toContain(`alter table public.${table} enable row level security`);
      expect(compact).toContain(`revoke all on table public.${table} from public, anon, authenticated, service_role`);
      expect(compact).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
    expect(compact).toContain("grant execute on function public.erp_capacity_update_threshold(");
  });
});
