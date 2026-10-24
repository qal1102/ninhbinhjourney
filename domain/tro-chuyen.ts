import { BAN_DO_CHUC_NANG, CHUC_NANG_WEB } from "@/domain/ban-do-chuc-nang";

/**
 * Trò chuyện trong ERP (24/10/2026, migration 133).
 *
 * Một tin gồm chữ, tối đa 6 tệp và tối đa 4 thẻ gắn. Thẻ gắn trỏ tới một phần
 * của dự án: một chức năng ERP (bấm là tới đúng màn, có khoanh viền cam như
 * màn Dạo một vòng), một trang của khách, hay một văn bản đã nhận vào hệ
 * thống. Bật "Giao thành việc" thì tin kèm một việc ở Việc & ghi chú.
 */

export type TheGan =
  | { kieu: "chuc-nang"; id: string; ten: string; duongDan: string }
  | { kieu: "trang-khach"; id: string; ten: string; duongDan: string }
  | { kieu: "van-ban"; id: string; ten: string; duongDan: string };

export type TepDinhKem = { path: string; ten: string; co: number; kieu: string; url?: string | null };

export type ViecTrongTin = {
  id: string;
  nguoiNhan: string | null;
  nguoiTao: string;
  han: string | null;
  trangThai: "mo" | "xong" | "huy";
  noiDung: string;
};

export type TinNhan = {
  id: string;
  nguoiGui: string;
  tenNguoiGui: string;
  loai: "chu" | "he-thong";
  noiDung: string;
  tep: TepDinhKem[];
  gan: TheGan[];
  taoLuc: string;
  laMau: boolean;
  viec: ViecTrongTin | null;
};

export type ThanhVien = { id: string; ten: string; docDen: string };

export type Phong = {
  id: string;
  loai: "rieng" | "nhom";
  ten: string | null;
  kenh: string;
  tinCuoiLuc: string;
  laMau: boolean;
  thanhVien: ThanhVien[];
  tinCuoi: { nguoiGui: string; ten: string; noiDung: string; soTep: number; soGan: number; luc: string; loai: string } | null;
  chuaDoc: number;
};

export const SO_TEP_TOI_DA = 6;
export const SO_GAN_TOI_DA = 4;
export const TEP_TOI_DA_BYTE = 4_000_000;

export const KIEU_TEP_NHAN: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export function laAnh(kieu: string) {
  return kieu.startsWith("image/");
}

/** Mọi phần gắn được: chức năng ERP (theo nhóm) và trang của khách. */
export type MucGan = { kieu: "chuc-nang" | "trang-khach"; id: string; ten: string; nhom: string; duongDan: string };

export function danhMucGan(coSoMau: string): MucGan[] {
  const erp = BAN_DO_CHUC_NANG.flatMap((nhom) =>
    nhom.chucNang.map((cn) => ({
      kieu: "chuc-nang" as const,
      id: cn.id,
      ten: cn.ten,
      nhom: nhom.ten,
      duongDan: cn.duongDan.replace("{site}", coSoMau),
    })),
  );
  const web = CHUC_NANG_WEB.map((cn) => ({ kieu: "trang-khach" as const, id: cn.id, ten: cn.ten, nhom: "Trang của khách", duongDan: cn.duongDan }));
  return [...erp, ...web];
}

/** Đường dẫn bấm từ thẻ gắn: chức năng ERP kèm `?chi=` để khoanh đúng chỗ. */
export function duongDanThe(the: TheGan) {
  if (the.kieu === "chuc-nang") return `${the.duongDan}${the.duongDan.includes("?") ? "&" : "?"}chi=${encodeURIComponent(the.id)}`;
  if (the.kieu === "van-ban") return `${the.duongDan}?ma=${encodeURIComponent(the.id)}`;
  return the.duongDan;
}

const DUONG_DAN_TRONG = /^\/[A-Za-z0-9\-_/?=&.%]{0,200}$/;

/**
 * Kiểm thẻ gắn từ trình duyệt: chức năng và trang khách phải có trong bản đồ
 * chức năng (không nhận đường dẫn tuỳ ý, kẻo tin chở liên kết ra ngoài).
 */
export function kiemTheGan(raw: unknown, ctx: { coSoMau: string; vanBan: ReadonlySet<string> }): TheGan[] | null {
  if (!Array.isArray(raw) || raw.length > SO_GAN_TOI_DA) return null;
  const danhMuc = new Map(danhMucGan(ctx.coSoMau).map((m) => [`${m.kieu}:${m.id}`, m]));
  const ra: TheGan[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const t = x as Record<string, unknown>;
    if (t.kieu === "van-ban") {
      if (typeof t.id !== "string" || !ctx.vanBan.has(t.id) || typeof t.ten !== "string") return null;
      ra.push({ kieu: "van-ban", id: t.id, ten: t.ten.slice(0, 120), duongDan: "/erp/van-ban" });
      continue;
    }
    if (t.kieu !== "chuc-nang" && t.kieu !== "trang-khach") return null;
    const m = danhMuc.get(`${t.kieu}:${String(t.id)}`);
    if (!m || !DUONG_DAN_TRONG.test(m.duongDan)) return null;
    ra.push({ kieu: m.kieu, id: m.id, ten: m.ten, duongDan: m.duongDan });
  }
  return ra;
}

export function kiemTep(raw: unknown, phongId: string): TepDinhKem[] | null {
  if (!Array.isArray(raw) || raw.length > SO_TEP_TOI_DA) return null;
  const ra: TepDinhKem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const t = x as Record<string, unknown>;
    if (typeof t.path !== "string" || !t.path.startsWith(`tc/${phongId}/`) || !/^tc\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(t.path)) return null;
    if (typeof t.kieu !== "string" || !(t.kieu in KIEU_TEP_NHAN)) return null;
    ra.push({ path: t.path, ten: String(t.ten ?? "tep").slice(0, 120), co: Math.max(0, Math.min(Number(t.co) || 0, TEP_TOI_DA_BYTE)), kieu: t.kieu });
  }
  return ra;
}

export function tenPhong(p: Pick<Phong, "loai" | "ten" | "thanhVien">, toi: string) {
  if (p.loai === "nhom") return p.ten ?? "Nhóm";
  return p.thanhVien.find((v) => v.id !== toi)?.ten || "Trò chuyện";
}

export function coTep(co: number) {
  if (co < 1024) return `${co} B`;
  if (co < 1024 * 1024) return `${Math.round(co / 1024)} KB`;
  return `${(co / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
