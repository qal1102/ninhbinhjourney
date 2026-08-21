import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020031_erp_auth_bridge.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();
const identityReadSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608070039_erp_rls_identity_reads.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const identityReadCompact = identityReadSql.replace(/\s+/g, " ").trim();

describe("ERP auth bridge migration 031 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("adds email and a forced first password change, both constrained", () => {
    expect(compact).toContain("add column if not exists email text");
    expect(compact).toContain(
      "add column if not exists must_change_password boolean not null default true",
    );
    expect(compact).toContain("erp_account_registry_email_check");
    expect(compact).toContain("erp_account_registry_email_idx");
    expect(compact).toContain("where email is not null");
  });

  it("only links an auth user through a system-admin gated RPC", () => {
    const body = compact.split(
      "create or replace function public.erp_admin_link_auth_user",
    )[1];
    expect(body, "erp_admin_link_auth_user is missing").toBeDefined();
    expect(body?.slice(0, 3000)).toContain("erp_admin_requires_system_admin");
    expect(body?.slice(0, 3000)).toContain("must_change_password = true");
    expect(compact).toContain("'ACCOUNT_ADMIN_EMAIL_ALREADY_LINKED'");
  });

  it("only a session's own auth user can clear its own password-change flag", () => {
    const body = compact.split(
      "create or replace function public.erp_confirm_password_changed",
    )[1];
    expect(body, "erp_confirm_password_changed is missing").toBeDefined();
    // Keyed by auth_user_id, not by a caller-supplied account_id -- nobody can
    // clear the flag for someone else.
    expect(body?.slice(0, 2000)).toContain("where auth_user_id = p_auth_user_id");
    expect(body?.slice(0, 2000)).toContain("must_change_password = false");
  });

  it("extends the audit action vocabulary rather than starting a second log", () => {
    expect(compact).toContain("'account.auth.linked'");
    expect(compact).toContain("'account.auth.password_changed'");
  });

  it("keeps both new functions hardened and service-role only", () => {
    for (const fn of [
      "erp_admin_link_auth_user",
      "erp_confirm_password_changed",
    ]) {
      const block = sql.split(`create or replace function public.${fn}`)[1];
      expect(block, `${fn} missing`).toBeDefined();
      expect(block?.slice(0, 3000)).toContain("security definer");
      expect(block?.slice(0, 3000)).toContain("set search_path = ''");
    }
    expect(compact).toContain(
      "grant execute on function public.erp_admin_link_auth_user",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_admin_link_auth_user",
    );
    expect(compact).toContain(
      "grant execute on function public.erp_confirm_password_changed",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_confirm_password_changed",
    );
    expect(compact).not.toMatch(/\bto anon\b/);
  });
});

describe("ERP authenticated identity reads migration 202608070039 contract", () => {
  it("preserves the fetched remote migration as one atomic transaction", () => {
    expect(identityReadCompact).toContain("begin;");
    expect(identityReadCompact.endsWith("commit;")).toBe(true);
  });

  it("derives the ERP account only from auth.uid and an active registry row", () => {
    const body = identityReadCompact.split(
      "create or replace function public.erp_rls_account_id",
    )[1];
    expect(body).toContain("account.auth_user_id = (select auth.uid())");
    expect(body).toContain("account.status = 'active'");
  });

  it("pins all three SECURITY DEFINER helpers and limits execute to signed-in/server roles", () => {
    for (const fn of [
      "erp_rls_account_id",
      "erp_rls_has_active_role",
      "erp_rls_can_view_account",
    ]) {
      const block = identityReadSql.split(`create or replace function public.${fn}`)[1];
      expect(block, `${fn} missing`).toBeDefined();
      expect(block?.slice(0, 3000)).toContain("security definer");
      expect(block?.slice(0, 3000)).toContain("set search_path = ''");
      expect(identityReadCompact).toContain(`revoke all on function public.${fn}`);
    }
    expect(identityReadCompact).toContain("to authenticated, service_role");
    expect(identityReadCompact).not.toMatch(/grant execute[^;]*\bto anon\b/);
  });

  it("opens read policies on exactly the five intended identity/grant tables", () => {
    for (const table of [
      "erp_account_registry",
      "erp_account_role_assignments",
      "erp_account_admin_audit",
      "erp_employee_access",
      "erp_employee_access_audit",
    ]) {
      expect(identityReadCompact).toContain(`on public.${table} for select to authenticated`);
    }
    expect(identityReadCompact.match(/create policy /g)).toHaveLength(5);
  });
});
