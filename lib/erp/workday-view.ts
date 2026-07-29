import "server-only";

import type { ErpSiteId } from "@/domain/erp";
import {
  isDemoErpAccountActive,
  listDemoEmployees,
} from "@/lib/erp/demo-data";
import type {
  CurrentErpUser,
  ErpAccessState,
} from "@/lib/erp/demo-session";
import {
  listWorkdays,
  vietnamDateKey,
} from "@/lib/erp/workday-repository";

export async function listWorkdaysForUser(
  user: CurrentErpUser,
  requestedSiteIds: readonly ErpSiteId[] = user.siteIds,
) {
  const siteIds = requestedSiteIds.filter((siteId) =>
    user.siteIds.includes(siteId),
  );
  const businessDate = vietnamDateKey();
  if (user.role === "employee") {
    return listWorkdays({
      siteIds,
      businessDate,
      employeeAccountId: user.id,
      limit: 20,
    });
  }
  if (user.role === "manager") {
    return listWorkdays({
      siteIds,
      businessDate,
      managerAccountId: user.id,
      limit: 100,
    });
  }
  return [];
}

export function listWorkdayEmployeeOptions(
  access: ErpAccessState,
  managerSiteIds: readonly ErpSiteId[],
) {
  const allowedSites = new Set(managerSiteIds);
  return listDemoEmployees()
    .filter((employee) => isDemoErpAccountActive(employee))
    .map((employee) => {
      const assigned = access.employees[employee.id];
      const siteIds = (assigned?.siteIds ?? []).filter(
        (siteId) => allowedSites.has(siteId),
      );
      const moduleIdsBySite = Object.fromEntries(
        siteIds.map((siteId) => [
          siteId,
          assigned?.moduleIdsBySite[siteId] ?? [],
        ]),
      );
      return {
        id: employee.id,
        name: employee.name,
        jobTitle: employee.jobTitle,
        siteIds,
        moduleIdsBySite,
        station: employee.workforceProfile?.primaryStation ?? "Theo phân công",
        shiftLabel: employee.workforceProfile?.shiftLabel ?? "Theo lịch ca",
      };
    })
    .filter((employee) => employee.siteIds.length > 0);
}
