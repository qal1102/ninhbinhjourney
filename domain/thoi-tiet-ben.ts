import { GIO_CHAY, type CoSoThuyen } from "@/domain/thuyen-song";

/**
 * Thời tiết ở bến thuyền Tràng An và Tam Cốc, trong giờ thuyền chạy.
 *
 * Nguồn là dự báo theo giờ của Open-Meteo (miễn phí, không cần khoá). Hàm ở
 * đây thuần: nhận số đo, trả mức cảnh báo, để bài kiểm chạy được mà không cần
 * mạng. Ngưỡng là **gợi ý** cho quản lý bến, không thay quyết định của họ:
 *
 * - Mưa theo cường độ giờ của WMO: vừa từ 2,5 mm/giờ, to từ 7,6 mm/giờ.
 * - Gió giật theo thang Beaufort: cấp 6 từ 39 km/giờ, cấp 7 từ 50 km/giờ.
 * - Dông theo mã thời tiết WMO 95, 96, 99.
 * - Nắng nóng theo cách gọi của ngành khí tượng: từ 35 °C, gay gắt từ 37 °C.
 * - Sương mù (mã 45, 48): sông Ngô Đồng và Sào Khê hay có sương sáng sớm,
 *   tầm nhìn qua hang kém.
 */

export const TOA_DO_BEN: Record<CoSoThuyen, { ten: string; lat: number; lon: number }> = {
  "trang-an": { ten: "Bến Tràng An", lat: 20.25331, lon: 105.91799 },
  "tam-coc": { ten: "Bến Văn Lâm", lat: 20.2166, lon: 105.9376 },
};

export type GioDuBao = {
  /** Giờ địa phương dạng `YYYY-MM-DDTHH:00`. */
  gio: string;
  nhietDo: number;
  /** mm trong giờ ấy. */
  mua: number;
  /** % khả năng mưa. */
  khaNangMua: number | null;
  maThoiTiet: number;
  /** km/giờ. */
  gioGiat: number;
};

export type MucThoiTiet = "binh-thuong" | "luu-y" | "tam-dung";

export type LoaiNguyCo = "dong" | "mua-to" | "gio-giat-manh" | "mua-vua" | "gio-giat" | "suong-mu" | "nang-nong-gay-gat" | "nang-nong";

const NGUY_CO: Record<LoaiNguyCo, { ten: string; muc: Exclude<MucThoiTiet, "binh-thuong">; thuTu: number }> = {
  dong: { ten: "Dông", muc: "tam-dung", thuTu: 0 },
  "mua-to": { ten: "Mưa to", muc: "tam-dung", thuTu: 1 },
  "gio-giat-manh": { ten: "Gió giật mạnh", muc: "tam-dung", thuTu: 2 },
  "mua-vua": { ten: "Mưa vừa", muc: "luu-y", thuTu: 3 },
  "gio-giat": { ten: "Gió giật", muc: "luu-y", thuTu: 4 },
  "suong-mu": { ten: "Sương mù", muc: "luu-y", thuTu: 5 },
  "nang-nong-gay-gat": { ten: "Nắng nóng gay gắt", muc: "luu-y", thuTu: 6 },
  "nang-nong": { ten: "Nắng nóng", muc: "luu-y", thuTu: 7 },
};

/** Nguy cơ của một giờ, nặng nhất trước. Mỗi nhóm (mưa, gió, nhiệt) chỉ lấy mức nặng nhất. */
export function nguyCoCuaGio(g: GioDuBao): LoaiNguyCo[] {
  const ra: LoaiNguyCo[] = [];
  if ([95, 96, 99].includes(g.maThoiTiet)) ra.push("dong");
  if (g.mua >= 7.6) ra.push("mua-to");
  else if (g.mua >= 2.5) ra.push("mua-vua");
  if (g.gioGiat >= 50) ra.push("gio-giat-manh");
  else if (g.gioGiat >= 39) ra.push("gio-giat");
  if (g.maThoiTiet === 45 || g.maThoiTiet === 48) ra.push("suong-mu");
  if (g.nhietDo >= 37) ra.push("nang-nong-gay-gat");
  else if (g.nhietDo >= 35) ra.push("nang-nong");
  return ra.sort((a, b) => NGUY_CO[a].thuTu - NGUY_CO[b].thuTu);
}

