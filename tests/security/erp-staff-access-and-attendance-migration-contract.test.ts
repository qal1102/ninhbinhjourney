import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607310009_erp_staff_access_and_attendance.sql",
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

describe("ERP staff access and attendance migration 009 contract", () => {
  it("applies atomically", () => {
    expect(compact.startsWith("-- Persist employee site/module access grants")).toBe(
      true,
    );
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("locks down erp_employee_access, its audit trail and erp_staff_attendance_events", () => {
    for (const table of [
      "erp_employee_access",
      "erp_employee_access_audit",
      "erp_staff_attendance_events",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table}`);
      expect(compact).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).not.toContain(`grant insert on table public.${table}`);
      expect(compact).not.toContain(`grant update on table public.${table}`);
      expect(compact).not.toContain(`grant delete on table public.${table}`);
    }
    expect(compact).toContain(
      "unique (tenant_id, idempotency_key)",
    );
  });

  it("only lets a manager or director mutate access through the RPC, scoped to the tenant's site", () => {
    const update = functionBlock("erp_update_employee_access");
    expect(update).toContain("v_role not in ('manager', 'director')");
    expect(update).toContain("message = 'EMPLOYEE_ACCESS_ACTOR_INVALID'");
    expect(update).toContain(
      "select 1 from public.sites s where s.id = p_site_context_id and s.tenant_id = p_tenant_id",
    );
    expect(update).toContain("message = 'EMPLOYEE_ACCESS_SITE_TENANT_MISMATCH'");
    expect(update).toContain("on conflict (employee_account_id) do update set");
    expect(update).toContain(
      "version = public.erp_employee_access.version + 1",
    );
    expect(update).toContain("insert into public.erp_employee_access_audit");
    expect(update).toContain(
      "case when p_site_active then 'employee.access.updated' else 'employee.site.revoked' end",
    );
  });

  it("records every access change even when revoking, always tied to the acting site context", () => {
    const update = functionBlock("erp_update_employee_access");
    expect(update).toContain(
      "v_site_id uuid := case when p_site_active then p_site_context_id else null end",
    );
    expect(update).toContain(
      "p_tenant_id, v_employee_id, p_site_context_id, v_actor_id, v_action",
    );
  });

  it("dedupes attendance writes by idempotency key and blocks double check-in/out", () => {
    const record = functionBlock("erp_record_attendance_event");
    expect(record).toContain(
      "where tenant_id = p_tenant_id and idempotency_key = v_key",
    );
    expect(record).toContain("if v_event.id is not null then return v_event; end if;");
    expect(record).toContain(
      "v_type = 'check-in' and v_last.event_type = 'check-in'",
    );
    expect(record).toContain("message = 'ATTENDANCE_ALREADY_CHECKED_IN'");
    expect(record).toContain(
      "v_type = 'check-out' and (v_last.id is null or v_last.event_type <> 'check-in')",
    );
    expect(record).toContain("message = 'ATTENDANCE_NO_OPEN_CHECK_IN'");
  });

  it("scopes the last-event lookup to the same tenant, user, site and business date", () => {
    const record = functionBlock("erp_record_attendance_event");
    expect(record).toContain("and user_account_id = v_user_id");
    expect(record).toContain("and site_id = p_site_id");
    expect(record).toContain("and business_date = p_business_date");
    expect(record).toContain("order by created_at desc");
  });

  it("never touches the pre-existing, unrelated erp_attendance_events table", () => {
    // A much earlier migration created erp_attendance_events (uuid user_id,
    // no business_date/idempotency_key) that nothing in the app reads or
    // writes. This migration must use its own erp_staff_attendance_events
    // table instead of colliding with or silently adopting that shape.
    expect(compact).not.toMatch(/\bpublic\.erp_attendance_events\b/);
  });

  it("exposes mutation RPCs only to the server service role", () => {
    for (const signature of [
      "public.erp_update_employee_access(uuid, text, uuid, boolean, text[], text, text)",
      "public.erp_record_attendance_event(uuid, uuid, text, text, double precision, double precision, double precision, text, date, text)",
    ]) {
      expect(compact).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${signature} to service_role;`,
      );
    }
  });
});
