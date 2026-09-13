import { describe, expect, it } from "vitest";
import {
  computeCounterCart,
  counterCashSuggestions,
  counterChange,
  counterSaleReadiness,
  parseCounterPrices,
  parseCounterSaleReceipt,
  type CounterPrice,
} from "@/domain/erp-counter-sale";
import { reconcileShift, type ShiftCounterCash } from "@/domain/erp-shift-reconciliation";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

const GIA: CounterPrice[] = [
  { priceListId: "p-nl", product: "adult", unitPriceVnd: 250_000, effectiveFrom: "2026-09-13" },
  { priceListId: "p-te", product: "child", unitPriceVnd: 0, effectiveFrom: "2026-09-13" },
];

describe("quầy tính tiền đúng như máy chủ sẽ tính", () => {
  it("2 người lớn và 1 trẻ dưới 1m3 là 500.000 đồng, 3 khách", () => {
    const cart = computeCounterCart({ adults: 2, children: 1, prices: GIA });
    expect(cart.totalVnd).toBe(500_000);
    expect(cart.partySize).toBe(3);
    expect(cart.lines).toEqual([
      { product: "adult", quantity: 2, unitPriceVnd: 250_000, lineTotalVnd: 500_000 },
      { product: "child", quantity: 1, unitPriceVnd: 0, lineTotalVnd: 0 },
    ]);
  });

  it("số vé âm, lẻ hay hỏng đều không lọt thành một dòng tiền", () => {
    const cart = computeCounterCart({ adults: -3, children: Number.NaN, prices: GIA });
    expect(cart.partySize).toBe(0);
    expect(cart.lines).toEqual([]);
    expect(computeCounterCart({ adults: 2.9, children: 0, prices: GIA }).lines[0].quantity).toBe(2);
  });

  it("loại vé chưa có giá thì báo thiếu, không tự coi là miễn phí", () => {
    const cart = computeCounterCart({ adults: 1, children: 2, prices: [GIA[0]] });
    expect(cart.missingPrices).toEqual(["child"]);
    expect(cart.totalVnd).toBe(250_000);
  });

  it("tiền thối là null khi khách đưa chưa đủ, không bao giờ âm", () => {
    expect(counterChange(600_000, 500_000)).toBe(100_000);
    expect(counterChange(500_000, 500_000)).toBe(0);
    expect(counterChange(499_999, 500_000)).toBeNull();
    expect(counterChange(Number.NaN, 0)).toBeNull();
  });

  it("gợi ý tiền khách đưa: đủ tiền trước, rồi các mệnh giá làm tròn lên", () => {
    expect(counterCashSuggestions(250_000)).toEqual([250_000, 300_000, 400_000, 500_000]);
    // Ba tờ 200.000 cho phiếu 500.000 là chuyện thường ở quầy.
    expect(counterCashSuggestions(500_000)).toEqual([500_000, 600_000, 1_000_000]);
    expect(counterCashSuggestions(0)).toEqual([]);
  });
});

describe("nút xác nhận bán chỉ mở khi đủ bốn điều", () => {
  const cart = computeCounterCart({ adults: 2, children: 0, prices: GIA });

  it("chưa tick đã đếm tiền thì chưa bán được, dù tiền đã đủ", () => {
    const ketQua = counterSaleReadiness({ cart, cashReceivedVnd: 500_000, cashCountedConfirmed: false });
    expect(ketQua.ok).toBe(false);
  });

  it("thiếu tiền thì chưa bán được, dù đã tick", () => {
    const ketQua = counterSaleReadiness({ cart, cashReceivedVnd: 400_000, cashCountedConfirmed: true });
    expect(ketQua).toEqual({ ok: false, reason: "Số tiền khách đưa chưa đủ tổng." });
  });

  it("chưa chọn vé hoặc vượt 45 khách thì chưa bán được", () => {
    const rong = computeCounterCart({ adults: 0, children: 0, prices: GIA });
    expect(counterSaleReadiness({ cart: rong, cashReceivedVnd: 0, cashCountedConfirmed: true }).ok).toBe(false);
    const dong = computeCounterCart({ adults: 40, children: 6, prices: GIA });
    expect(counterSaleReadiness({ cart: dong, cashReceivedVnd: 99_000_000, cashCountedConfirmed: true }).ok).toBe(false);
  });

  it("đủ vé, đủ tiền, đã tick thì bán được", () => {
    expect(counterSaleReadiness({ cart, cashReceivedVnd: 500_000, cashCountedConfirmed: true })).toEqual({ ok: true });
  });
});

