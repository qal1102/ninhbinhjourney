import { crc32 as nodeCrc32 } from "node:zlib";

/**
 * Bộ đọc tối giản cho bài kiểm A15-ERP-02: mở tệp ZIP, kiểm CRC bằng bản
 * `zlib.crc32` của Node (không dùng lại hàm CRC đang bị kiểm), kiểm XML đúng
 * cú pháp, rồi đọc ô ra để so với số đã đưa vào.
 */

export function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Không thấy phần kết thúc thư mục ZIP");
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset + centralSize !== eocd) throw new Error("Thư mục trung tâm lệch vị trí");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files = new Map<string, Uint8Array>();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Sai chữ ký đầu mục trung tâm");
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressed = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (method !== 0) throw new Error(`Mục ${name} không ở dạng stored`);
    if (compressed !== size) throw new Error(`Mục ${name} lệch kích thước`);

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`Sai chữ ký đầu mục ${name}`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localName = decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength));
    if (localName !== name) throw new Error(`Tên mục ${name} lệch giữa hai đầu mục`);
    if (view.getUint32(localOffset + 14, true) !== crc) throw new Error(`CRC mục ${name} lệch giữa hai đầu mục`);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + size);
    if (nodeCrc32(data) >>> 0 !== crc) throw new Error(`CRC mục ${name} sai`);
    if (files.has(name)) throw new Error(`Mục ${name} bị trùng`);
    files.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export function utf8(data: Uint8Array | undefined): string {
  if (!data) throw new Error("Thiếu phần tử trong tệp");
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

const NAME = /^[A-Za-z_][\w.:-]*/;
const ENTITY = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

function checkText(text: string, where: string) {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "<") throw new Error(`Ký tự < lạc trong ${where}`);
    if (char === "&" && !ENTITY.test(text.slice(index))) throw new Error(`Ký tự & không thoát trong ${where}`);
    const code = text.charCodeAt(index);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      throw new Error(`Ký tự điều khiển U+${code.toString(16)} trong ${where}`);
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`Nửa cặp surrogate lẻ trong ${where}`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`Nửa cặp surrogate lẻ trong ${where}`);
    }
  }
}

/** Kiểm XML đúng cú pháp: thẻ đóng mở khớp, thuộc tính có nháy, `&` và `<` đã thoát, đúng một gốc. */
export function assertWellFormedXml(xml: string): void {
  let rest = xml;
  if (rest.startsWith("<?xml")) {
    const end = rest.indexOf("?>");
    if (end < 0) throw new Error("Khai báo XML không đóng");
    rest = rest.slice(end + 2);
  }
  const stack: string[] = [];
  let roots = 0;
  while (rest.length > 0) {
    const open = rest.indexOf("<");
    const text = open < 0 ? rest : rest.slice(0, open);
    if (stack.length === 0 && text.trim() !== "") throw new Error("Có chữ nằm ngoài phần tử gốc");
    checkText(text, "nội dung");
    if (open < 0) break;
    rest = rest.slice(open);
    if (rest.startsWith("</")) {
      const match = /^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(rest);
      if (!match) throw new Error("Thẻ đóng sai cú pháp");
      const expected = stack.pop();
      if (expected !== match[1]) throw new Error(`Thẻ đóng ${match[1]} không khớp ${expected}`);
      rest = rest.slice(match[0].length);
      continue;
    }
    rest = rest.slice(1);
    const nameMatch = NAME.exec(rest);
    if (!nameMatch) throw new Error("Tên thẻ sai cú pháp");
    const name = nameMatch[0];
    rest = rest.slice(name.length);
    const seen = new Set<string>();
    for (;;) {
      const space = /^\s*/.exec(rest)![0];
      rest = rest.slice(space.length);
      if (rest.startsWith("/>")) {
        rest = rest.slice(2);
        if (stack.length === 0) roots += 1;
        break;
      }
      if (rest.startsWith(">")) {
        rest = rest.slice(1);
        if (stack.length === 0) roots += 1;
        stack.push(name);
        break;
      }
      if (space.length === 0) throw new Error(`Thuộc tính trong <${name}> thiếu khoảng trắng`);
      const attribute = /^([A-Za-z_][\w.:-]*)="([^"<]*)"/.exec(rest);
      if (!attribute) throw new Error(`Thuộc tính trong <${name}> sai cú pháp`);
      if (seen.has(attribute[1])) throw new Error(`Thuộc tính ${attribute[1]} bị trùng trong <${name}>`);
      seen.add(attribute[1]);
      checkText(attribute[2], `thuộc tính ${attribute[1]}`);
      rest = rest.slice(attribute[0].length);
    }
  }
  if (stack.length) throw new Error(`Thẻ chưa đóng: ${stack.join(", ")}`);
  if (roots !== 1) throw new Error(`Cần đúng một phần tử gốc, có ${roots}`);
}

