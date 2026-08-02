import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020028_erp_ticket_validation.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP ticket validation migration 028 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("gives the gate something real to check against", () => {
    expect(compact).toContain("create table if not exists public.erp_tickets");
    // A ticket code is unique per tenant, so the same code cannot be issued
    // twice and then admitted twice.
    expect(compact).toContain("unique (tenant_id, ticket_code)");
    // The scan log finally points at a ticket instead of holding loose text.
    expect(compact).toContain(
      "add column if not exists ticket_id uuid references public.erp_tickets(id)",
    );
  });

  it("counts entries instead of guessing from a time window", () => {
    // The old defence was "same code within 2 minutes is a double-tap", which
    // both admitted a genuine second visitor on a group pass and let the same
    // ticket back in 121 seconds later.
    expect(compact).toContain("entries_used <= entries_allowed");
    expect(compact).toContain("entries_used = entries_used + 1");
    // Decided under a row lock: two lanes must not both see the last entry.
    expect(compact).toContain("for update");
  });

  it("makes a retry harmless", () => {
    expect(compact).toContain("erp_gate_scan_events_idempotency_idx");
    expect(compact).toContain("where idempotency_key is not null");
    expect(compact).toContain("'replayed', true");
  });

  it("records refusals, not only admissions", () => {
    for (const result of [
      "'accepted'",
      "'not-found'",
      "'wrong-site'",
      "'wrong-day'",
      "'exhausted'",
      "'void'",
    ]) {
      expect(compact, `missing outcome ${result}`).toContain(result);
    }
    // Scans taken before T8 must not be relabelled as verified admissions.
    expect(compact).toContain("'legacy-uncheckable'");
  });

  it("keeps the new surface hardened and service-role only", () => {
    expect(compact).toContain("alter table public.erp_tickets enable row level security");
    expect(compact).toContain(
      "revoke all on table public.erp_tickets from public, anon, authenticated, service_role",
    );
    expect(compact).toContain("grant select on table public.erp_tickets to service_role");
    const fn = sql.match(/create or replace function[\s\S]*?\n\$\$;/g) ?? [];
    expect(fn.length).toBeGreaterThanOrEqual(1);
    for (const block of fn) {
      expect(block).toContain("security definer");
      expect(block).toContain("set search_path = ''");
    }
    expect(compact).toContain(
      "grant execute on function public.erp_gate_scan_ticket(uuid, uuid, text, text, text, text) to service_role",
    );
  });
});
