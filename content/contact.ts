/**
 * WEB-STRUCT-02: nguồn liên hệ đặt chỗ qua điện thoại/email DUY NHẤT cho
 * web công khai. Số và email THẬT, lấy nguyên vẹn từ chỗ trước đây đang
 * khai cứng trong `components/discovery/seasonal-experience-browser.tsx`
 * (dòng ~59) -- không đổi giá trị, không tạo nguồn thứ hai. Cả
 * `seasonal-experience-browser.tsx` lẫn
 * `components/discovery/package-showcase.tsx` đều import từ đây.
 *
 * QA-P2-09 (14/09/2026): địa chỉ thư từng nằm trần trong `mailto:` của HTML
 * trang chủ, bộ quét thư rác đọc HTML là lấy được. Nay tách hai nửa và chỉ
 * ghép lại trên trình duyệt sau khi trang chạy (`ProtectedMailLink`), nên HTML
 * máy chủ gửi ra không còn chuỗi địa chỉ nào.
 */
export const CONTACT = {
  emailUser: "xuantruong_nb",
  emailDomain: "hn.vnn.vn",
  phoneHref: "tel:+842293876930",
  phoneLabel: "0229 387 6930",
} as const;

/** Ghép `mailto:` — chỉ gọi trên trình duyệt, không đưa vào HTML máy chủ. */
export function contactMailto(subject?: string): string {
  const address = [CONTACT.emailUser, CONTACT.emailDomain].join("@");
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}
