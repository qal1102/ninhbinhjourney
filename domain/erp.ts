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
  | "xe-trung-chuyen"
  | "tai-san-bao-tri"
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
  snapshot: {
    visitors: number;
    checkedIn: number;
    employeesOnShift: number;
    openIncidents: number;
    capacityPercent: number;
  };
};

export type ErpModule = {
  id: ErpModuleId;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  employeeAssignable: boolean;
  /**
   * `live` — the module runs a real workflow against real persisted data.
   * `planned` — the screen exists but no workflow is behind it yet.
   *
   * T3. Until this field existed the five planned modules rendered invented
   * tables: named drivers, work orders, "2 tệp đính kèm". A client who asks
   * "who is Nguyễn Văn Hải?" during a demo gets no honest answer, and every
   * real module in the product loses credibility with him. `planned` modules
   * now say what they will do and what data they still need, and say plainly
   * that nothing is behind them yet.
   */
  status: "live" | "planned";
  /** For `planned` modules only: the data that has to exist first. */
  plannedNeeds?: readonly string[];
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
    snapshot: {
      visitors: 2840,
      checkedIn: 1916,
      employeesOnShift: 84,
      openIncidents: 2,
      capacityPercent: 68,
    },
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
    snapshot: {
      visitors: 3610,
      checkedIn: 2478,
      employeesOnShift: 112,
      openIncidents: 5,
      capacityPercent: 83,
    },
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
    snapshot: {
      visitors: 1740,
      checkedIn: 1288,
      employeesOnShift: 57,
      openIncidents: 1,
      capacityPercent: 61,
    },
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
    snapshot: {
      visitors: 3260,
      checkedIn: 2214,
      employeesOnShift: 96,
      openIncidents: 3,
      capacityPercent: 74,
    },
  },
] as const;

export const ERP_MODULES: readonly ErpModule[] = [
  {
    id: "ve-dat-cho",
    name: "Vé & đặt chỗ",
    shortName: "Vé",
    description: "Đơn theo ngày, kênh bán, hoàn đổi và danh sách khách sắp đến.",
    accent: "#286655",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "check-in-khach",
    name: "Check-in khách",
    shortName: "Khách",
    description: "Quét mã, xác thực quyền lợi và xử lý ngoại lệ ngay tại cổng.",
    accent: "#2f6f8f",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "suc-chua",
    name: "Sức chứa & luồng khách",
    shortName: "Sức chứa",
    description: "Theo dõi tải theo ca, tuyến và cảnh báo trước khi quá ngưỡng.",
    accent: "#9a6a20",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "camera-ai",
    name: "Camera AI & hiện trường",
    shortName: "Camera AI",
    description: "Xem hiện trường, mật độ ẩn danh và các cảnh báo an toàn theo từng khu vực.",
    accent: "#355f78",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "bao-cao-hien-truong",
    name: "Báo cáo hiện trường",
    shortName: "Hiện trường",
    description: "Ảnh tại cổng, quầy vé, bến, tuyến và bằng chứng hoàn thành công việc theo ca.",
    accent: "#49735f",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "du-an-su-kien",
    name: "Dự án & sự kiện",
    shortName: "Dự án",
    description: "Theo dõi festival, chương trình lớn, tiến độ, ngân sách, nhà thầu, deadline và rủi ro cần xử lý.",
    accent: "#9a5f32",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "su-co",
    name: "Sự cố & điều phối",
    shortName: "Sự cố",
    description: "Tiếp nhận, phân mức, giao người xử lý và lưu toàn bộ thời gian phản hồi.",
    accent: "#a34738",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "nhan-su",
    name: "Nhân sự & ca trực",
    shortName: "Nhân sự",
    description: "Xếp ca, phân công nhân viên và mở đúng module theo trách nhiệm.",
    accent: "#71568f",
    employeeAssignable: false,
    status: "live",
  },
  {
    id: "cham-cong",
    name: "Chấm công nhân viên",
    shortName: "Chấm công",
    description: "Vào ca/ra ca bằng vị trí cơ sở, tự tạo bảng công và ngoại lệ đi muộn.",
    accent: "#24756a",
    employeeAssignable: true,
    status: "live",
  },
  {
    id: "xe-trung-chuyen",
    name: "Xe trung chuyển",
    shortName: "Trung chuyển",
    description: "Lịch xe, tài xế, điểm đón và trạng thái từng vòng vận hành.",
    accent: "#3865a3",
    employeeAssignable: true,
    status: "planned",
    plannedNeeds: [
      "Danh sách xe, tài xế và tuyến chạy",
      "Vị trí xe theo thời gian thực hoặc mốc điểm đón thủ công",
    ],
  },
  {
    id: "tai-san-bao-tri",
    name: "Tài sản & nghiệm thu",
    shortName: "Tài sản",
    description: "Theo dõi tài sản, bảo dưỡng, checklist, ảnh hiện trường và biên bản bàn giao.",
    accent: "#6f6759",
    employeeAssignable: true,
    status: "planned",
    plannedNeeds: [
      "Danh mục tài sản kèm mã và lịch bảo dưỡng",
      "Chu kỳ bảo dưỡng và người phụ trách từng nhóm tài sản",
    ],
  },
  {
    id: "doi-tac-nha-cung-ung",
    name: "Đối tác & nhà cung ứng",
    shortName: "Đối tác",
    description: "Tiến độ, cam kết an toàn, hồ sơ nghiệm thu và công nợ của từng đơn vị.",
    accent: "#5d6f8f",
    employeeAssignable: false,
    status: "live",
  },
  {
    id: "sop-dien-tap",
    name: "SOP & diễn tập",
    shortName: "SOP",
    description: "Quy trình theo ngưỡng, phân vai chỉ huy, lịch diễn tập và điều kiện mở cửa.",
    accent: "#8e573f",
    employeeAssignable: true,
    status: "planned",
    plannedNeeds: [
      "Bộ SOP và ngưỡng kích hoạt từng quy trình",
      "Lịch diễn tập và phân vai chỉ huy",
    ],
  },
  {
    id: "tai-chinh-doi-soat",
    name: "Tài chính & đối soát",
    shortName: "Tài chính",
    description: "Doanh thu, chi phí, biên lợi nhuận, công nợ và đối soát theo ca, kênh, cơ sở.",
    accent: "#8a6b27",
    employeeAssignable: false,
    status: "live",
  },
  {
    id: "bao-cao",
    name: "Báo cáo & dự báo",
    shortName: "Phân tích",
    description: "So sánh tháng, quý, năm; nhận diện xu hướng và các yếu tố cần xử lý sớm.",
    accent: "#8b5a2b",
    employeeAssignable: false,
    status: "planned",
    plannedNeeds: [
      "Dữ liệu vận hành đủ dài để so sánh kỳ (hiện mới có từ 24/07/2026)",
    ],
  },
] as const;

export const EMPLOYEE_DEFAULT_MODULES: readonly ErpModuleId[] = [
  "check-in-khach",
  "bao-cao-hien-truong",
  "su-co",
  "cham-cong",
];

export function getErpSite(siteId: string) {
  return ERP_SITES.find((site) => site.id === siteId);
}

export function getErpModule(moduleId: string) {
  return ERP_MODULES.find((module) => module.id === moduleId);
}

export function isErpSiteId(value: string): value is ErpSiteId {
  return ERP_SITES.some((site) => site.id === value);
}

export function isErpModuleId(value: string): value is ErpModuleId {
  return ERP_MODULES.some((module) => module.id === value);
}
