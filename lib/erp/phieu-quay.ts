import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { isErpSiteId, type ErpSiteId } from "@/domain/erp";

/**
 * Mã QR quầy vé cho khách quét bằng điện thoại (12/10/2026).
 *
 * Chủ dự án: lập phiếu xong phải đưa được vé cho khách, "khi khách thanh toán
 * = quét QR là tự động xác nhận thành công… thành công = xuất vé ngay trên
 * điện thoại của khách". Thanh toán vẫn là giả lập: mở được mã là coi như đã
 * trả.
 *
 * Mã có hai loại, cùng một lối `/ve-quay/<mã>`:
 *
 * - **cho** — giữ chỗ chờ khách quét. Chưa có gì trong kho. Khách mở mã thì
 *   máy chủ ghi phiếu bán bằng đúng hàm của quầy, dưới tên người bán đã tạo
 *   mã; khoá phiếu (`k`) làm cho quét bao nhiêu lần cũng chỉ ra một phiếu.
 * - **ve** — phiếu đã bán (tiền mặt, hoặc đã quét): chỉ để khách mở lại vé
 *   trên điện thoại khi chưa kịp lưu.
 *
 * Mã được mã hoá AES-GCM bằng khoá máy chủ, nên khách không đọc hay sửa được
 * số vé, người bán hay khoá phiếu. Số tiền trong mã chỉ để hiện; tiền thật do
 * hàm trong kho tính từ bảng giá.
 */

export type PhieuQuayCho = {
  loai: "cho";
  siteId: ErpSiteId;
  adults: number;
  children: number;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  requestKey: string;
  totalVnd: number;
  /** Hết giữ chỗ, mili giây. */
  expiresAt: number;
};

export type PhieuQuayVe = {
  loai: "ve";
  siteId: ErpSiteId;
  saleCode: string;
};

export type PhieuQuay = PhieuQuayCho | PhieuQuayVe;

/** Giữ chỗ chờ khách quét: 15 phút, như giữ chỗ trên web. */
export const PHUT_GIU_CHO_QUAY = 15;

const NHAN_KHOA = "nbj-phieu-quay-v1";

export class PhieuQuayError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION_MISSING" | "PHIEU_HONG" | "PHIEU_HET_HAN",
  ) {
    super(message);
  }
}

export function khoaPhieuQuayTu(bi: string): Buffer {
  return createHmac("sha256", bi).update(NHAN_KHOA).digest();
}

function khoaPhieuQuay(): Buffer {
  const bi = process.env.CUSTOMER_IDENTITY_HASH_KEY?.trim();
  if (!bi || bi.length < 32) {
    throw new PhieuQuayError("Mã QR cho khách chưa được cấu hình ở bản chạy này.", "CONFIGURATION_MISSING");
  }
  return khoaPhieuQuayTu(bi);
}

export function niemPhieuQuay(phieu: PhieuQuay, khoa: Buffer = khoaPhieuQuay()): string {
  const nen =
    phieu.loai === "ve"
      ? { l: "v", s: phieu.siteId, m: phieu.saleCode }
      : {
          l: "c",
          s: phieu.siteId,
          a: phieu.adults,
          c: phieu.children,
          u: phieu.actorAccountId,
          n: phieu.actorName,
          d: phieu.actingDirectorAccountId ?? undefined,
          k: phieu.requestKey,
          t: phieu.totalVnd,
          e: phieu.expiresAt,
        };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", khoa, iv);
  const ma = Buffer.concat([cipher.update(JSON.stringify(nen), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ma]).toString("base64url");
}

const HONG = "Mã QR này không đọc được. Mời bạn quét lại mã ở quầy vé.";
const so = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const chu = (v: unknown, min: number, max: number) => typeof v === "string" && v.length >= min && v.length <= max;

export function moPhieuQuay(
  chuoi: string,
  khoa: Buffer = khoaPhieuQuay(),
  bayGio: number = Date.now(),
  /** Chỉ để đọc phiếu đã bán: khách mở lại sau 15 phút vẫn phải thấy vé. */
  opts: { choPhepHetHan?: boolean } = {},
): PhieuQuay {
  let nen: Record<string, unknown>;
  try {
    const goi = Buffer.from(chuoi, "base64url");
    if (goi.length < 29 || goi.length > 2048) throw new Error("độ dài");
    const decipher = createDecipheriv("aes-256-gcm", khoa, goi.subarray(0, 12));
    decipher.setAuthTag(goi.subarray(12, 28));
    const ro = Buffer.concat([decipher.update(goi.subarray(28)), decipher.final()]);
    nen = JSON.parse(ro.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new PhieuQuayError(HONG, "PHIEU_HONG");
  }
  if (typeof nen.s !== "string" || !isErpSiteId(nen.s)) throw new PhieuQuayError(HONG, "PHIEU_HONG");
  if (nen.l === "v") {
    if (!chu(nen.m, 4, 40)) throw new PhieuQuayError(HONG, "PHIEU_HONG");
    return { loai: "ve", siteId: nen.s, saleCode: nen.m as string };
  }
  const { a, c, u, n, d, k, t, e } = nen;
  if (
    nen.l !== "c"
    || !so(a, 0, 45) || !so(c, 0, 45) || (a as number) + (c as number) < 1 || (a as number) + (c as number) > 45
    || !chu(u, 2, 100) || !chu(n, 1, 200) || (d !== undefined && !chu(d, 2, 100))
    || !chu(k, 8, 128) || !so(t, 0, 1_000_000_000) || typeof e !== "number"
  ) {
    throw new PhieuQuayError(HONG, "PHIEU_HONG");
  }
  if (e <= bayGio && !opts.choPhepHetHan) {
    throw new PhieuQuayError("Mã QR này đã hết hạn giữ chỗ. Mời bạn nhờ quầy vé tạo mã mới.", "PHIEU_HET_HAN");
  }
  return {
    loai: "cho",
    siteId: nen.s,
    adults: a as number,
    children: c as number,
    actorAccountId: u as string,
    actorName: n as string,
    actingDirectorAccountId: (d as string | undefined) ?? null,
    requestKey: k as string,
    totalVnd: t as number,
    expiresAt: e,
  };
}
