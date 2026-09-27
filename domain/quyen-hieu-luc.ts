import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpRole,
  type ErpSiteId,
} from "@/domain/erp";
import { appRoleFromRegistryRole, type ErpRegistryRole } from "@/domain/erp-account-roles";
import { ERP_ACCOUNTANT_MODULE_IDS } from "@/domain/erp-role-policy";

/**
 * Quyền thật của một tài khoản: vào được cơ sở nào, mở được module nào.
 *
 * ## Vì sao có tệp này
 *
 * Trước 28/09/2026 quyền ERP được ghép từ ba nguồn không khớp nhau: vai và cơ
 * sở của 13 tài khoản mẫu nằm cứng trong `lib/erp/demo-data.ts`, vai của người
 * tạo mới nằm trong sổ tài khoản (`erp_account_role_assignments`), còn module
 * nằm trong kho thứ ba (`erp_employee_access`). Hệ quả chủ dự án nhìn thấy:
 * bấm "Cấp" hay "Thu hồi" trên màn Tài khoản & phân quyền gần như không đổi gì
 * với người có sẵn, người tạo mới vào được mà không mở được module nào, còn
 * module "Báo cáo" thêm sau thì không quản lý nào có.
 *
 * Nay chỉ có một luật, ở đây:
 * - **Vai và cơ sở** lấy từ sổ tài khoản, cho mọi người.
 * - **Giám đốc**: mọi cơ sở, mọi module.
 * - **Quản lý cơ sở**: mọi module ở cơ sở mình phụ trách. Module mới thêm là
 *   có ngay, không ai phải nhớ cấp.
 * - **Kế toán, kế toán trưởng**: bộ module tài chính ở cơ sở được cấp.
 * - **Nhân viên**: đúng những việc quản lý giao ở màn Nhân sự. Chưa được giao
 *   gì ở một cơ sở thì có bộ cơ bản (chấm công, báo cáo hiện trường), để người
 *   mới vào ca được ngay thay vì thấy màn hình trống.
 */

export const ERP_EMPLOYEE_BASE_MODULE_IDS: readonly ErpModuleId[] = Object.freeze([
  "cham-cong",
  "bao-cao-hien-truong",
]);

/** Thứ tự khi một tài khoản lỡ giữ hơn một vai nghiệp vụ: vai rộng nhất thắng. */
const THU_TU_VAI: readonly ErpRole[] = [
  "director",
  "chief-accountant",
  "accountant",
  "manager",
  "employee",
];

export function vaiTuPhieuCap(grants: readonly { role: ErpRegistryRole }[]): ErpRole | null {
  const vai = new Set(
    grants
      .map((grant) => appRoleFromRegistryRole(grant.role))
      .filter((role): role is ErpRole => role !== null),
  );
  return THU_TU_VAI.find((role) => vai.has(role)) ?? null;
}

/** Vai nghiệp vụ nào bắt buộc gắn với một cơ sở, vai nào chỉ cấp toàn vùng. */
export function vaiCanCoSo(role: ErpRegistryRole): "bat-buoc" | "toan-vung" | "tuy-chon" {
  if (role === "employee" || role === "regional-manager") return "bat-buoc";
  if (role === "director" || role === "system-admin") return "toan-vung";
  return "tuy-chon";
}

export type QuyenHieuLuc = {
  siteIds: ErpSiteId[];
  moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>>;
};

const MOI_CO_SO: readonly ErpSiteId[] = ERP_SITES.map((site) => site.id);
const MOI_MODULE: readonly ErpModuleId[] = ERP_MODULES.map((module) => module.id);

export function tinhQuyenHieuLuc(input: {
  role: ErpRole | null;
  /** Cơ sở trong phiếu cấp vai, theo thứ tự `ERP_SITES`. */
  coSoDuocCap: readonly ErpSiteId[];
  /** Việc quản lý đã giao cho nhân viên, theo từng cơ sở. Không có khoá = chưa giao. */
  viecDaGiao?: Partial<Record<ErpSiteId, readonly ErpModuleId[]>>;
  /** Sai khi tài khoản khoá, hoặc hợp đồng thời vụ đã hết hạn. */
  conHieuLuc: boolean;
}): QuyenHieuLuc {
  const { role } = input;
  if (!role || !input.conHieuLuc) return { siteIds: [], moduleIdsBySite: {} };

  const coSo = role === "director" ? [...MOI_CO_SO] : MOI_CO_SO.filter((id) => input.coSoDuocCap.includes(id));
  const moduleCua = (siteId: ErpSiteId): ErpModuleId[] => {
    if (role === "director" || role === "manager") return [...MOI_MODULE];
    if (role === "accountant" || role === "chief-accountant") return [...ERP_ACCOUNTANT_MODULE_IDS];
    const daGiao = input.viecDaGiao?.[siteId];
    const nguon = daGiao ?? ERP_EMPLOYEE_BASE_MODULE_IDS;
    return MOI_MODULE.filter((id) => nguon.includes(id));
  };
  return {
    siteIds: coSo,
    moduleIdsBySite: Object.fromEntries(coSo.map((siteId) => [siteId, moduleCua(siteId)])),
  };
}
