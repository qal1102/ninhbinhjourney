import { describe, expect, it } from "vitest";
import { summarisePostedTrialBalance, type AccountingJournal } from "@/domain/erp-accounting";
import {
  SHIFT_SCAN_RESULT_KEYS,
  reconcileShift,
  type ShiftScanCounts,
} from "@/domain/erp-shift-reconciliation";
import { ticketStatusLabel } from "@/domain/erp-ticket-sales";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import type { TicketSalesSummary } from "@/lib/erp/gate-scan-repository";
import type { ShiftReconciliationSource } from "@/lib/erp/shift-reconciliation-repository";
import { buildAccountingLedgerReport, buildSupplierApReport } from "@/lib/export/accounting-report";
import { buildReportXlsx, reportFileName, reportHasData, type ReportTable } from "@/lib/export/report";
import { buildShiftReconciliationReport } from "@/lib/export/shift-reconciliation-report";
import { buildTicketSalesReport, ticketSalesHasData } from "@/lib/export/ticket-sales-report";
import { readXlsx } from "./support/xlsx-reader";

const EXPORTED_AT = new Date("2026-09-17T07:05:00.000Z");
const GAP_LABELS = { alert: "Cần xử lý ngay", watch: "Nên xem lại", info: "Ghi chú" } as const;

function table(tables: readonly ReportTable[], title: string): ReportTable {
  const found = tables.find((item) => item.title === title);
  if (!found) throw new Error(`Không thấy bảng ${title}`);
  return found;
}

function scanCounts(overrides: Partial<ShiftScanCounts> = {}): ShiftScanCounts {
  const base = Object.fromEntries(SHIFT_SCAN_RESULT_KEYS.map((key) => [key, 0])) as Record<
    (typeof SHIFT_SCAN_RESULT_KEYS)[number],
    number
  >;
  return { ...base, ...overrides };
}

function shiftSource(overrides: Partial<ShiftReconciliationSource> = {}): ShiftReconciliationSource {
  return {
    shift: {
      id: "ca-1",
      shiftCode: "TA-20260915-CA1",
      shiftLabel: "Ca sáng",
      station: "Cổng A",
      businessDate: "2026-09-15",
      status: "submitted",
      submittedByName: "Nguyễn Văn An",
      dataOrigin: "real",
    },
    reconciliation: reconcileShift({
      shift: {
        businessDate: "2026-09-15",
        shiftStartedAt: "2026-09-14T23:00:00.000Z",
        shiftEndedAt: "2026-09-15T07:00:00.000Z",
        ticketsSold: 40,
        cashVnd: 4_000_000,
        cardVnd: 500_000,
      },
      scanCounts: scanCounts({ accepted: 38, "payment-due": 2, "wrong-day": 1 }),
      cash: {
        count: 2,
        totalVnd: 600_000,
        collectors: [{ accountId: "nv-1", displayName: "Trần Thị Bình", count: 2, totalVnd: 600_000 }],
        outstandingCount: 0,
        outstandingVnd: 0,
      },
      counterCash: {
        count: 12,
        totalVnd: 3_000_000,
        qrCount: 2,
        qrTotalVnd: 500_000,
        voidedCount: 1,
        voidedVnd: 250_000,
        sellers: [
          { accountId: "nv-2", displayName: "Lê Hoà", count: 14, totalVnd: 3_000_000, qrTotalVnd: 500_000 },
        ],
      },
    }),
    scanUnavailableReason: "",
    cashUnavailableReason: "",
    counterCashUnavailableReason: "",
    ...overrides,
  };
}

