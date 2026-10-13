/**
 * Mã mời bạn (13/10/2026, migration 125). Mỗi số điện thoại đã gắn có một mã
 * `MOI-XXXXXX`. Bạn mua vé trên web bằng mã ấy được giảm 10%; người mời được
 * cộng một lượt tích khi bạn đã qua cổng và để lại số khác số người mời (tối
 * đa 5 lượt mỗi năm). Không gửi tin nhắn nào: khách tự chia sẻ đường dẫn.
 */

/** Trình duyệt nhớ mã mời 30 ngày sau khi mở `/moi/<mã>`, chỉ để điền sẵn ô mã. */
export const COOKIE_MA_MOI = "nbj-ma-moi";
export const NGAY_NHO_MA_MOI = 30;
export const PHAN_TRAM_GIAM_MA_MOI = 10;
export const LUOT_MOI_TOI_DA_MOT_NAM = 5;

const KHUON_MA_MOI = /^MOI-[A-Z0-9]{6}$/;

/** Viết hoa, bỏ khoảng trắng; sai khuôn thì `null`. */
export function chuanHoaMaMoi(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const ma = raw.trim().toUpperCase().replace(/\s+/g, "");
  return KHUON_MA_MOI.test(ma) ? ma : null;
}

/** Phần giảm của mã mời: 10% tạm tính, làm tròn xuống nghìn đồng (đúng như kho). */
export function giamMaMoi(tamTinhVnd: number): number {
  if (!Number.isFinite(tamTinhVnd) || tamTinhVnd <= 0) return 0;
  return Math.floor(tamTinhVnd / 10_000) * 1000;
}

/** Đường dẫn mời để khách gửi cho bạn. */
export function duongDanMoi(goc: string, ma: string): string {
  return `${goc.replace(/\/$/, "")}/moi/${ma}`;
}