export function mucCuaGio(g: GioDuBao): MucThoiTiet {
  const nguyCo = nguyCoCuaGio(g);
  if (nguyCo.some((n) => NGUY_CO[n].muc === "tam-dung")) return "tam-dung";
  return nguyCo.length > 0 ? "luu-y" : "binh-thuong";
}

/** Mô tả ngắn theo mã thời tiết WMO. */
export function moTaThoiTiet(ma: number): string {
  if (ma === 0) return "Trời quang";
  if (ma <= 2) return "Ít mây";
  if (ma === 3) return "Nhiều mây";
  if (ma === 45 || ma === 48) return "Sương mù";
  if (ma >= 51 && ma <= 57) return "Mưa phùn";
  if (ma >= 61 && ma <= 67) return "Mưa";
  if (ma >= 80 && ma <= 82) return "Mưa rào";
  if (ma >= 95) return "Dông";
  return "Nhiều mây";
}

export type KhoangNguyCo = {
  loai: LoaiNguyCo;
  ten: string;
  muc: Exclude<MucThoiTiet, "binh-thuong">;
  /** Giờ bắt đầu và giờ cuối (cả hai tính), `YYYY-MM-DDTHH:00`. */
  tu: string;
  den: string;
  /** Số đo lớn nhất trong khoảng, kèm đơn vị, để quản lý biết nặng tới đâu. */
  dinh: string;
};

export type BaoCaoThoiTiet = {
  muc: MucThoiTiet;
  khung: KhungXem;
  cacGio: (GioDuBao & { muc: MucThoiTiet })[];
  cacKhoang: KhoangNguyCo[];
};

function dinhCua(loai: LoaiNguyCo, cacGio: GioDuBao[]): string {
  const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  if (loai === "mua-to" || loai === "mua-vua") return `tới ${so(Math.max(...cacGio.map((g) => g.mua)))} mm/giờ`;
  if (loai === "gio-giat" || loai === "gio-giat-manh") return `tới ${Math.round(Math.max(...cacGio.map((g) => g.gioGiat)))} km/giờ`;
  if (loai === "nang-nong" || loai === "nang-nong-gay-gat") return `tới ${Math.round(Math.max(...cacGio.map((g) => g.nhietDo)))} °C`;
  if (loai === "dong") return `${cacGio.length} giờ`;
  return "tầm nhìn kém";
}

/** Giờ hiện tại ở Ninh Bình dạng `YYYY-MM-DDTHH:00`. */
export function gioHienTaiVN(bayGio: Date): string {
  return `${new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 13)}:00`;
}

export type KhungXem = {
  /** Giờ đầu và giờ cuối (cả hai tính), `YYYY-MM-DDTHH:00`. */
  tu: string;
  den: string;
  nhan: string;
};

/**
 * Chỉ giờ có thuyền mới đáng cảnh báo: dông lúc nửa đêm không làm bến phải
 * dừng. Thuyền chạy 6:30–17:30 (`GIO_CHAY`), tức các ô giờ 06:00 tới 17:00.
 * Trong giờ chạy thì xem từ giờ hiện tại tới hết ngày chạy; trước 6:00 thì xem
 * trọn ngày hôm nay; sau 17:30 thì xem trọn ngày mai.
 */
export function khungXem(bayGio: Date): KhungXem {
  const vn = new Date(bayGio.getTime() + 7 * 3_600_000);
  const gio = vn.getUTCHours() + vn.getUTCMinutes() / 60;
  const dauGio = Math.floor(GIO_CHAY.mo);
  const cuoiGio = Math.ceil(GIO_CHAY.dong) - 1;
  const hai = (n: number) => String(n).padStart(2, "0");
  if (gio >= GIO_CHAY.dong) {
    const mai = new Date(vn.getTime() + 24 * 3_600_000).toISOString().slice(0, 10);
    return { tu: `${mai}T${hai(dauGio)}:00`, den: `${mai}T${hai(cuoiGio)}:00`, nhan: "ngày mai, giờ thuyền chạy" };
  }
  const homNay = vn.toISOString().slice(0, 10);
  if (gio < dauGio) {
    return { tu: `${homNay}T${hai(dauGio)}:00`, den: `${homNay}T${hai(cuoiGio)}:00`, nhan: "hôm nay, giờ thuyền chạy" };
  }
  return { tu: gioHienTaiVN(bayGio), den: `${homNay}T${hai(cuoiGio)}:00`, nhan: `từ giờ tới ${hai(cuoiGio + 1)}:00` };
}

