/**
 * Đại lý và hoa hồng (migration 099). Phần thuần: đọc số kho trả về, tháng
 * theo giờ Việt Nam, và các luật nhỏ để màn ERP lẫn cổng đại lý nói giống nhau.
 *
 * Luật hoa hồng nằm trong kho (`erp_dai_ly_thang`): chỉ tính đơn đã trả mà
 * khách đã qua cổng, theo tháng của ngày đi, tiền đơn × tỷ lệ.
 *
 * Từ 102, "Ghi đã chi" dựng bút toán Nợ 6418 / Có 1121 chờ kế toán trưởng
 * kiểm tra (chia theo cơ sở khách qua cổng). Lần chi đi qua ba trạng thái:
 * chờ duyệt → đã ghi sổ, hoặc bị trả lại (tháng ấy ghi chi lại được).
 */

export const COOKIE_DAI_LY = "nbj-dai-ly";
export const NGAY_NHO_DAI_LY = 30;

export type DongDaiLy = {
  id: string;
  ma: string;
  ten: string;
  nguoiLienHe: string | null;
  dienThoai: string | null;
  tyLe: number;
  trangThai: "hop-tac" | "tam-ngung";
  /** Lữ hành, homestay… hay người chèo giới thiệu khách (migration 116). */
  loai: "dai-ly" | "nguoi-cheo";
  laMau: boolean;
  coKhoa: boolean;
  don: number;
  khach: number;
  doanhThu: number;
  donToi: number;
  khachToi: number;
  doanhThuToi: number;
  hoaHong: number;
  daChi: number | null;
  chiLuc: string | null;
  trangThaiChi: TrangThaiChi | null;
  lyDoTra: string | null;
  butToan: { ma: string; trangThai: string }[];
};

export type TrangThaiChi = "cho-duyet" | "da-ghi-so" | "bi-tra-lai";

function docTrangThaiChi(x: unknown): TrangThaiChi | null {
  return x === "cho-duyet" || x === "da-ghi-so" || x === "bi-tra-lai" ? x : null;
}

function docButToan(x: unknown): { ma: string; trangThai: string }[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((b) =>
    b && typeof b === "object" && typeof (b as Record<string, unknown>).ma === "string"
      ? [{ ma: (b as Record<string, string>).ma, trangThai: String((b as Record<string, unknown>).trang_thai ?? "") }]
      : [],
  );
}

export type DonDaiLy = {
  maDon: string;
  ngayDi: string;
  soKhach: number;
  tien: number;
  trangThai: string;
  daToi: boolean;
  laMau: boolean;
};

export function laMaDaiLy(x: string): boolean {
  return /^[A-Z0-9]{4,16}$/.test(x);
}

/** Gợi ý mã từ tên: bỏ dấu, bỏ chữ thường gặp, lấy chữ in hoa. */
export function goiYMa(ten: string): string {
  const khongDau = ten
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/\b(CONG TY|CTY|TNHH|DU LICH|LU HANH|TRAVEL|DAI LY|MAU)\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");
  return khongDau.slice(0, 12).padEnd(4, "0");
}

function so(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function chuoi(x: unknown): string | null {
  return typeof x === "string" && x.length > 0 ? x : null;
}

export function docBangThang(raw: unknown): DongDaiLy[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): DongDaiLy[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.ma !== "string" || typeof r.ten !== "string") return [];
    return [{
      id: r.id,
      ma: r.ma,
      ten: r.ten,
      nguoiLienHe: chuoi(r.nguoi_lien_he),
      dienThoai: chuoi(r.dien_thoai),
      tyLe: so(r.ty_le),
      trangThai: r.trang_thai === "tam-ngung" ? "tam-ngung" : "hop-tac",
      loai: r.loai === "nguoi-cheo" ? "nguoi-cheo" : "dai-ly",
      laMau: r.la_mau === true,
      coKhoa: r.co_khoa === true,
      don: so(r.don),
      khach: so(r.khach),
      doanhThu: so(r.doanh_thu),
      donToi: so(r.don_toi),
      khachToi: so(r.khach_toi),
      doanhThuToi: so(r.doanh_thu_toi),
      hoaHong: so(r.hoa_hong),
      daChi: r.da_chi === null || r.da_chi === undefined ? null : so(r.da_chi),
      chiLuc: chuoi(r.chi_luc),
      trangThaiChi: docTrangThaiChi(r.trang_thai_chi),
      lyDoTra: chuoi(r.ly_do_tra),
      butToan: docButToan(r.but_toan),
    }];
  });
}

export function docDonGanDay(raw: unknown): DonDaiLy[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): DonDaiLy[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.order_code !== "string" || typeof r.visit_date !== "string") return [];
    return [{
      maDon: r.order_code,
      ngayDi: r.visit_date,
      soKhach: so(r.party_size),
      tien: so(r.total_vnd),
      trangThai: typeof r.status === "string" ? r.status : "",
      daToi: r.da_toi === true,
      laMau: r.la_mau === true,
    }];
  });
}

/** "YYYY-MM" của tháng hiện tại theo giờ Việt Nam. */
export function thangHienTai(bayGio = new Date()): string {
  return new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
}

export function congThang(thang: string, buoc: number): string {
  const [nam, t] = thang.split("-").map(Number);
  const d = new Date(Date.UTC(nam, t - 1 + buoc, 1));
  return d.toISOString().slice(0, 7);
}

/** Tháng hợp lệ trên đường dẫn (`?thang=2026-09`), không quá tháng hiện tại, không cũ hơn 24 tháng. */
export function chonThang(x: unknown, bayGio = new Date()): string {
  const hienTai = thangHienTai(bayGio);
  const xin = Array.isArray(x) ? x[0] : x;
  if (typeof xin !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(xin)) return hienTai;
  if (xin > hienTai || xin < congThang(hienTai, -24)) return hienTai;
  return xin;
}

export function tenThang(thang: string): string {
  const [nam, t] = thang.split("-");
  return `tháng ${Number(t)}/${nam}`;
}

/** Mã đơn che bớt cho cổng đại lý: đủ để đối chiếu với khách, không đủ để tra vé. */
export function cheMaDon(ma: string): string {
  return ma.length > 8 ? `${ma.slice(0, 8)}••••••••` : ma;
}

export function trangThaiDon(don: Pick<DonDaiLy, "trangThai" | "daToi">): string {
  if (don.daToi) return "Khách đã tới";
  if (don.trangThai === "confirmed") return "Đã trả, chờ khách tới";
  if (don.trangThai === "holding") return "Đang giữ chỗ";
  return "Không thành";
}

export function tien(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(vnd))} đ`;
}
