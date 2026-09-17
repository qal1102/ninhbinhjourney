import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createStoredZip, crc32 } from "@/lib/export/zip";
import {
  buildXlsx,
  columnLetter,
  escapeXml,
  needsFormulaGuard,
  sanitizeSheetNames,
  type XlsxCell,
} from "@/lib/export/xlsx";
import { assertWellFormedXml, readStoredZip, readXlsx, utf8 } from "./support/xlsx-reader";

const text = (value: string): XlsxCell => ({ type: "text", value });
const integer = (value: number): XlsxCell => ({ type: "number", value, format: "integer" });

describe("crc32", () => {
  it("khớp giá trị chuẩn và khớp bản zlib của Node", () => {
    const encoder = new TextEncoder();
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    for (const sample of ["", "a", "Tràng An — đối soát", "x".repeat(10_000)]) {
      const bytes = encoder.encode(sample);
      expect(crc32(bytes)).toBe(nodeCrc32(bytes) >>> 0);
    }
  });
});

describe("createStoredZip", () => {
  it("đóng gói rồi đọc lại đúng từng byte", () => {
    const encoder = new TextEncoder();
    const zip = createStoredZip([
      { name: "a.txt", data: encoder.encode("xin chào") },
      { name: "thu-muc/b.xml", data: encoder.encode("<a/>") },
      { name: "rong.bin", data: new Uint8Array() },
    ]);
    const files = readStoredZip(zip);
    expect([...files.keys()]).toEqual(["a.txt", "thu-muc/b.xml", "rong.bin"]);
    expect(utf8(files.get("a.txt"))).toBe("xin chào");
    expect(files.get("rong.bin")?.length).toBe(0);
  });

  it("từ chối tên trùng và tên không phải ASCII", () => {
    const data = new Uint8Array([1]);
    expect(() => createStoredZip([{ name: "a", data }, { name: "a", data }])).toThrow(/trùng/);
    expect(() => createStoredZip([{ name: "tệp.xml", data }])).toThrow(/không hợp lệ/);
  });
});

describe("bộ kiểm XML trong bài kiểm", () => {
  it("bắt được đúng những lỗi làm Excel báo tệp hỏng", () => {
    expect(() => assertWellFormedXml('<?xml version="1.0"?>\n<a x="1"><b/>Tôm &amp; cua</a>')).not.toThrow();
    for (const broken of [
      "<a>Tôm & cua</a>",
      "<a><b></a></b>",
      "<a>",
      '<a x="1" x="2"/>',
      "<a x=1/>",
      '<a x="<"/>',
      `<a>${String.fromCharCode(1)}</a>`,
      "<a/><b/>",
    ]) {
      expect(() => assertWellFormedXml(broken), broken).toThrow();
    }
  });
});

describe("buildXlsx — cấu trúc tệp", () => {
  const bytes = buildXlsx({
    sheets: [
      { name: "Trang một", rows: [[text("Xin chào"), integer(1)]], freezeRows: 1 },
      { name: "Trang hai", rows: [] },
    ],
  });

  it("đủ đúng các phần tử OPC, XML nào cũng đúng cú pháp", () => {
    const files = readStoredZip(bytes);
    expect([...files.keys()].sort()).toEqual(
      [
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/_rels/workbook.xml.rels",
        "xl/sharedStrings.xml",
        "xl/styles.xml",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/sheet2.xml",
      ].sort(),
    );
    for (const [name, data] of files) {
      expect(() => assertWellFormedXml(utf8(data)), name).not.toThrow();
    }
  });

  it("mọi phần tử được khai kiểu nội dung, mọi liên kết trỏ tới tệp có thật", () => {
    const files = readStoredZip(bytes);
    const contentTypes = utf8(files.get("[Content_Types].xml"));
    for (const name of files.keys()) {
      if (name.endsWith(".rels") || name === "[Content_Types].xml") continue;
      expect(contentTypes).toContain(`PartName="/${name}"`);
    }
    const rels = utf8(files.get("xl/_rels/workbook.xml.rels"));
    for (const match of rels.matchAll(/Target="([^"]+)"/g)) {
      expect(files.has(`xl/${match[1]}`), match[1]).toBe(true);
    }
    expect(utf8(files.get("_rels/.rels"))).toContain('Target="xl/workbook.xml"');
  });

  it("trang tính rỗng vẫn hợp lệ, trang đầu được chọn và giữ dòng tiêu đề", () => {
    const workbook = readXlsx(bytes);
    expect(workbook.sheetNames).toEqual(["Trang một", "Trang hai"]);
    expect(workbook.sheets[1].xml).toContain("<sheetData/>");
    expect(workbook.sheets[1].xml).toContain('<dimension ref="A1"/>');
    expect(workbook.sheets[0].xml).toContain('tabSelected="1"');
    expect(workbook.sheets[0].xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(workbook.sheets[0].xml).toContain('<dimension ref="A1:B1"/>');
  });

  it("không dựng tệp không có trang tính nào", () => {
    expect(() => buildXlsx({ sheets: [] })).toThrow();
  });
});