export function unescapeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    return String.fromCodePoint(parseInt(entity.slice(1), 10));
  });
}

export type ReadCell = {
  ref: string;
  style: number;
  /** `s` là chữ dùng chung; `n` là số (không có thuộc tính `t`). */
  type: "s" | "n" | string;
  raw: string;
  /** Chữ đã giải mã, hoặc số. */
  value: string | number;
};

export type ReadWorkbook = {
  files: Map<string, Uint8Array>;
  sharedStrings: string[];
  cellXfs: { numFmtId: number; fontId: number; quotePrefix: boolean }[];
  numFmts: Map<number, string>;
  sheetNames: string[];
  sheets: { xml: string; cells: Map<string, ReadCell> }[];
};

export function readXlsx(bytes: Uint8Array): ReadWorkbook {
  const files = readStoredZip(bytes);
  for (const [name, data] of files) {
    if (name.endsWith(".xml") || name.endsWith(".rels")) assertWellFormedXml(utf8(data));
  }
  const sharedStrings = [...utf8(files.get("xl/sharedStrings.xml")).matchAll(/<si><t(?: xml:space="preserve")?>([\s\S]*?)<\/t><\/si>/g)].map(
    (match) => unescapeXml(match[1]),
  );
  const styles = utf8(files.get("xl/styles.xml"));
  const cellXfsXml = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const cellXfs = [...cellXfsXml.matchAll(/<xf ([^>]*?)\/?>/g)].map((match) => ({
    numFmtId: Number(/numFmtId="(\d+)"/.exec(match[1])?.[1] ?? 0),
    fontId: Number(/fontId="(\d+)"/.exec(match[1])?.[1] ?? 0),
    quotePrefix: /quotePrefix="1"/.test(match[1]),
  }));
  const numFmts = new Map(
    [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map(
      (match) => [Number(match[1]), unescapeXml(match[2])] as const,
    ),
  );
  const workbook = utf8(files.get("xl/workbook.xml"));
  const sheetNames = [...workbook.matchAll(/<sheet name="([^"]*)"/g)].map((match) => unescapeXml(match[1]));
  const sheets = sheetNames.map((_, index) => {
    const xml = utf8(files.get(`xl/worksheets/sheet${index + 1}.xml`));
    const cells = new Map<string, ReadCell>();
    for (const match of xml.matchAll(/<c r="([A-Z]+\d+)"((?: [a-z]+="[^"]*")*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
      const attributes = match[2];
      const style = Number(/ s="(\d+)"/.exec(attributes)?.[1] ?? 0);
      const type = / t="([^"]*)"/.exec(attributes)?.[1] ?? "n";
      const raw = match[3] ?? "";
      const value = type === "s" ? sharedStrings[Number(raw)] : Number(raw);
      cells.set(match[1], { ref: match[1], style, type, raw, value });
    }
    return { xml, cells };
  });
  return { files, sharedStrings, cellXfs, numFmts, sheetNames, sheets };
}
