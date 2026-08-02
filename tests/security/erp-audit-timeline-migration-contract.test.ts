import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608030033_erp_audit_timeline.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

const SNAPSHOT_TABLES = [
  "erp_account_admin_audit",
  "erp_accounting_audit_events",
  "erp_ap_audit_events",
  "erp_employee_access_audit",
  "erp_project_audit_events",
  "erp_shift_close_audit_events",
  "erp_workday_audit_events",
];

function functionBody(name: string) {
  const body = compact.split(`create or replace function public.${name}`)[1];
  expect(body, `${name} is missing`).toBeDefined();
  return body ?? "";
}

describe("ERP audit timeline migration 033 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("adds the identity-snapshot columns to every audit table that lacked them", () => {
    for (const table of SNAPSHOT_TABLES) {
      expect(compact, `${table} not in the snapshot list`).toContain(`'${table}'`);
    }
    expect(compact).toContain("add column if not exists actor_display_name text");
    expect(compact).toContain("add column if not exists actor_job_title text");
    expect(compact).toContain("add column if not exists actor_site_scope text");
  });

  it("snapshots identity with a trigger rather than trusting ~30 RPCs to remember", () => {
    // Đây là điểm mấu chốt của thiết kế: một chỗ quên là một dòng nhật ký mất
    // bối cảnh vĩnh viễn, nên đường ghi phải không lách được.
    expect(compact).toContain("before insert on public.%I");
    expect(compact).toContain(
      "execute function public.erp_audit_fill_actor_snapshot()",
    );
  });

  it("never overwrites a name an RPC already wrote", () => {
    const body = functionBody("erp_audit_fill_actor_snapshot()");
    expect(body).toContain("coalesce(new.actor_display_name");
    expect(body).toContain("coalesce(new.actor_job_title");
    expect(body).toContain("coalesce(new.actor_site_scope");
  });

  it("records the actor's own sites, not just the site the action touched", () => {
    const body = functionBody("erp_audit_fill_actor_snapshot()");
    expect(body).toContain("erp_account_role_assignments");
    expect(body).toContain("assignment.status = 'active'");
  });

  it("marks backfilled rows as not-a-snapshot so the screen can say so", () => {
    expect(compact).toContain("actor_snapshot_at_write = false");
    expect(compact).toContain(
      "add column if not exists actor_snapshot_at_write boolean not null default true",
    );
  });

  it("pairs every immutability-trigger disable with an enable", () => {
    // Bẫy #10: migration 025 đã vấp đúng chỗ này một lần.
    const disables = compact.match(/disable trigger/g) ?? [];
    const enables = compact.match(/enable trigger/g) ?? [];
    expect(disables).toHaveLength(2);
    expect(enables).toHaveLength(disables.length);
    expect(compact).toContain(
      "alter table public.erp_ap_audit_events disable trigger erp_ap_audit_immutable",
    );
    expect(compact).toContain(
      "alter table public.erp_ap_audit_events enable trigger erp_ap_audit_immutable",
    );
  });

  it("computes the viewer's scope inside the function, never from a parameter", () => {
    const body = functionBody(
      "erp_audit_timeline( p_tenant_id uuid, p_viewer_account_id text",
    );
    const head = body.slice(0, 4000);
    // Không có tham số nào cho phép người gọi tự khai mình thấy tất cả.
    expect(head).not.toContain("p_sees_everything");
    expect(head).not.toContain("p_site_ids");
    expect(body).toContain("erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id)");
  });

  it("gives a manager both their own team's actions and actions touching their site", () => {
    const body = functionBody(
      "erp_audit_timeline( p_tenant_id uuid, p_viewer_account_id text",
    );
    expect(body).toContain("unified.site_id = any (v_site_ids)");
    expect(body).toContain("assignment.site_id = any (v_site_ids)");
  });

  it("falls back to own-actions-only when the viewer holds no scope", () => {
    const body = functionBody(
      "erp_audit_timeline( p_tenant_id uuid, p_viewer_account_id text",
    );
    expect(body).toContain("unified.actor_account_id = p_viewer_account_id");
    expect(body).toContain("cardinality(v_site_ids) > 0");
  });

  it("searches the logged name as well as the current one", () => {
    const body = functionBody(
      "erp_audit_timeline( p_tenant_id uuid, p_viewer_account_id text",
    );
    expect(body).toContain("unified.actor_display_name ilike");
    expect(body).toContain("registry.display_name ilike");
  });

  it("caps the page size so no caller can ask for the whole table", () => {
    const body = functionBody(
      "erp_audit_timeline( p_tenant_id uuid, p_viewer_account_id text",
    );
    expect(body).toContain("least(greatest(coalesce(p_limit, 200), 1), 500)");
  });

  it("scopes the headcount report the same way as the timeline", () => {
    const body = functionBody("erp_headcount_by_site(");
    expect(body).toContain("erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id)");
    expect(body).toContain("v_sees_everything or assignment.site_id = any (v_site_ids)");
    // Chỉ đếm người còn hiệu lực, không đếm tài khoản đã khoá.
    expect(body).toContain("registry.status = 'active'");
  });

  it("runs every function with a pinned search path and hands them only to service_role", () => {
    const definers = compact.match(/security definer set search_path = ''/g) ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(4);
    for (const fn of [
      "erp_audit_viewer_scope",
      "erp_audit_timeline",
      "erp_headcount_by_site",
    ]) {
      expect(compact).toContain(`revoke all on function public.${fn}`);
      expect(compact, `${fn} is not granted to service_role`).toMatch(
        new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`),
      );
    }
    expect(compact).toContain(
      "revoke all on function public.erp_audit_fill_actor_snapshot() from public, anon, authenticated",
    );
  });
});
