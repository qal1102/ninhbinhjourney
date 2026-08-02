import "server-only";

import { ERP_MODULES, type ErpModuleId, type ErpRole, type ErpSiteId } from "@/domain/erp";
import { appRoleFromRegistryRole } from "@/domain/erp-account-roles";
import {
  listRegistryAccounts,
  sitesFromGrants,
  type ErpRegistryAccount,
} from "@/lib/erp/account-registry-repository";
import {
  findDemoErpAccountById,
  getGrantableModuleIds,
  isDemoErpAccountActive,
  type DemoWorkforceProfile,
} from "@/lib/erp/demo-data";

/**
 * T14b — danh bạ nhân sự đọc từ registry.
 *
 * Trước đây hai màn hình còn liệt kê thẳng từ `DEMO_ERP_ACCOUNTS`: màn hình
 * phân quyền module theo cơ sở, và ô "xem theo vai trò" của giám đốc. Hậu quả
 * cụ thể: một người do giám đốc tạo trên `/erp/tai-khoan` **đăng nhập được**
 * (T6b) và **có hồ sơ** (T14 bước 1), nhưng **không tồn tại** ở hai màn hình
 * đó — tức là vừa tuyển xong đã không phân được việc.
 *
 * Registry là nguồn sự thật về *ai tồn tại và giữ vai trò gì*. Nó không giữ
 * *hồ sơ đào tạo* — thứ quyết định một nhân viên được phép nhận module nào.
 * Hai loại dữ liệu đó khác nhau và không nên gộp: vai trò do giám đốc cấp,
 * đào tạo do thực tế huấn luyện quyết định.
 *
 * Trong lúc chưa có bảng hồ sơ đào tạo thật:
 *
 * - Tài khoản còn hồ sơ mẫu → giữ nguyên giới hạn theo `trainedModuleIds`.
 * - Tài khoản chỉ có trong registry → được phép nhận **mọi module đánh dấu
 *   `employeeAssignable`**, và cờ `hasTrainingRecord = false` để màn hình nói
 *   thẳng ra rằng chưa có hồ sơ đào tạo, giám đốc tự chịu trách nhiệm.
 *
 * Không nới lỏng gì so với trước: các tài khoản này trước đây không hiện ra
 * để mà cấp quyền.
 */
export type ErpStaffDirectoryEntry = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  role: ErpRole;
  /** Cơ sở suy ra từ các phiếu cấp vai trò đang có hiệu lực. */
  siteIds: ErpSiteId[];
  /** `false` khi tài khoản bị tạm khoá, thu hồi, hoặc ngoài hạn hợp đồng mùa vụ. */
  active: boolean;
  /** Module giám đốc được phép tích cho tài khoản này. */
  grantableModuleIds: ErpModuleId[];
  /** `false` nghĩa là danh sách trên là mặc định, không phải hồ sơ đào tạo. */
  hasTrainingRecord: boolean;
  hasAuthUser: boolean;
  email: string | null;
  /**
   * Tên đăng nhập cũ, chỉ còn ở tài khoản có trong mã nguồn. Registry không
   * giữ tên đăng nhập — danh tính thật của nó là email (T6b). Giữ lại vì đây
   * vẫn là cách người vận hành gọi nhau khi đối chiếu bảng phân công.
   */
  username: string | null;
  /**
   * Chỉ có ở tài khoản còn hồ sơ mẫu. Tài khoản do giám đốc tạo chưa có vị trí
   * làm việc/ca trực/hạn hợp đồng — bỏ trống chứ không bịa.
   */
  workforceProfile?: DemoWorkforceProfile;
};

const EMPLOYEE_ASSIGNABLE_MODULE_IDS: ErpModuleId[] = ERP_MODULES.filter(
  (module) => module.employeeAssignable,
).map((module) => module.id);

const ALL_MODULE_IDS: ErpModuleId[] = ERP_MODULES.map((module) => module.id);

function primaryAppRole(account: ErpRegistryAccount): ErpRole | null {
  for (const grant of account.grants) {
    const role = appRoleFromRegistryRole(grant.role);
    if (role) return role;
  }
  return null;
}

function grantableModules(role: ErpRole, hasTrainingRecord: boolean, trained: ErpModuleId[]) {
  if (role === "manager") return ALL_MODULE_IDS;
  if (role !== "employee") return [];
  return hasTrainingRecord ? trained : EMPLOYEE_ASSIGNABLE_MODULE_IDS;
}

export function buildStaffDirectory(
  accounts: readonly ErpRegistryAccount[],
  now = Date.now(),
): ErpStaffDirectoryEntry[] {
  const entries: ErpStaffDirectoryEntry[] = [];

  for (const account of accounts) {
    const role = primaryAppRole(account);
    // Tài khoản chỉ giữ `system-admin` không phải một người đi làm ca; nó
    // không thuộc danh bạ nhân sự.
    if (!role) continue;

    const demoProfile = findDemoErpAccountById(account.accountId);
    const trained = demoProfile ? getGrantableModuleIds(demoProfile) : [];
    const hasTrainingRecord = Boolean(demoProfile?.workforceProfile);

    entries.push({
      accountId: account.accountId,
      displayName: account.displayName,
      jobTitle: account.jobTitle,
      role,
      siteIds: sitesFromGrants(account),
      // Hai điều kiện chồng lên nhau, không thay thế nhau: registry quyết định
      // tài khoản còn hiệu lực hay không, hồ sơ mùa vụ quyết định người đó có
      // đang trong hạn hợp đồng hay không.
      active:
        account.status === "active" &&
        (!demoProfile || isDemoErpAccountActive(demoProfile, now)),
      grantableModuleIds: grantableModules(role, hasTrainingRecord, trained),
      hasTrainingRecord,
      hasAuthUser: account.hasAuthUser,
      email: account.email,
      username: demoProfile?.username ?? null,
      workforceProfile: demoProfile?.workforceProfile,
    });
  }

  return entries.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "vi-VN"),
  );
}

export async function listStaffDirectory(): Promise<ErpStaffDirectoryEntry[]> {
  return buildStaffDirectory(await listRegistryAccounts());
}

/**
 * Tài khoản giám đốc có thể "xem thử". Loại chính mình và loại giám đốc khác:
 * xem thử một giám đốc khác không cho biết thêm điều gì, và tài khoản đã bị
 * khoá thì không phản ánh đúng thứ người đó thấy khi đi làm.
 */
export function selectRoleSwitchTargets(
  directory: readonly ErpStaffDirectoryEntry[],
  currentUserId?: string,
): ErpStaffDirectoryEntry[] {
  return directory.filter(
    (entry) =>
      entry.role !== "director" && entry.active && entry.accountId !== currentUserId,
  );
}

export async function listRoleSwitchTargets(
  currentUserId?: string,
): Promise<ErpStaffDirectoryEntry[]> {
  return selectRoleSwitchTargets(await listStaffDirectory(), currentUserId);
}
