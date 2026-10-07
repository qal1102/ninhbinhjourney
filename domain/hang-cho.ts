import type { ErpSiteId } from "@/domain/erp";

/**
 * Hàng chờ ảo ở bến đò (migration 097). Chỉ phần thuần: đọc số liệu kho trả
 * về và tính giờ chờ, để trang khách lẫn màn ERP nói cùng một con số.
 */

/** Nơi có hàng chờ: mã trên đường dẫn công khai → cơ sở ERP. */
export const BEN_CO_HANG_CHO = {
  "tam-coc": { siteId: "tam-coc", ten: "Bến đò Tam Cốc", tenEn: "Tam Coc boat pier", slugDiemDen: "tam-coc-bich-dong" },
} as const satisfies Record<string, { siteId: ErpSiteId; ten: string; tenEn: string; slugDiemDen: string }>;

export type MaBen = keyof typeof BEN_CO_HANG_CHO;

export function laMaBen(x: string): x is MaBen {
  return Object.hasOwn(BEN_CO_HANG_CHO, x);
}

export function benCuaCoSo(siteId: ErpSiteId): MaBen | null {
  for (const [ma, ben] of Object.entries(BEN_CO_HANG_CHO)) if (ben.siteId === siteId) return ma as MaBen;
  return null;
}

/** Bến có hàng chờ nằm ở trang điểm đến này. */
export function benCuaDiemDen(slug: string): MaBen | null {
  for (const [ma, ben] of Object.entries(BEN_CO_HANG_CHO)) if (ben.slugDiemDen === slug) return ma as MaBen;
  return null;
}

/**
 * Giờ nhận số ở bến, theo giờ Việt Nam: từ lúc đò bắt đầu chạy (6:30) tới nửa
 * tiếng trước khi đò nghỉ (17:30, `GIO_CHAY` ở màn Thuyền). Soát 07/10/2026:
 * 21 giờ khách vẫn lấy được số, trang báo "Ngay" và "10 phút ra bến" dù bến đã
 * nghỉ.
 */
export const GIO_NHAN_SO = { mo: 6 * 60 + 30, dong: 17 * 60 } as const;

export function trongGioNhanSo(now: Date = new Date()) {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const phut = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  return phut >= GIO_NHAN_SO.mo && phut < GIO_NHAN_SO.dong;
}

export type TrangThaiLuot = "cho" | "da-goi" | "da-len" | "bo-luot" | "khach-huy" | "het-ngay";

export type TongQuanHangCho = {
  dangNhan: boolean;
  loiTamDung: string | null;
  khachMoiPhutKhai: number;
  phutGiuLuot: number;
  soNhomCho: number;
  soKhachCho: number;
  dangGoi: number[];
  goiToiSo: number | null;
  soCap: number | null;
  khachLen30Phut: number;
  daLenHomNay: number;
  nhomDaLen: number;
  nhomBoLuot: number;
  nhomHuy: number;
  phutChoTrungBinh: number | null;
  /** Ngoài giờ nhận số; máy chủ gắn vào lúc trả lời, kho không biết. */
  ngoaiGio?: boolean;
};

export type LuotCuaKhach = {
  soThuTu: number;
  soKhach: number;
  trangThai: TrangThaiLuot;
  taoLuc: string;
  goiLuc: string | null;
  nhomTruoc: number;
  khachTruoc: number;
  tongQuan: TongQuanHangCho;
};

export type LuotTrongErp = {
  id: string;
  soThuTu: number;
  soKhach: number;
  ngonNgu: "vi" | "en";
  trangThai: Exclude<TrangThaiLuot, "het-ngay">;
  taoLuc: string;
  goiLuc: string | null;
  xongLuc: string | null;
};

function so(x: unknown, macDinh = 0): number {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : macDinh;
}

function soHoacNull(x: unknown): number | null {
  return x === null || x === undefined ? null : so(x);
}

function chuoiHoacNull(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

export function docTongQuan(raw: unknown): TongQuanHangCho | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    dangNhan: r.dang_nhan === true,
    loiTamDung: chuoiHoacNull(r.loi_tam_dung),
    khachMoiPhutKhai: so(r.khach_moi_phut_khai, 5),
    phutGiuLuot: so(r.phut_giu_luot, 10),
    soNhomCho: so(r.so_nhom_cho),
    soKhachCho: so(r.so_khach_cho),
    dangGoi: Array.isArray(r.dang_goi) ? r.dang_goi.map((x) => so(x)).filter((x) => x > 0) : [],
    goiToiSo: soHoacNull(r.goi_toi_so),
    soCap: soHoacNull(r.so_cap),
    khachLen30Phut: so(r.khach_len_30_phut),
    daLenHomNay: so(r.da_len_hom_nay),
    nhomDaLen: so(r.nhom_da_len),
    nhomBoLuot: so(r.nhom_bo_luot),
    nhomHuy: so(r.nhom_huy),
    phutChoTrungBinh: soHoacNull(r.phut_cho_tb),
  };
}

