import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERP_MODULES, type ErpSiteId } from "@/domain/erp";
import { listDemoSiteManagers } from "@/lib/erp/demo-data";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608020018_erp_manager_module_access_seed.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

// Duplicated on purpose rather than imported from lib/erp/shift-close-repository,
// which is "server-only". A contract test should pin the literal ids the
// migration writes anyway.
const SITE_UUID_BY_SLUG: Record<ErpSiteId, string> = {
  "trang-an": "10000000-0000-4000-8000-000000000001",
  "tam-chuc": "10000000-0000-4000-8000-000000000009",
  "tam-coc": "10000000-0000-4000-8000-000000000005",
  "bai-dinh": "10000000-0000-4000-8000-000000000003",
};

/** The `array[...]` literal that belongs to a given account id in the VALUES list. */
function seededModulesFor(accountId: string): string[] {
  const block = compact.split(`'${accountId}',`)[1];
  expect(block, `migration has no row for ${accountId}`).toBeDefined();
  const arrayLiteral = /array\[(.*?)\]/.exec(block)?.[1];
  expect(arrayLiteral, `no module array for ${accountId}`).toBeDefined();
  return (arrayLiteral ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

/** Row shape is: '<account>', '<tenant uuid>', '<site uuid>', array[...] */
function seededSiteFor(accountId: string): string {
  const head = (compact.split(`'${accountId}',`)[1] ?? "").split("array[")[0];
  const uuids = head.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/g) ?? [];
  expect(uuids.length, `expected tenant + site uuid for ${accountId}`).toBe(2);
  return uuids[1].replace(/'/g, "");
}

describe("ERP manager module access seed migration 018 contract", () => {
  it("applies atomically and is data-only", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toContain("create table");
    expect(compact).not.toContain("create or replace function");
    expect(compact).not.toContain("alter table");
    expect(compact).not.toContain("grant select");
    expect(compact).not.toContain("grant execute");
  });

  it("never overwrites a grant a director has already made", () => {
    expect(compact).toContain("on conflict (employee_account_id) do nothing;");
  });

  it("seeds every site manager on exactly the site they manage", () => {
    const managers = listDemoSiteManagers();
    expect(managers.length).toBe(4);
    for (const manager of managers) {
      expect(manager.managedSiteIds.length).toBe(1);
      expect(seededSiteFor(manager.id)).toBe(
        SITE_UUID_BY_SLUG[manager.managedSiteIds[0]],
      );
    }
  });

  it("seeds exactly the module list demo-data.ts gives each manager", () => {
    for (const manager of listDemoSiteManagers()) {
      expect([...seededModulesFor(manager.id)].sort()).toEqual(
        [...manager.initialModuleIds].sort(),
      );
    }
  });

  it("grants only real module ids, and never all fifteen to anyone", () => {
    const known = new Set(ERP_MODULES.map((module) => module.id));
    for (const manager of listDemoSiteManagers()) {
      const modules = seededModulesFor(manager.id);
      for (const moduleId of modules) {
        expect(known.has(moduleId as never)).toBe(true);
      }
      // The point of V14: a manager is permissioned, not handed everything.
      expect(modules.length).toBeLessThan(ERP_MODULES.length);
      expect(modules).not.toContain("bao-cao");
    }
  });

  it("stays inside the 20-module ceiling erp_employee_access enforces", () => {
    for (const manager of listDemoSiteManagers()) {
      expect(seededModulesFor(manager.id).length).toBeLessThanOrEqual(20);
    }
  });
});
