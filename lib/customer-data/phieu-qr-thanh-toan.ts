import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Phiếu thanh toán QR, bản giả lập.
 *
 * Màn hình đặt chỗ hiện một mã QR; khách quét bằng điện thoại, trang mở ra
 * trên máy thứ hai, bấm xác nhận là đơn ghi "đã thanh toán bằng QR". Máy thứ
 * hai KHÔNG có cookie phiên của máy đặt chỗ, nên mọi thứ nó cần để xác nhận
 * (lượt giữ, mã yêu cầu, phiên khách, liên hệ) đi theo chính mã QR.
 *
 * Vì thế phiếu phải **mã hoá**, không chỉ ký: trong đó có mã phiên khách và
 * có thể có số điện thoại, mà đường dẫn thì nằm lại trong lịch sử trình duyệt
 * và nhật ký máy chủ. AES-256-GCM vừa giấu nội dung vừa chặn sửa — đổi một
 * byte là mở phiếu thất bại.
 *
 * Khoá dẫn ra từ `CUSTOMER_IDENTITY_HASH_KEY` bằng HMAC có nhãn riêng, để
 * phiếu không bao giờ dùng chung khoá với kho liên hệ.
 */

export type PhieuQr = {
  /** Lượt giữ chỗ cần xác nhận. */
  holdId: string;
  /** Khoá chống trùng của lần trả này — xác nhận lại vẫn ra đúng một đơn. */
  paymentRequestId: string;
  /** Phiên khách đã giữ chỗ; máy quét mượn danh nghĩa này để xác nhận. */
  anonymousId: string;
  /** Liên hệ khách để lại ở màn hình đặt chỗ, nếu có. */
  contact?: string;
  /** Chỉ để hiện cho khách xem; số tiền thật do cơ sở dữ liệu tính. */
  amountVnd: number;
  productId: string;
  /** Hết hạn cùng lượt giữ chỗ, tính bằng mili giây. */
  expiresAt: number;
};

const NHAN_KHOA = "nbj-phieu-qr-thanh-toan-v1";

export class PhieuQrError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION_MISSING" | "PHIEU_HONG" | "PHIEU_HET_HAN",
  ) {
    super(message);
  }
}

export function khoaPhieuTu(bi: string): Buffer {
  return createHmac("sha256", bi).update(NHAN_KHOA).digest();
}

function khoaPhieu(): Buffer {
  const bi = process.env.CUSTOMER_IDENTITY_HASH_KEY?.trim();
  if (!bi || bi.length < 32) {
    throw new PhieuQrError("Thanh toán qua mã QR chưa được cấu hình.", "CONFIGURATION_MISSING");
  }
  return khoaPhieuTu(bi);
}

export function niemPhieu(phieu: PhieuQr, khoa: Buffer = khoaPhieu()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", khoa, iv);
  const nen = JSON.stringify({
    h: phieu.holdId,
    p: phieu.paymentRequestId,
    a: phieu.anonymousId,
    c: phieu.contact || undefined,
    t: phieu.amountVnd,
    g: phieu.productId,
    e: phieu.expiresAt,
  });
  const ma = Buffer.concat([cipher.update(nen, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ma]).toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function moPhieu(
  chuoi: string,
  khoa: Buffer = khoaPhieu(),
  bayGio: number = Date.now(),
): PhieuQr {
  let nen: Record<string, unknown>;
  try {
    const goi = Buffer.from(chuoi, "base64url");
    if (goi.length < 29 || goi.length > 2048) throw new Error("độ dài");
    const decipher = createDecipheriv("aes-256-gcm", khoa, goi.subarray(0, 12));
    decipher.setAuthTag(goi.subarray(12, 28));
    const ro = Buffer.concat([decipher.update(goi.subarray(28)), decipher.final()]);
    nen = JSON.parse(ro.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new PhieuQrError("Mã QR này không đọc được. Mời bạn quét lại mã trên màn hình đặt chỗ.", "PHIEU_HONG");
  }
  const { h, p, a, c, t, g, e } = nen;
  if (
    typeof h !== "string" || !UUID.test(h)
    || typeof p !== "string" || !UUID.test(p)
    || typeof a !== "string" || !UUID.test(a)
    || typeof g !== "string"
    || typeof t !== "number" || !Number.isFinite(t)
    || typeof e !== "number"
    || (c !== undefined && typeof c !== "string")
  ) {
    throw new PhieuQrError("Mã QR này không đọc được. Mời bạn quét lại mã trên màn hình đặt chỗ.", "PHIEU_HONG");
  }
  if (e <= bayGio) {
    throw new PhieuQrError(
      "Mã QR này đã hết hạn cùng lượt giữ chỗ. Mời bạn giữ chỗ lại trên màn hình đặt chỗ.",
      "PHIEU_HET_HAN",
    );
  }
  return {
    holdId: h,
    paymentRequestId: p,
    anonymousId: a,
    contact: c,
    amountVnd: t,
    productId: g,
    expiresAt: e,
  };
}
