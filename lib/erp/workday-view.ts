import "server-only";

import type { ErpSiteId } from "@/domain/erp";
import { tinhQuyenHieuLuc } from "@/domain/quyen-hieu-luc";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
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

/**
 * Nhân viên quản lý giao việc được, hoặc bàn giao ca được, ở các cơ sở này.
 *
 * Đọc từ danh bạ (sổ tài khoản), tính việc được giao bằng đúng luật quyền lúc
 * người ấy đăng nhập (`domain/quyen-hieu-luc.ts`). Trước 28/09/2026 danh sách
 * này lấy từ tài khoản mẫu trong mã nguồn, nên người giám đốc vừa tạo không
 * bao giờ hiện trong ô chọn giao việc hay nhận ca.
 */
export function listWorkdayEmployeeOptions(
  access: ErpAccessState,
  managerSiteIds: readonly ErpSiteId[],
  directory: readonly ErpStaffDirectoryEntry[],
) {
  const allowedSites = new Set(managerSiteIds);
  return directory
    .filter((entry) => entry.role === "employee" && entry.active)
    .map((entry) => {
      const quyen = tinhQuyenHieuLuc({
        role: "employee",
        coSoDuocCap: entry.siteIds,
        viecDaGiao: access.employees[entry.accountId]?.moduleIdsBySite,
        conHieuLuc: entry.active,
      });
      const siteIds = quyen.siteIds.filter((siteId) => allowedSites.has(siteId));
      return {
        id: entry.accountId,
        name: entry.displayName,
        jobTitle: entry.jobTitle,
        siteIds,
        moduleIdsBySite: Object.fromEntries(
          siteIds.map((siteId) => [siteId, quyen.moduleIdsBySite[siteId] ?? []]),
        ),
        station: entry.workforceProfile?.primaryStation ?? "Theo phân công",
        shiftLabel: entry.workforceProfile?.shiftLabel ?? "Theo lịch ca",
      };
    })
    .filter((employee) => employee.siteIds.length > 0);
}
