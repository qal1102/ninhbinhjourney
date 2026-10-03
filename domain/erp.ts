export type ErpRole =
  | "employee"
  | "manager"
  | "accountant"
  | "chief-accountant"
  | "director";

export type ErpSiteId = "trang-an" | "tam-chuc" | "tam-coc" | "bai-dinh";

export type ErpModuleId =
  | "ve-dat-cho"
  | "check-in-khach"
  | "suc-chua"
  | "camera-ai"
  | "bao-cao-hien-truong"
  | "du-an-su-kien"
  | "su-co"
  | "nhan-su"
  | "cham-cong"
  | "doi-tac-nha-cung-ung"
  | "sop-dien-tap"
  | "tai-chinh-doi-soat"
  | "bao-cao";

export type ErpSite = {
  id: ErpSiteId;
  name: string;
  shortName: string;
  province: string;
  image: string;
  coordinates: { latitude: number; longitude: number };
  geofenceRadiusMeters: number;
  summary: string;
  status: "stable" | "attention";
};

export type ErpModule = {
  id: ErpModuleId;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  employeeAssignable: boolean;
};

export const ERP_ROLE_LABELS: Record<ErpRole, string> = {
  employee: "Nhân viên",
  manager: "Quản lý cơ sở",
  accountant: "Kế toán",
  "chief-accountant": "Kế toán trưởng",
  director: "Giám đốc",
};

export const ERP_SITES: readonly ErpSite[] = [
  {
    id: "trang-an",
    name: "Khu du lịch Tràng An",
    shortName: "Tràng An",
    province: "Ninh Bình",
    image: "/images/destinations/trang-an.jpg",
    coordinates: { latitude: 20.25245, longitude: 105.91755 },
    geofenceRadiusMeters: 900,
    summary: "Bến thuyền, tuyến tham quan mặt nước và điều phối khách theo khung giờ.",
    status: "stable",
  },
  {
    id: "tam-chuc",
    name: "Khu du lịch Tam Chúc",
    shortName: "Tam Chúc",
    province: "Hà Nam",
    image: "/images/destinations/tam-chuc.jpg",
    coordinates: { latitude: 20.5579, longitude: 105.7817 },
    geofenceRadiusMeters: 1500,
    summary: "Điều phối cổng, xe điện, bến thuyền và các điểm tâm linh trong quần thể.",
    status: "attention",
  },
  {
    id: "tam-coc",
    name: "Khu du lịch Tam Cốc",
    shortName: "Tam Cốc",
    province: "Ninh Bình",
    image: "/images/destinations/editorial/tam-coc-editorial.png",
    coordinates: { latitude: 20.2154, longitude: 105.936 },
    geofenceRadiusMeters: 800,
    summary: "Quản lý bến đò, tuyến sông, thứ tự thuyền và lưu lượng khách tại bến.",
    status: "stable",
  },
  {
    id: "bai-dinh",
    name: "Quần thể chùa Bái Đính",
    shortName: "Bái Đính",
    province: "Ninh Bình",
    image: "/images/destinations/editorial/bai-dinh-editorial.png",
    coordinates: { latitude: 20.2778, longitude: 105.864 },
    geofenceRadiusMeters: 1400,
    summary: "Điều phối cổng, xe điện, tuyến tham quan và dòng khách trong quần thể tâm linh.",
    status: "stable",
  },
] as const;

