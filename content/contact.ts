/**
 * WEB-STRUCT-02: nguồn liên hệ đặt chỗ qua điện thoại/email DUY NHẤT cho
 * web công khai. Số và email THẬT, lấy nguyên vẹn từ chỗ trước đây đang
 * khai cứng trong `components/discovery/seasonal-experience-browser.tsx`
 * (dòng ~59) -- không đổi giá trị, không tạo nguồn thứ hai. Cả
 * `seasonal-experience-browser.tsx` lẫn
 * `components/discovery/package-showcase.tsx` đều import từ đây.
 */
export const CONTACT = {
  email: "xuantruong_nb@hn.vnn.vn",
  phoneHref: "tel:+842293876930",
  phoneLabel: "0229 387 6930",
} as const;
