/**
 * A15-TRUNG-THU-01 (phần còn lại, 18/09/2026). Nguồn sự thật DUY NHẤT cho
 * câu hỏi "mùa Trung thu 2026 trên web công khai còn mở hay đã khép".
 *
 * Bàn Trăng (`content/packages.ts`, slug `ban-trang-tam-coc-2026`) chỉ bán
 * 18–27/09/2026 — `bookingEndDate: "2026-09-27"` — và phía cơ sở dữ liệu
 * cũng ép đúng khung giờ này ở tầng giữ chỗ. Cổng trang chủ, hộp trợ lý hành
 * trình và trang `/seasonal/mid-autumn` đều phải tắt theo ĐÚNG một mốc này,
 * không phải Trung thu (25/09) — sau rằm vẫn còn hai ngày bán Bàn Trăng.
 *
 * Mốc khép tính theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7 cố định quanh
 * năm — không có giờ mùa hè). Chuỗi ISO dưới đây ghi thẳng offset số
 * "+07:00" thay vì tra theo tên vùng, để không phụ thuộc dữ liệu ICU của
 * môi trường chạy (cùng cách làm với `seasonalAccessWindow` ở
 * `lib/erp/demo-data.ts`).
 *
 * Biên: còn trong mùa tới hết 27/09/2026 23:59:59 giờ VN; đúng 00:00:00
 * 28/09/2026 giờ VN trở đi coi là đã khép. Viết thành "trước đúng 00:00
 * ngày kế tiếp" để không phải so sánh giờ/phút/giây lẻ.
 */
export const MID_AUTUMN_SEASON_CLOSES_AT_ISO = "2026-09-28T00:00:00+07:00";

const MID_AUTUMN_SEASON_CLOSES_AT_MS = Date.parse(MID_AUTUMN_SEASON_CLOSES_AT_ISO);

/**
 * `now` mặc định là thời điểm gọi hàm thật (`Date.now()`), nhưng luôn nhận
 * tham số ngoài để bài kiểm và Playwright ép được ngày mà không phải chờ
 * lịch thật hay giả lập đồng hồ hệ điều hành.
 */
export function isMidAutumnSeasonOpen(now: Date | number = Date.now()): boolean {
  const instant = typeof now === "number" ? now : now.getTime();
  return instant < MID_AUTUMN_SEASON_CLOSES_AT_MS;
}
