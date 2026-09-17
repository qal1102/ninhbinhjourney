import { describe, expect, it } from "vitest";
import {
  buildReportXlsx,
  formatReportValue,
  formatVietnameseNumber,
  formatVietnamTimestamp,
  parseReportMoment,
  reportFileName,
  reportHasData,
  reportHeading,
  slugifyAscii,
  vietnamDateKey,
  type ErpReport,
} from "@/lib/export/report";
import { readXlsx } from "./support/xlsx-reader";

// 14:05 ngày 17/09/2026 giờ Việt Nam.
const EXPORTED_AT = new Date("2026-09-17T07:05:00.000Z");

function sampleReport(overrides: Partial<ErpReport> = {}): ErpReport {
  return {
    screen: "Đối soát cuối ca",
    site: "Tràng An",
    period: "Ca TA-CA1 · ngày làm việc 15/09/2026",
    source: "tờ chốt ca và nhật ký quét cổng.",
    fileSlug: "doi-soat-ca",
    sheets: [
      {
        name: "Đối soát ca",
        tables: [
          {
            title: "Tiền thu tại điểm",
            note: "Thu ngay tại cổng.",
            columns: [
              { header: "Người thu", kind: "text" },
              { header: "Số khoản", kind: "integer" },
              { header: "Số tiền (đ)", kind: "integer" },
              { header: "Ngày", kind: "date" },
              { header: "Giờ thu", kind: "datetime" },
            ],
            rows: [
              ["Nguyễn Văn An", 3, 1_250_000, "2026-09-15", "2026-09-15T01:30:59.000Z"],
              ["Trần Thị Bình", 2, 800_000, "2026-09-15", "2026-09-15T17:05:00.000Z"],
              ["Lê Hoà", "chưa đọc được", null, "không rõ", null],
            ],
            totalRow: ["Tổng cả ca", 5, 2_050_000, null, null],
          },
          {
            title: "Tiền bán tại quầy",
            columns: [{ header: "Khoản", kind: "text" }],
            rows: [],
            emptyText: "Ca này chưa có phiếu bán vé tại quầy nào.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("giờ Việt Nam", () => {
  it("in HH:mm dd/MM/yyyy theo UTC+7, kể cả khi qua nửa đêm", () => {
    expect(formatVietnamTimestamp(EXPORTED_AT)).toBe("14:05 17/09/2026");
    expect(formatVietnamTimestamp(new Date("2026-09-16T17:30:00.000Z"))).toBe("00:30 17/09/2026");
    expect(formatVietnamTimestamp(new Date("2026-12-31T16:59:00.000Z"))).toBe("23:59 31/12/2026");
    expect(vietnamDateKey(new Date("2026-09-16T17:00:00.000Z"))).toBe("2026-09-17");
    expect(vietnamDateKey(new Date("2026-09-16T16:59:59.999Z"))).toBe("2026-09-16");
  });

  it("dòng đầu báo cáo có tên màn hình, cơ sở, kỳ và giờ xuất", () => {
    const heading = reportHeading(sampleReport(), EXPORTED_AT);
    expect(heading.title).toBe("Đối soát cuối ca · Tràng An");
    expect(heading.lines).toEqual([
      "Kỳ báo cáo: Ca TA-CA1 · ngày làm việc 15/09/2026",
      "Xuất lúc 14:05 17/09/2026 (giờ Việt Nam)",
      "Nguồn: tờ chốt ca và nhật ký quét cổng.",
    ]);
  });

  it("đọc ngày thành số ngày Excel, quy về giờ Việt Nam và cắt giây", () => {
    // 15/09/2026 là ngày thứ 46280 trong hệ ngày 1900 của Excel.
    expect(parseReportMoment("2026-09-15")).toMatchObject({ serial: 46280, dateOnly: true });
    const late = parseReportMoment("2026-09-15T17:30:45.000Z");
    expect(late?.dateOnly).toBe(false);
    expect(late!.serial).toBeCloseTo(46281 + 30 / (24 * 60), 9);
    expect(parseReportMoment("2026-02-30")).toBeNull();
    expect(parseReportMoment("15/09/2026")).toBeNull();
    expect(formatReportValue("2026-09-15T17:30:45.000Z", "datetime")).toBe("16/09/2026 00:30");
    expect(formatReportValue("2026-09-15T17:30:45.000Z", "date")).toBe("16/09/2026");
    expect(formatReportValue("2026-09-15", "datetime")).toBe("15/09/2026");
    expect(formatReportValue("không rõ", "date")).toBe("không rõ");
  });
});

describe("viết số và tên tệp", () => {
  it("viết số kiểu Việt Nam", () => {
    expect(formatVietnameseNumber(12_800_000)).toBe("12.800.000");
    expect(formatVietnameseNumber(-1_500)).toBe("-1.500");
    expect(formatVietnameseNumber(12.5)).toBe("12,5");
    expect(formatVietnameseNumber(999)).toBe("999");
    expect(formatVietnameseNumber(0)).toBe("0");
    expect(formatReportValue(null, "integer")).toBe("");
    expect(formatReportValue("chưa đọc được", "integer")).toBe("chưa đọc được");
  });

  it("tên tệp chỉ có chữ ASCII, theo ngày Việt Nam", () => {
    expect(slugifyAscii("Tràng An")).toBe("trang-an");
    expect(slugifyAscii("Đối soát cuối ca · Tam Cốc – Bích Động")).toBe("doi-soat-cuoi-ca-tam-coc-bich-dong");
    expect(reportFileName(sampleReport(), EXPORTED_AT)).toBe("doi-soat-ca_trang-an_2026-09-17.xlsx");
    const name = reportFileName(
      sampleReport({ fileQualifiers: ["TA/CA 1: đêm"] }),
      new Date("2026-09-17T17:10:00.000Z"),
    );
    expect(name).toBe("doi-soat-ca_trang-an_ta-ca-1-dem_2026-09-18.xlsx");
    expect(name).toMatch(/^[a-z0-9_.-]+$/);
  });
});

describe("báo cáo → tệp Excel", () => {
  const bytes = buildReportXlsx(sampleReport(), EXPORTED_AT);
  const workbook = readXlsx(bytes);
  const cells = workbook.sheets[0].cells;

  it("bốn dòng đầu là tiêu đề, kỳ, giờ xuất và nguồn", () => {
    expect(workbook.sheetNames).toEqual(["Đối soát ca"]);
    expect(cells.get("A1")?.value).toBe("Đối soát cuối ca · Tràng An");
    expect(cells.get("A2")?.value).toBe("Kỳ báo cáo: Ca TA-CA1 · ngày làm việc 15/09/2026");
    expect(cells.get("A3")?.value).toBe("Xuất lúc 14:05 17/09/2026 (giờ Việt Nam)");
    expect(cells.get("A4")?.value).toBe("Nguồn: tờ chốt ca và nhật ký quét cổng.");
    expect(cells.has("A5")).toBe(false);
  });

  it("mỗi cột một ô; số là ô số, cộng lại đúng số nguồn", () => {
    expect(cells.get("A6")?.value).toBe("Tiền thu tại điểm");
    expect(cells.get("A7")?.value).toBe("Thu ngay tại cổng.");
    expect(["A8", "B8", "C8", "D8", "E8"].map((ref) => cells.get(ref)?.value)).toEqual([
      "Người thu",
      "Số khoản",
      "Số tiền (đ)",
      "Ngày",
      "Giờ thu",
    ]);
    expect(cells.get("C9")).toMatchObject({ type: "n", value: 1_250_000 });
    expect(cells.get("C10")).toMatchObject({ type: "n", value: 800_000 });
    const sum = (cells.get("C9")!.value as number) + (cells.get("C10")!.value as number);
    expect(sum).toBe(cells.get("C12")!.value);
    expect(workbook.cellXfs[cells.get("C9")!.style].numFmtId).toBe(3);
    // Dòng tổng in đậm.
    expect(workbook.cellXfs[cells.get("C12")!.style].fontId).toBe(1);
    expect(workbook.cellXfs[cells.get("A12")!.style].fontId).toBe(1);
  });

  it("chữ trong cột số giữ là chữ, ô trống để trống, ngày là số ngày", () => {
    expect(cells.get("B11")).toMatchObject({ type: "s", value: "chưa đọc được" });
    expect(cells.has("C11")).toBe(false);
    expect(cells.get("D9")).toMatchObject({ type: "n", value: 46280 });
    expect(workbook.numFmts.get(workbook.cellXfs[cells.get("D9")!.style].numFmtId)).toBe("dd/mm/yyyy");
    // 01:30:59Z → 08:30 giờ Việt Nam, bỏ giây.
    expect(cells.get("E9")!.value as number).toBeCloseTo(46280 + (8 * 60 + 30) / (24 * 60), 9);
    expect(workbook.numFmts.get(workbook.cellXfs[cells.get("E9")!.style].numFmtId)).toBe("dd/mm/yyyy hh:mm");
    expect(cells.get("D11")).toMatchObject({ type: "s", value: "không rõ" });
  });

  it("bảng rỗng chỉ có tên bảng và câu giải thích, không có dòng tiêu đề cột", () => {
    expect(cells.get("A14")?.value).toBe("Tiền bán tại quầy");
    expect(cells.get("A15")?.value).toBe("Ca này chưa có phiếu bán vé tại quầy nào.");
    expect(cells.has("A16")).toBe(false);
    // Nhiều bảng chồng nhau thì không đóng băng dòng nào.
    expect(workbook.sheets[0].xml).not.toContain("<pane");
  });

  it("một bảng thì đóng băng tới dòng tiêu đề cột", () => {
    const single = readXlsx(
      buildReportXlsx(
        sampleReport({ sheets: [{ name: "Một bảng", tables: [sampleReport().sheets[0].tables[0]] }] }),
        EXPORTED_AT,
      ),
    );
    expect(single.sheets[0].xml).toContain('<pane ySplit="8" topLeftCell="A9"');
  });

  it("báo cáo không có dòng dữ liệu nào thì coi là rỗng, nhưng vẫn dựng được tệp", () => {
    const empty = sampleReport({
      sheets: [{ name: "Rỗng", tables: [{ title: "Không có gì", columns: [], rows: [], emptyText: "Chưa có." }] }],
    });
    expect(reportHasData(empty)).toBe(false);
    expect(reportHasData(sampleReport())).toBe(true);
    const read = readXlsx(buildReportXlsx(empty, EXPORTED_AT));
    expect(read.sheets[0].cells.get("A7")?.value).toBe("Chưa có.");
    const noSheets = readXlsx(buildReportXlsx(sampleReport({ sheets: [] }), EXPORTED_AT));
    expect(noSheets.sheetNames).toEqual(["Đối soát cuối ca"]);
  });
});
