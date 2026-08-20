import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202608200045_erp_offline_gate_sync.sql", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-08 offline gate migration 045", () => {
  it("is atomic, RLS protected, append-only and service-role RPC only", () => {
    expect(compact.startsWith("-- CUS-08 / A3:") && compact.endsWith("commit;")).toBe(true);
    for (const table of ["erp_gate_offline_manifests", "erp_gate_offline_sync_batches", "erp_gate_offline_sync_items"]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("from public, anon, authenticated, service_role;");
    expect(compact).not.toContain("grant insert on table");
    expect(compact.match(/execute function public.customer_append_only\(\)/g)?.length).toBe(3);
  });

  it("preloads only code digests and remaining entries, never guest PII", () => {
    const manifestFunction = sql.match(/create or replace function public\.erp_prepare_offline_gate_manifest[\s\S]*?\n\$\$;/)?.[0] ?? "";
    expect(manifestFunction).toContain("extensions.digest(upper(trim(ticket.ticket_code)), 'sha256')");
    expect(manifestFunction).toContain("ticket.entries_allowed - ticket.entries_used");
    expect(manifestFunction).not.toMatch(/guest_name|guest_phone|booking_reference/);
  });

  it("shares one T8 decision function for online and delayed offline scans", () => {
    expect(compact).toContain("create or replace function public.erp_gate_scan_ticket_at(");
    expect(compact).toContain("p_scanned_at at time zone 'Asia/Ho_Chi_Minh'");
    expect(compact).toContain("select public.erp_gate_scan_ticket_at(");
    expect(compact).toContain("entries_used = entries_used + 1");
    expect(compact).toContain("for update;");
    expect(compact).toContain("GATE_SCAN_IDEMPOTENCY_CONFLICT");
  });

  it("retries a batch exactly once and records local/server divergence", () => {
    const scanFunction = sql.match(/create or replace function public\.erp_gate_scan_ticket_at[\s\S]*?\n\$\$;/)?.[0] ?? "";
    const batchFunction = sql.match(/create or replace function public\.erp_sync_offline_gate_batch[\s\S]*?\n\$\$;/)?.[0] ?? "";
    expect(compact).toContain("pg_advisory_xact_lock");
    expect(compact).toContain("unique (tenant_id, idempotency_key)");
    expect(compact).toContain("reconciliation_status in ('matched', 'diverged')");
    expect(compact).toContain("v_server_result = v_item.value ->> 'local_result'");
    expect(compact).toContain("jsonb_array_length(p_scans)");
    expect(compact).toContain("v_count not between 1 and 200");
    expect(compact).toContain("'replayed_batch', true, 'items', v_results");
    expect(scanFunction).not.toContain("v_results");
    expect(batchFunction).toContain("from public.erp_gate_offline_sync_items item");
    expect(batchFunction.match(/public\.erp_gate_actor_can_scan/g)?.length).toBe(2);
    expect(batchFunction.indexOf("from public.erp_gate_offline_sync_items item"))
      .toBeLessThan(batchFunction.indexOf("'replayed_batch', true, 'items', v_results"));
  });

  it("does not create a second ticket or capacity source", () => {
    expect(compact).not.toContain("create table if not exists public.erp_tickets");
    expect(compact).not.toContain("create table if not exists public.customer_booking_slots");
    expect(compact).not.toContain("alter table public.customer_booking_slots");
  });
});