export const ERP_MODULES: readonly ErpModule[] = [
  {
    id: "ve-dat-cho",
    name: "Vé & đặt chỗ",
    shortName: "Vé",
    description: "Bán vé tại quầy, in phiếu thu, lập phiếu đoàn và nộp sổ cuối ca.",
    accent: "#286655",
    employeeAssignable: true,
  },
  {
    id: "check-in-khach",
    name: "Soát vé & khách",
    shortName: "Khách",
    description: "Quét vé ở cổng, thu tiền khách trả tại điểm, tra vé khi khách mất mã.",
    accent: "#2f6f8f",
    employeeAssignable: true,
  },
  {
    id: "suc-chua",
    name: "Sức chứa & luồng khách",
    shortName: "Sức chứa",
    description: "Lượt khách trong giờ so với sức chứa từng điểm nghẽn, báo trước khi quá tải.",
    accent: "#9a6a20",
    employeeAssignable: true,
  },
  {
    id: "camera-ai",
    name: "Camera AI & hiện trường",
    shortName: "Camera AI",
    description: "Mật độ khách theo từng khu vực và cảnh báo khi đông; hiện đang chạy bản mô phỏng.",
    accent: "#355f78",
    employeeAssignable: true,
  },
  {
    id: "bao-cao-hien-truong",
    name: "Báo cáo hiện trường",
    shortName: "Hiện trường",
    description: "Nhân viên gửi ảnh và ghi chú từ cổng, quầy, bến; quản lý xác nhận.",
    accent: "#49735f",
    employeeAssignable: true,
  },
  {
    id: "du-an-su-kien",
    name: "Dự án & sự kiện",
    shortName: "Dự án",
    description: "Lễ hội và sự kiện lớn: tiến độ, ngân sách, hạn chót, đề nghị đổi phạm vi.",
    accent: "#9a5f32",
    employeeAssignable: true,
  },
  {
    id: "su-co",
    name: "Sự cố & điều phối",
    shortName: "Sự cố",
    description: "Nhận báo sự cố, giao người xử lý; quá hạn thì tự chuyển lên giám đốc.",
    accent: "#a34738",
    employeeAssignable: true,
  },
  {
    id: "nhan-su",
    name: "Nhân sự & ca trực",
    shortName: "Nhân sự",
    description: "Bàn giao ca, giao việc cho từng người, xem ai đang trong ca.",
    accent: "#71568f",
    employeeAssignable: false,
  },
  {
    id: "cham-cong",
    name: "Chấm công nhân viên",
    shortName: "Chấm công",
    description: "Vào ca, ra ca bằng vị trí tại cơ sở; quản lý duyệt ngày công.",
    accent: "#24756a",
    employeeAssignable: true,
  },
  {
    id: "doi-tac-nha-cung-ung",
    name: "Đối tác & nhà cung ứng",
    shortName: "Đối tác",
    description: "Đề nghị mua, hợp đồng, nghiệm thu, hoá đơn và công nợ nhà cung cấp.",
    accent: "#5d6f8f",
    employeeAssignable: false,
  },
  {
    id: "sop-dien-tap",
    name: "SOP & diễn tập",
    shortName: "SOP",
    description: "Danh mục kiểm tra trước giờ mở cửa, quy trình khi đông và khi có sự cố.",
    accent: "#8e573f",
    employeeAssignable: true,
  },
  {
    id: "tai-chinh-doi-soat",
    name: "Tài chính & đối soát",
    shortName: "Tài chính",
    description: "Đối chiếu tiền khai cuối ca với phiếu thu và lượt quét; nguồn doanh thu theo ca.",
    accent: "#8a6b27",
    employeeAssignable: false,
  },
  {
    id: "bao-cao",
    name: "Báo cáo & dự báo",
    shortName: "Phân tích",
    description: "Tám tuần khách qua cổng, ngày đông giờ đông, tiền quầy và dự báo bảy ngày tới.",
    accent: "#8b5a2b",
    employeeAssignable: false,
  },
] as const;

export function getErpSite(siteId: string) {
  return ERP_SITES.find((site) => site.id === siteId);
}

export function getErpModule(moduleId: string) {
  return ERP_MODULES.find((module) => module.id === moduleId);
}

/**
 * A15-LOI-03 — những màn hình người ta dùng khi **đang đứng**, ngoài trời,
 * tay bận, nắng chiếu vào màn hình.
 *
 * Danh sách này quyết định sàn chữ 14px. Nó cố ý ngắn: sàn 14px không phải là
 * "chữ to thì tốt hơn" áp cho cả hệ thống — nới cả ERP lên 14px sẽ đẩy vỡ các
 * bảng nhiều cột của kế toán và điều hành, nơi người ta ngồi trước màn hình
 * lớn và cần thấy nhiều dòng một lúc. Chỗ 12px đau thật là ở cổng.
 *
 * Bảy màn dưới đây đều có một đặc điểm chung: người dùng chúng không ngồi.
 * Chấm công và Nhân sự vào danh sách ngày 21/09: nhân viên chấm vào ca và
 * bàn giao ca đều làm khi đang đứng ngoài hiện trường, cầm điện thoại.
 */
export const ERP_OPERATIONAL_MODULE_IDS = [
  "check-in-khach",
  "ve-dat-cho",
  "suc-chua",
  "su-co",
  "bao-cao-hien-truong",
  "cham-cong",
  "nhan-su",
] as const;

export function isOperationalModule(moduleId: string): boolean {
  return (ERP_OPERATIONAL_MODULE_IDS as readonly string[]).includes(moduleId);
}

export function isErpSiteId(value: string): value is ErpSiteId {
  return ERP_SITES.some((site) => site.id === value);
}

export function isErpModuleId(value: string): value is ErpModuleId {
  return ERP_MODULES.some((module) => module.id === value);
}
