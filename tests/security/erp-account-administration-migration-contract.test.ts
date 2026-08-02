import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERP_REGISTRY_ROLES } from "@/domain/erp-account-roles";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020027_erp_account_administration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP account administration migration 027 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("makes one account able to hold several sites", () => {
    // The single-column primary key is precisely what made "quản lý X phụ
    // trách ba khu" unrepresentable, at any layer.
    expect(compact).toContain(
      "primary key (employee_account_id, site_id)",
    );
    expect(compact).toContain("alter column site_id set not null");
    // Revoking one site must delete one row, not blank the account's only row.
    expect(compact).toContain("delete from public.erp_employee_access");
    expect(compact).toContain("on conflict (employee_account_id, site_id) do update");
  });

  it("teaches the role check every role the application knows", () => {
    for (const role of ERP_REGISTRY_ROLES) {
      expect(compact, `role check is missing ${role}`).toContain(`'${role}'`);
    }
  });

  it("separates system-admin from director instead of merging them", () => {
    // Both are granted to the director, but as two rows -- that is the whole
    // point: an audit line can then say which capacity was being used.
    expect(compact).toContain("'system-admin'");
    expect(compact).toContain("'director-001'");
    expect(compact).toContain("erp_account_admin_audit");
  });

  it("gates every administration RPC on an active system-admin grant", () => {
    expect(compact).toContain(
      "create or replace function public.erp_admin_requires_system_admin",
    );
    expect(compact).toContain("'ACCOUNT_ADMIN_ROLE_REQUIRED'");
    for (const fn of [
      "erp_admin_upsert_account",
      "erp_admin_set_account_status",
      "erp_admin_set_role_assignment",
    ]) {
      const body = compact.split(`create or replace function public.${fn}`)[1];
      expect(body, `${fn} is missing`).toBeDefined();
      expect(
        body?.slice(0, 4000),
        `${fn} does not check system-admin`,
      ).toContain("erp_admin_requires_system_admin");
    }
  });

  it("refuses to let an administrator lock themselves out", () => {
    // There is no second way back in; this is not a recoverable mistake.
    expect(compact).toContain("'ACCOUNT_ADMIN_CANNOT_LOCK_SELF'");
  });

  it("keeps every new function hardened and service-role only", () => {
    const functionBlocks = sql.match(/create (or replace )?function[\s\S]*?\n\$\$;/g) ?? [];
    expect(functionBlocks.length).toBeGreaterThanOrEqual(5);
    for (const block of functionBlocks) {
      expect(block).toContain("security definer");
      expect(block).toContain("set search_path = ''");
    }
    for (const fn of [
      "erp_admin_upsert_account",
      "erp_admin_set_account_status",
      "erp_admin_set_role_assignment",
      "erp_update_employee_access",
    ]) {
      expect(compact).toContain(`grant execute on function public.${fn}`);
      expect(compact).toContain(`revoke all on function public.${fn}`);
    }
    expect(compact).toContain(
      "alter table public.erp_account_admin_audit enable row level security",
    );
    expect(compact).not.toMatch(/\bto anon\b/);
  });
});
