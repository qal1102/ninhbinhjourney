import { vietnamDayKey } from "@/domain/ticket-window";

/**
 * Bốn ô đầu màn hình báo cáo hiện trường, tính từ chính các báo cáo đọc về.
 *
 * Bản cũ viết `reports.length + 21` rồi kèm ba hằng số chết (19 · 4 · 1),
 * dưới nhãn "Báo cáo hôm nay". Sai hai lần: cộng thêm hai mươi mốt báo cáo
 * không tồn tại, và danh sách nguồn vốn là 50 lượt gần nhất của cơ sở chứ
 * chưa bao giờ là của riêng hôm nay. Cơ sở nào chưa ai báo cáo thì ô vẫn
 * nói 21 trong khi lưới thẻ ngay bên dưới trắng trơn. Kiểm kê 05/09/2026
 * bắt được.
 */
export type FieldReportSummary = {
  today: number;
  awaitingConfirmation: number;
  confirmed: number;
  missingEvidence: number;
};

type SummarySource = {
  status: string;
  imageUrl: string | null;
  createdAt: string;
};

/**
 * Trạng thái là chữ tự do do người nộp chọn, nên so khớp phải chịu được
 * khác biệt dấu và hoa thường. Đừng so bằng `===` với một chuỗi cứng: đổi
 * một chữ trong danh sách chọn là ô đếm về 0 mà không ai hay.
 */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function summarizeFieldReports(
  reports: readonly SummarySource[],
  at: Date,
): FieldReportSummary {
  const dayKey = vietnamDayKey(at);
  return {
    today: reports.filter(
      (report) => vietnamDayKey(new Date(report.createdAt)) === dayKey,
    ).length,
    awaitingConfirmation: reports.filter((report) =>
      normalize(report.status).startsWith("cho "),
    ).length,
    confirmed: reports.filter((report) =>
      normalize(report.status).startsWith("da xac nhan"),
    ).length,
    missingEvidence: reports.filter((report) => report.imageUrl === null).length,
  };
}
