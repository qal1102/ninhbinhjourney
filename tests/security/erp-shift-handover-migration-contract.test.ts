import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020029_erp_shift_handover.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP shift handover migration 029 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("refuses a handover signed by one person", () => {
    // A handover where the outgoing leader closes their own record is not a
    // handover. Enforced twice: as a table constraint and inside the RPC.
    expect(compact).toContain("check (outgoing_account_id <> incoming_account_id)");
    expect(compact).toContain("'SHIFT_HANDOVER_SAME_PERSON'");
    expect(compact).toContain("'SHIFT_HANDOVER_WRONG_ACTOR'");
    expect(compact).toContain("v_actor <> v_row.incoming_account_id");
  });

  it("carries the operational state across the shift boundary, not just money", () => {
    for (const column of [
      "cash_counted_vnd",
      "cash_expected_vnd",
      "open_incident_codes",
      "equipment_note",
      "handover_note",
    ]) {
      expect(compact, `missing ${column}`).toContain(column);
    }
    // The difference is derived, so it cannot be typed in wrong.
    expect(compact).toContain("cash_difference_vnd bigint generated always as");
  });

  it("makes a refusal explain itself", () => {
    expect(compact).toContain("'SHIFT_HANDOVER_DISPUTE_NEEDS_REASON'");
    expect(compact).toContain(
      "check (status <> 'disputed' or char_length(trim(coalesce(decision_note, ''))) >= 4)",
    );
  });

  it("survives a retry and a concurrent decision", () => {
    expect(compact).toContain("unique (tenant_id, idempotency_key)");
    // One handover per station per shift per day.
    expect(compact).toContain(
      "unique (tenant_id, site_id, business_date, shift_label, station_code)",
    );
    expect(compact).toContain("for update");
    expect(compact).toContain("'SHIFT_HANDOVER_VERSION_CONFLICT'");
  });

  it("keeps an append-only trail of who signed what", () => {
    expect(compact).toContain("create table if not exists public.erp_shift_handover_events");
    expect(compact).toContain("unique (handover_id, sequence_number)");
    for (const event of [
      "'handover.submitted'",
      "'handover.accepted'",
      "'handover.disputed'",
    ]) {
      expect(compact).toContain(event);
    }
  });

  it("keeps the new surface hardened and service-role only", () => {
    for (const table of ["erp_shift_handovers", "erp_shift_handover_events"]) {
      expect(compact).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role`,
      );
      expect(compact).toContain(`grant select on table public.${table} to service_role`);
    }
    const blocks = sql.match(/create or replace function[\s\S]*?\n\$\$;/g) ?? [];
    expect(blocks.length).toBe(2);
    for (const block of blocks) {
      expect(block).toContain("security definer");
      expect(block).toContain("set search_path = ''");
    }
    expect(compact).not.toMatch(/\bto anon\b/);
  });
});
