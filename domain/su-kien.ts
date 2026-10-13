/**
 * Sự kiện gặp người nổi tiếng, rút thăm minh bạch (13/10/2026, migration 127).
 *
 * Rút thăm "cam kết rồi mở": lúc tạo sự kiện máy sinh hạt giống bí mật và
 * công bố mã băm SHA-256 của nó. Rút xong công bố hạt giống và danh sách. Điểm
 * của một người là mã băm nhỏ nhất của `hạt giống:mã tham gia:k` với k = 1…số
 * lượt; điểm nhỏ nhất trúng trước. Ai cũng tính lại được bằng `tinhNguoiTrung`
 * ngay trên trình duyệt, khỏi phải tin lời ban tổ chức.
 */

export const LUOT_TOI_DA = 5;

export type NguoiThamGia = { ma: string; so: string; luot: number; trung: number | null };

export type SuKienCongKhai = {
  slug: string;
  ten: string;
  moTa: string;
  khachMoi: string;
  site: string | null;
  dienRaLuc: string;
  moDangKyLuc: string;
  hanDangKy: string;
  soGiai: number;
  giaiThuong: string;
  soDangKyKhuyenMai: string | null;
  trangThai: "mo" | "da-rut";
  rutLuc: string | null;
  hatGiongBam: string;
  hatGiong: string | null;
  soNguoi: number;
  danhSach: NguoiThamGia[] | null;
};

export type SuKienTomTat = {
  slug: string;
  ten: string;
  khachMoi: string;
  dienRaLuc: string;
  hanDangKy: string;
  trangThai: "mo" | "da-rut";
  soGiai: number;
  soNguoi: number;
};

function chu(v: unknown) {
  return typeof v === "string" ? v : "";
}
function so(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function docSuKien(raw: unknown): SuKienCongKhai | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== "string") return null;
  return {
    slug: r.slug,
    ten: chu(r.ten),
    moTa: chu(r.mo_ta),
    khachMoi: chu(r.khach_moi),
    site: typeof r.site === "string" ? r.site : null,
    dienRaLuc: chu(r.dien_ra_luc),
    moDangKyLuc: chu(r.mo_dang_ky_luc),
    hanDangKy: chu(r.han_dang_ky),
    soGiai: so(r.so_giai),
    giaiThuong: chu(r.giai_thuong),
    soDangKyKhuyenMai: typeof r.so_dang_ky_khuyen_mai === "string" ? r.so_dang_ky_khuyen_mai : null,
    trangThai: r.trang_thai === "da-rut" ? "da-rut" : "mo",
    rutLuc: typeof r.rut_luc === "string" ? r.rut_luc : null,
    hatGiongBam: chu(r.hat_giong_bam),
    hatGiong: typeof r.hat_giong === "string" ? r.hat_giong : null,
    soNguoi: so(r.so_nguoi),
    danhSach: Array.isArray(r.danh_sach)
      ? (r.danh_sach as Record<string, unknown>[]).map((d) => ({
          ma: chu(d.ma),
          so: chu(d.so),
          luot: so(d.luot),
          trung: d.trung == null ? null : so(d.trung),
        }))
      : null,
  };
}

export function docDanhSachSuKien(raw: unknown): SuKienTomTat[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).flatMap((r) =>
    typeof r.slug === "string"
      ? [{
          slug: r.slug,
          ten: chu(r.ten),
          khachMoi: chu(r.khach_moi),
          dienRaLuc: chu(r.dien_ra_luc),
          hanDangKy: chu(r.han_dang_ky),
          trangThai: r.trang_thai === "da-rut" ? ("da-rut" as const) : ("mo" as const),
          soGiai: so(r.so_giai),
          soNguoi: so(r.so_nguoi),
        }]
      : [],
  );
}

export type TraSuKien =
  | { dangKy: false }
  | { dangKy: true; maThamGia: string; soLuot: number; daRut: boolean; trungThuTu: number | null; maNhan: string | null };

export function docTraSuKien(raw: unknown): TraSuKien {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.dang_ky !== true) return { dangKy: false };
  return {
    dangKy: true,
    maThamGia: chu(r.ma_tham_gia),
    soLuot: so(r.so_luot),
    daRut: r.da_rut === true,
    trungThuTu: r.trung_thu_tu == null ? null : so(r.trung_thu_tu),
    maNhan: typeof r.ma_nhan === "string" ? r.ma_nhan : null,
  };
}

async function sha256Hex(chuoi: string): Promise<string> {
  const bam = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(chuoi));
  return Array.from(new Uint8Array(bam), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hạt giống công bố có đúng là hạt giống đã cam kết lúc tạo sự kiện không. */
export async function hatGiongKhop(hatGiong: string, hatGiongBam: string): Promise<boolean> {
  return (await sha256Hex(hatGiong)) === hatGiongBam;
}

/** Tính lại người trúng từ hạt giống và danh sách công bố, đúng phép tính của kho. */
export async function tinhNguoiTrung(
  hatGiong: string,
  danhSach: readonly Pick<NguoiThamGia, "ma" | "luot">[],
  soGiai: number,
): Promise<string[]> {
  const diem = await Promise.all(
    danhSach.map(async (d) => {
      let nho: string | null = null;
      for (let k = 1; k <= Math.max(1, Math.min(LUOT_TOI_DA, d.luot)); k += 1) {
        const h = await sha256Hex(`${hatGiong}:${d.ma}:${k}`);
        if (nho === null || h < nho) nho = h;
      }
      return { ma: d.ma, diem: nho ?? "" };
    }),
  );
  return diem
    .sort((a, b) => (a.diem < b.diem ? -1 : a.diem > b.diem ? 1 : a.ma < b.ma ? -1 : a.ma > b.ma ? 1 : 0))
    .slice(0, soGiai)
    .map((d) => d.ma);
}

/** Chữ khách đọc về số lượt: 1 lượt đăng ký + 1 lượt mỗi lần qua cổng, tối đa 5. */
export function cachTinhLuot(lang: "vi" | "en" = "vi") {
  return lang === "en"
    ? `Everyone starts with 1 chance; each gate entry on a ticket linked to your phone during registration adds 1, up to ${LUOT_TOI_DA}.`
    : `Ai đăng ký cũng có 1 lượt; mỗi lần qua cổng bằng vé đã gắn số này trong thời gian đăng ký được thêm 1 lượt, tối đa ${LUOT_TOI_DA}.`;
}