describe("báo cáo đối soát cuối ca", () => {
  it("chép đúng khai, đếm và chênh lệch trên màn hình", () => {
    const source = shiftSource();
    const report = buildShiftReconciliationReport({
      siteName: "Tràng An",
      source,
      statusLabel: "Chờ quản lý",
      gapLevelLabels: GAP_LABELS,
    });
    const tables = report.sheets[0].tables;
    const differences = table(tables, "Chênh lệch");
    expect(differences.rows).toHaveLength(source.reconciliation.differences.length);
    source.reconciliation.differences.forEach((difference, index) => {
      expect(differences.rows[index].slice(0, 5)).toEqual([
        difference.label,
        difference.unit === "vnd" ? "đồng" : "lượt",
        difference.declared,
        difference.counted,
        difference.delta,
      ]);
    });
    // Tiền mặt: đếm 600.000 cổng + 3.000.000 quầy = 3.600.000, khai 4.000.000.
    expect(differences.rows[0].slice(2, 5)).toEqual([4_000_000, 3_600_000, -400_000]);

    expect(table(tables, "Lượt quét trong ca").rows).toEqual([
      ["Cho vào", 38],
      ["Chưa thu tiền", 2],
      ["Từ chối", 1],
    ]);
    expect(table(tables, "Lượt quét theo kết quả").rows).toEqual([
      ["Mời khách vào", 38],
      ["Vé không dùng cho ngày ấy", 1],
      ["Giữ lại vì chưa thu tiền", 2],
    ]);
    expect(table(tables, "Tiền thu tại điểm").totalRow).toEqual(["Tổng cả ca", 2, 600_000]);
    expect(table(tables, "Tiền bán tại quầy").rows).toEqual([
      ["Tiền mặt phải có trong quỹ", 12, 3_000_000],
      ["Chuyển khoản QR, tiền nằm ở tài khoản ngân hàng", 2, 500_000],
      ["Phiếu đã huỷ, đã hoàn cho khách", 1, 250_000],
    ]);
    const gaps = table(tables, "Cần lưu ý");
    expect(gaps.rows.map((row) => row[1])).toEqual(source.reconciliation.gaps.map((gap) => gap.title));
    expect(gaps.rows.every((row) => Object.values(GAP_LABELS).includes(row[0] as never))).toBe(true);

    const info = table(tables, "Hồ sơ ca").rows;
    expect(info).toContainEqual(["Ngày làm việc", "15/09/2026"]);
    expect(info).toContainEqual(["Khung giờ đối soát", "06:00 15/09/2026 → 14:00 15/09/2026 (giờ Việt Nam)"]);
    expect(info).toContainEqual(["Trạng thái", "Chờ quản lý"]);
    expect(report.period).toBe("Ca TA-20260915-CA1 · Ca sáng · ngày làm việc 15/09/2026");
    expect(reportFileName(report, EXPORTED_AT)).toBe("doi-soat-ca_trang-an_ta-20260915-ca1_2026-09-17.xlsx");
  });

  it("chưa đọc được thì ghi đúng câu màn hình, không ghi số 0", () => {
    const base = shiftSource();
    const source = shiftSource({
      shift: { ...base.shift, dataOrigin: "demo-seed" },
      reconciliation: reconcileShift({
        shift: { businessDate: "2026-09-15", ticketsSold: 10, cashVnd: 1_000_000 },
        scanCounts: null,
        cash: null,
        counterCash: null,
      }),
      scanUnavailableReason: "Chưa có migration nhật ký quét.",
    });
    const report = buildShiftReconciliationReport({
      siteName: "Tràng An",
      source,
      statusLabel: "Chờ quản lý",
      gapLevelLabels: GAP_LABELS,
    });
    const tables = report.sheets[0].tables;
    expect(table(tables, "Chênh lệch").rows.map((row) => row.slice(2, 5))).toEqual([
      [1_000_000, "chưa đọc được", "—"],
      [10, "chưa đọc được", "—"],
    ]);
    expect(table(tables, "Lượt quét trong ca")).toMatchObject({ rows: [], emptyText: "Chưa có migration nhật ký quét." });
    expect(table(tables, "Tiền thu tại điểm")).toMatchObject({
      rows: [],
      emptyText: "Chưa đọc được khoản thu tại cổng của ca này.",
    });
    expect(table(tables, "Tiền bán tại quầy").emptyText).toBe("Chưa đọc được tiền bán tại quầy của ca này.");
    expect(table(tables, "Hồ sơ ca").rows.find((row) => row[0] === "Loại hồ sơ")?.[1]).toMatch(/^hồ sơ mẫu/);
    expect(reportHasData(report)).toBe(true);

    const workbook = readXlsx(buildReportXlsx(report, EXPORTED_AT));
    const values = [...workbook.sheets[0].cells.values()].map((cell) => cell.value);
    expect(values).toContain("chưa đọc được");
    expect(values).toContain("Chưa có migration nhật ký quét.");
  });
});

