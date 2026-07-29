import type { ErpSiteId } from "./erp";

export const ERP_DAILY_FINANCE = {
  asOf: "10:20",
  revenueMillion: 1840,
  collectedMillion: 1620,
  receivableMillion: 220,
  operatingCostMillion: 1170,
  operatingProfitMillion: 670,
  marginPercent: 36.4,
  payablesDueMillion: 428,
  payablesApprovedMillion: 286,
  payablesPendingDocumentsMillion: 142,
  reconciliationVarianceMillion: 46,
} as const;

export const ERP_COST_BREAKDOWN = [
  { label: "Nhân sự & ca tăng cường", valueMillion: 326 },
  { label: "Xe, thuyền, nhiên liệu", valueMillion: 241 },
  { label: "Đối tác vận hành", valueMillion: 284 },
  { label: "Bảo trì, điện nước", valueMillion: 167 },
  { label: "Marketing & sự kiện", valueMillion: 96 },
  { label: "Phí bán vé & chi phí khác", valueMillion: 56 },
] as const;

export const ERP_SITE_FINANCE = [
  { id: "tam-chuc", revenueMillion: 618, costMillion: 407, profitMillion: 211, monthRevenueBillion: 12.8, monthProfitBillion: 4.2, change: "+12,4%", share: 34 },
  { id: "trang-an", revenueMillion: 486, costMillion: 301, profitMillion: 185, monthRevenueBillion: 9.7, monthProfitBillion: 3.6, change: "+5,2%", share: 26 },
  { id: "bai-dinh", revenueMillion: 474, costMillion: 294, profitMillion: 180, monthRevenueBillion: 10.6, monthProfitBillion: 3.8, change: "+7,8%", share: 26 },
  { id: "tam-coc", revenueMillion: 262, costMillion: 168, profitMillion: 94, monthRevenueBillion: 5.5, monthProfitBillion: 2.0, change: "−1,6%", share: 14 },
] as const;

export const ERP_WORKFORCE_SUMMARY = [
  { siteId: "tam-chuc", planned: 120, onShift: 112, permanentOnShift: 85, seasonalOnShift: 27, late: 5, absent: 8, overtimeRisk: 4 },
  { siteId: "trang-an", planned: 88, onShift: 84, permanentOnShift: 70, seasonalOnShift: 14, late: 3, absent: 4, overtimeRisk: 2 },
  { siteId: "bai-dinh", planned: 97, onShift: 96, permanentOnShift: 80, seasonalOnShift: 16, late: 2, absent: 1, overtimeRisk: 2 },
  { siteId: "tam-coc", planned: 60, onShift: 57, permanentOnShift: 46, seasonalOnShift: 11, late: 2, absent: 3, overtimeRisk: 1 },
] as const;

export type ErpFinancePeriodId = "today" | "month" | "quarter" | "year";
export type ErpFinanceMetricId = "revenue" | "cost" | "profit" | "collected" | "payables";

export type ErpFinanceMetric = {
  label: string;
  valueMillion: number;
  pulse: string;
  comparisons: readonly { label: string; value: string; favorable: boolean }[];
  breakdown: readonly { label: string; valueMillion: number }[];
  source: string;
};

export type ErpFinancePeriod = {
  label: string;
  range: string;
  asOf: string;
  subtitle: string;
  delta: string;
  reconciliationVarianceMillion: number;
  metrics: Record<ErpFinanceMetricId, ErpFinanceMetric>;
};

const revenueBreakdown = {
  today: [["Vé tham quan", 896], ["Thuyền & xe điện", 478], ["Ẩm thực & bán lẻ", 294], ["Đối tác khác", 172]],
  month: [["Vé tham quan", 18900], ["Thuyền & xe điện", 10000], ["Ẩm thực & bán lẻ", 6200], ["Đối tác khác", 3500]],
  quarter: [["Vé tham quan", 53000], ["Thuyền & xe điện", 28100], ["Ẩm thực & bán lẻ", 17300], ["Đối tác khác", 9800]],
  year: [["Vé tham quan", 140300], ["Thuyền & xe điện", 74500], ["Ẩm thực & bán lẻ", 45800], ["Đối tác khác", 25800]],
} as const;

