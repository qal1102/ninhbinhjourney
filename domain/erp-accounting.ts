import type { ErpSiteId } from "@/domain/erp";

export type AccountingCaseCategory =
  | "revenue"
  | "payable"
  | "expense"
  | "payroll"
  | "asset"
  | "invoice"
  | "close";

export type AccountingCaseStatus =
  | "new"
  | "awaiting-source"
  | "reviewing"
  | "drafted"
  | "awaiting-approval"
  | "ready-to-post"
  | "closed";

export type AccountingJournalLine = {
  account: string;
  label: string;
  debitMillion: number;
  creditMillion: number;
};

export type AccountingCase = {
  id: string;
  category: AccountingCaseCategory;
  siteId: ErpSiteId | "all";
  title: string;
  counterparty: string;
  amountMillion: number;
  due: string;
  status: AccountingCaseStatus;
  priority: "normal" | "attention" | "urgent";
  owner: string;
  checker: string;
  source: string;
  documents: readonly string[];
  missingDocuments: readonly string[];
  dimensions: readonly string[];
  journal: readonly AccountingJournalLine[];
  timeline: readonly string[];
};

export const ACCOUNTING_CATEGORY_LABELS: Record<AccountingCaseCategory, string> = {
  revenue: "Doanh thu & đối soát",
  payable: "Công nợ phải trả",
  expense: "Chi phí & hoàn ứng",
  payroll: "Lương & bảng công",
  asset: "Tài sản & khấu hao",
  invoice: "Hóa đơn điện tử",
  close: "Đóng kỳ",
};

export const ACCOUNTING_STATUS_LABELS: Record<AccountingCaseStatus, string> = {
  new: "Mới tiếp nhận",
  "awaiting-source": "Chờ bổ sung hồ sơ",
  reviewing: "Đang kiểm tra",
  drafted: "Đã lập bút toán nháp",
  "awaiting-approval": "Chờ người kiểm tra",
  "ready-to-post": "Đã duyệt · chờ ghi sổ",
  closed: "Đã hoàn tất",
};

