import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020026_erp_demo_rebase_timeline.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP demo timeline rebase migration 026 contract", () => {
  it("applies atomically and adds no table", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toContain("create table");
  });

  it("is hardened like every other RPC in this system", () => {
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
    expect(compact).toContain(
      "revoke all on function public.erp_demo_rebase_timeline() from public",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_demo_rebase_timeline() from anon",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_demo_rebase_timeline() from authenticated",
    );
    expect(compact).toContain(
      "grant execute on function public.erp_demo_rebase_timeline() to service_role",
    );
  });

  it("never moves time backwards", () => {
    // Running it twice in a day has to be a no-op; a negative shift would
    // rewrite a demo into the past and make already-closed records reopen.
    expect(compact).toContain("if v_shift <= 0 then");
    expect(compact).toContain("'ALREADY_CURRENT'");
  });

  it("touches only seeded fixtures, never a record a real action produced", () => {
    // Every UPDATE must carry a narrow identity predicate. This is the same
    // rule the purge migrations follow: no time ranges, no whole tables.
    const statements = sql.split(/^\s*update public\./m).slice(1);
    expect(statements.length).toBeGreaterThanOrEqual(7);

    for (const statement of statements) {
      const body = statement.split(/;\s*$/m)[0];
      expect(body).toContain("tenant_id = v_tenant");
      const hasIdentityPredicate =
        /id::text like '[0-9a-f-]+%'/.test(body) ||
        /id like 'INC-%'/.test(body) ||
        /code like 'EV-%'/.test(body);
      expect(
        hasIdentityPredicate,
        `update without a fixture predicate:\n${body.slice(0, 200)}`,
      ).toBe(true);
    }
  });

  it("only de-escalates incidents that are genuinely no longer overdue", () => {
    // A demo with zero problems in it is not a believable demo, and clearing
    // an escalation that is still true would be lying about the data.
    expect(compact).toContain(
      "now() <= reported_at_ts + make_interval(mins => sla_minutes)",
    );
    // It strips the machine's own timeline entry, not a human's.
    expect(compact).toContain("'Chuyển cấp tự động'");
  });

  it("shifts whole days so shift labels and times stay coherent", () => {
    expect(compact).toContain("make_interval(days => v_shift)");
    expect(compact).not.toContain("make_interval(hours =>");
  });
});