const collectedBreakdown = {
  today: [["Chuyển khoản & QR", 714], ["Thẻ/POS", 438], ["Tiền mặt tại quầy", 326], ["Đối tác đã thanh toán", 142]],
  month: [["Chuyển khoản & QR", 15800], ["Thẻ/POS", 9700], ["Tiền mặt tại quầy", 7200], ["Đối tác đã thanh toán", 3200]],
  quarter: [["Chuyển khoản & QR", 44600], ["Thẻ/POS", 27400], ["Tiền mặt tại quầy", 20300], ["Đối tác đã thanh toán", 9100]],
  year: [["Chuyển khoản & QR", 119600], ["Thẻ/POS", 73400], ["Tiền mặt tại quầy", 54400], ["Đối tác đã thanh toán", 24400]],
} as const;

const payableBreakdown = {
  today: [["Nhà cung cấp vận tải", 168], ["Dịch vụ ăn uống", 112], ["Bảo trì & vật tư", 94], ["Hoa hồng đối tác", 54]],
  month: [["Nhà cung cấp vận tải", 2600], ["Dịch vụ ăn uống", 1800], ["Bảo trì & vật tư", 1400], ["Hoa hồng đối tác", 1000]],
  quarter: [["Nhà cung cấp vận tải", 7100], ["Dịch vụ ăn uống", 4800], ["Bảo trì & vật tư", 3900], ["Hoa hồng đối tác", 2800]],
  year: [["Nhà cung cấp vận tải", 16400], ["Dịch vụ ăn uống", 11200], ["Bảo trì & vật tư", 9100], ["Hoa hồng đối tác", 6500]],
} as const;

function rows(values: readonly (readonly [string, number])[]) {
  return values.map(([label, valueMillion]) => ({ label, valueMillion }));
}

