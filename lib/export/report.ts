import { buildXlsx, type XlsxCell, type XlsxSheet, type XlsxWorkbook } from "./xlsx";

/**
 * A15-ERP-02 — một mô hình báo cáo, hai đầu ra: tệp Excel và bản in.
 *
 * Màn hình dựng mô hình này từ **đúng dữ liệu nó đang hiển thị**, rồi cả tệp
 * Excel lẫn bản in PDF đều đọc từ đây. Không có truy vấn thứ hai, nên số
 * trong tệp không thể lệch số trên màn hình vì một bộ lọc khác.
 */

export type ReportColumnKind = "text" | "integer" | "number" | "date" | "datetime";

/**
 * Giá trị một ô. Cột `date`/`datetime` nhận chuỗi `YYYY-MM-DD` hoặc mốc ISO.
 * Chuỗi trong cột số được giữ nguyên là chữ (ví dụ "chưa đọc được").
 */
export type ReportValue = string | number | null;

export type ReportColumn = {
  header: string;
  kind: ReportColumnKind;
};

export type ReportTable = {
  title: string;
  /** Một câu giải thích ngay dưới tên bảng, ví dụ lý do chưa đọc được số. */
  note?: string;
  columns: readonly ReportColumn[];
  rows: readonly (readonly ReportValue[])[];
  /** Dòng tổng, in đậm ở cuối bảng. */
  totalRow?: readonly ReportValue[];
  /** Câu hiện thay cho bảng khi không có dòng nào. */
  emptyText?: string;
};

export type ReportSheet = {
  name: string;
  tables: readonly ReportTable[];
};

