import { ERP_MODULES, type ErpModuleId, type ErpRole, type ErpSiteId } from "@/domain/erp";
import { canAccountSignIn } from "@/domain/erp-account-roles";
import { tinhQuyenHieuLuc, vaiTuPhieuCap, type QuyenHieuLuc } from "@/domain/quyen-hieu-luc";
import {
  getRegistryAccount,
  sitesFromGrants,
  type ErpRegistryAccount,
} from "./account-registry-repository";
import { findDemoErpAccountById, isDemoErpAccountActive, type DemoErpAccount } from "./demo-data";
import { getAccessState, type ErpAccessState } from "./staff-access-repository";

/**
 * Một người trong hệ thống, đọc từ đúng một nguồn: sổ tài khoản.
 *
 * `demo-data.ts` chỉ còn góp phần hồ sơ mà sổ chưa có (mật khẩu dùng chung của
 * tài khoản mẫu, lịch hợp đồng thời vụ, danh sách việc đã được đào tạo). Nó
 * không còn quyết ai giữ vai gì hay ở cơ sở nào. Xem `domain/quyen-hieu-luc.ts`.
 */
export type TaiKhoanHieuLuc = {
  id: string;
  name: string;
  jobTitle: string;
  role: ErpRole;
  /** Đang hoạt động và (nếu là thời vụ) còn trong hạn hợp đồng. */
  conHieuLuc: boolean;
  quyen: QuyenHieuLuc;
  /** Việc người này đã được đào tạo, giới hạn những gì quản lý giao được. */
  viecDaDaoTao: ErpModuleId[];
  registry: ErpRegistryAccount;
  demo?: DemoErpAccount;
};

const VIEC_NHAN_VIEN_GIAO_DUOC: ErpModuleId[] = ERP_MODULES.filter((module) => module.employeeAssignable).map(
  (module) => module.id,
);

export function dungTaiKhoanHieuLuc(
  registry: ErpRegistryAccount,
  access: Pick<ErpAccessState, "employees">,
): TaiKhoanHieuLuc | null {
  const role = vaiTuPhieuCap(registry.grants);
  if (!role) return null;
  const demo = findDemoErpAccountById(registry.accountId);
  const conHieuLuc = canAccountSignIn(registry.status) && (demo ? isDemoErpAccountActive(demo) : true);
  const quyen = tinhQuyenHieuLuc({
    role,
    coSoDuocCap: sitesFromGrants(registry),
    viecDaGiao: role === "employee" ? access.employees[registry.accountId]?.moduleIdsBySite : undefined,
    conHieuLuc,
  });
  const daoTao =
    role === "employee"
      ? (demo?.workforceProfile?.trainedModuleIds ?? (demo ? demo.initialModuleIds : VIEC_NHAN_VIEN_GIAO_DUOC))
      : role === "manager"
        ? ERP_MODULES.map((module) => module.id)
        : [];
  return {
    id: registry.accountId,
    name: registry.displayName,
    jobTitle: registry.jobTitle,
    role,
    conHieuLuc,
    quyen,
    viecDaDaoTao: [...daoTao],
    registry,
    demo,
  };
}

export async function docTaiKhoanHieuLuc(accountId: string): Promise<TaiKhoanHieuLuc | null> {
  const [registry, access] = await Promise.all([getRegistryAccount(accountId), getAccessState()]);
  return registry ? dungTaiKhoanHieuLuc(registry, access) : null;
}

/** Nhân viên này có đang thuộc cơ sở ấy (theo sổ tài khoản) không. */
export function thuocCoSo(taiKhoan: TaiKhoanHieuLuc, siteId: ErpSiteId): boolean {
  return taiKhoan.quyen.siteIds.includes(siteId);
}
