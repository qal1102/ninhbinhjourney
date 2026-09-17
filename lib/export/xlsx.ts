import { createStoredZip, type ZipEntry } from "./zip";

/**
 * A15-ERP-02 — dựng tệp Excel `.xlsx` bằng tay, không thêm thư viện.
 *
 * Vì sao không dùng CSV: máy Windows đặt vùng Việt Nam dùng dấu `;` để ngăn
 * cột và dấu `,` làm dấu thập phân. Tệp CSV ngăn bằng dấu phẩy mở ra thì cả
 * dòng dồn vào một cột; thêm dòng `sep=;` thì Excel lại bỏ qua dấu BOM và vỡ
 * dấu tiếng Việt. Tệp `.xlsx` không dính cả hai chuyện ấy: chữ luôn là UTF-8,
 * số lưu dạng số theo chuẩn chung (dấu chấm thập phân, không dấu ngăn nghìn)
 * và Excel tự hiện theo vùng của máy — máy vùng Việt Nam thấy `12.800.000`.
 *
 * Hàm thuần: cùng đầu vào thì ra đúng từng byte.
 */

export type XlsxTextRole = "plain" | "bold" | "title" | "meta" | "header";
export type XlsxNumberFormat = "integer" | "general";
export type XlsxDateFormat = "date" | "datetime";

export type XlsxCell =
  | null
  | { type: "text"; value: string; role?: XlsxTextRole }
  | { type: "number"; value: number; format: XlsxNumberFormat; bold?: boolean }
  /** `serial` là số ngày kiểu Excel (1 = 01/01/1900), đã quy về giờ Việt Nam. */
  | { type: "date"; serial: number; format: XlsxDateFormat; bold?: boolean };

export type XlsxSheet = {
  name: string;
  /** Độ rộng từng cột, tính theo số ký tự. */
  columnWidths?: readonly number[];
  /** Mỗi phần tử là một dòng; dòng rỗng để trống một hàng. */
  rows: readonly (readonly XlsxCell[])[];
  /** Số dòng trên cùng giữ đứng yên khi cuộn. */
  freezeRows?: number;
};

export type XlsxWorkbook = { sheets: readonly XlsxSheet[] };

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const EXCEL_CELL_LIMIT = 32767;

/**
 * Bỏ ký tự XML 1.0 không cho phép (ký tự điều khiển, nửa cặp surrogate lẻ).
 * Để lại chúng thì Excel báo tệp hỏng và đòi "sửa chữa".
 */
function stripInvalidXmlChars(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    result += value[index];
  }
  return result;
}

export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\r/g, "&#13;");
}

/**
 * Chữ mở đầu bằng `=`, `+`, `-`, `@`, tab hoặc xuống dòng có thể bị Excel hiểu
 * thành công thức khi người dùng bấm vào ô rồi Enter, hoặc khi tệp bị lưu lại
 * thành CSV. Ô chữ như thế được gắn kiểu `quotePrefix` — đúng dấu nháy đơn
 * Excel tự thêm khi người dùng gõ `'=...` — nên nội dung hiện ra y nguyên mà
 * không bao giờ thành công thức.
 */
