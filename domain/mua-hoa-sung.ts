import {
  CAC_DIP,
  doChacChan,
  homNayTheoGioVN,
  ngayCuaDipTrongNam,
  soNgayGiua,
  type ChacChan,
  type DipMuaVu,
} from "@/domain/lich-mua-vu";

/**
 * Mùa hoa súng trên sông Ngô Đồng (Tam Cốc) và lễ Sắc Hồng Tam Cốc.
 *
 * Ngày lấy từ Lịch mùa vụ (`domain/lich-mua-vu.ts`), không chép lại: trang
 * khách, gói đò sớm và màn Future planning cùng đọc một nguồn. Mọi hàm nhận
 * `bayGio` nên dùng được cho mọi năm, không phải bản dựng riêng cho 2026.
 *
 * Dữ kiện có nguồn:
 * - Hoa nở từ cuối tháng 10 tới tháng 12, mỗi ngày chỉ khoảng 7–10 giờ sáng
 *   rồi cụp lại (Tuổi Trẻ, 26/10/2025).
 * - Sắc Hồng Tam Cốc 2025 – Bản tình ca mùa thu, 22–23/11/2025: hàng trăm
 *   thuyền kết hình hoa súng diễu qua ba hang, có nhạc và ánh sáng, dâng
 *   hương ở đền Thái Vi (dulichninhbinh.com.vn, vntravel.org.vn).
 */

const DIP_MUA = CAC_DIP.find((d) => d.id === "mua-hoa-sung-tam-coc") as DipMuaVu;
const DIP_LE = CAC_DIP.find((d) => d.id === "sac-hong-tam-coc") as DipMuaVu;

export type GiaiDoanHoaSung = "sap-toi" | "dang-no" | "le-hoi" | "cuoi-mua";

export type MuaHoaSung = {
  nam: number;
  /** Khoảng mùa hoa (ước lượng), dạng `YYYY-MM-DD`. */
  tu: string;
  den: string;
  le: { tu: string; den: string; chacChan: ChacChan; nguon?: string };
};

export function muaHoaSungNam(nam: number): MuaHoaSung {
  const mua = ngayCuaDipTrongNam(DIP_MUA, nam)!;
  const le = ngayCuaDipTrongNam(DIP_LE, nam)!;
  return {
    nam,
    tu: mua.batDau,
    den: mua.ketThuc,
    le: { tu: le.batDau, den: le.ketThuc, chacChan: doChacChan(DIP_LE, nam), nguon: DIP_LE.daCongBo?.[nam]?.nguon },
  };
}

export type TinhTrangHoaSung = {
  mua: MuaHoaSung;
  giaiDoan: GiaiDoanHoaSung;
  homNay: string;
  /** Số ngày tới khi mùa hoa bắt đầu (0 nếu đã vào mùa). */
  ngayToiMua: number;
  /** Số ngày tới lễ (âm nếu lễ đã qua). */
  ngayToiLe: number;
};

/**
 * Mùa đang diễn ra hoặc sắp tới: qua hết mùa năm nay thì nhìn sang năm sau,
 * nên trang không bao giờ nói về một mùa đã khép.
 */
export function tinhTrangHoaSung(bayGio: Date): TinhTrangHoaSung {
  const homNay = homNayTheoGioVN(bayGio);
  const namNay = Number(homNay.slice(0, 4));
  let mua = muaHoaSungNam(namNay);
  if (homNay > mua.den) mua = muaHoaSungNam(namNay + 1);
  const ngayToiMua = Math.max(0, soNgayGiua(homNay, mua.tu));
  const ngayToiLe = soNgayGiua(homNay, mua.le.tu);
  const giaiDoan: GiaiDoanHoaSung =
    homNay < mua.tu
      ? "sap-toi"
      : homNay >= mua.le.tu && homNay <= mua.le.den
        ? "le-hoi"
        : homNay > mua.le.den
          ? "cuoi-mua"
          : "dang-no";
  return { mua, giaiDoan, homNay, ngayToiMua, ngayToiLe };
}

/** Các mùa hoa từ mùa đang tới trở đi, để khách và người làm kế hoạch nhìn trước. */
export function cacMuaToi(bayGio: Date, soMua = 3): MuaHoaSung[] {
  const dau = tinhTrangHoaSung(bayGio).mua.nam;
  return Array.from({ length: soMua }, (_, i) => muaHoaSungNam(dau + i));
}

/**
 * Hoa mở bao nhiêu (0–1) theo giờ Ninh Bình dạng thập phân (7,5 là 7:30).
 * Nở dần từ 6:30, mở trọn 7:15–9:45, cụp dần tới 10:30: khớp câu "chỉ nở
 * khoảng 7–10 giờ sáng".
 */
export function doNoHoa(gio: number): number {
  if (gio <= 6.5 || gio >= 10.5) return 0;
  if (gio < 7.25) return (gio - 6.5) / 0.75;
  if (gio <= 9.75) return 1;
  return (10.5 - gio) / 0.75;
}

/** Giờ hiện tại ở Ninh Bình dạng thập phân. */
export function gioNinhBinh(bayGio: Date): number {
  const d = new Date(bayGio.getTime() + 7 * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/**
 * Khung ngày nhận đặt gói đò mùa hoa súng: từ hôm nay (hoặc ngày mở mùa nếu
 * chưa tới) tới hết mùa. Hết mùa năm nay thì mở sẵn mùa năm sau.
 */
export function khungBanHoaSung(bayGio: Date): { tu: string; den: string } {
  const { mua, homNay } = tinhTrangHoaSung(bayGio);
  return { tu: homNay > mua.tu ? homNay : mua.tu, den: mua.den };
}

/** `dd/mm/yyyy` từ `YYYY-MM-DD`. */
export function ngayDoc(isoNgay: string): string {
  const [nam, thang, ngay] = isoNgay.split("-");
  return `${ngay}/${thang}/${nam}`;
}