/** Kiểm dạng `TongQuanHangCho` mà API trả cho trình duyệt (đã đổi sang camelCase). */
export function laTongQuan(x: unknown): x is TongQuanHangCho {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.dangNhan === "boolean" && typeof r.soNhomCho === "number" && Array.isArray(r.dangGoi);
}

const TRANG_THAI: readonly TrangThaiLuot[] = ["cho", "da-goi", "da-len", "bo-luot", "khach-huy", "het-ngay"];

export function docLuotCuaKhach(raw: unknown): LuotCuaKhach | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tongQuan = docTongQuan(r.tong_quan);
  const trangThai = TRANG_THAI.find((t) => t === r.trang_thai);
  if (!tongQuan || !trangThai || typeof r.tao_luc !== "string") return null;
  return {
    soThuTu: so(r.so_thu_tu),
    soKhach: so(r.so_khach, 1),
    trangThai,
    taoLuc: r.tao_luc,
    goiLuc: chuoiHoacNull(r.goi_luc),
    nhomTruoc: so(r.nhom_truoc),
    khachTruoc: so(r.khach_truoc),
    tongQuan,
  };
}

export function docDanhSachErp(raw: unknown): { tongQuan: TongQuanHangCho; luot: LuotTrongErp[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tongQuan = docTongQuan(r.tong_quan);
  if (!tongQuan) return null;
  const luot = Array.isArray(r.luot)
    ? r.luot.flatMap((x): LuotTrongErp[] => {
        if (!x || typeof x !== "object") return [];
        const d = x as Record<string, unknown>;
        const trangThai = TRANG_THAI.find((t) => t === d.trang_thai && t !== "het-ngay");
        if (typeof d.id !== "string" || !trangThai || typeof d.tao_luc !== "string") return [];
        return [{
          id: d.id,
          soThuTu: so(d.so_thu_tu),
          soKhach: so(d.so_khach, 1),
          ngonNgu: d.ngon_ngu === "en" ? "en" : "vi",
          trangThai: trangThai as LuotTrongErp["trangThai"],
          taoLuc: d.tao_luc,
          goiLuc: chuoiHoacNull(d.goi_luc),
          xongLuc: chuoiHoacNull(d.xong_luc),
        }];
      })
    : [];
  return { tongQuan, luot };
}

/**
 * Tốc độ lên thuyền, khách mỗi phút. Có từ 6 khách lên trong 30 phút qua thì
 * dùng số đo; ít hơn thì dùng tốc độ khai trong cấu hình, vì đo trên hai ba
 * khách là đoán mò.
 */
export function tocDoLenThuyen(tq: Pick<TongQuanHangCho, "khachLen30Phut" | "khachMoiPhutKhai">) {
  if (tq.khachLen30Phut >= 6) return { khachMoiPhut: tq.khachLen30Phut / 30, nguon: "do" as const };
  return { khachMoiPhut: tq.khachMoiPhutKhai, nguon: "khai" as const };
}

/** Phút chờ ước tính cho người đứng sau `khachTruoc` khách. Làm tròn lên bội số 5, tối thiểu 0. */
export function uocPhutCho(khachTruoc: number, tq: Pick<TongQuanHangCho, "khachLen30Phut" | "khachMoiPhutKhai">) {
  if (khachTruoc <= 0) return 0;
  const { khachMoiPhut } = tocDoLenThuyen(tq);
  const phut = khachTruoc / Math.max(khachMoiPhut, 0.1);
  return Math.max(5, Math.ceil(phut / 5) * 5);
}

/** Lượt đã gọi mà quá giờ giữ lượt: nhân viên nên bỏ lượt để gọi người sau. */
export function daQuaGioGiu(goiLuc: string | null, phutGiuLuot: number, bayGio = Date.now()) {
  if (!goiLuc) return false;
  return bayGio - Date.parse(goiLuc) > phutGiuLuot * 60_000;
}

export function soHienThi(soThuTu: number) {
  return `A${String(soThuTu).padStart(3, "0")}`;
}
