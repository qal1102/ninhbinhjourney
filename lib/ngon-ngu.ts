/**
 * Ngôn ngữ của web khách: `?lang=` trên đường dẫn thắng, rồi tới cookie
 * `ninh-binh-lang` mà nút VI/EN ghi lại. Trang chủ dùng đúng luật này từ đầu;
 * trước 30/09/2026 các trang khác (Khám phá, Gói, điểm đến, đặt vé…) bỏ qua
 * nó, nên khách bấm EN ở trang chủ rồi bấm sang trang nào cũng về tiếng Việt.
 *
 * Tệp này không đụng `cookies()` để dùng được cả ở trình duyệt; phần đọc
 * cookie phía máy chủ nằm ở `lib/ngon-ngu-server.ts`.
 */

export type NgonNgu = "vi" | "en";

export const KHOA_NGON_NGU = "ninh-binh-lang";

export function chonNgonNgu(thamSo: unknown, daLuu: unknown): NgonNgu {
  const xin = Array.isArray(thamSo) ? thamSo[0] : thamSo;
  if (xin === "en" || xin === "vi") return xin;
  return daLuu === "en" ? "en" : "vi";
}

/** Chọn chữ theo ngôn ngữ, viết gọn tại chỗ: `ch(lang, "Gói", "Packages")`. */
export function ch(lang: NgonNgu, vi: string, en: string): string {
  return lang === "en" ? en : vi;
}

/** Ngày giờ theo đúng thói quen đọc của từng ngôn ngữ. */
export function maVung(lang: NgonNgu): string {
  return lang === "en" ? "en-GB" : "vi-VN";
}
