/**
 * Báo khẩn cấp (12/10/2026, migration 121): một chạm từ hiện trường, cấp trên
 * rung và thấy cảnh báo bám màn tới khi bấm "Đã nhận", quá 2 phút chưa ai
 * nhận thì máy người báo tự mở cuộc gọi tới cấp trên.
 */

export const LOAI_KHAN_CAP = [
  { id: "nguoi-gap-nan", ten: "Người gặp nạn", goiY: "Rơi xuống nước, ngất, lạc" },
  { id: "tai-nan", ten: "Tai nạn, bị thương", goiY: "Ngã, va thuyền, chảy máu" },
  { id: "chay-no", ten: "Cháy, nổ", goiY: "Khói, lửa, chập điện" },
  { id: "an-ninh", ten: "Mất an ninh", goiY: "Ẩu đả, trộm cắp, gây rối" },
  { id: "thien-tai", ten: "Mưa lũ, sạt lở", goiY: "Nước dâng, đá lở, cây đổ" },
  { id: "khac", ten: "Khẩn cấp khác", goiY: "Ghi một dòng nếu kịp" },
] as const;

export type LoaiKhanCap = (typeof LOAI_KHAN_CAP)[number]["id"];

export function laLoaiKhanCap(x: unknown): x is LoaiKhanCap {
  return LOAI_KHAN_CAP.some((l) => l.id === x);
}

export function tenLoaiKhanCap(id: string) {
  return LOAI_KHAN_CAP.find((l) => l.id === id)?.ten ?? "Khẩn cấp";
}

/** Quá chừng này mà chưa ai bấm "Đã nhận" thì máy người báo tự gọi cấp trên. */
export const GIAY_CHO_TRUOC_KHI_GOI = 120;

/** Số khẩn cấp quốc gia, luôn hiện cạnh nút gọi cấp trên. */
export const SO_KHAN_CAP_QUOC_GIA = [
  { so: "115", ten: "Cấp cứu" },
  { so: "114", ten: "Cứu hoả, cứu nạn" },
  { so: "113", ten: "Công an" },
] as const;

export type CapTren = { accountId: string; ten: string; vai: "manager" | "director"; dienThoai: string | null };

export type BaoDong = {
  ma: string;
  siteId: string;
  siteName: string;
  incidentId: string | null;
  loai: LoaiKhanCap;
  ghiChu: string;
  viDo: number | null;
  kinhDo: number | null;
  saiSoM: number | null;
  anhPath: string | null;
  /** Đường dẫn xem ảnh có hạn, máy chủ ký khi đọc. */
  anhUrl?: string | null;
  nguoiBaoAccountId: string;
  nguoiBaoTen: string;
  baoLuc: string;
  nhanBoiTen: string | null;
  nhanLuc: string | null;
  goiLuc: string | null;
  goiToiTen: string | null;
  capTren: CapTren[];
};

function so(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function chu(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x : null;
}

export function docBaoDong(raw: unknown): BaoDong | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ma = chu(r.ma);
  if (!ma) return null;
  return {
    ma,
    siteId: String(r.site_id ?? ""),
    siteName: chu(r.site_name) ?? "",
    incidentId: chu(r.incident_id),
    loai: laLoaiKhanCap(r.loai) ? r.loai : "khac",
    ghiChu: chu(r.ghi_chu) ?? "",
    viDo: so(r.vi_do),
    kinhDo: so(r.kinh_do),
    saiSoM: so(r.sai_so_m),
    anhPath: chu(r.anh_path),
    nguoiBaoAccountId: String(r.nguoi_bao_account_id ?? ""),
    nguoiBaoTen: chu(r.nguoi_bao_ten) ?? "",
    baoLuc: String(r.bao_luc ?? ""),
    nhanBoiTen: chu(r.nhan_boi_ten),
    nhanLuc: chu(r.nhan_luc),
    goiLuc: chu(r.goi_luc),
    goiToiTen: chu(r.goi_toi_ten),
    capTren: Array.isArray(r.cap_tren)
      ? (r.cap_tren as Record<string, unknown>[]).map((c) => ({
          accountId: String(c.account_id ?? ""),
          ten: chu(c.ten) ?? "",
          vai: c.vai === "manager" ? ("manager" as const) : ("director" as const),
          dienThoai: chu(c.dien_thoai),
        }))
      : [],
  };
}

/** Người sẽ được gọi khi quá 2 phút: quản lý cơ sở có số trước, rồi giám đốc có số. */
export function nguoiSeGoi(capTren: readonly CapTren[]): CapTren | null {
  return capTren.find((c) => c.vai === "manager" && c.dienThoai) ?? capTren.find((c) => c.dienThoai) ?? null;
}

/** Số giây đã trôi từ lúc báo, tính theo đồng hồ máy chủ đã chỉnh lệch. */
export function giayDaQua(baoLuc: string, bayGioMs: number) {
  const t = Date.parse(baoLuc);
  return Number.isFinite(t) ? Math.max(0, Math.floor((bayGioMs - t) / 1000)) : 0;
}

/** "tel:" chỉ giữ chữ số và dấu + đầu. */
export function duongGoi(soDienThoai: string) {
  const sach = soDienThoai.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return `tel:${sach}`;
}

export function banDoTai(viDo: number, kinhDo: number) {
  return `https://www.google.com/maps/search/?api=1&query=${viDo},${kinhDo}`;
}