export const ERP_ACCOUNTING_CASES: readonly AccountingCase[] = [
  {
    id: "REC-TA-0728",
    category: "revenue",
    siteId: "trang-an",
    title: "Đối soát ca vé Cổng A",
    counterparty: "Ca sáng · Quầy vé A",
    amountMillion: 79.4,
    due: "11:00 hôm nay",
    status: "ready-to-post",
    priority: "normal",
    owner: "Phạm Thu Trang",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "462 vé · QR/POS/tiền mặt · chênh lệch 0 đồng",
    documents: ["Bảng kê 462 vé", "Biên bản chốt ca", "Báo cáo POS", "Phiếu nộp quỹ"],
    missingDocuments: [],
    dimensions: ["Tràng An", "Cổng A", "Vé tham quan", "OPS-GATE-A"],
    journal: [
      { account: "111/112", label: "Tiền mặt và tiền gửi", debitMillion: 79.4, creditMillion: 0 },
      { account: "511", label: "Doanh thu cung cấp dịch vụ", debitMillion: 0, creditMillion: 72.18 },
      { account: "3331", label: "Thuế GTGT phải nộp", debitMillion: 0, creditMillion: 7.22 },
    ],
    timeline: ["07:28 · Nhân viên mở ca", "10:12 · Quản lý xác nhận chốt ca", "10:24 · Kế toán khớp đủ 4 nguồn", "10:31 · Kế toán trưởng duyệt"],
  },
  {
    id: "REC-TC-0728",
    category: "revenue",
    siteId: "tam-chuc",
    title: "Chênh lệch QR và báo cáo quầy",
    counterparty: "Cổng Khách Điện · Ca sáng",
    amountMillion: 18,
    due: "10:50 hôm nay",
    status: "awaiting-source",
    priority: "urgent",
    owner: "Phạm Thu Trang",
    checker: "Trưởng ca Tam Chúc",
    source: "8 giao dịch QR chưa khớp settlement ngân hàng",
    documents: ["Bảng kê vé", "Biên bản chốt ca", "Danh sách QR lỗi"],
    missingDocuments: ["Giải trình trưởng ca", "Settlement ngân hàng 10:30"],
    dimensions: ["Tam Chúc", "Cổng Khách Điện", "QR", "OPS-GATE-TC"],
    journal: [],
    timeline: ["09:42 · Hệ thống phát hiện chênh lệch", "09:48 · Quản lý phân loại 8 giao dịch", "10:02 · Chuyển kế toán kiểm tra"],
  },
  {
    id: "AP-TC-011",
    category: "payable",
    siteId: "tam-chuc",
    title: "Thanh toán 184 chuyến xe tăng cường",
    counterparty: "Vận tải Minh Long · NCC-006",
    amountMillion: 712,
    due: "30/07/2026",
    status: "drafted",
    priority: "attention",
    owner: "Phạm Thu Trang",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "Hợp đồng vận tải · nghiệm thu 184/184 chuyến",
    documents: ["Hợp đồng", "Lệnh điều xe", "Biên bản nghiệm thu", "Hóa đơn điện tử", "Đề nghị thanh toán"],
    missingDocuments: [],
    dimensions: ["Tam Chúc", "Trung chuyển", "Nhà cung cấp", "OPS-TRANSIT"],
    journal: [
      { account: "627", label: "Chi phí vận hành", debitMillion: 647.27, creditMillion: 0 },
      { account: "1331", label: "Thuế GTGT được khấu trừ", debitMillion: 64.73, creditMillion: 0 },
      { account: "331", label: "Phải trả nhà cung cấp", debitMillion: 0, creditMillion: 712 },
    ],
    timeline: ["27/07 · Quản lý nghiệm thu 184 chuyến", "28/07 08:15 · NCC gửi hóa đơn", "28/07 09:36 · Kế toán hoàn tất 3-way match", "28/07 10:05 · Lập bút toán nháp"],
  },
  {
    id: "AP-TA-041",
    category: "payable",
    siteId: "trang-an",
    title: "Suất ăn đoàn thiếu biên bản nghiệm thu",
    counterparty: "Ẩm thực Tràng An Xanh · NCC-011",
    amountMillion: 146,
    due: "16:00 hôm nay",
    status: "awaiting-source",
    priority: "attention",
    owner: "Phạm Thu Trang",
    checker: "Quản lý Tràng An",
    source: "Hóa đơn 000184 · 1.240 suất ăn đoàn",
    documents: ["Hợp đồng", "Hóa đơn điện tử", "Bảng kê suất ăn"],
    missingDocuments: ["Biên bản nghiệm thu", "Xác nhận điều chỉnh 12 suất trẻ em"],
    dimensions: ["Tràng An", "Ẩm thực", "Khách đoàn", "FNB-GROUP"],
    journal: [],
    timeline: ["08:42 · NCC gửi hồ sơ", "09:06 · Kế toán phát hiện thiếu nghiệm thu", "09:12 · Đã trả việc cho quản lý cơ sở"],
  },
  {
    id: "EXP-BD-031",
    category: "expense",
    siteId: "bai-dinh",
    title: "Hoàn ứng vật tư Đêm hội Hoa đăng",
    counterparty: "Nguyễn Hoài An · Ban sự kiện",
    amountMillion: 28.6,
    due: "15:00 hôm nay",
    status: "reviewing",
    priority: "normal",
    owner: "Phạm Thu Trang",
    checker: "Quản lý dự án Bái Đính",
    source: "Tạm ứng 30 triệu · hoàn lại 1,4 triệu",
    documents: ["Đề nghị tạm ứng", "Ủy quyền mua hộ", "Hóa đơn", "Chứng từ chuyển khoản"],
    missingDocuments: [],
    dimensions: ["Bái Đính", "Dự án Hoa đăng", "Vật tư", "EVENT-BD-014"],
    journal: [
      { account: "641", label: "Chi phí sự kiện", debitMillion: 28.6, creditMillion: 0 },
      { account: "141", label: "Tạm ứng nhân viên", debitMillion: 0, creditMillion: 28.6 },
    ],
    timeline: ["25/07 · Giải ngân tạm ứng", "28/07 08:54 · Nhân viên nộp hồ sơ", "28/07 09:40 · Quản lý dự án xác nhận vật tư"],
  },
  {
    id: "PAY-TA-0726",
    category: "payroll",
    siteId: "trang-an",
    title: "Khóa bảng công và phụ cấp tháng 7",
    counterparty: "84 nhân sự Tràng An",
    amountMillion: 1180,
    due: "31/07/2026",
    status: "awaiting-source",
    priority: "attention",
    owner: "Lê Thị Vân · Kế toán lương",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "84/89 nhân sự đủ bảng công · 3 ngoại lệ làm thêm",
    documents: ["Bảng công đã khóa", "Bảng phân ca", "Danh sách phụ cấp"],
    missingDocuments: ["Xác nhận 3 ca làm thêm", "Quyết định điều chỉnh phụ cấp"],
    dimensions: ["Tràng An", "Nhân sự", "Lương tháng 7", "HR-PAYROLL"],
    journal: [],
    timeline: ["27/07 · Hệ thống tổng hợp bảng công", "28/07 08:10 · Quản lý xác nhận 81 hồ sơ", "28/07 09:20 · Trả 3 ngoại lệ về cơ sở"],
  },
  {
    id: "FA-TC-024",
    category: "asset",
    siteId: "tam-chuc",
    title: "Ghi tăng 4 xe điện mới",
    counterparty: "Thiết bị Minh Phát",
    amountMillion: 3240,
    due: "31/07/2026",
    status: "reviewing",
    priority: "normal",
    owner: "Phạm Thu Trang",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "4 xe đã bàn giao · sẵn sàng sử dụng 27/07",
    documents: ["Hợp đồng", "Hóa đơn", "Biên bản bàn giao", "Hồ sơ kỹ thuật", "Quyết định đưa vào sử dụng"],
    missingDocuments: [],
    dimensions: ["Tam Chúc", "Đội xe điện", "TSCĐ", "ASSET-EV"],
    journal: [
      { account: "211", label: "Tài sản cố định hữu hình", debitMillion: 2945.45, creditMillion: 0 },
      { account: "1331", label: "Thuế GTGT được khấu trừ", debitMillion: 294.55, creditMillion: 0 },
      { account: "331", label: "Phải trả nhà cung cấp", debitMillion: 0, creditMillion: 3240 },
    ],
    timeline: ["27/07 14:30 · Kỹ thuật bàn giao", "28/07 08:05 · Quản lý xác nhận vị trí/người giữ", "28/07 10:10 · Kế toán kiểm tra hồ sơ tài sản"],
  },
  {
    id: "INV-ALL-0728",
    category: "invoice",
    siteId: "all",
    title: "Hóa đơn máy tính tiền chưa truyền thành công",
    counterparty: "12 giao dịch tại 3 cơ sở",
    amountMillion: 38.6,
    due: "12:00 hôm nay",
    status: "new",
    priority: "urgent",
    owner: "Phạm Thu Trang",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "Mã lỗi kết nối cơ quan thuế · không trùng doanh thu",
    documents: ["Nhật ký máy tính tiền", "Danh sách giao dịch", "Mã lỗi truyền nhận"],
    missingDocuments: [],
    dimensions: ["Toàn vùng", "Hóa đơn điện tử", "Máy tính tiền", "EINVOICE"],
    journal: [],
    timeline: ["09:15 · Hệ thống ghi nhận 12 lỗi", "09:18 · Tự động thử gửi lại lần 1", "09:45 · Tạo hàng việc cho kế toán"],
  },
  {
    id: "CLOSE-0726",
    category: "close",
    siteId: "all",
    title: "Đóng kỳ tháng 7/2026",
    counterparty: "Toàn vùng",
    amountMillion: 0,
    due: "05/08/2026",
    status: "reviewing",
    priority: "attention",
    owner: "Phạm Thu Trang",
    checker: "Kế toán trưởng Nguyễn Hải Yến",
    source: "18/22 checklist hoàn tất · còn 4 ngoại lệ",
    documents: ["Đối soát ngân hàng", "Tuổi nợ AR/AP", "Bảng khấu hao", "Cân đối phát sinh"],
    missingDocuments: ["Khóa bảng lương", "Xử lý 2 hóa đơn lỗi", "Dồn tích festival", "Xác nhận công nợ NCC-011"],
    dimensions: ["Toàn vùng", "Tháng 7/2026", "Khóa kỳ", "GL-CLOSE"],
    journal: [],
    timeline: ["25/07 · Mở checklist đóng kỳ", "28/07 08:00 · 18 bước hoàn tất", "28/07 10:00 · Còn 4 ngoại lệ có người phụ trách"],
  },
] as const;

export function journalTotals(accountingCase: AccountingCase) {
  return accountingCase.journal.reduce(
    (totals, line) => ({
      debitMillion: totals.debitMillion + line.debitMillion,
      creditMillion: totals.creditMillion + line.creditMillion,
    }),
    { debitMillion: 0, creditMillion: 0 },
  );
}