export function needsFormulaGuard(value: string): boolean {
  return /^[=+\-@\t\r\n]/.test(value);
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Tên trang tính: tối đa 31 ký tự, không có `[ ] : * ? / \`, không trùng. */
export function sanitizeSheetNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, index) => {
    const cleaned =
      stripInvalidXmlChars(raw)
        .replace(/[[\]:*?/\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^'+|'+$/g, "")
        .slice(0, 31)
        .trim() || `Trang ${index + 1}`;
    let candidate = cleaned;
    let counter = 2;
    while (used.has(candidate.toLocaleLowerCase("vi"))) {
      const suffix = ` (${counter})`;
      candidate = cleaned.slice(0, 31 - suffix.length).trim() + suffix;
      counter += 1;
    }
    used.add(candidate.toLocaleLowerCase("vi"));
    return candidate;
  });
}

type StyleKey = string;

/** Bảng kiểu ô. Thứ tự này là chỉ số `s="…"` ghi vào từng ô. */
const TEXT_ROLES: readonly XlsxTextRole[] = ["plain", "bold", "title", "meta", "header"];
const TEXT_FONT: Readonly<Record<XlsxTextRole, number>> = {
  plain: 0,
  bold: 1,
  title: 2,
  meta: 3,
  header: 1,
};

const STYLE_KEYS: readonly StyleKey[] = [
  // `text:plain` phải đứng đầu: kiểu số 0 là kiểu mặc định của mọi ô.
  ...TEXT_ROLES.flatMap((role) => [`text:${role}`, `text:${role}:guard`]),
  "number:integer",
  "number:integer:bold",
  "number:general",
  "number:general:bold",
  "date:date",
  "date:date:bold",
  "date:datetime",
  "date:datetime:bold",
];

const STYLE_INDEX = new Map(STYLE_KEYS.map((key, index) => [key, index]));

function styleXf(key: StyleKey): string {
  const [kind, variant, flag] = key.split(":");
  if (kind === "text") {
    const role = variant as XlsxTextRole;
    const font = TEXT_FONT[role];
    const guard = flag === "guard" ? ' quotePrefix="1"' : "";
    if (role === "header") {
      return `<xf numFmtId="0" fontId="${font}" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${guard}><alignment vertical="center" wrapText="1"/></xf>`;
    }
    const applyFont = font === 0 ? "" : ' applyFont="1"';
    return `<xf numFmtId="0" fontId="${font}" fillId="0" borderId="0" xfId="0"${applyFont}${guard}/>`;
  }
  const bold = flag === "bold";
  const numFmtId =
    kind === "number" ? (variant === "integer" ? 3 : 0) : variant === "date" ? 164 : 165;
  const applyNumber = numFmtId === 0 ? "" : ' applyNumberFormat="1"';
  const applyFont = bold ? ' applyFont="1"' : "";
  return `<xf numFmtId="${numFmtId}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${applyNumber}${applyFont}/>`;
}