/**
 * Các giờ thuyền chạy cần xem (`khungXem`): mức chung (nặng nhất), từng giờ,
 * và các khoảng nguy cơ liền nhau (giờ liền nhau cùng một loại gộp lại).
 */
export function phanTichThoiTiet(cacGioGoc: readonly GioDuBao[], bayGio: Date): BaoCaoThoiTiet {
  const khung = khungXem(bayGio);
  const cacGio = cacGioGoc
    .filter((g) => g.gio >= khung.tu && g.gio <= khung.den)
    .map((g) => ({ ...g, muc: mucCuaGio(g) }));

  const cacKhoang: KhoangNguyCo[] = [];
  for (const loai of Object.keys(NGUY_CO) as LoaiNguyCo[]) {
    let dang: GioDuBao[] = [];
    const dong = () => {
      if (dang.length === 0) return;
      cacKhoang.push({
        loai,
        ten: NGUY_CO[loai].ten,
        muc: NGUY_CO[loai].muc,
        tu: dang[0].gio,
        den: dang[dang.length - 1].gio,
        dinh: dinhCua(loai, dang),
      });
      dang = [];
    };
    for (const g of cacGio) {
      if (nguyCoCuaGio(g).includes(loai)) dang.push(g);
      else dong();
    }
    dong();
  }
  cacKhoang.sort((a, b) => a.tu.localeCompare(b.tu) || NGUY_CO[a.loai].thuTu - NGUY_CO[b.loai].thuTu);

  const muc: MucThoiTiet = cacGio.some((g) => g.muc === "tam-dung")
    ? "tam-dung"
    : cacGio.some((g) => g.muc === "luu-y")
      ? "luu-y"
      : "binh-thuong";
  return { muc, khung, cacGio, cacKhoang };
}

/**
 * Đọc phản hồi `hourly` của Open-Meteo. Thiếu cột hay sai kiểu thì trả `null`
 * để màn hình nói "chưa lấy được dự báo" thay vì vẽ số sai.
 */
export function docDuBaoOpenMeteo(json: unknown): GioDuBao[] | null {
  const h = (json as { hourly?: Record<string, unknown> } | null)?.hourly;
  if (!h) return null;
  const cot = (ten: string) => (Array.isArray(h[ten]) ? (h[ten] as unknown[]) : null);
  const gio = cot("time");
  const nhiet = cot("temperature_2m");
  const mua = cot("precipitation");
  const kha = cot("precipitation_probability");
  const ma = cot("weather_code");
  const giat = cot("wind_gusts_10m");
  if (!gio || !nhiet || !mua || !ma || !giat) return null;
  const ra: GioDuBao[] = [];
  for (let i = 0; i < gio.length; i++) {
    const g = gio[i];
    const so = [nhiet[i], mua[i], ma[i], giat[i]];
    if (typeof g !== "string" || so.some((x) => typeof x !== "number" || !Number.isFinite(x))) continue;
    ra.push({
      gio: g.slice(0, 13) + ":00",
      nhietDo: nhiet[i] as number,
      mua: mua[i] as number,
      khaNangMua: typeof kha?.[i] === "number" ? (kha[i] as number) : null,
      maThoiTiet: ma[i] as number,
      gioGiat: giat[i] as number,
    });
  }
  return ra.length > 0 ? ra : null;
}

export function duongDanOpenMeteo(coSo: CoSoThuyen): string {
  const { lat, lon } = TOA_DO_BEN[coSo];
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,precipitation,precipitation_probability,weather_code,wind_gusts_10m",
    timezone: "Asia/Bangkok",
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}
