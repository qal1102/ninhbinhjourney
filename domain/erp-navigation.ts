import type { ErpModule, ErpModuleId } from "@/domain/erp";

export type ErpModuleGroup = {
  id: string;
  name: string;
  shortName: string;
  moduleIds: readonly ErpModuleId[];
};

export const ERP_MODULE_GROUPS: readonly ErpModuleGroup[] = [
  {
    id: "booking-checkin",
    name: "Booking & Check-in",
    shortName: "Booking",
    moduleIds: ["ve-dat-cho", "check-in-khach"],
  },
  {
    id: "field-operations",
    name: "Điều hành hiện trường",
    shortName: "Hiện trường",
    moduleIds: ["suc-chua", "camera-ai", "bao-cao-hien-truong"],
  },
  {
    id: "safety-incidents",
    name: "An toàn & sự cố",
    shortName: "An toàn",
    moduleIds: ["su-co", "sop-dien-tap"],
  },
  {
    id: "staff-shifts",
    name: "Nhân sự & ca làm",
    shortName: "Nhân sự",
    moduleIds: ["nhan-su", "cham-cong"],
  },
  {
    id: "vehicles-assets",
    name: "Phương tiện & tài sản",
    shortName: "Tài sản",
    moduleIds: ["xe-trung-chuyen", "tai-san-bao-tri"],
  },
  {
    id: "projects-events",
    name: "Dự án & sự kiện",
    shortName: "Dự án",
    moduleIds: ["du-an-su-kien"],
  },
  {
    id: "partners-debt",
    name: "Nhà cung cấp & công nợ",
    shortName: "Đối tác",
    moduleIds: ["doi-tac-nha-cung-ung"],
  },
  {
    id: "finance-reports",
    name: "Tài chính & báo cáo",
    shortName: "Tài chính",
    moduleIds: ["tai-chinh-doi-soat", "bao-cao"],
  },
] as const;

export type VisibleErpModuleGroup = ErpModuleGroup & {
  modules: readonly ErpModule[];
};

export function groupVisibleErpModules(
  modules: readonly ErpModule[],
): VisibleErpModuleGroup[] {
  return ERP_MODULE_GROUPS.map((group) => ({
    ...group,
    modules: group.moduleIds
      .map((moduleId) => modules.find((module) => module.id === moduleId))
      .filter((module): module is ErpModule => Boolean(module)),
  })).filter((group) => group.modules.length > 0);
}