function stylesXml(): string {
  const font = (inner: string) => `<font>${inner}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
  return (
    XML_HEAD +
    `<styleSheet xmlns="${MAIN_NS}">` +
    '<numFmts count="2">' +
    '<numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>' +
    '<numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/>' +
    "</numFmts>" +
    '<fonts count="4">' +
    font("") +
    font("<b/>") +
    '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF4A5A52"/><name val="Calibri"/><family val="2"/></font>' +
    "</fonts>" +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EFEB"/><bgColor indexed="64"/></patternFill></fill>' +
    "</fills>" +
    '<borders count="2">' +
    "<border><left/><right/><top/><bottom/><diagonal/></border>" +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FF8EAA9E"/></bottom><diagonal/></border>' +
    "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${STYLE_KEYS.length}">${STYLE_KEYS.map(styleXf).join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

class SharedStrings {
  private readonly indexByValue = new Map<string, number>();
  private readonly values: string[] = [];
  private references = 0;

  add(value: string): number {
    this.references += 1;
    const existing = this.indexByValue.get(value);
    if (existing !== undefined) return existing;
    const index = this.values.length;
    this.values.push(value);
    this.indexByValue.set(value, index);
    return index;
  }

  toXml(): string {
    const items = this.values
      .map((value) => {
        const preserve = /^\s|\s$|\n|\t/.test(value) ? ' xml:space="preserve"' : "";
        return `<si><t${preserve}>${escapeXml(value)}</t></si>`;
      })
      .join("");
    return (
      XML_HEAD +
      `<sst xmlns="${MAIN_NS}" count="${this.references}" uniqueCount="${this.values.length}">${items}</sst>`
    );
  }
}

/** Số viết theo chuẩn chung của tệp: dấu chấm thập phân, không ngăn nghìn. */
function numberLiteral(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

function cellXml(cell: Exclude<XlsxCell, null>, ref: string, strings: SharedStrings): string | null {
  if (cell.type === "text") {
    const text = cell.value.length > EXCEL_CELL_LIMIT ? cell.value.slice(0, EXCEL_CELL_LIMIT) : cell.value;
    const role = cell.role ?? "plain";
    const key = needsFormulaGuard(text) ? `text:${role}:guard` : `text:${role}`;
    const style = STYLE_INDEX.get(key) ?? 0;
    const styleAttr = style === 0 ? "" : ` s="${style}"`;
    return `<c r="${ref}"${styleAttr} t="s"><v>${strings.add(text)}</v></c>`;
  }
  if (cell.type === "number") {
    if (!Number.isFinite(cell.value)) return null;
    const style = STYLE_INDEX.get(`number:${cell.format}${cell.bold ? ":bold" : ""}`) ?? 0;
    const styleAttr = style === 0 ? "" : ` s="${style}"`;
    return `<c r="${ref}"${styleAttr}><v>${numberLiteral(cell.value)}</v></c>`;
  }
  if (!Number.isFinite(cell.serial)) return null;
  const style = STYLE_INDEX.get(`date:${cell.format}${cell.bold ? ":bold" : ""}`) ?? 0;
  return `<c r="${ref}" s="${style}"><v>${numberLiteral(cell.serial)}</v></c>`;
}

function sheetXml(sheet: XlsxSheet, strings: SharedStrings, selected: boolean): string {
  let lastRow = 0;
  let lastColumn = 0;
  const rowParts: string[] = [];
  sheet.rows.forEach((row, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const ref = `${columnLetter(columnIndex)}${rowIndex + 1}`;
      const xml = cellXml(cell, ref, strings);
      if (!xml) return;
      cells.push(xml);
      lastColumn = Math.max(lastColumn, columnIndex + 1);
    });
    if (cells.length === 0) return;
    lastRow = rowIndex + 1;
    rowParts.push(`<row r="${rowIndex + 1}">${cells.join("")}</row>`);
  });

  const dimension = lastRow === 0 ? "A1" : `A1:${columnLetter(lastColumn - 1)}${lastRow}`;
  const freeze = sheet.freezeRows && sheet.freezeRows > 0 ? Math.floor(sheet.freezeRows) : 0;
  const tabSelected = selected ? ' tabSelected="1"' : "";
  const sheetView = freeze
    ? `<sheetView${tabSelected} workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freeze + 1}" sqref="A${freeze + 1}"/></sheetView>`
    : `<sheetView${tabSelected} workbookViewId="0"/>`;
  const widths = (sheet.columnWidths ?? [])
    .map((width, index) =>
      Number.isFinite(width) && width > 0
        ? `<col min="${index + 1}" max="${index + 1}" width="${Math.round(width * 100) / 100}" customWidth="1"/>`
        : "",
    )
    .join("");

  return (
    XML_HEAD +
    `<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="${dimension}"/>` +
    `<sheetViews>${sheetView}</sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (widths ? `<cols>${widths}</cols>` : "") +
    (rowParts.length ? `<sheetData>${rowParts.join("")}</sheetData>` : "<sheetData/>") +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
    "</worksheet>"
  );
}

export type XlsxModifiedAt = Parameters<typeof createStoredZip>[1];

/** Dựng toàn bộ tệp `.xlsx` thành một mảng byte. */
export function buildXlsx(workbook: XlsxWorkbook, modifiedAt?: XlsxModifiedAt): Uint8Array<ArrayBuffer> {
  if (workbook.sheets.length === 0) {
    throw new Error("Tệp Excel cần ít nhất một trang tính.");
  }
  const encoder = new TextEncoder();
  const strings = new SharedStrings();
  const names = sanitizeSheetNames(workbook.sheets.map((sheet) => sheet.name));
  const sheetParts = workbook.sheets.map((sheet, index) => sheetXml(sheet, strings, index === 0));
  const sheetCount = sheetParts.length;

  const contentTypes =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheetParts
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    "</Types>";

  const rootRels =
    XML_HEAD +
    `<Relationships xmlns="${PKG_REL_NS}">` +
    `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
    "</Relationships>";

  const workbookXml =
    XML_HEAD +
    `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="16000" windowHeight="9000" activeTab="0"/></bookViews>' +
    `<sheets>${names
      .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets>` +
    "</workbook>";

  const workbookRels =
    XML_HEAD +
    `<Relationships xmlns="${PKG_REL_NS}">` +
    sheetParts
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${sheetCount + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId${sheetCount + 2}" Type="${REL_NS}/sharedStrings" Target="sharedStrings.xml"/>` +
    "</Relationships>";

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/styles.xml", data: encoder.encode(stylesXml()) },
    ...sheetParts.map((xml, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(xml),
    })),
    // Bảng chữ dùng chung dựng sau cùng, khi mọi trang tính đã ghi chữ vào.
    { name: "xl/sharedStrings.xml", data: encoder.encode(strings.toXml()) },
  ];

  return createStoredZip(entries, modifiedAt);
}
