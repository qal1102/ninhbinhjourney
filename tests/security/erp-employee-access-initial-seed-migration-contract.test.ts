import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607310010_erp_employee_access_initial_seed.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP employee access initial seed migration 010 contract", () => {
  it("applies atomically and is data-only", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toContain("create table");
    expect(compact).not.toContain("create or replace function");
    expect(compact).not.toContain("alter table");
  });

  it("never overwrites a grant a manager has already made", () => {
    expect(compact).toContain(
      "on conflict (employee_account_id) do nothing;",
    );
  });

  it("seeds exactly the six active demo employees with their original demo-cookie default modules", () => {
    const expected: Record<string, string[]> = {
      "employee-trang-an-01": [
        "ve-dat-cho",
        "check-in-khach",
        "bao-cao-hien-truong",
        "su-co",
        "cham-cong",
      ],
      "employee-trang-an-02": [
        "suc-chua",
        "bao-cao-hien-truong",
        "su-co",
        "cham-cong",
      ],
      "employee-trang-an-seasonal-01": [
        "check-in-khach",
        "bao-cao-hien-truong",
        "su-co",
        "cham-cong",
      ],
      "employee-tam-chuc-01": [
        "xe-trung-chuyen",
        "bao-cao-hien-truong",
        "su-co",
        "cham-cong",
      ],
      "employee-tam-coc-01": [
        "check-in-khach",
        "bao-cao-hien-truong",
        "suc-chua",
        "cham-cong",
      ],
      "employee-bai-dinh-01": [
        "xe-trung-chuyen",
        "bao-cao-hien-truong",
        "suc-chua",
        "cham-cong",
      ],
    };
    for (const [employeeId, modules] of Object.entries(expected)) {
      expect(sql).toContain(`'${employeeId}'`);
      for (const moduleId of modules) {
        expect(sql).toContain(`'${moduleId}'`);
      }
    }
  });
});