const TICKET_SALES: TicketSalesSummary = {
  periods: [
    { period: "day", label: "Hôm nay", ticketCount: 5, entryCount: 12, changePercent: 20, counterRevenueVnd: 1_500_000, unpricedTicketCount: 1 },
    { period: "week", label: "7 ngày", ticketCount: 30, entryCount: 70, changePercent: -12.5, counterRevenueVnd: 9_000_000, unpricedTicketCount: 4 },
    { period: "month", label: "30 ngày", ticketCount: 90, entryCount: 210, changePercent: null, counterRevenueVnd: null, unpricedTicketCount: null },
    { period: "year", label: "365 ngày", ticketCount: 90, entryCount: 210, changePercent: null, counterRevenueVnd: 30_000_000, unpricedTicketCount: 10 },
  ],
  productShares: [
    { product: "adult", productLabel: "Vé người lớn", ticketCount: 60, entryCount: 150, sharePercent: 71.4 },
    { product: "group", productLabel: "Vé đoàn", ticketCount: 1, entryCount: 60, sharePercent: 28.6 },
  ],
  recentSales: [
    {
      ticketCode: "QUAY-4D5E31C1CABC",
      product: "adult",
      productLabel: "Vé người lớn",
      channel: "quay-ve",
      channelLabel: "Quầy vé",
      guestName: "",
      status: "partially-used",
      issuedAt: "2026-09-17T02:15:30.000Z",
      priceVnd: 500_000,
    },
  ],
  truncated: false,
};

