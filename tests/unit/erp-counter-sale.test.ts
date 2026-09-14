import { describe, expect, it } from "vitest";
import {
  computeCounterCart,
  counterCashSuggestions,
  counterChange,
  counterPaymentReference,
  counterSaleReadiness,
  parseCounterPriceHistory,
  parseCounterPrices,
  parseCounterSaleReceipt,
  validateCounterPriceInput,
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

describe("QA-ERP-POS-05 — khách trả bằng chuyển khoản QR", () => {
  const cart = computeCounterCart({ adults: 2, children: 0, prices: GIA });

  it("không cần nhập tiền khách đưa, nhưng vẫn phải tick đã thấy tiền về", () => {
    expect(
      counterSaleReadiness({ cart, cashReceivedVnd: 0, cashCountedConfirmed: false, paymentMethod: "qr-transfer" }),
    ).toEqual({ ok: false, reason: "Mở ứng dụng ngân hàng, thấy tiền về đúng số, rồi đánh dấu xác nhận." });
    expect(
      counterSaleReadiness({ cart, cashReceivedVnd: 0, cashCountedConfirmed: true, paymentMethod: "qr-transfer" }),
    ).toEqual({ ok: true });
  });

  it("tiền mặt vẫn đòi đủ tiền khách đưa như cũ", () => {
    expect(
      counterSaleReadiness({ cart, cashReceivedVnd: 0, cashCountedConfirmed: true, paymentMethod: "cash" }).ok,
    ).toBe(false);
  });

  it("nội dung chuyển khoản gọn, không dấu, đúng ràng buộc của migration 070", () => {
    const ma = counterPaymentReference("3f9a2c10-7b4e-4d2a-9c1e-0a1b2c3d4e5f");
    expect(ma).toBe("NBJ-3F9A2C");
    expect(ma).toMatch(/^[A-Z0-9-]{4,40}$/);
    // Cùng một tấm phiếu thì cùng một nội dung, bấm lại không đổi mã khách đã ghi.
    expect(counterPaymentReference("3f9a2c10-7b4e-4d2a-9c1e-0a1b2c3d4e5f")).toBe(ma);
    expect(counterPaymentReference("")).toBe("NBJ-000000");
    expect(counterPaymentReference("ab")).toBe("NBJ-AB0000");
  });

  it("phiếu QR đọc ra đúng phương thức và nội dung; trường lạ thì coi là tiền mặt", () => {
    const goc = {
      sale_code: "PT-0A1B2C3D4E5F",
      sold_at: "2026-09-13T03:00:00Z",
      business_date: "2026-09-13",
      total_vnd: 500000,
      status: "completed",
      lines: [],
    };
    const qr = parseCounterSaleReceipt({ ...goc, payment_method: "qr-transfer", payment_reference: "NBJ-3F9A2C" });
    expect(qr?.paymentMethod).toBe("qr-transfer");
    expect(qr?.paymentReference).toBe("NBJ-3F9A2C");
    expect(parseCounterSaleReceipt({ ...goc, payment_method: "bitcoin" })?.paymentMethod).toBe("cash");
  });
});

describe("QA-ERP-POS-05 — giám đốc đặt giá", () => {
  const today = "2026-09-13";

  it("giá hôm nay hoặc hẹn ngày sau thì lưu được", () => {
    expect(validateCounterPriceInput({ unitPriceVnd: 280_000, effectiveFrom: today, today })).toEqual({ ok: true });
    expect(validateCounterPriceInput({ unitPriceVnd: 0, effectiveFrom: "2026-10-01", today })).toEqual({ ok: true });
  });

  it("không đặt giá lùi ngày, vì phiếu đã bán phải giữ giá lúc bán", () => {
    const ketQua = validateCounterPriceInput({ unitPriceVnd: 280_000, effectiveFrom: "2026-09-12", today });
    expect(ketQua.ok).toBe(false);
  });

  it("hẹn giá trước tối đa một năm, đúng như máy chủ", () => {
    expect(validateCounterPriceInput({ unitPriceVnd: 1, effectiveFrom: "2027-09-13", today }).ok).toBe(true);
    expect(validateCounterPriceInput({ unitPriceVnd: 1, effectiveFrom: "2027-09-14", today }).ok).toBe(false);
  });

  it("giá âm, lẻ, quá trần hay trống đều bị chặn", () => {
    for (const gia of [-1, 1.5, 10_000_001, Number.NaN]) {
      expect(validateCounterPriceInput({ unitPriceVnd: gia, effectiveFrom: today, today }).ok, String(gia)).toBe(false);
    }
    expect(validateCounterPriceInput({ unitPriceVnd: 1, effectiveFrom: "13/09/2026", today }).ok).toBe(false);
  });

  it("lịch sử giá không in mã máy của giá khởi tạo ra màn hình", () => {
    const rows = parseCounterPriceHistory([
      { price_list_id: "a", product: "adult", unit_price_vnd: 250000, effective_from: today, created_by_name: "system" },
      { price_list_id: "b", product: "adult", unit_price_vnd: 280000, effective_from: today, created_by_name: "Trần Thu Hà", note: "Mùa lễ" },
      { price_list_id: "c", product: "vip", unit_price_vnd: 1 },
    ]);
    expect(rows.map((row) => row.createdByName)).toEqual(["Hệ thống", "Trần Thu Hà"]);
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
      "COUNTER_SALE_PAYMENT_INVALID",
      "COUNTER_PRICE_INPUT_INVALID",
      "COUNTER_PRICE_DATE_INVALID",
      "COUNTER_PRICE_NOT_ALLOWED",
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
  const quay = (totalVnd: number, voidedVnd = 0, qrTotalVnd = 0): ShiftCounterCash => ({
    count: totalVnd > 0 ? 3 : 0,
    totalVnd,
    qrCount: qrTotalVnd > 0 ? 2 : 0,
    qrTotalVnd,
    voidedCount: voidedVnd > 0 ? 1 : 0,
    voidedVnd,
    sellers: [{ accountId: "employee-trang-an-01", displayName: "Lê Minh Tuấn", count: 3, totalVnd, qrTotalVnd }],
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

describe("QA-ERP-POS-05 — đối soát tách tiền mặt với chuyển khoản QR", () => {
  const ca = {
    businessDate: "2026-09-13",
    shiftStartedAt: "2026-09-13T00:00:00Z",
    shiftEndedAt: "2026-09-13T05:00:00Z",
    ticketsSold: 10,
    cashVnd: 1_000_000,
    cardVnd: 500_000,
  };
  const quay = (totalVnd: number, qrTotalVnd: number): ShiftCounterCash => ({
    count: 3,
    totalVnd,
    qrCount: qrTotalVnd > 0 ? 2 : 0,
    qrTotalVnd,
    voidedCount: 0,
    voidedVnd: 0,
    sellers: [],
  });

  it("tiền QR không cộng vào tiền mặt trong quỹ", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000, 500_000) });
    expect(ketQua.differences.find((d) => d.id === "cash")?.counted).toBe(1_000_000);
    expect(ketQua.gaps.map((g) => g.id)).not.toContain("cash-below-counted");
  });

  it("phiếu QR nhiều hơn phần khai thẻ và chuyển khoản thì báo đỏ", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000, 750_000) });
    const canhBao = ketQua.gaps.find((g) => g.id === "counter-qr-above-declared");
    expect(canhBao?.level).toBe("alert");
    expect(canhBao?.title).toContain("250.000");
    expect(ketQua.differences.find((d) => d.id === "transfer")?.delta).toBe(250_000);
  });

  it("khai thẻ nhiều hơn phiếu QR là thường gặp, không báo", () => {
    const ketQua = reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000, 300_000) });
    expect(ketQua.gaps.map((g) => g.id)).not.toContain("counter-qr-above-declared");
    expect(ketQua.differences.find((d) => d.id === "transfer")?.delta).toBe(-200_000);
  });

  it("không có phiếu QR, hoặc không truyền phần khai thẻ, thì không có dòng chuyển khoản", () => {
    expect(
      reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: quay(1_000_000, 0) }).differences.map((d) => d.id),
    ).toEqual(["cash", "entries"]);
    const khongKhaiThe = { ...ca, cardVnd: undefined };
    const ketQua = reconcileShift({ shift: khongKhaiThe, scanCounts: null, cash: null, counterCash: quay(1_000_000, 900_000) });
    expect(ketQua.differences.map((d) => d.id)).toEqual(["cash", "entries"]);
    expect(ketQua.gaps.map((g) => g.id)).not.toContain("counter-qr-above-declared");
  });

  it("ca chỉ có phiếu QR vẫn là ca có số liệu, không hiện như ca trống", () => {
    const chiQr: ShiftCounterCash = { ...quay(0, 500_000), count: 0 };
    expect(reconcileShift({ shift: ca, scanCounts: null, cash: null, counterCash: chiQr }).hasCountedData).toBe(true);
  });
});
