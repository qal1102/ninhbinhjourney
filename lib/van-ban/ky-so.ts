import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { LOAI_VAN_BAN, type LoaiVanBan } from "@/domain/van-ban";

/**
 * Chữ ký của hệ thống trên văn bản phát hành.
 *
 * Khoá lấy từ `VAN_BAN_KHOA`; chưa đặt thì suy ra từ khoá bí mật của kho (có
 * sẵn trên Vercel), nên bật tính năng không cần thêm biến môi trường nào. Đổi
 * khoá gốc thì mọi văn bản phát hành trước đó không còn qua cổng, nên khi cần
 * đổi khoá kho hãy đặt `VAN_BAN_KHOA` bằng giá trị cũ trước.
 *
 * Từ khoá gốc suy ra hai khoá riêng: khoá ký mã phát hành và mật khẩu chủ của
 * lớp mã hoá PDF (AES-256). Người dùng mở tệp không cần mật khẩu, nhưng chỉ
 * có mật khẩu chủ mới được sửa phần chữ cố định.
 */

const MAU_GOC_O_MAY = "nbj-van-ban-chi-dung-o-may";

function khoaGoc() {
  return (
    process.env.VAN_BAN_KHOA?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.ERP_DEMO_SESSION_SECRET?.trim() ||
    MAU_GOC_O_MAY
  );
}

function suyRa(nhan: string) {
  return createHmac("sha256", khoaGoc()).update(nhan).digest();
}

export function matKhauChuPdf() {
  return suyRa("nbj-van-ban/mat-khau-chu/v1").toString("base64url");
}

function kyChuoi(noiDung: string, nhan = "nbj-van-ban/ky/v1") {
  return createHmac("sha256", suyRa(nhan)).update(noiDung).digest("base64url");
}

function bangNhau(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const KY_TU_MA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "VB-7K2Q9M": sáu ký tự, bỏ các chữ dễ nhầm (I, L, O, 0, 1). */
export function taoMaPhatHanh() {
  let ma = "";
  for (let i = 0; i < 6; i += 1) ma += KY_TU_MA[randomInt(KY_TU_MA.length)];
  return `VB-${ma}`;
}

export const KHUON_MA_PHAT_HANH = /^VB-[A-Z0-9]{6}$/;

export type MaKy = { id: string; loai: LoaiVanBan; phienBan: number; maBam: string };

/** Mã nằm trong ô ẩn của PDF: NBJVB1.<id>.<loại>.<phiên bản>.<băm nội dung>.<chữ ký>. */
export function kyMaPhatHanh(m: MaKy) {
  const than = `NBJVB1.${m.id}.${m.loai}.${m.phienBan}.${m.maBam}`;
  return `${than}.${kyChuoi(than)}`;
}

export type DocMa = { hopLe: true; ma: MaKy } | { hopLe: false; lyDo: "khong-doc-duoc" | "sai-chu-ky" };

export function docMaPhatHanh(chuoi: string | null | undefined): DocMa {
  const phan = (chuoi ?? "").trim().split(".");
  if (phan.length !== 6 || phan[0] !== "NBJVB1") return { hopLe: false, lyDo: "khong-doc-duoc" };
  const [, id, loai, phienBan, maBam, chuKy] = phan;
  if (!KHUON_MA_PHAT_HANH.test(id) || !LOAI_VAN_BAN.includes(loai as LoaiVanBan) || !/^\d{1,3}$/.test(phienBan) || !/^[0-9a-f]{64}$/.test(maBam)) {
    return { hopLe: false, lyDo: "khong-doc-duoc" };
  }
  if (!bangNhau(chuKy, kyChuoi(phan.slice(0, 5).join(".")))) return { hopLe: false, lyDo: "sai-chu-ky" };
  return { hopLe: true, ma: { id, loai: loai as LoaiVanBan, phienBan: Number(phienBan), maBam } };
}

/**
 * Phiếu soát: bước Soát trả về kết quả AI kèm phiếu này, bước Nộp gửi lại tệp
 * cùng phiếu. Máy chủ kiểm phiếu thay vì hỏi AI lần nữa (đỡ tốn lượt, và kết
 * quả AI người dùng đã xem là kết quả được ghi). Phiếu gắn với băm của tệp,
 * nên không dùng phiếu của tệp này cho tệp khác được.
 */
export function kyPhieuSoat(noiDung: { maBamTep: string; ai: unknown; heThan: number }) {
  const than = Buffer.from(JSON.stringify(noiDung)).toString("base64url");
  return `${than}.${kyChuoi(than, "nbj-van-ban/phieu-soat/v1")}`;
}

export function docPhieuSoat(phieu: string | null | undefined, maBamTep: string, bayGio = Date.now()): { ai: unknown } | null {
  const [than, chuKy] = (phieu ?? "").split(".");
  if (!than || !chuKy || !bangNhau(chuKy, kyChuoi(than, "nbj-van-ban/phieu-soat/v1"))) return null;
  try {
    const v = JSON.parse(Buffer.from(than, "base64url").toString("utf8")) as { maBamTep?: string; ai?: unknown; heThan?: number };
    if (v.maBamTep !== maBamTep || typeof v.heThan !== "number" || v.heThan < bayGio) return null;
    return { ai: v.ai ?? null };
  } catch {
    return null;
  }
}