export type ErpReport = {
  /** Tên màn hình, ví dụ "Đối soát cuối ca". */
  screen: string;
  /** Cơ sở, hoặc "Toàn vùng". */
  site: string;
  /** Kỳ hoặc phạm vi của số liệu. */
  period: string;
  /** Số liệu lấy từ đâu. */
  source: string;
  /** Phần đầu tên tệp, ví dụ "doi-soat-ca". */
  fileSlug: string;
  /** Phần phụ của tên tệp đứng sau tên cơ sở, ví dụ mã ca. */
  fileQualifiers?: readonly string[];
  sheets: readonly ReportSheet[];
};

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ngày 01/01/1970 trong hệ ngày của Excel (tính cả ngày 29/02/1900 không có thật). */
const EXCEL_UNIX_EPOCH_SERIAL = 25569;

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** Năm, tháng, ngày, giờ, phút, giây theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa). */
export function vietnamParts(moment: Date) {
  const shifted = new Date(moment.getTime() + VIETNAM_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** `HH:mm dd/MM/yyyy` theo giờ Việt Nam. */
export function formatVietnamTimestamp(moment: Date): string {
  const p = vietnamParts(moment);
  return `${pad(p.hour)}:${pad(p.minute)} ${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

/** `yyyy-MM-dd` theo giờ Việt Nam, dùng cho tên tệp. */
export function vietnamDateKey(moment: Date): string {
  const p = vietnamParts(moment);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

type ParsedMoment = {
  /** Số ngày kiểu Excel theo giờ Việt Nam. */
  serial: number;
  /** Mốc đã cộng 7 giờ, đọc bằng các hàm `getUTC…` là ra giờ Việt Nam. */
  vietnamMs: number;
  dateOnly: boolean;
};

/** Đọc một giá trị ngày thành số ngày kiểu Excel, đã quy về giờ Việt Nam. */
export function parseReportMoment(value: string): ParsedMoment | null {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const utc = Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    if (Number.isNaN(utc) || new Date(utc).toISOString().slice(0, 10) !== trimmed) return null;
    return { serial: utc / DAY_MS + EXCEL_UNIX_EPOCH_SERIAL, vietnamMs: utc, dateOnly: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  // Bỏ phần giây: màn hình chỉ hiện tới phút, và Excel làm tròn hay cắt giây
  // tuỳ định dạng — cắt sẵn ở đây thì Excel, bản in và màn hình cùng một phút.
  const MINUTE_MS = 60 * 1000;
  const vietnamMs = Math.floor((parsed + VIETNAM_OFFSET_MS) / MINUTE_MS) * MINUTE_MS;
  return { serial: vietnamMs / DAY_MS + EXCEL_UNIX_EPOCH_SERIAL, vietnamMs, dateOnly: false };
}

/** Viết số kiểu Việt Nam: dấu chấm ngăn nghìn, dấu phẩy thập phân. */
export function formatVietnameseNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [integerPart, fractionPart] = String(rounded).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative && rounded !== 0 ? "-" : ""}${grouped}${fractionPart ? `,${fractionPart}` : ""}`;
}

/** Chữ hiện trong bản in cho một ô — cùng giá trị đã ghi vào tệp Excel. */
export function formatReportValue(value: ReportValue, kind: ReportColumnKind): string {
  if (value === null) return "";
  if (typeof value === "number") {
    if (kind === "date" || kind === "datetime") return String(value);
    return formatVietnameseNumber(value);
  }
  if (kind === "date" || kind === "datetime") {
    const parsed = parseReportMoment(value);
    if (!parsed) return value;
    // Cắt giây như Excel và như màn hình, không làm tròn phút.
    const moment = new Date(parsed.vietnamMs);
    const day = `${pad(moment.getUTCDate())}/${pad(moment.getUTCMonth() + 1)}/${moment.getUTCFullYear()}`;
    return kind === "date" || parsed.dateOnly
      ? day
      : `${day} ${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}`;
  }
  return value;
}

/** Bốn dòng đầu của mọi báo cáo, dùng chung cho tệp Excel và bản in. */
export function reportHeading(report: ErpReport, exportedAt: Date) {
  return {
    title: `${report.screen} · ${report.site}`,
    lines: [
      `Kỳ báo cáo: ${report.period}`,
      `Xuất lúc ${formatVietnamTimestamp(exportedAt)} (giờ Việt Nam)`,
      `Nguồn: ${report.source}`,
    ],
  };
}

export function reportHasData(report: ErpReport): boolean {
  return report.sheets.some((sheet) => sheet.tables.some((table) => table.rows.length > 0));
}

/** Chữ thường không dấu, chỉ a–z, 0–9 và dấu gạch ngang. */
export function slugifyAscii(value: string): string {
  // Tách dấu khỏi chữ (NFD) rồi bỏ các dấu rời U+0300–U+036F. Dò bằng mã số
  // chứ không bằng dải trong regex: công cụ soạn tệp từng dịch escape ấy
  // thành ký tự thật (xem tests/security/source-control-characters.test.ts).
  const withoutMarks = Array.from(value.normalize("NFD"))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
  return withoutMarks
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ví dụ `doi-soat-ca_trang-an_2026-09-17.xlsx`. */
export function reportFileName(report: ErpReport, exportedAt: Date, extension = "xlsx"): string {
  const parts = [report.fileSlug, report.site, ...(report.fileQualifiers ?? [])]
    .map((part) => slugifyAscii(part).slice(0, 40).replace(/-+$/g, ""))
    .filter(Boolean);
  return `${[...parts, vietnamDateKey(exportedAt)].join("_")}.${extension}`;
}

function valueCell(value: ReportValue, kind: ReportColumnKind, bold: boolean): XlsxCell {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (kind === "date" || kind === "datetime" || kind === "text") {
      return { type: "number", value, format: "general", bold };
    }
    return { type: "number", value, format: kind === "integer" ? "integer" : "general", bold };
  }
  if (kind === "date" || kind === "datetime") {
    const parsed = parseReportMoment(value);
    if (parsed) {
      return {
        type: "date",
        serial: kind === "date" ? Math.floor(parsed.serial) : parsed.serial,
        format: kind === "date" || parsed.dateOnly ? "date" : "datetime",
        bold,
      };
    }
  }
  return { type: "text", value, role: bold ? "bold" : "plain" };
}

function displayLength(value: ReportValue, kind: ReportColumnKind) {
  if (value === null) return 0;
  if (kind === "datetime") return 16;
  if (kind === "date") return 10;
  return formatReportValue(value, kind).length;
}

const MIN_WIDTH = 8;
const MAX_WIDTH = 50;

function sheetFromReport(sheet: ReportSheet, heading: ReturnType<typeof reportHeading>): XlsxSheet {
  const rows: XlsxCell[][] = [];
  rows.push([{ type: "text", value: heading.title, role: "title" }]);
  for (const line of heading.lines) rows.push([{ type: "text", value: line, role: "meta" }]);
  rows.push([]);

  const widths: number[] = [];
  const widen = (index: number, length: number) => {
    widths[index] = Math.max(widths[index] ?? MIN_WIDTH, Math.min(MAX_WIDTH, length + 2));
  };

  let freezeRows: number | undefined;
  sheet.tables.forEach((table, tableIndex) => {
    if (tableIndex > 0) rows.push([]);
    rows.push([{ type: "text", value: table.title, role: "bold" }]);
    if (table.note) rows.push([{ type: "text", value: table.note, role: "meta" }]);
    if (table.rows.length === 0) {
      if (table.emptyText) rows.push([{ type: "text", value: table.emptyText, role: "plain" }]);
      return;
    }
    rows.push(table.columns.map((column) => ({ type: "text", value: column.header, role: "header" })));
    if (sheet.tables.length === 1) freezeRows = rows.length;
    table.columns.forEach((column, index) => widen(index, column.header.length));
    const pushRow = (values: readonly ReportValue[], bold: boolean) => {
      rows.push(
        table.columns.map((column, index) => {
          const value = values[index] ?? null;
          widen(index, displayLength(value, column.kind));
          return valueCell(value, column.kind, bold);
        }),
      );
    };
    for (const values of table.rows) pushRow(values, false);
    if (table.totalRow) pushRow(table.totalRow, true);
  });

  return {
    name: sheet.name,
    columnWidths: Array.from(widths, (width) => width ?? MIN_WIDTH),
    rows,
    freezeRows,
  };
}

export function reportToWorkbook(report: ErpReport, exportedAt: Date): XlsxWorkbook {
  const heading = reportHeading(report, exportedAt);
  const sheets = report.sheets.length ? report.sheets : [{ name: report.screen, tables: [] }];
  return { sheets: sheets.map((sheet) => sheetFromReport(sheet, heading)) };
}

/** Dựng tệp `.xlsx` hoàn chỉnh cho một báo cáo. */
export function buildReportXlsx(report: ErpReport, exportedAt: Date): Uint8Array<ArrayBuffer> {
  const p = vietnamParts(exportedAt);
  return buildXlsx(reportToWorkbook(report, exportedAt), p);
}
