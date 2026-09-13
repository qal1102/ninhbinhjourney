/**
 * Địa chỉ gốc công khai của trang web, cho thẻ canonical, ảnh chia sẻ, sitemap
 * và robots.
 *
 * Đọc từ `NEXT_PUBLIC_SITE_URL` — chính biến mà bảng kiểm phát hành đã đòi trỏ
 * đúng production — để không đặt thêm một địa chỉ thứ hai ở đâu đó rồi hai nơi
 * lệch nhau. Biến thiếu hoặc không phải https thì dùng địa chỉ production
 * hiện hành, vì một sitemap trỏ về localhost còn tệ hơn không có sitemap.
 */
const DIA_CHI_PRODUCTION = "https://ninhbinhjourney.vercel.app";

function docDiaChi() {
  const tuBien = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!tuBien) return DIA_CHI_PRODUCTION;
  try {
    const url = new URL(tuBien);
    if (url.protocol !== "https:") return DIA_CHI_PRODUCTION;
    return url.origin;
  } catch {
    return DIA_CHI_PRODUCTION;
  }
}

export const SITE_URL = docDiaChi();

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}