export const ERP_FINANCE_REPORT: Record<ErpFinancePeriodId, ErpFinancePeriod> = {
  today: {
    label: "Hôm nay", range: "28/07/2026", asOf: ERP_DAILY_FINANCE.asOf, subtitle: `đến ${ERP_DAILY_FINANCE.asOf}`, delta: "+7,0%", reconciliationVarianceMillion: 46,
    metrics: {
      revenue: { label: "Doanh thu", valueMillion: 1840, pulse: "+6,9% so với cùng giờ hôm qua", comparisons: [{ label: "Cùng giờ hôm qua", value: "+118 triệu · +6,9%", favorable: true }, { label: "Cùng ngày năm trước", value: "+174 triệu · +10,4%", favorable: true }, { label: "Kế hoạch đến 10:20", value: "+120 triệu · +7,0%", favorable: true }], breakdown: rows(revenueBreakdown.today), source: "Giao dịch quầy vé, website, máy POS và bảng kê đối tác đã đối soát đến 10:20." },
      cost: { label: "Chi phí ghi nhận", valueMillion: 1170, pulse: "Thấp hơn kế hoạch 74 triệu", comparisons: [{ label: "Cùng giờ hôm qua", value: "+31 triệu · +2,7%", favorable: false }, { label: "Cùng ngày năm trước", value: "+66 triệu · +6,0%", favorable: false }, { label: "Kế hoạch đến 10:20", value: "−74 triệu · −5,9%", favorable: true }], breakdown: ERP_COST_BREAKDOWN.map(({ label, valueMillion }) => ({ label, valueMillion })), source: "Phiếu chi, bảng ca, nghiệm thu dịch vụ và chi phí vận hành đã có mã hạch toán." },
      profit: { label: "Lợi nhuận vận hành", valueMillion: 670, pulse: "Biên 36,4% · tăng 87 triệu", comparisons: [{ label: "Cùng giờ hôm qua", value: "+87 triệu · +14,9%", favorable: true }, { label: "Cùng ngày năm trước", value: "+108 triệu · +19,2%", favorable: true }, { label: "Kế hoạch đến 10:20", value: "+194 triệu · +40,8%", favorable: true }], breakdown: ERP_SITE_FINANCE.map((site) => ({ label: site.id === "tam-chuc" ? "Tam Chúc" : site.id === "trang-an" ? "Tràng An" : site.id === "bai-dinh" ? "Bái Đính" : "Tam Cốc", valueMillion: site.profitMillion })), source: "Doanh thu thuần trừ chi phí vận hành đã ghi nhận; chưa gồm thuế thu nhập doanh nghiệp." },
      collected: { label: "Tiền đã thu", valueMillion: 1620, pulse: "88,0% doanh thu đã về", comparisons: [{ label: "Cùng giờ hôm qua", value: "+102 triệu · +6,7%", favorable: true }, { label: "Cùng ngày năm trước", value: "+151 triệu · +10,3%", favorable: true }, { label: "So với doanh thu", value: "Còn 220 triệu chưa thu", favorable: false }], breakdown: rows(collectedBreakdown.today), source: "Sao kê ngân hàng, POS và chốt két quầy vé; loại trừ hoàn vé và phí kênh bán." },
      payables: { label: "Phải trả đến hạn", valueMillion: 428, pulse: "142 triệu còn thiếu chứng từ", comparisons: [{ label: "Đến hạn hôm qua", value: "+36 triệu · +9,2%", favorable: false }, { label: "Bình quân 30 ngày", value: "−21 triệu · −4,7%", favorable: true }, { label: "Đủ điều kiện thanh toán", value: "286 triệu · 66,8%", favorable: true }], breakdown: rows(payableBreakdown.today), source: "Công nợ đến hạn theo hợp đồng; 4 chứng từ đang chờ nghiệm thu hoặc bổ sung hóa đơn." },
    },
  },
  month: {
    label: "Tháng", range: "Tháng 7/2026", asOf: "đến ngày 28/07", subtitle: "tháng 7/2026", delta: "+8,4%", reconciliationVarianceMillion: 92,
    metrics: {
      revenue: { label: "Doanh thu", valueMillion: 38600, pulse: "+8,4% so với kế hoạch", comparisons: [{ label: "Tháng trước", value: "+3,0 tỷ · +8,4%", favorable: true }, { label: "Cùng tháng năm trước", value: "+4,4 tỷ · +12,9%", favorable: true }, { label: "Kế hoạch tháng", value: "+3,0 tỷ · +8,4%", favorable: true }], breakdown: rows(revenueBreakdown.month), source: "Doanh thu lũy kế tháng từ các kênh bán đã đối soát đến ngày 28/07." },
      cost: { label: "Chi phí ghi nhận", valueMillion: 25000, pulse: "Thấp hơn ngân sách 700 triệu", comparisons: [{ label: "Tháng trước", value: "+1,2 tỷ · +5,0%", favorable: false }, { label: "Cùng tháng năm trước", value: "+1,9 tỷ · +8,2%", favorable: false }, { label: "Ngân sách tháng", value: "−0,7 tỷ · −2,7%", favorable: true }], breakdown: rows([["Nhân sự & ca vận hành", 8500], ["Vận chuyển & nhiên liệu", 6000], ["Đối tác & dịch vụ", 5500], ["Bảo trì, điện nước, khác", 5000]]), source: "Chi phí tháng đã có chứng từ hoặc bảng phân bổ được kế toán ghi nhận." },
      profit: { label: "Lợi nhuận vận hành", valueMillion: 13600, pulse: "Biên 35,2% · tăng 1,8 tỷ", comparisons: [{ label: "Tháng trước", value: "+1,8 tỷ · +15,3%", favorable: true }, { label: "Cùng tháng năm trước", value: "+2,5 tỷ · +22,5%", favorable: true }, { label: "Kế hoạch tháng", value: "+3,7 tỷ · +37,4%", favorable: true }], breakdown: ERP_SITE_FINANCE.map((site) => ({ label: site.id === "tam-chuc" ? "Tam Chúc" : site.id === "trang-an" ? "Tràng An" : site.id === "bai-dinh" ? "Bái Đính" : "Tam Cốc", valueMillion: site.monthProfitBillion * 1000 })), source: "Lợi nhuận vận hành lũy kế tháng; chưa gồm thuế thu nhập doanh nghiệp." },
      collected: { label: "Tiền đã thu", valueMillion: 35900, pulse: "93,0% doanh thu đã về", comparisons: [{ label: "Tháng trước", value: "+2,9 tỷ · +8,8%", favorable: true }, { label: "Cùng tháng năm trước", value: "+3,8 tỷ · +11,8%", favorable: true }, { label: "So với doanh thu", value: "Còn 2,7 tỷ chưa thu", favorable: false }], breakdown: rows(collectedBreakdown.month), source: "Tiền thực nhận trong tháng sau hoàn vé, phí thanh toán và phí kênh bán." },
      payables: { label: "Phải trả đến hạn", valueMillion: 6800, pulse: "1,4 tỷ thiếu chứng từ", comparisons: [{ label: "Cuối tháng trước", value: "−0,3 tỷ · −4,2%", favorable: true }, { label: "Bình quân 12 tháng", value: "+0,4 tỷ · +6,3%", favorable: false }, { label: "Đủ điều kiện thanh toán", value: "5,4 tỷ · 79,4%", favorable: true }], breakdown: rows(payableBreakdown.month), source: "Công nợ đến hạn trong tháng theo ngày thanh toán trên hợp đồng và hóa đơn." },
    },
  },
  quarter: {
    label: "Quý", range: "Quý II/2026 · gần nhất đã khóa", asOf: "khóa sổ 30/06", subtitle: "quý II/2026", delta: "+11,8%", reconciliationVarianceMillion: 182,
    metrics: {
      revenue: { label: "Doanh thu", valueMillion: 108200, pulse: "+11,8% so với kế hoạch", comparisons: [{ label: "Quý trước", value: "+6,7 tỷ · +6,6%", favorable: true }, { label: "Cùng quý năm trước", value: "+11,8 tỷ · +12,2%", favorable: true }, { label: "Kế hoạch quý", value: "+11,4 tỷ · +11,8%", favorable: true }], breakdown: rows(revenueBreakdown.quarter), source: "Doanh thu quý II hợp nhất từ bốn cơ sở và toàn bộ kênh bán." },
      cost: { label: "Chi phí ghi nhận", valueMillion: 70400, pulse: "Thấp hơn ngân sách 2,3 tỷ", comparisons: [{ label: "Quý trước", value: "+3,0 tỷ · +4,5%", favorable: false }, { label: "Cùng quý năm trước", value: "+5,4 tỷ · +8,3%", favorable: false }, { label: "Ngân sách quý", value: "−2,3 tỷ · −3,2%", favorable: true }], breakdown: rows([["Nhân sự & ca vận hành", 23900], ["Vận chuyển & nhiên liệu", 16900], ["Đối tác & dịch vụ", 15500], ["Bảo trì, điện nước, khác", 14100]]), source: "Chi phí thực tế quý theo sổ cái và các khoản phân bổ đã khóa kỳ." },
      profit: { label: "Lợi nhuận vận hành", valueMillion: 37800, pulse: "Biên 34,9% · tăng 3,7 tỷ", comparisons: [{ label: "Quý trước", value: "+3,7 tỷ · +10,9%", favorable: true }, { label: "Cùng quý năm trước", value: "+6,4 tỷ · +20,4%", favorable: true }, { label: "Kế hoạch quý", value: "+13,7 tỷ · +56,8%", favorable: true }], breakdown: rows([["Tam Chúc", 11700], ["Tràng An", 10000], ["Bái Đính", 10600], ["Tam Cốc", 5500]]), source: "Lợi nhuận vận hành quý II trước thuế thu nhập doanh nghiệp." },
      collected: { label: "Tiền đã thu", valueMillion: 101400, pulse: "93,7% doanh thu đã về", comparisons: [{ label: "Quý trước", value: "+6,1 tỷ · +6,4%", favorable: true }, { label: "Cùng quý năm trước", value: "+9,6 tỷ · +10,5%", favorable: true }, { label: "So với doanh thu", value: "Còn 6,8 tỷ chưa thu", favorable: false }], breakdown: rows(collectedBreakdown.quarter), source: "Tiền thực nhận trong quý đã khớp với sao kê, POS và chốt két." },
      payables: { label: "Phải trả đến hạn", valueMillion: 18600, pulse: "3,7 tỷ thiếu chứng từ", comparisons: [{ label: "Cuối quý trước", value: "−0,7 tỷ · −3,6%", favorable: true }, { label: "Bình quân 8 quý", value: "+0,9 tỷ · +5,1%", favorable: false }, { label: "Đủ điều kiện thanh toán", value: "14,9 tỷ · 80,1%", favorable: true }], breakdown: rows(payableBreakdown.quarter), source: "Công nợ phải trả có hạn thanh toán nằm trong quý II/2026." },
    },
  },
  year: {
    label: "Năm", range: "Năm 2026", asOf: "đến ngày 28/07", subtitle: "lũy kế 2026", delta: "+14,2%", reconciliationVarianceMillion: 540,
    metrics: {
      revenue: { label: "Doanh thu", valueMillion: 286400, pulse: "+14,2% so với kế hoạch", comparisons: [{ label: "Cùng kỳ 2025", value: "+34,8 tỷ · +13,8%", favorable: true }, { label: "Bình quân 2023–2025", value: "+41,4 tỷ · +16,9%", favorable: true }, { label: "Kế hoạch lũy kế", value: "+35,6 tỷ · +14,2%", favorable: true }], breakdown: rows(revenueBreakdown.year), source: "Doanh thu lũy kế năm đến 28/07, so cùng số ngày của các kỳ lịch sử." },
      cost: { label: "Chi phí ghi nhận", valueMillion: 189100, pulse: "Thấp hơn ngân sách 9,7 tỷ", comparisons: [{ label: "Cùng kỳ 2025", value: "+14,1 tỷ · +8,1%", favorable: false }, { label: "Bình quân 2023–2025", value: "+17,6 tỷ · +10,3%", favorable: false }, { label: "Ngân sách lũy kế", value: "−9,7 tỷ · −4,9%", favorable: true }], breakdown: rows([["Nhân sự & ca vận hành", 64300], ["Vận chuyển & nhiên liệu", 45400], ["Đối tác & dịch vụ", 41600], ["Bảo trì, điện nước, khác", 37800]]), source: "Chi phí lũy kế năm từ sổ cái, lương, nghiệm thu và phân bổ định kỳ." },
      profit: { label: "Lợi nhuận vận hành", valueMillion: 97300, pulse: "Biên 34,0% · tăng 20,7 tỷ", comparisons: [{ label: "Cùng kỳ 2025", value: "+20,7 tỷ · +27,0%", favorable: true }, { label: "Bình quân 2023–2025", value: "+23,8 tỷ · +32,4%", favorable: true }, { label: "Kế hoạch lũy kế", value: "+45,3 tỷ · +87,1%", favorable: true }], breakdown: rows([["Tam Chúc", 30100], ["Tràng An", 26000], ["Bái Đính", 27200], ["Tam Cốc", 14000]]), source: "Lợi nhuận vận hành lũy kế năm; chưa gồm thuế thu nhập doanh nghiệp." },
      collected: { label: "Tiền đã thu", valueMillion: 271800, pulse: "94,9% doanh thu đã về", comparisons: [{ label: "Cùng kỳ 2025", value: "+30,0 tỷ · +12,4%", favorable: true }, { label: "Bình quân 2023–2025", value: "+36,1 tỷ · +15,3%", favorable: true }, { label: "So với doanh thu", value: "Còn 14,6 tỷ chưa thu", favorable: false }], breakdown: rows(collectedBreakdown.year), source: "Tiền thực nhận lũy kế năm sau hoàn vé và phí kênh bán." },
      payables: { label: "Phải trả đến hạn", valueMillion: 43200, pulse: "7,8 tỷ thiếu chứng từ", comparisons: [{ label: "Cùng ngày năm 2025", value: "−1,2 tỷ · −2,7%", favorable: true }, { label: "Bình quân 2023–2025", value: "−0,8 tỷ · −1,8%", favorable: true }, { label: "Đủ điều kiện thanh toán", value: "35,4 tỷ · 81,9%", favorable: true }], breakdown: rows(payableBreakdown.year), source: "Công nợ còn mở tại ngày 28/07/2026, không cộng các khoản chưa đến hạn." },
    },
  },
};

