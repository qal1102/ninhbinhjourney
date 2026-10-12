import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { khoaPhieuQuayTu, moPhieuQuay, niemPhieuQuay, PhieuQuayError, type PhieuQuayCho } from "@/lib/erp/phieu-quay";
import { khoaPhieuTu, niemPhieu } from "@/lib/customer-data/phieu-qr-thanh-toan";

const BI = "k".repeat(40);
const KHOA = khoaPhieuQuayTu(BI);
const BAY_GIO = Date.UTC(2026, 9, 12, 7, 0, 0);

const CHO: PhieuQuayCho = {
  loai: "cho",
  siteId: "trang-an",
  adults: 2,
  children: 1,
  actorAccountId: "employee-trang-an-01",
  actorName: "Đỗ Thị Lan",
  actingDirectorAccountId: null,
  requestKey: "6f1c2a0e-9a4b-4c1d-8e2f-1234567890ab",
  totalVnd: 500000,
  expiresAt: BAY_GIO + 15 * 60 * 1000,
};

describe("mã QR quầy cho khách quét", () => {
  it("mở lại đúng mọi trường của mã chờ quét", () => {
    expect(moPhieuQuay(niemPhieuQuay(CHO, KHOA), KHOA, BAY_GIO)).toEqual(CHO);
  });

  it("mở lại mã xem vé của phiếu đã bán", () => {
    const ma = niemPhieuQuay({ loai: "ve", siteId: "tam-coc", saleCode: "PT-ABC123DEF456" }, KHOA);
    expect(moPhieuQuay(ma, KHOA, BAY_GIO)).toEqual({ loai: "ve", siteId: "tam-coc", saleCode: "PT-ABC123DEF456" });
  });

  it("sửa một ký tự là hỏng, không đọc ra số vé khác", () => {
    const ma = niemPhieuQuay(CHO, KHOA);
    const sua = ma.slice(0, 40) + (ma[40] === "A" ? "B" : "A") + ma.slice(41);
    expect(() => moPhieuQuay(sua, KHOA, BAY_GIO)).toThrow(PhieuQuayError);
  });

  it("quá 15 phút thì không xác nhận trả được, nhưng vẫn đọc được để xem vé", () => {
    const ma = niemPhieuQuay(CHO, KHOA);
    const sau = CHO.expiresAt + 1;
    expect(() => moPhieuQuay(ma, KHOA, sau)).toThrow(/hết hạn/);
    expect(moPhieuQuay(ma, KHOA, sau, { choPhepHetHan: true })).toMatchObject({ loai: "cho", requestKey: CHO.requestKey });
  });

  it("không nhận mã thanh toán của web dù cùng bí mật gốc", () => {
    const maWeb = niemPhieu(
      {
        holdId: "11111111-1111-4111-8111-111111111111",
        paymentRequestId: "22222222-2222-4222-8222-222222222222",
        anonymousId: "33333333-3333-4333-8333-333333333333",
        amountVnd: 500000,
        productId: "trang-an-mot-ngay",
        expiresAt: CHO.expiresAt,
      },
      khoaPhieuTu(BI),
    );
    expect(() => moPhieuQuay(maWeb, KHOA, BAY_GIO)).toThrow(PhieuQuayError);
  });

  it("từ chối số vé ngoài 1–45 người", () => {
    expect(() => moPhieuQuay(niemPhieuQuay({ ...CHO, adults: 40, children: 6 }, KHOA), KHOA, BAY_GIO)).toThrow(PhieuQuayError);
    expect(() => moPhieuQuay(niemPhieuQuay({ ...CHO, adults: 0, children: 0 }, KHOA), KHOA, BAY_GIO)).toThrow(PhieuQuayError);
  });
});