describe("báo cáo vé đã bán", () => {
  it("bốn kỳ thành bốn dòng, tiền quầy và phần trăm là số", () => {
    const report = buildTicketSalesReport({ siteName: "Tam Cốc", sales: TICKET_SALES });
    const [periods, shares, recent] = report.sheets[0].tables;
    expect(periods.columns.map((column) => column.header)).toEqual([
      "Kỳ",
      "Lượt khách được vào",
      "Tấm vé đã phát",
      "Lượt khách so kỳ liền trước (%)",
      "Tiền bán vé tại quầy (đ)",
      "Tấm vé chưa có giá",
    ]);
    expect(periods.rows).toEqual([
      ["Hôm nay", 12, 5, 20, 1_500_000, 1],
      ["7 ngày", 70, 30, -12.5, 9_000_000, 4],
      ["30 ngày", 210, 90, "chưa đủ dữ liệu kỳ trước", null, null],
      ["365 ngày", 210, 90, "chưa đủ dữ liệu kỳ trước", 30_000_000, 10],
    ]);
    expect(shares.rows).toEqual([
      ["Vé người lớn", 150, 71.4, 60],
      ["Vé đoàn", 60, 28.6, 1],
    ]);
    // Không xuất giá vé: màn hình không hiện giá trong danh sách này.
    expect(recent.rows).toEqual([
      ["QUAY-4D5E31C1CABC", "Vé người lớn", "Quầy vé", "2026-09-17T02:15:30.000Z", "Đã dùng một phần", "Không có tên"],
    ]);

    const cells = readXlsx(buildReportXlsx(report, EXPORTED_AT)).sheets[0].cells;
    const numbers = [...cells.values()].filter((cell) => cell.type === "n").map((cell) => cell.value);
    expect(numbers).toEqual(expect.arrayContaining([1_500_000, 9_000_000, 30_000_000, -12.5, 71.4]));
  });

  it("chưa có giá thì bỏ hai cột tiền; rỗng thì không có gì để xuất", () => {
    const withoutRevenue: TicketSalesSummary = {
      ...TICKET_SALES,
      truncated: true,
      // Đường đếm cũ: kỳ nào cũng không có hai trường tiền.
      periods: TICKET_SALES.periods.map((period) => ({
        period: period.period,
        label: period.label,
        ticketCount: period.ticketCount,
        entryCount: period.entryCount,
        changePercent: period.changePercent,
      })),
    };
    const report = buildTicketSalesReport({ siteName: "Tam Cốc", sales: withoutRevenue });
    const periods = report.sheets[0].tables[0];
    expect(periods.columns).toHaveLength(4);
    expect(periods.note).toMatch(/^Số vé quá nhiều/);
    expect(periods.note).toContain("hệ thống chưa lưu giá bán trên từng vé");

    const empty: TicketSalesSummary = {
      periods: TICKET_SALES.periods.map((period) => ({
        ...period,
        ticketCount: 0,
        entryCount: 0,
        changePercent: null,
        counterRevenueVnd: null,
        unpricedTicketCount: null,
      })),
      productShares: [],
      recentSales: [],
      truncated: false,
    };
    expect(ticketSalesHasData(empty)).toBe(false);
    expect(ticketSalesHasData(TICKET_SALES)).toBe(true);
  });

  it("trạng thái vé đọc bằng tiếng Việt", () => {
    expect(["issued", "partially-used", "used", "void", "la-lam"].map(ticketStatusLabel)).toEqual([
      "Chưa dùng",
      "Đã dùng một phần",
      "Đã dùng hết lượt",
      "Đã huỷ",
      "la-lam",
    ]);
    expect(ticketStatusLabel("toString")).toBe("toString");
  });
});

function journal(patch: Partial<AccountingJournal>): AccountingJournal {
  return {
    id: "j-1",
    tenantId: "tenant",
    siteId: "trang-an",
    dataOrigin: "real",
    journalCode: "JV-20260915-001",
    sourceType: "shift-close",
    sourceWorkflowId: "ca-1",
    sourceSupplierInvoiceId: null,
    sourceVersion: 1,
    businessDate: "2026-09-15",
    periodKey: "2026-09",
    status: "posted",
    version: 1,
    makerAccountId: "ketoan",
    makerNote: "Đã đối chiếu.",
    checkerAccountId: "ketoantruong",
    checkerNote: "Hợp lệ.",
    submittedAt: "2026-09-15T02:00:00.000Z",
    approvedAt: "2026-09-15T03:00:00.000Z",
    postedAt: "2026-09-15T03:00:00.000Z",
    reversalOfJournalId: null,
    supersedesJournalId: null,
    createdAt: "2026-09-15T02:00:00.000Z",
    updatedAt: "2026-09-15T03:00:00.000Z",
    lines: [
      { id: "l-1", journalId: "j-1", lineNumber: 1, accountCode: "1111", accountName: "Tiền mặt", debitVnd: 4_000_000, creditVnd: 0, dimensions: {} },
      { id: "l-2", journalId: "j-1", lineNumber: 2, accountCode: "5113", accountName: "Doanh thu cung cấp dịch vụ", debitVnd: 0, creditVnd: 4_000_000, dimensions: {} },
    ],
    auditTrail: [],
    ...patch,
  };
}

