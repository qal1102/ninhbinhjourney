/**
 * QA-P2-09 — đọc lại ngày theo kiểu Việt Nam.
 *
 * Ô `<input type="date">` hiện ngày theo ngôn ngữ của trình duyệt, không theo
 * `lang="vi"` của trang: máy để tiếng Anh thì khách thấy MM/DD/YYYY và dễ đặt
 * nhầm tháng với ngày. Trang không ép được ô gốc, nên đọc lại ngày đã chọn
 * ngay dưới ô: "Thứ Hai, 15/09/2026".
 */
const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function formatVietnameseDate(isoDate: string | null | undefined): string {
  const v = (isoDate ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "";
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (Number.isNaN(t) || d.toISOString().slice(0, 10) !== v) return "";
  return `${THU[d.getUTCDay()]}, ${m[3]}/${m[2]}/${m[1]}`;
}
