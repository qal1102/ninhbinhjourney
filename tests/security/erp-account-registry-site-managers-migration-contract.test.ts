import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ErpSiteId } from "@/domain/erp";
import { listDemoSiteManagers } from "@/lib/erp/demo-data";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608020025_erp_account_registry_site_managers.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

// Pinned literally rather than imported from the "server-only"
// shift-close repository: a contract test should assert the ids the migration
// actually writes, not re-derive them from the same source it is checking.
const SITE_UUID_BY_SLUG: Record<ErpSiteId, string> = {
  "trang-an": "10000000-0000-4000-8000-000000000001",
  "tam-chuc": "10000000-0000-4000-8000-000000000009",
  "tam-coc": "10000000-0000-4000-8000-000000000005",
  "bai-dinh": "10000000-0000-4000-8000-000000000003",
};

const TRANG_AN_UUID = SITE_UUID_BY_SLUG["trang-an"];

describe("ERP account registry site managers migration 025 contract", () => {
  it("applies atomically and changes no schema", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toContain("create table");
    expect(compact).not.toContain("create or replace function");
    expect(compact).not.toContain("alter table");
    expect(compact).not.toContain("drop ");
    expect(compact).not.toContain("grant select");
    expect(compact).not.toContain("grant execute");
  });

  it("registers every site manager the application already ships", () => {
    // The defect this migration repairs is precisely that demo-data.ts and the
    // registry disagreed about who exists. Anyone who adds a fifth manager to
    // the app without registering them fails here rather than on production.
    for (const manager of listDemoSiteManagers()) {
      expect(compact, `${manager.id} missing from registry`).toContain(
        `'${manager.id}'`,
      );
    }
  });

  it("gives each newly registered manager the role on exactly one site", () => {
    for (const [accountId, siteId] of [
      ["manager-tam-chuc", "tam-chuc"],
      ["manager-tam-coc", "tam-coc"],
      ["manager-bai-dinh", "bai-dinh"],
    ] as const) {
      const assignmentBlock = compact
        .split(`'${accountId}', 'regional-manager',`)[1]
        ?.slice(0, 120);
      expect(assignmentBlock, `no role assignment for ${accountId}`).toBeDefined();
      expect(assignmentBlock).toContain(`'${SITE_UUID_BY_SLUG[siteId]}'`);
      expect(assignmentBlock).toContain("'active'");
      // A manager scoped to one site must never be handed a null (= all sites)
      // scope, which is what erp_account_has_active_role treats as global.
      expect(assignmentBlock?.startsWith(" null")).toBe(false);
    }
  });

  it("revokes the old regional scope outside Tràng An without deleting history", () => {
    expect(compact).toContain("set status = 'revoked'");
    expect(compact).toContain("effective_until = '2026-08-01T00:00:00+07:00'");
    expect(compact).toContain(`site_id <> '${TRANG_AN_UUID}'`);
    // Revoking, never deleting: a role genuinely held until today is history.
    expect(compact).not.toContain("delete from public.erp_account_role_assignments");
  });

  it("keeps the Tràng An assignment the incumbent still holds", () => {
    // The revoke predicate must exclude Tràng An; if it ever matched all four
    // sites the incumbent would lose AP submission at their own site too.
    const revokeClause = compact.split("set status = 'revoked'")[1] ?? "";
    expect(revokeClause).toContain(`site_id <> '${TRANG_AN_UUID}'`);
    expect(revokeClause).toContain("account_id = 'manager-trang-an'");
  });

  it("re-attributes invoices per site instead of by a blanket update", () => {
    const invoiceUpdate = compact.split(
      "update public.erp_ap_supplier_invoices",
    )[1];
    expect(invoiceUpdate).toBeDefined();
    // Narrow predicate: only rows still naming the old regional manager, and
    // only at a site he does not run.
    expect(invoiceUpdate).toContain("manager_account_id = 'manager-trang-an'");
    for (const siteId of ["tam-chuc", "tam-coc", "bai-dinh"] as const) {
      expect(invoiceUpdate).toContain(SITE_UUID_BY_SLUG[siteId]);
    }
    expect(invoiceUpdate).not.toContain(TRANG_AN_UUID);
  });

  it("rewrites only audit rows this repository seeded itself", () => {
    const auditUpdate = compact.split("update public.erp_ap_audit_events")[1];
    expect(auditUpdate).toBeDefined();
    // The append-only audit trail may be corrected only where the row is a
    // fixture we fabricated. A line produced by a real action stays as it
    // happened, wrong attribution and all -- that is the evidence.
    expect(auditUpdate).toContain("metadata->>'seed' = 'true'");
    expect(auditUpdate).toContain("actor_account_id = 'manager-trang-an'");
    expect(auditUpdate).not.toContain("delete from");
  });
});