export function formatFinanceAmount(valueMillion: number) {
  if (Math.abs(valueMillion) < 1000) return `${valueMillion.toLocaleString("vi-VN")} triệu`;
  const billion = valueMillion / 1000;
  return `${billion.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
}

export type ProjectEvent = {
  siteId: ErpSiteId;
  name: string;
  date: string;
  daysLeft: number;
  progress: number;
  budgetBillion: number;
  committedBillion: number;
  expectedGuests: number;
  urgentCount: number;
  nextMilestone: string;
};

export const ERP_PROJECT_EVENTS: readonly ProjectEvent[] = [
  { siteId: "trang-an", name: "Lễ hội Tràng An 2026", date: "14/08/2026", daysLeft: 17, progress: 68, budgetBillion: 12.8, committedBillion: 9.4, expectedGuests: 35000, urgentCount: 2, nextMilestone: "Chốt phương án phân luồng trước 29/07" },
  { siteId: "tam-chuc", name: "Tuần Văn hóa Tam Chúc", date: "01/09/2026", daysLeft: 35, progress: 42, budgetBillion: 8.6, committedBillion: 5.1, expectedGuests: 24000, urgentCount: 1, nextMilestone: "Nghiệm thu sân khấu trước 04/08" },
  { siteId: "tam-coc", name: "Festival Sắc vàng Tam Cốc", date: "12/09/2026", daysLeft: 46, progress: 35, budgetBillion: 6.2, committedBillion: 3.4, expectedGuests: 18000, urgentCount: 1, nextMilestone: "Khóa danh sách nhà cung ứng trước 06/08" },
  { siteId: "bai-dinh", name: "Đêm hội Hoa đăng Bái Đính", date: "26/09/2026", daysLeft: 60, progress: 28, budgetBillion: 9.1, committedBillion: 4.0, expectedGuests: 28000, urgentCount: 0, nextMilestone: "Duyệt thiết kế ánh sáng trước 10/08" },
] as const;
