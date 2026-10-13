/**
 * Ảnh đẹp Ninh Bình hằng tháng (13/10/2026, migration 127). Chủ dự án giao em
 * tự quyết giải thưởng. Giải trao bằng vé của chính khu du lịch: người trúng
 * mang mã nhận giải tới quầy, quầy cấp vé mời 0 đ ghi lý do "Giải thi ảnh"
 * (lối vé mời đã có từ 12/10), nên không phát sinh tiền mặt và vé vẫn hiện
 * trong đối soát ca. Thi theo chất lượng ảnh do giám đốc chấm, không bốc
 * thăm, không cần mua vé.
 */

export type LoaiGiai = "nhat" | "nhi" | "ba" | "khuyen-khich";

export const GIAI_THI_ANH: readonly {
  giai: LoaiGiai;
  ten: { vi: string; en: string };
  soLuong: number;
  quaTang: { vi: string; en: string };
  giaTriVnd: number;
}[] = [
  {
    giai: "nhat",
    ten: { vi: "Giải nhất", en: "First prize" },
    soLuong: 1,
    quaTang: {
      vi: "4 vé gói Tràng An sáng, Tam Cốc chiều và ảnh in khổ lớn trưng ở bến Tràng An cả tháng sau, ghi tên tác giả",
      en: "4 tickets for the Trang An morning, Tam Coc afternoon plan, plus a large print shown at Trang An pier for a month with your name",
    },
    giaTriVnd: 1_620_000,
  },
  {
    giai: "nhi",
    ten: { vi: "Giải nhì", en: "Second prize" },
    soLuong: 1,
    quaTang: { vi: "2 vé gói Tràng An sáng, Tam Cốc chiều", en: "2 tickets for the Trang An morning, Tam Coc afternoon plan" },
    giaTriVnd: 810_000,
  },
  {
    giai: "ba",
    ten: { vi: "Giải ba", en: "Third prize" },
    soLuong: 1,
    quaTang: { vi: "2 vé Tràng An", en: "2 Trang An tickets" },
    giaTriVnd: 500_000,
  },
  {
    giai: "khuyen-khich",
    ten: { vi: "Khuyến khích", en: "Honourable mention" },
    soLuong: 5,
    quaTang: { vi: "Mỗi giải 1 vé Tràng An", en: "1 Trang An ticket each" },
    giaTriVnd: 250_000,
  },
];

export function tongGiaTriGiai(): number {
  return GIAI_THI_ANH.reduce((c, g) => c + g.soLuong * g.giaTriVnd, 0);
}

export function tenGiai(giai: string | null, lang: "vi" | "en" = "vi"): string {
  return GIAI_THI_ANH.find((g) => g.giai === giai)?.ten[lang] ?? "";
}

export const DIA_DIEM_THI_ANH = [
  { ma: "trang-an", vi: "Tràng An", en: "Trang An" },
  { ma: "tam-coc", vi: "Tam Cốc – Bích Động", en: "Tam Coc – Bich Dong" },
  { ma: "bai-dinh", vi: "Chùa Bái Đính", en: "Bai Dinh Pagoda" },
  { ma: "tam-chuc", vi: "Tam Chúc", en: "Tam Chuc" },
  { ma: "hoa-lu", vi: "Cố đô Hoa Lư", en: "Hoa Lu Ancient Capital" },
  { ma: "khac", vi: "Nơi khác ở Ninh Bình", en: "Elsewhere in Ninh Binh" },
] as const;

export type MaDiaDiemThiAnh = (typeof DIA_DIEM_THI_ANH)[number]["ma"];

export function laDiaDiemThiAnh(ma: string): ma is MaDiaDiemThiAnh {
  return DIA_DIEM_THI_ANH.some((d) => d.ma === ma);
}

export const ANH_TOI_DA_BYTE = 5 * 1024 * 1024;
export const ANH_MOI_THANG = 3;

/** Tháng theo giờ Việt Nam, dạng YYYY-MM. */
export function thangVN(bayGio = new Date()): string {
  return new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
}

export function thangTruoc(thang: string): string {
  const [n, t] = thang.split("-").map(Number);
  return t === 1 ? `${n - 1}-12` : `${n}-${String(t - 1).padStart(2, "0")}`;
}

/** Thể lệ ngắn, đọc được trên điện thoại. */
export const THE_LE_THI_ANH: readonly { vi: string; en: string }[] = [
  { vi: "Ảnh bạn tự chụp ở Ninh Bình; không ghép, không tạo bằng AI.", en: "Your own photo taken in Ninh Binh; no composites, no AI-generated images." },
  { vi: "Mỗi số điện thoại gửi tối đa 3 ảnh mỗi tháng, ảnh dưới 5 MB.", en: "Up to 3 photos per phone number per month, each under 5 MB." },
  { vi: "Ảnh có người lạ rõ mặt thì bạn cần họ đồng ý.", en: "If strangers' faces are clearly visible, you need their consent." },
  { vi: "Nhận ảnh tới hết ngày cuối tháng; công bố giải trước ngày 5 tháng sau, trên trang này.", en: "Entries close at the end of the month; winners are posted here by the 5th of the next month." },
  { vi: "Bạn giữ bản quyền; Ninh Bình Journey được dùng ảnh để giới thiệu điểm đến, luôn ghi tên bạn.", en: "You keep the copyright; Ninh Binh Journey may use the photo to promote the destination, always with your name." },
  { vi: "Trúng giải: tra bằng số điện thoại để lấy mã nhận giải, mang tới quầy đón khách đổi vé.", en: "Winners: look up your phone number for the claim code and bring it to the visitor desk for your tickets." },
];
