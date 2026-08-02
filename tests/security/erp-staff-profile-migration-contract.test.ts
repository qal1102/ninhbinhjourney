import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020032_erp_staff_profile.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP staff profile migration 032 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("adds phone and start date, both constrained", () => {
    expect(compact).toContain("add column if not exists phone text");
    expect(compact).toContain("add column if not exists started_at date");
    expect(compact).toContain("erp_account_registry_phone_check");
  });

  it("lets a manager edit profile only for a site they actually share with the target", () => {
    const body = compact.split(
      "create or replace function public.erp_manager_shares_site_with_account",
    )[1];
    expect(body, "erp_manager_shares_site_with_account is missing").toBeDefined();
    expect(body?.slice(0, 2000)).toContain("role = 'regional-manager'");
    expect(body?.slice(0, 2000)).toContain("target_grant.status = 'active'");
  });

  it("gates the profile-edit RPC on system-admin OR a shared-site manager, never on nothing", () => {
    const body = compact.split(
      "create or replace function public.erp_manager_update_profile",
    )[1];
    expect(body, "erp_manager_update_profile is missing").toBeDefined();
    const head = body?.slice(0, 3000) ?? "";
    expect(head).toContain("erp_account_has_active_role");
    expect(head).toContain("'system-admin'");
    expect(head).toContain("erp_manager_shares_site_with_account");
    expect(head).toContain("'PROFILE_MANAGER_SCOPE_REQUIRED'");
    expect(head).toContain("'PROFILE_INPUT_INVALID'");
  });

  it("cannot touch status or role -- there is no parameter that could", () => {
    const signature = compact.split(
      "create or replace function public.erp_manager_update_profile(",
    )[1]
      ?.split(") returns")[0] ?? "";
    expect(signature).not.toContain("p_status");
    expect(signature).not.toContain("p_role");
    expect(signature).not.toContain("p_site_id");
    // The update statement itself must not assign status either, in case a
    // future edit adds the column back to the signature by mistake.
    const body = compact.split(
      "create or replace function public.erp_manager_update_profile",
    )[1] ?? "";
    const updateClause = body.split("update public.erp_account_registry set")[1]
      ?.split("where account_id")[0] ?? "";
    expect(updateClause).not.toContain("status");
  });

  it("keeps both new functions hardened and service-role only", () => {
    for (const fn of [
      "erp_manager_shares_site_with_account",
      "erp_manager_update_profile",
    ]) {
      const block = sql.split(`create or replace function public.${fn}`)[1];
      expect(block, `${fn} missing`).toBeDefined();
      expect(block?.slice(0, 3000)).toContain("security definer");
      expect(block?.slice(0, 3000)).toContain("set search_path = ''");
      expect(compact).toContain(`grant execute on function public.${fn}`);
      expect(compact).toContain(`revoke all on function public.${fn}`);
    }
    expect(compact).not.toMatch(/\bto anon\b/);
  });
});
