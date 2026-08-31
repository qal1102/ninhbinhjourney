import type { ErpSite } from "@/domain/erp";

export type ErpBackTarget = { href: string; label: string };

/** Nhãn dùng chung cho mọi trang con quay thẳng về tổng quan `/erp`. */
export const ERP_OVERVIEW_BACK_TARGET: ErpBackTarget = {
  href: "/erp",
  label: "Quay lại tổng quan",
};

/**
 * `app/erp/[site]/[module]/page.tsx`: một module luôn thuộc đúng một cơ sở,
 * nên đích quay lại luôn là trang cơ sở đó, không phải tổng quan chung.
 */
export function resolveModuleBackTarget(
  site: Pick<ErpSite, "id" | "shortName">,
): ErpBackTarget {
  return { href: `/erp/${site.id}`, label: `Quay lại ${site.shortName}` };
}

/**
 * `app/erp/ho-so/[accountId]/page.tsx`: trang hồ sơ được mở từ hai chỗ khác
 * nhau tuỳ ai đang xem -- từ danh sách `/erp/tai-khoan` (chỉ `system-admin`
 * vào được trang đó) hoặc từ tên chính mình / một dòng nhật ký (mọi vai trò
 * khác), nơi không có danh sách tài khoản nào để quay về.
 */
export function resolveStaffProfileBackTarget(
  isSystemAdminViewer: boolean,
): ErpBackTarget {
  return isSystemAdminViewer
    ? { href: "/erp/tai-khoan", label: "Quay lại danh sách tài khoản" }
    : ERP_OVERVIEW_BACK_TARGET;
}
