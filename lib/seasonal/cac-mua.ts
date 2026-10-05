import { tinhTrangHoaSung } from "@/domain/mua-hoa-sung";
import { isMidAutumnSeasonOpen } from "./mid-autumn-season";
import { DUONG_DAN_MUA, type TrangMua } from "./trang-mua";

/**
 * Kệ các mùa: mọi sự kiện theo mùa web đã dựng, cả mùa đang mở lẫn mùa đã
 * khép. Chủ dự án (06/10/2026): mùa đã qua như Trung thu phải ở lại cho khách
 * xem, chỉ ghi rõ là đã khép, không gỡ đi. Trước đó cổng "Sự kiện theo mùa"
 * chuyển hẳn sang hoa súng và không còn lối nào tới trang Trung thu.
 */

export type TrangThaiMua = "dang-mo" | "sap-toi" | "da-khep";

export type ChuongMua = {
  id: TrangMua;
  duongDan: string;
  ten: { vi: string; en: string };
  dong: { vi: string; en: string };
  anh: string;
  viTriAnh: string;
  trangThai: TrangThaiMua;
  nhanTrangThai: { vi: string; en: string };
};

export function cacChuongMua(bayGio: Date = new Date()): ChuongMua[] {
  const hoaSung = tinhTrangHoaSung(bayGio);
  const trungThuMo = isMidAutumnSeasonOpen(bayGio);
  const hoaSungSapToi = hoaSung.giaiDoan === "sap-toi";

  const chuong: ChuongMua[] = [
    {
      id: "hoa-sung",
      duongDan: DUONG_DAN_MUA["hoa-sung"],
      ten: { vi: `Mùa hoa súng Tam Cốc ${hoaSung.mua.nam}`, en: `Tam Coc water lilies ${hoaSung.mua.nam}` },
      dong: {
        vi: "Hoa súng nở trên sông Ngô Đồng, lễ Sắc Hồng và đò sớm đúng giờ hoa mở.",
        en: "Lilies on the Ngo Dong River, the Sac Hong festival and early boats timed to the bloom.",
      },
      anh: "/images/campaigns/hoa-sung/bong-sung-sang-som.webp",
      viTriAnh: "68% 42%",
      trangThai: hoaSungSapToi ? "sap-toi" : "dang-mo",
      nhanTrangThai: hoaSungSapToi
        ? { vi: `Còn ${hoaSung.ngayToiMua} ngày tới mùa hoa`, en: `${hoaSung.ngayToiMua} days to go` }
        : { vi: "Đang mùa hoa", en: "In bloom now" },
    },
    {
      id: "mid-autumn",
      duongDan: DUONG_DAN_MUA["mid-autumn"],
      ten: { vi: "Trung thu 2026", en: "Mid-Autumn 2026" },
      dong: {
        vi: "Ba đêm trăng trên sông Ngô Đồng: Bàn Trăng, hộp bánh và lịch trăng từng đêm.",
        en: "Three moonlit nights on the Ngo Dong: the Moon Table, gift boxes and a night-by-night moon calendar.",
      },
      anh: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp",
      viTriAnh: "50% 55%",
      trangThai: trungThuMo ? "dang-mo" : "da-khep",
      nhanTrangThai: trungThuMo
        ? { vi: "Đang mở", en: "Open now" }
        : { vi: "Đã khép mùa · xem lại", en: "Season closed · look back" },
    },
  ];

  // Mùa đang mở hay sắp tới đứng trước, mùa đã khép xếp sau.
  return chuong.sort((a, b) => Number(a.trangThai === "da-khep") - Number(b.trangThai === "da-khep"));
}