describe("buildXlsx — nội dung ô", () => {
  it("giữ nguyên tiếng Việt, cả dạng dựng sẵn lẫn dạng dấu rời", () => {
    const composed = "Nguyễn Thị Hằng · Tràng An · đồng · Tiền bán tại quầy";
    const decomposed = composed.normalize("NFD");
    const workbook = readXlsx(buildXlsx({ sheets: [{ name: "Đối soát ca", rows: [[text(composed), text(decomposed)]] }] }));
    expect(workbook.sheetNames).toEqual(["Đối soát ca"]);
    expect(workbook.sheets[0].cells.get("A1")?.value).toBe(composed);
    expect(workbook.sheets[0].cells.get("B1")?.value).toBe(decomposed);
  });

  it("số ghi thành ô số (không phải chữ), đúng định dạng nghìn", () => {
    const workbook = readXlsx(
      buildXlsx({
        sheets: [
          {
            name: "Số",
            rows: [
              [integer(12_800_000), integer(-1_500), { type: "number", value: 12.5, format: "general" }],
              [integer(-0), integer(Number.NaN), integer(Number.POSITIVE_INFINITY)],
            ],
          },
        ],
      }),
    );
    const cells = workbook.sheets[0].cells;
    expect(cells.get("A1")).toMatchObject({ type: "n", raw: "12800000", value: 12_800_000 });
    expect(cells.get("B1")).toMatchObject({ type: "n", raw: "-1500", value: -1500 });
    expect(cells.get("C1")).toMatchObject({ type: "n", raw: "12.5", value: 12.5 });
    expect(cells.get("A2")).toMatchObject({ type: "n", raw: "0" });
    // NaN và vô cực không ghi thành số rác: ô để trống.
    expect(cells.has("B2")).toBe(false);
    expect(cells.has("C2")).toBe(false);
    const style = workbook.cellXfs[cells.get("A1")!.style];
    expect(style.numFmtId).toBe(3); // #,##0 — Excel hiện theo vùng máy
    expect(workbook.sheets[0].xml).not.toMatch(/t="(s|str|inlineStr)"[^>]*><v>12800000/);
  });

  it("ngày ghi thành số ngày kiểu Excel kèm định dạng dd/mm/yyyy", () => {
    const workbook = readXlsx(
      buildXlsx({
        sheets: [
          {
            name: "Ngày",
            rows: [
              [
                { type: "date", serial: 46280, format: "date" },
                { type: "date", serial: 46280.5, format: "datetime" },
              ],
            ],
          },
        ],
      }),
    );
    const [date, datetime] = [workbook.sheets[0].cells.get("A1")!, workbook.sheets[0].cells.get("B1")!];
    expect(date.value).toBe(46280);
    expect(workbook.numFmts.get(workbook.cellXfs[date.style].numFmtId)).toBe("dd/mm/yyyy");
    expect(workbook.numFmts.get(workbook.cellXfs[datetime.style].numFmtId)).toBe("dd/mm/yyyy hh:mm");
  });

  it("thoát <, &, nháy kép, nháy đơn và bỏ ký tự XML cấm", () => {
    const tricky = `<b>Tôm & cua</b> "ngon" l'ạ`;
    // Dựng ký tự điều khiển bằng mã số: viết thẳng vào tệp nguồn thì bài canh ký tự vô hình đỏ.
    const controls = `a${String.fromCharCode(1)}b${String.fromCharCode(8)}c${String.fromCharCode(0xd800)}d😀e`;
    const bytes = buildXlsx({ sheets: [{ name: "Thoát", rows: [[text(tricky), text(controls)]] }] });
    const raw = utf8(readStoredZip(bytes).get("xl/sharedStrings.xml"));
    expect(raw).toContain("&lt;b&gt;Tôm &amp; cua&lt;/b&gt; &quot;ngon&quot; l&apos;ạ");
    const workbook = readXlsx(bytes);
    expect(workbook.sheets[0].cells.get("A1")?.value).toBe(tricky);
    expect(workbook.sheets[0].cells.get("B1")?.value).toBe("abcd😀e");
    expect(escapeXml("\r")).toBe("&#13;");
  });

  it("chữ mở đầu bằng = + - @ không bao giờ thành công thức", () => {
    const dangerous = ['=HYPERLINK("http://x","bấm")', "+84 912 345 678", "-2", "@SUM(A1)", "\tlệch", "\rdòng"];
    const bytes = buildXlsx({
      sheets: [
        {
          name: "Công thức",
          rows: [
            dangerous.map(text),
            [text("Bình thường"), text("a=b"), { type: "text", value: "=1+1", role: "header" }, { type: "text", value: "-", role: "bold" }],
          ],
        },
      ],
    });
    const workbook = readXlsx(bytes);
    const sheet = workbook.sheets[0];
    expect(sheet.xml).not.toContain("<f>");
    expect(sheet.xml).not.toContain("<f ");
    dangerous.forEach((value, index) => {
      const cell = sheet.cells.get(`${columnLetter(index)}1`)!;
      expect(cell.type).toBe("s");
      // Nội dung giữ nguyên, không chèn dấu nháy vào chữ.
      expect(cell.value).toBe(value);
      expect(workbook.cellXfs[cell.style].quotePrefix, value).toBe(true);
    });
    expect(workbook.cellXfs[sheet.cells.get("A2")!.style].quotePrefix).toBe(false);
    expect(workbook.cellXfs[sheet.cells.get("B2")!.style].quotePrefix).toBe(false);
    expect(workbook.cellXfs[sheet.cells.get("C2")!.style]).toMatchObject({ quotePrefix: true, fontId: 1 });
    expect(workbook.cellXfs[sheet.cells.get("D2")!.style]).toMatchObject({ quotePrefix: true, fontId: 1 });
    expect(needsFormulaGuard("Tổng")).toBe(false);
  });

  it("tên trang tính bỏ ký tự Excel cấm, tối đa 31 ký tự, không trùng", () => {
    const names = sanitizeSheetNames(["Sổ: nhật ký/[2026]*?", "Sổ  nhật ký 2026", "", "x".repeat(40), "X".repeat(40), "'Nháy'"]);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[[\]:*?/\\]/);
      expect(name.startsWith("'")).toBe(false);
    }
    expect(names[0]).toBe("Sổ nhật ký 2026");
    expect(names[1]).toBe("Sổ nhật ký 2026 (2)");
    expect(names[2]).toBe("Trang 3");
    expect(names[4]).toMatch(/\(2\)$/);
    expect(names[5]).toBe("Nháy");
  });

  it("đổi số cột thành chữ cột", () => {
    expect([0, 25, 26, 51, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AZ", "ZZ", "AAA"]);
  });
});
