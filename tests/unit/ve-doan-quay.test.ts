import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bacUuDai, giaVeDoan, parseCounterSaleReceipt } from "@/domain/erp-counter-sale";
import { khoaPhieuQuayTu, moPhieuQuay, niemPhieuQuay, PhieuQuayError, type PhieuQuayCho } from "@/lib/erp/phieu-quay";

const KHOA = khoaPhieuQuayTu("k".repeat(40));

describe("vé đoàn ở quầy (migration 118)", () => {
  it("giá đoàn = giá người lớn × số người, giảm làm tròn xuống nghìn đồng như trong kho", () => {
    expect(giaVeDoan({ unitPriceVnd: 250_000, partySize: 7, discountPercent: 5 })).toEqual({
      tamTinhVnd: 1_750_000,
      giamVnd: 87_000,
      tongVnd: 1_663_000,
      phanTram: 5,
    });
    expect(giaVeDoan({ unitPriceVnd: 250_000, partySize: 10, discountPercent: 0 }).tongVnd).toBe(2_500_000);
  });

  it("bậc ưu đãi theo số đoàn đã trả trong năm", () => {
    expect(bacUuDai(0)).toEqual({ phanTram: 0, mocKe: 5 });
    expect(bacUuDai(5)).toEqual({ phanTram: 5, mocKe: 10 });
    expect(bacUuDai(12)).toEqual({ phanTram: 8, mocKe: 20 });
    expect(bacUuDai(25)).toEqual({ phanTram: 10, mocKe: null });
  });

  it("mã QR chờ quét mang được thông tin đoàn, khách không sửa được", () => {
    const phieu: PhieuQuayCho = {
      loai: "cho",
      siteId: "trang-an",
      adults: 12,
      children: 0,
      actorAccountId: "employee-trang-an-01",
      actorName: "Đỗ Thị Lan",
      actingDirectorAccountId: null,
      requestKey: "khoa-doan-12345678",
      totalVnd: 2_850_000,
      expiresAt: Date.now() + 60_000,
      doan: {
        leaderName: "HDV Nguyễn Văn An",
        leaderPhone: "0987654321",
        travelCompanyId: "293ce34c-e685-42b5-a7cf-f12acc6a55b3",
        invoiceRequested: true,
        groupLabel: "",
        companyName: "Công ty Lữ hành ABC",
        discountPercent: 5,
      },
    };
    const mo = moPhieuQuay(niemPhieuQuay(phieu, KHOA), KHOA);
    expect(mo).toEqual(phieu);
  });

  it("mã đoàn có trẻ em lẻ hay dưới hai người thì không mở được", () => {
    const hong: PhieuQuayCho = {
      loai: "cho",
      siteId: "trang-an",
      adults: 1,
      children: 0,
      actorAccountId: "employee-trang-an-01",
      actorName: "Lan",
      actingDirectorAccountId: null,
      requestKey: "khoa-doan-12345678",
      totalVnd: 250_000,
      expiresAt: Date.now() + 60_000,
      doan: {
        leaderName: "HDV An",
        leaderPhone: null,
        travelCompanyId: null,
        invoiceRequested: false,
        groupLabel: "",
        companyName: null,
        discountPercent: 0,
      },
    };
    expect(() => moPhieuQuay(niemPhieuQuay(hong, KHOA), KHOA)).toThrow(PhieuQuayError);
  });

  it("phiếu thu đọc được loại phiếu, ưu đãi, công ty và người mời", () => {
    const doan = parseCounterSaleReceipt({
      sale_code: "PT-EBA9DEDCDA16",
      payment_method: "cash",
      total_vnd: 1_663_000,
      sale_kind: "group",
      discount_percent: 5,
      discount_vnd: 87_000,
      group_leader_name: "HDV C",
      invoice_requested: true,
      group_code: "DOAN-8CD1D8A79D",
      travel_company: { id: "c1", name: "ABC", tax_code: "0101234567", address: "Hà Nội", invoice_email: null },
      lines: [],
    });
    expect(doan).toMatchObject({
      saleKind: "group",
      discountVnd: 87_000,
      groupCode: "DOAN-8CD1D8A79D",
      travelCompany: { name: "ABC", taxCode: "0101234567" },
      invoiceRequested: true,
    });
    const moi = parseCounterSaleReceipt({
      sale_code: "PT-000000000001",
      payment_method: "complimentary",
      sale_kind: "comp",
      comp_inviter_name: "Lê Hoàng Nam",
      comp_reason: "Đoàn báo chí",
      lines: [],
    });
    expect(moi).toMatchObject({ saleKind: "comp", paymentMethod: "complimentary", compInviterName: "Lê Hoàng Nam" });
    // Phiếu cũ trước migration 118: không có trường mới thì là phiếu lẻ.
    expect(parseCounterSaleReceipt({ sale_code: "PT-000000000002", lines: [] })).toMatchObject({
      saleKind: "single",
      discountVnd: 0,
      travelCompany: null,
    });
  });
});
