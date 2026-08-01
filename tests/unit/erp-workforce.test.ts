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

  it("gives every site its own manager, isolated from the other three", () => {
    const legacyAlias = findDemoErpAccountByUsername("ql.trangan");
    const managers = DEMO_ERP_ACCOUNTS.filter(
      (account) => account.role === "manager",
    );

    // L14 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md: a single regional
    // manager with all four sites meant "manager sees only their own site"
    // was never actually provable in a demo. Each site now has its own
    // manager account with managedSiteIds narrowed to exactly that site.
    expect(managers).toHaveLength(4);
    for (const site of ERP_SITES) {
      const manager = managers.find((account) =>
        account.managedSiteIds.includes(site.id),
      );
      expect(manager, `no manager owns ${site.id}`).toBeDefined();
      expect(manager?.managedSiteIds).toEqual([site.id]);
      expect(manager?.initialSiteIds).toEqual([site.id]);
    }

    // The old regional-manager username keeps logging in (now scoped to
    // Tràng An only) so previously shared demo scripts do not break.
    const trangAnManager = findDemoErpAccountByUsername("ql.vanhanh");
    expect(trangAnManager?.id).toBe("manager-trang-an");
    expect(legacyAlias?.id).toBe(trangAnManager?.id);

    const employees = DEMO_ERP_ACCOUNTS.filter(
      (account) => account.role === "employee",
    );
    expect(employees.length).toBeGreaterThan(0);
    for (const employee of employees) {
      const supervisorId = employee.workforceProfile?.supervisorId;
      const supervisor = managers.find((account) => account.id === supervisorId);
      expect(supervisor, `${employee.id} has no valid supervisor`).toBeDefined();
      // Every employee reports to the manager who actually owns their site.
      expect(supervisor?.managedSiteIds).toEqual(employee.initialSiteIds);
    }
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
