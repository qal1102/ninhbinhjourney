import type { ErpModuleId, ErpSiteId } from "@/domain/erp";

export type WorkdayTaskTemplate = {
  id: string;
  siteId: ErpSiteId;
  title: string;
  station: string;
  moduleId: ErpModuleId;
  instructions: string;
  evidenceRequired: boolean;
};

export const WORKDAY_TASK_TEMPLATES: readonly WorkdayTaskTemplate[] = [
  {
    id: "ta-gate-group-checkin",
    siteId: "trang-an",
    title: "Xác thực và đón đoàn tại Cổng A",
    station: "Cổng A · Khu đón khách",
    moduleId: "check-in-khach",
    instructions:
      "Kiểm tra mã đoàn, số khách và quyền lợi; ghi nhận ngoại lệ trước khi khách xuống bến.",
    evidenceRequired: true,
  },
  {
    id: "ta-boat-route-safety",
    siteId: "trang-an",
    title: "Kiểm tra thuyền và điều kiện an toàn trước tuyến",
    station: "Bến thuyền Tràng An",
    moduleId: "sop-dien-tap",
    instructions:
      "Đối chiếu số thuyền, áo phao, mái chèo và thông tin người chèo đò trước khi xếp khách.",
    evidenceRequired: true,
  },
  {
    id: "ta-rower-route-handover",
    siteId: "trang-an",
    title: "Bàn giao lượt thuyền và tình trạng tuyến",
    station: "Tuyến thuyền Tràng An",
    moduleId: "bao-cao-hien-truong",
    instructions:
      "Ghi số lượt khách, tình trạng hang/tuyến, vật cản hoặc điểm cần vệ sinh và ảnh tại điểm bàn giao.",
    evidenceRequired: true,
  },
  {
    id: "ta-wharf-flow",
    siteId: "trang-an",
    title: "Điều phối hàng chờ và phân thuyền",
    station: "Khu xếp hàng xuống thuyền",
    moduleId: "suc-chua",
    instructions:
      "Theo dõi hàng chờ, ưu tiên người cao tuổi/trẻ nhỏ và báo quản lý khi tải vượt ngưỡng.",
    evidenceRequired: false,
  },
  {
    id: "tc-rower-route-check",
    siteId: "tam-coc",
    title: "Kiểm tra thuyền và nhận tuyến sông Ngô Đồng",
    station: "Bến thuyền Tam Cốc",
    moduleId: "sop-dien-tap",
    instructions:
      "Kiểm tra thuyền, áo phao, số khách và tình trạng tuyến qua ba hang trước khi rời bến.",
    evidenceRequired: true,
  },
  {
    id: "tc-rower-end-shift",
    siteId: "tam-coc",
    title: "Bàn giao lượt chèo đò cuối ca",
    station: "Bến trả khách Tam Cốc",
    moduleId: "bao-cao-hien-truong",
    instructions:
      "Ghi số chuyến, số khách, tình trạng thuyền và ảnh bàn giao tại bến sau lượt cuối.",
    evidenceRequired: true,
  },
  {
    id: "tc-wharf-queue",
    siteId: "tam-coc",
    title: "Điều phối khách và thuyền tại bến",
    station: "Khu xếp hàng bến Tam Cốc",
    moduleId: "suc-chua",
    instructions:
      "Ghép khách theo sức chứa, theo dõi thời gian chờ và gọi thuyền theo đúng thứ tự.",
    evidenceRequired: false,
  },
  {
    id: "tc-route-environment",
    siteId: "tam-coc",
    title: "Kiểm tra vệ sinh và vật cản trên tuyến",
    station: "Tuyến sông Ngô Đồng",
    moduleId: "bao-cao-hien-truong",
    instructions:
      "Ghi nhận rác, vật cản hoặc điểm sạt lở ảnh hưởng luồng thuyền và chuyển quản lý xử lý.",
    evidenceRequired: true,
  },
  {
    id: "tch-electric-dispatch",
    siteId: "tam-chuc",
    title: "Điều phối xe điện giữa Vesak và Tam Quan Nội",
    station: "Điểm điều phối xe điện Vesak",
    moduleId: "xe-trung-chuyen",
    instructions:
      "Kiểm tra xe sẵn sàng, số khách chờ, vòng quay và báo xe chậm hoặc quá tải.",
    evidenceRequired: true,
  },
  {
    id: "tch-cruise-boarding",
    siteId: "tam-chuc",
    title: "Kiểm tra khách lên du thuyền",
    station: "Bến thuyền Tam Chúc",
    moduleId: "check-in-khach",
    instructions:
      "Đối chiếu vé, khung giờ, số khách và quyền lợi dịch vụ trước khi khách lên thuyền.",
    evidenceRequired: true,
  },
  {
    id: "tch-inner-temple-flow",
    siteId: "tam-chuc",
    title: "Theo dõi luồng khách tại Tam Quan Nội",
    station: "Tam Quan Nội",
    moduleId: "suc-chua",
    instructions:
      "Theo dõi mật độ, hướng dẫn luồng đi bộ/xe điện và báo quản lý khi hàng chờ vượt ngưỡng.",
    evidenceRequired: false,
  },
  {
    id: "tch-hospitality-handover",
    siteId: "tam-chuc",
    title: "Bàn giao khu khách xá và dịch vụ đoàn",
    station: "Khách xá Tam Chúc",
    moduleId: "bao-cao-hien-truong",
    instructions:
      "Ghi tình trạng phòng chờ, suất ăn/đồ uống, yêu cầu đoàn và ảnh khu vực khi bàn giao.",
    evidenceRequired: true,
  },
  {
    id: "bd-electric-dispatch",
    siteId: "bai-dinh",
    title: "Điều phối xe điện đưa đón khách",
    station: "Điểm đón xe điện Bái Đính",
    moduleId: "xe-trung-chuyen",
    instructions:
      "Kiểm tra số xe hoạt động, hàng chờ, ưu tiên khách cần hỗ trợ và báo chuyến trễ.",
    evidenceRequired: true,
  },
  {
    id: "bd-temple-visitor-flow",
    siteId: "bai-dinh",
    title: "Hướng dẫn luồng khách tại khu chùa mới",
    station: "Khu chùa Bái Đính mới",
    moduleId: "suc-chua",
    instructions:
      "Theo dõi mật độ tại trục tham quan, hướng dẫn điểm lên/xuống xe và chuyển cảnh báo ùn tắc.",
    evidenceRequired: false,
  },
  {
    id: "bd-worship-area-check",
    siteId: "bai-dinh",
    title: "Kiểm tra khu chiêm bái trước giờ đón khách",
    station: "Điện Tam Thế · Điện Pháp Chủ",
    moduleId: "sop-dien-tap",
    instructions:
      "Kiểm tra lối đi, biển hướng dẫn, khu vực nghỉ chân và điều kiện an toàn trước khi mở luồng.",
    evidenceRequired: true,
  },
  {
    id: "bd-public-area-handover",
    siteId: "bai-dinh",
    title: "Bàn giao vệ sinh và tiện ích công cộng",
    station: "Khu dịch vụ Bái Đính",
    moduleId: "bao-cao-hien-truong",
    instructions:
      "Ghi tình trạng khu ăn uống, điểm nghỉ, nhà vệ sinh và ảnh các hạng mục cần xử lý.",
    evidenceRequired: true,
  },
] as const;

export function getWorkdayTaskTemplate(
  siteId: ErpSiteId,
  templateId: string,
) {
  return WORKDAY_TASK_TEMPLATES.find(
    (template) => template.siteId === siteId && template.id === templateId,
  );
}

export function listWorkdayTaskTemplates(siteId: ErpSiteId) {
  return WORKDAY_TASK_TEMPLATES.filter(
    (template) => template.siteId === siteId,
  );
}