describe("báo cáo sổ kế toán", () => {
  const journals = [
    journal({}),
    journal({
      id: "j-2",
      journalCode: "JV-20260916-002",
      siteId: "tam-coc",
      businessDate: "2026-09-16",
      status: "pending-checker",
      postedAt: null,
      dataOrigin: "demo-seed",
      lines: [
        { id: "l-3", journalId: "j-2", lineNumber: 1, accountCode: "1111", accountName: "Tiền mặt", debitVnd: 999, creditVnd: 0, dimensions: {} },
        { id: "l-4", journalId: "j-2", lineNumber: 2, accountCode: "5113", accountName: "Doanh thu cung cấp dịch vụ", debitVnd: 0, creditVnd: 999, dimensions: {} },
      ],
    }),
    journal({
      id: "j-3",
      journalCode: "JV-20260917-003",
      reversalOfJournalId: "j-1",
      businessDate: "2026-09-14",
      lines: [
        { id: "l-5", journalId: "j-3", lineNumber: 1, accountCode: "5113", accountName: "Doanh thu cung cấp dịch vụ", debitVnd: 1_000_000, creditVnd: 0, dimensions: {} },
        { id: "l-6", journalId: "j-3", lineNumber: 2, accountCode: "1111", accountName: "Tiền mặt", debitVnd: 0, creditVnd: 1_000_000, dimensions: {} },
      ],
    }),
  ];
  const statusLabel = (status: string) => ({ posted: "Đã ghi sổ", "pending-checker": "Chờ kế toán trưởng" })[status] ?? "Bản nháp";

  it("cân đối chỉ cộng bút toán đã ghi sổ, đúng phép cộng của màn hình", () => {
    const report = buildAccountingLedgerReport({ journals, journalStatusLabel: statusLabel });
    const balance = report.sheets[0].tables[0];
    const { rows, totals } = summarisePostedTrialBalance(journals);
    expect(balance.rows).toEqual(
      rows.map((row) => [row.accountCode, row.accountName, row.debitVnd, row.creditVnd, row.debitVnd - row.creditVnd]),
    );
    expect(balance.rows).toEqual([
      ["1111", "Tiền mặt", 4_000_000, 1_000_000, 3_000_000],
      ["5113", "Doanh thu cung cấp dịch vụ", 1_000_000, 4_000_000, -3_000_000],
    ]);
    expect(balance.totalRow).toEqual(["Tổng cộng", null, totals.debitVnd, totals.creditVnd, null]);
    expect(totals).toEqual({ debitVnd: 5_000_000, creditVnd: 5_000_000 });
    expect(report.period).toBe("bút toán có ngày nghiệp vụ từ 14/09/2026 đến 16/09/2026");
  });

  it("sổ nhật ký mỗi dòng định khoản một dòng, giữ thứ tự màn hình", () => {
    const report = buildAccountingLedgerReport({ journals, journalStatusLabel: statusLabel });
    const ledger = report.sheets[1].tables[0];
    expect(ledger.title).toBe("3 bút toán có nguồn");
    expect(ledger.rows).toHaveLength(6);
    expect(ledger.rows[0]).toEqual([
      "JV-20260915-001", "Tràng An", "Doanh thu ca", "2026-09-15", "Đã ghi sổ",
      "1111", "Tiền mặt", 4_000_000, 0, "2026-09-15T03:00:00.000Z", "đã có bút toán đảo",
    ]);
    expect(ledger.rows[2]).toEqual([
      "JV-20260916-002", "Tam Cốc", "Doanh thu ca", "2026-09-16", "Chờ kế toán trưởng",
      "1111", "Tiền mặt", 999, 0, null, "hồ sơ mẫu",
    ]);
    expect(ledger.rows[4][2]).toBe("Đảo bút toán");

    const workbook = readXlsx(buildReportXlsx(report, EXPORTED_AT));
    expect(workbook.sheetNames).toEqual(["Cân đối phát sinh", "Sổ nhật ký"]);
    expect(reportFileName(report, EXPORTED_AT)).toBe("so-ke-toan_toan-vung_2026-09-17.xlsx");
  });
});

