import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608010014_erp_role_switch_audit.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function functionBlock(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return sql.slice(start, end + 4).replace(/\s+/g, " ");
}

describe("ERP role switch audit migration 014 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("locks down erp_role_switch_audit to service-role read only, insert only through the RPC", () => {
    expect(compact).toContain(
      "create table if not exists public.erp_role_switch_audit",
    );
    expect(compact).toContain(
      "alter table public.erp_role_switch_audit enable row level security;",
    );
    expect(compact).toContain(
      "revoke all on table public.erp_role_switch_audit from public, anon, authenticated, service_role;",
    );
    expect(compact).not.toContain(
      "grant insert on table public.erp_role_switch_audit",
    );
    expect(compact).not.toContain(
      "grant update on table public.erp_role_switch_audit",
    );
    expect(compact).not.toContain(
      "grant delete on table public.erp_role_switch_audit",
    );
  });

  it("the RPC validates actor identity, target role and action before inserting", () => {
    const fn = functionBlock("erp_record_role_switch");
    expect(fn).toContain("message = 'ROLE_SWITCH_ACTOR_INVALID'");
    expect(fn).toContain("message = 'ROLE_SWITCH_TENANT_MISMATCH'");
    for (const role of ["employee", "manager", "accountant", "chief-accountant"]) {
      expect(fn).toContain(`'${role}'`);
    }
    expect(fn).toContain("v_action not in ('started', 'ended')");
  });

  it("exposes the mutation RPC only to the server service role", () => {
    const signature =
      "public.erp_record_role_switch(uuid, text, text, text, text, text, text)";
    expect(compact).toContain(
      `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
    );
    expect(compact).toContain(
      `grant execute on function ${signature} to service_role;`,
    );
  });

  it("does not itself grant or check any application permission -- audit trail only", () => {
    // This table/RPC must never become a second source of truth for what an
    // account can do; permission checks live entirely in
    // lib/erp/demo-session.ts (startRoleSwitch/endRoleSwitch) and the
    // existing accountCanAccessSite/accountCanAccessModule checks.
    expect(compact).not.toContain("module_ids");
    expect(compact).not.toContain("site_id");
  });
});
