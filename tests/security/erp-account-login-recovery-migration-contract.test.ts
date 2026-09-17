import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * A15-ACC-01 — migration 076: cấp lại mật khẩu, gỡ đăng nhập, tra email đăng nhập.
 */

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202609170076_erp_account_login_recovery.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const compact = code.replace(/\s+/g, " ").trim();

const FUNCTIONS = [
  "erp_admin_find_login_by_email",
  "erp_admin_mark_login_password_reset",
  "erp_admin_unlink_auth_user",
] as const;

function body(name: string) {
  const start = code.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const end = code.indexOf("$$;", start);
  return code.slice(start, end).replace(/\s+/g, " ");
}

describe("A15-ACC-01 migration 076 contract", () => {
  it("applies atomically", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("keeps every audit action production already allows, and adds only the two new ones", () => {
    for (const action of [
      "account.created",
      "account.updated",
      "account.status.changed",
      "account.role.granted",
      "account.role.revoked",
      "account.auth.linked",
      "account.auth.password_changed",
      "account.auth.password_reset",
      "account.auth.unlinked",
    ]) {
      expect(compact, action).toContain(`'${action}'`);
    }
    expect(compact).toContain("drop constraint if exists erp_account_admin_audit_action_check");
  });

  it("touches no table other than the audit constraint and never deletes a row", () => {
    expect(compact).not.toMatch(/\bdelete from\b|\btruncate\b|\bdrop table\b|\bcreate table\b/i);
    const alters = compact.match(/alter table public\.\w+/g) ?? [];
    expect(new Set(alters)).toEqual(new Set(["alter table public.erp_account_admin_audit"]));
    expect(compact).not.toMatch(/insert into auth\.|update auth\.|delete from auth\./);
  });

  it.each(FUNCTIONS)("%s is security definer with an empty search path and re-checks system-admin first", (name) => {
    const text = body(name);
    expect(text).toContain("security definer");
    expect(text).toContain("set search_path = ''");
    const guard = text.indexOf("perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id)");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(text.search(/\b(update|insert|return query)\b/));
  });

  it.each(FUNCTIONS)("%s is callable by service_role only", (name) => {
    expect(compact).toContain(`revoke all on function public.${name}(uuid, text, text) from public, anon, authenticated;`);
    expect(compact).toContain(`grant execute on function public.${name}(uuid, text, text) to service_role;`);
    expect(compact).not.toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to (anon|authenticated)`));
  });

  it("nobody resets or unlinks their own login through these functions", () => {
    for (const name of ["erp_admin_mark_login_password_reset", "erp_admin_unlink_auth_user"]) {
      expect(body(name)).toContain("ACCOUNT_ADMIN_SELF_LOGIN_CHANGE");
    }
  });

  it("a reset only applies to a linked account and records the reset in the audit log", () => {
    const text = body("erp_admin_mark_login_password_reset");
    expect(text).toContain("and auth_user_id is not null");
    expect(text).toContain("must_change_password = true");
    expect(text).toContain("'account.auth.password_reset'");
    expect(text).toContain("ACCOUNT_ADMIN_LOGIN_NOT_LINKED");
  });

  it("unlink locks the row, releases link and email, keeps the old email in the audit line, and returns the Auth id", () => {
    const text = body("erp_admin_unlink_auth_user");
    expect(text).toContain("returns uuid");
    expect(text).toContain("for update");
    expect(text).toContain("auth_user_id = null");
    expect(text).toContain("email = null");
    expect(text).toContain("'account.auth.unlinked'");
    expect(text).toContain("jsonb_build_object('email', v_email)");
    expect(text).toContain("return v_auth_user_id");
  });

  it("the email lookup reads auth.users without filtering links by tenant, and exposes who created the user", () => {
    const text = body("erp_admin_find_login_by_email");
    expect(text).toContain("from auth.users auth_user");
    expect(text).toContain("on registry.auth_user_id = auth_user.id where");
    expect(text).toContain("raw_user_meta_data ->> 'erp_account_id'");
    expect(text).toContain("lower(auth_user.email) = v_email");
  });
});
