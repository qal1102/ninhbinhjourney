import { describe, expect, it } from "vitest";
import { ERP_SITES } from "@/domain/erp";
import { ERP_WORKFORCE_SUMMARY } from "@/domain/erp-operating-data";
import {
  DEMO_ERP_ACCOUNTS,
  findDemoErpAccountByUsername,
  getEmployeeAssignableModuleIds,
  isDemoErpAccountActive,
} from "@/lib/erp/demo-data";

describe("ERP workforce assignments", () => {
  it("keeps workforce totals consistent with each site snapshot", () => {
    for (const row of ERP_WORKFORCE_SUMMARY) {
      const site = ERP_SITES.find((item) => item.id === row.siteId);
      expect(site, row.siteId).toBeDefined();
      expect(row.onShift, row.siteId).toBe(site?.snapshot.employeesOnShift);
      expect(row.permanentOnShift + row.seasonalOnShift, row.siteId).toBe(row.onShift);
      expect(row.onShift, row.siteId).toBeLessThanOrEqual(row.planned);
    }
  });

  it("models seasonal staff as expiring employees with trained-only modules", () => {
    const seasonal = findDemoErpAccountByUsername("tv.trangan");
    expect(seasonal?.role).toBe("employee");
    expect(seasonal?.workforceProfile?.employmentType).toBe("seasonal");
    expect(isDemoErpAccountActive(seasonal!, Date.parse("2026-07-28T10:00:00+07:00"))).toBe(true);
    expect(isDemoErpAccountActive(seasonal!, Date.parse("2026-09-01T00:00:00+07:00"))).toBe(false);

    const allowed = getEmployeeAssignableModuleIds(seasonal!);
    expect(allowed).toEqual(expect.arrayContaining(["check-in-khach", "bao-cao-hien-truong", "su-co", "cham-cong"]));
    expect(allowed).not.toEqual(expect.arrayContaining(["ve-dat-cho", "camera-ai", "tai-san-bao-tri", "du-an-su-kien"]));
  });

  it("uses one regional operations manager while preserving the old login alias", () => {
    const manager = findDemoErpAccountByUsername("ql.vanhanh");
    const legacyAlias = findDemoErpAccountByUsername("ql.trangan");

    expect(manager?.id).toBe("manager-trang-an");
    expect(legacyAlias?.id).toBe(manager?.id);
    expect(manager?.role).toBe("manager");
    expect(
      DEMO_ERP_ACCOUNTS.filter((account) => account.role === "manager"),
    ).toHaveLength(1);
    expect(manager?.managedSiteIds).toEqual(ERP_SITES.map((site) => site.id));
    expect(findDemoErpAccountByUsername("ql.tamchuc")).toBeUndefined();
    expect(findDemoErpAccountByUsername("ql.tamcoc")).toBeUndefined();
    expect(findDemoErpAccountByUsername("ql.baidinh")).toBeUndefined();

    const employees = DEMO_ERP_ACCOUNTS.filter(
      (account) => account.role === "employee",
    );
    expect(employees.length).toBeGreaterThan(0);
    expect(
      employees.every(
        (account) =>
          account.workforceProfile?.supervisorId === "manager-trang-an",
      ),
    ).toBe(true);
  });

  it("provides a separate regional chief accountant account", () => {
    const chiefAccountant = findDemoErpAccountByUsername("ketoantruong");

    expect(chiefAccountant?.role).toBe("chief-accountant");
    expect(chiefAccountant?.jobTitle).toBe("Kế toán trưởng");
    expect(chiefAccountant?.initialSiteIds).toEqual(
      ERP_SITES.map((site) => site.id),
    );
  });
});