describe("đọc phiếu và lỗi từ máy chủ", () => {
  it("đọc đúng phiếu máy chủ trả về", () => {
    const phieu = parseCounterSaleReceipt({
      sale_code: "PT-0A1B2C3D4E5F",
      site_id: "10000000-0000-4000-8000-000000000001",
      sold_by_account_id: "employee-trang-an-01",
      sold_by_name: "Lê Minh Tuấn",
      acting_director_account_id: null,
      sold_at: "2026-09-13T03:00:00Z",
      business_date: "2026-09-13",
      adults: 2,
      children: 1,
      total_vnd: 500000,
      cash_received_vnd: 600000,
      change_vnd: 100000,
      status: "completed",
      lines: [
        { product: "adult", quantity: 2, unit_price_vnd: 250000, line_total_vnd: 500000, ticket_code: "QUAY-AAAABBBBCCCC", entries_allowed: 2, entries_used: 0, ticket_status: "issued" },
        { product: "hack", quantity: 1 },
      ],
    });
    expect(phieu?.saleCode).toBe("PT-0A1B2C3D4E5F");
    expect(phieu?.changeVnd).toBe(100000);
    expect(phieu?.lines).toHaveLength(1);
    expect(parseCounterSaleReceipt({})).toBeNull();
  });

  it("bảng giá bỏ qua dòng hỏng và giá âm", () => {
    expect(
      parseCounterPrices([
        { price_list_id: "a", product: "adult", unit_price_vnd: 250000, effective_from: "2026-09-13" },
        { product: "child", unit_price_vnd: -1 },
        { product: "vip", unit_price_vnd: 1 },
      ]),
    ).toHaveLength(1);
  });

  it("mọi lỗi quầy máy chủ trả về đều thành câu tiếng Việt, qua bảng lỗi chung", () => {
    for (const ma of [
      "COUNTER_SALE_CASH_NOT_CONFIRMED",
      "COUNTER_SALE_CASH_SHORT",
      "COUNTER_SALE_VOID_OWN_SALE",
      "COUNTER_SALE_VOID_NOT_ALLOWED",
      "COUNTER_SALE_ALREADY_ADMITTED",
    ]) {
      const cau = findRpcBusinessMessage({ message: `ERROR: ${ma} (SQLSTATE 22023)` });
      expect(cau, ma).toBeTruthy();
      expect(cau, ma).not.toMatch(/[A-Z_]{6,}/);
    }
  });
});

describe("đối soát cuối ca khi quầy đã ghi phiếu", () => {
  const ca = {
    businessDate: "2026-09-13",
    shiftStartedAt: "2026-09-13T00:00:00Z",
    shiftEndedAt: "2026-09-13T05:00:00Z",
    ticketsSold: 10,
    cashVnd: 1_000_000,
  };
  const quay = (totalVnd: number, voidedVnd = 0): ShiftCounterCash => ({
    count: totalVnd > 0 ? 3 : 0,
    totalVnd,
    voidedCount: voidedVnd > 0 ? 1 : 0,
    voidedVnd,
    sellers: [{ accountId: "employee-trang-an-01", displayName: "Lê Minh Tuấn", count: 3, totalVnd }],
  });

  it("hệ thống đếm tiền quầy vào con số tiền mặt", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000) });
    const tien = ketQua.differences.find((d) => d.id === "cash");
    expect(tien?.counted).toBe(1_000_000);
    expect(tien?.delta).toBe(0);
    expect(ketQua.gaps.map((g) => g.id)).not.toContain("cash-below-counted");
    expect(ketQua.gaps.map((g) => g.id)).not.toContain("cash-without-receipt");
  });

  it("phiếu quầy nhiều hơn tiền khai là thiếu tiền, báo đỏ", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_250_000) });
    const canhBao = ketQua.gaps.find((g) => g.id === "cash-below-counted");
    expect(canhBao?.level).toBe("alert");
    expect(canhBao?.title).toContain("250.000");
  });

  it("tiền khai nhiều hơn phiếu quầy là có tiền mặt không phiếu, phải hỏi lại", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(700_000) });
    const canhBao = ketQua.gaps.find((g) => g.id === "cash-without-receipt");
    expect(canhBao?.level).toBe("watch");
    expect(canhBao?.title).toContain("300.000");
  });

  it("phiếu huỷ không tính vào quỹ, nhưng được nêu ra", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000, 250_000) });
    expect(ketQua.differences.find((d) => d.id === "cash")?.counted).toBe(1_000_000);
    expect(ketQua.gaps.find((g) => g.id === "counter-voided")?.level).toBe("info");
  });

  it("cộng cả tiền thu tại cổng lẫn tiền quầy", () => {
    const ketQua = reconcileShift({
      shift: ca,
      scanCounts: null,
      cash: { count: 1, totalVnd: 300_000, collectors: [], outstandingCount: 0, outstandingVnd: 0 },
      counterCash: quay(700_000),
    });
    expect(ketQua.differences.find((d) => d.id === "cash")?.counted).toBe(1_000_000);
  });

  it("chưa có sổ quầy thì giữ nguyên cách tính cũ", () => {
    const cu = reconcileShift({ shift: ca, scanCounts: null, cash: null });
    const moi = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: null });
    expect(moi.differences).toEqual(cu.differences);
    expect(moi.gaps).toEqual(cu.gaps);
    expect(moi.counterCash).toBeNull();
  });
});
