/**
 * A15-ERP-02 — đóng gói tệp ZIP kiểu "stored" (không nén) cho tệp `.xlsx`.
 *
 * Tệp `.xlsx` thực chất là một tệp ZIP chứa vài tệp XML. Chuẩn OPC cho phép
 * phần tử nằm trong ZIP ở dạng không nén, và Excel mở được dạng này. Tự viết
 * khoảng trăm dòng ở đây để khỏi kéo thêm một thư viện nén vào gói chạy trên
 * trình duyệt: báo cáo ERP chỉ vài trăm dòng, không nén cũng chỉ vài trăm KB.
 *
 * Hàm thuần: cùng đầu vào thì ra đúng từng byte, không đọc đồng hồ.
 */

export type ZipEntry = {
  /** Đường dẫn trong tệp nén, chỉ chữ ASCII, dùng dấu `/`. */
  name: string;
  data: Uint8Array;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 theo đúng đa thức ZIP dùng (IEEE 802.3). */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Giờ và ngày theo kiểu MS-DOS mà đầu mục ZIP bắt buộc phải có. */
function dosDateTime(moment: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  const year = Math.min(Math.max(moment.year, 1980), 2107);
  const time = (moment.hour << 11) | (moment.minute << 5) | Math.floor(moment.second / 2);
  const date = ((year - 1980) << 9) | (moment.month << 5) | moment.day;
  return { time: time & 0xffff, date: date & 0xffff };
}

const ASCII_NAME = /^[\x21-\x7e]+$/;

/**
 * Ghép các tệp thành một tệp ZIP không nén.
 *
 * `modifiedAt` là giờ ghi vào đầu mục, theo giờ địa phương người gọi đã quy
 * đổi sẵn (năm, tháng 1–12, ngày, giờ, phút, giây). Không truyền thì dùng
 * mốc cố định 01/01/1980 để đầu ra luôn giống nhau.
 */
export function createStoredZip(
  entries: readonly ZipEntry[],
  modifiedAt: { year: number; month: number; day: number; hour: number; minute: number; second: number } = {
    year: 1980,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  },
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modifiedAt);
  const seen = new Set<string>();

  const prepared = entries.map((entry) => {
    if (!ASCII_NAME.test(entry.name) || entry.name.startsWith("/")) {
      throw new Error(`Tên tệp trong gói nén không hợp lệ: ${entry.name}`);
    }
    if (seen.has(entry.name)) {
      throw new Error(`Tên tệp trong gói nén bị trùng: ${entry.name}`);
    }
    seen.add(entry.name);
    return { name: encoder.encode(entry.name), data: entry.data, crc: crc32(entry.data) };
  });

  const localSize = prepared.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = prepared.reduce((total, entry) => total + 46 + entry.name.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff || prepared.length > 0xffff) {
    throw new Error("Báo cáo quá lớn để đóng gói thành một tệp.");
  }

  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;
  const localOffsets: number[] = [];

  for (const entry of prepared) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // phiên bản tối thiểu để giải nén
    view.setUint16(offset + 6, 0, true); // cờ
    view.setUint16(offset + 8, 0, true); // 0 = không nén
    view.setUint16(offset + 10, time, true);
    view.setUint16(offset + 12, date, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    view.setUint16(offset + 28, 0, true);
    output.set(entry.name, offset + 30);
    output.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralStart = offset;
  prepared.forEach((entry, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // tạo bởi
    view.setUint16(offset + 6, 20, true); // cần để giải nén
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, time, true);
    view.setUint16(offset + 14, date, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint16(offset + 30, 0, true); // trường phụ
    view.setUint16(offset + 32, 0, true); // chú thích
    view.setUint16(offset + 34, 0, true); // số đĩa
    view.setUint16(offset + 36, 0, true); // thuộc tính trong
    view.setUint32(offset + 38, 0, true); // thuộc tính ngoài
    view.setUint32(offset + 42, localOffsets[index], true);
    output.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return output;
}