describe("báo cáo công nợ nhà cung cấp", () => {
  const invoice = {
    caseCode: "AP-TC-202609-018",
    siteId: "tam-chuc",
    dataOrigin: "real",
    supplier: { name: "Vận tải Minh Long", taxCode: "0101234567" },
    invoiceSeries: "1C26TML",
    invoiceNumber: "000018",
    dueDate: "2026-10-15",
    netVnd: 200_000_000,
    vatVnd: 20_000_000,
    totalVnd: 220_000_000,
    status: "match-exception",
    exceptionCodes: ["invoice-over-purchase-order", "missing-acceptance"],
  } as unknown as SupplierApInvoice;

  it("chép đúng hồ sơ đang hiện, mã số thuế và số hóa đơn giữ là chữ", () => {
    const report = buildSupplierApReport({
      siteName: "Tam Chúc",
      invoices: [invoice],
      statusLabel: () => "Cần bổ sung nguồn",
    });
    const table = report.sheets[0].tables[0];
    // Xem trong một cơ sở: không có cột "Cơ sở"; không hồ sơ mẫu nào: không có cột "Ghi chú".
    expect(table.columns.map((column) => column.header)).toEqual([
      "Mã hồ sơ", "Nhà cung cấp", "Mã số thuế", "Số hóa đơn", "Hạn thanh toán",
      "Trước thuế (đ)", "Thuế GTGT (đ)", "Tổng thanh toán (đ)", "Trạng thái", "Phần chưa đạt",
    ]);
    expect(table.rows).toEqual([
      [
        "AP-TC-202609-018", "Vận tải Minh Long", "0101234567", "1C26TML/000018", "2026-10-15",
        200_000_000, 20_000_000, 220_000_000, "Cần bổ sung nguồn",
        "Giá trị hóa đơn vượt PO; Thiếu biên bản nhận hàng/nghiệm thu",
      ],
    ]);
    const cells = readXlsx(buildReportXlsx(report, EXPORTED_AT)).sheets[0].cells;
    // Dòng 8 là dòng dữ liệu đầu tiên: 4 dòng đầu, 1 dòng trống, tên bảng, tiêu đề cột.
    expect(cells.get("C8")).toMatchObject({ type: "s", value: "0101234567" });
    expect(cells.get("D8")).toMatchObject({ type: "s", value: "1C26TML/000018" });
    expect(cells.get("H8")).toMatchObject({ type: "n", value: 220_000_000 });
    expect(reportFileName(report, EXPORTED_AT)).toBe("cong-no-nha-cung-cap_tam-chuc_2026-09-17.xlsx");
  });

  it("xem toàn vùng thì có cột cơ sở; có hồ sơ chạy thử thì có cột ghi chú", () => {
    const residue = { ...invoice, dataOrigin: "test-residue", exceptionCodes: [] } as SupplierApInvoice;
    const report = buildSupplierApReport({ invoices: [invoice, residue], statusLabel: () => "Đã ghi nhận công nợ" });
    const table = report.sheets[0].tables[0];
    expect(report.site).toBe("Toàn vùng");
    expect(table.columns.map((column) => column.header)).toEqual([
      "Mã hồ sơ", "Cơ sở", "Nhà cung cấp", "Mã số thuế", "Số hóa đơn", "Hạn thanh toán",
      "Trước thuế (đ)", "Thuế GTGT (đ)", "Tổng thanh toán (đ)", "Trạng thái", "Phần chưa đạt", "Ghi chú",
    ]);
    expect(table.rows.map((row) => [row[1], row[10], row[11]])).toEqual([
      ["Tam Chúc", "Giá trị hóa đơn vượt PO; Thiếu biên bản nhận hàng/nghiệm thu", null],
      ["Tam Chúc", null, "cặn chạy thử"],
    ]);
  });
});
