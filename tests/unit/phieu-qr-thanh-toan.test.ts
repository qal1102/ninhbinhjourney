import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { khoaPhieuTu, moPhieu, niemPhieu, PhieuQrError } from "@/lib/customer-data/phieu-qr-thanh-toan";
import { CustomerQrPaymentRequestSchema, nhanCachTra } from "@/domain/customer-booking";

const KHOA = khoaPhieuTu("k".repeat(40));
const BAY_GIO = Date.UTC(2026, 8, 26, 3, 0, 0);

const PHIEU = {
  holdId: "11111111-1111-4111-8111-111111111111",
  paymentRequestId: "22222222-2222-4222-8222-222222222222",
  anonymousId: "33333333-3333-4333-8333-333333333333",
  contact: "0912345678",
  amountVnd: 500000,
  productId: "trang-an-mot-ngay",
  expiresAt: BAY_GIO + 15 * 60 * 1000,
};

describe("phiếu thanh toán QR", () => {
  it("niêm rồi mở lại ra đúng nội dung", () => {
    expect(moPhieu(niemPhieu(PHIEU, KHOA), KHOA, BAY_GIO)).toEqual(PHIEU);
  });

  it("không để lộ phiên khách hay số điện thoại trong đường dẫn", () => {
    const chuoi = niemPhieu(PHIEU, KHOA);
    const giai = Buffer.from(chuoi, "base64url").toString("latin1");
    expect(chuoi).not.toContain("0912345678");
    expect(giai).not.toContain("0912345678");
    expect(giai).not.toContain(PHIEU.anonymousId);
    // Đủ ngắn để mã QR còn quét dễ trên màn hình.
    expect(chuoi.length).toBeLessThan(400);
  });

  it("hai lần niêm cùng nội dung ra hai chuỗi khác nhau", () => {
    expect(niemPhieu(PHIEU, KHOA)).not.toBe(niemPhieu(PHIEU, KHOA));
  });

  it("sửa một ký tự là phiếu hỏng", () => {
    const chuoi = niemPhieu(PHIEU, KHOA);
    const giua = Math.floor(chuoi.length / 2);
    const sua = chuoi.slice(0, giua) + (chuoi[giua] === "A" ? "B" : "A") + chuoi.slice(giua + 1);
    expect(() => moPhieu(sua, KHOA, BAY_GIO)).toThrow(PhieuQrError);
  });

  it("khoá khác thì không mở được", () => {
    const chuoi = niemPhieu(PHIEU, KHOA);
    expect(() => moPhieu(chuoi, khoaPhieuTu("x".repeat(40)), BAY_GIO)).toThrow(PhieuQrError);
  });

  it("quá 15 phút giữ chỗ thì phiếu hết hạn", () => {
    const chuoi = niemPhieu(PHIEU, KHOA);
    try {
      moPhieu(chuoi, KHOA, PHIEU.expiresAt + 1);
      throw new Error("phải hết hạn");
    } catch (error) {
      expect(error).toBeInstanceOf(PhieuQrError);
      expect((error as PhieuQrError).code).toBe("PHIEU_HET_HAN");
    }
  });

  it("rác thì báo phiếu hỏng, không văng lỗi lạ", () => {
    for (const rac of ["", "abc", "!!!!", "A".repeat(3000)]) {
      expect(() => moPhieu(rac, KHOA, BAY_GIO)).toThrow(PhieuQrError);
    }
  });
});

describe("yêu cầu mở mã QR", () => {
  it("bắt buộc có liên hệ, vì luật chống giữ chỗ bừa đếm theo số", () => {
    const hopLe = {
      hold_id: PHIEU.holdId,
      payment_request_id: PHIEU.paymentRequestId,
      contact: "0912345678",
      amount_vnd: 500000,
      product_id: "trang-an",
    };
    expect(CustomerQrPaymentRequestSchema.safeParse(hopLe).success).toBe(true);
    const { contact: _bo, ...thieu } = hopLe;
    void _bo;
    expect(CustomerQrPaymentRequestSchema.safeParse(thieu).success).toBe(false);
    expect(CustomerQrPaymentRequestSchema.safeParse({ ...hopLe, extra: 1 }).success).toBe(false);
  });
});

describe("nhãn cách trả trong ERP", () => {
  it("nói rõ đơn nào trả bằng QR", () => {
    expect(nhanCachTra("qr-transfer", "succeeded")).toBe("Đã thanh toán bằng QR");
    expect(nhanCachTra("pay-on-site", "pending")).toBe("Chờ thu tại điểm");
    expect(nhanCachTra("pay-on-site", "succeeded")).toBe("Đã thu tiền mặt tại điểm");
    expect(nhanCachTra("pay-on-site", "cancelled")).toBe("Đã huỷ vì khách không đến");
    expect(nhanCachTra(null, null)).toBe("Chưa thanh toán");
  });
});
