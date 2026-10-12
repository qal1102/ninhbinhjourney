/**
 * Tệp PDF một trang chứa đúng một ảnh JPEG (12/10/2026, chủ dự án: "in vé phải
 * fit vừa tờ giấy, xuất PDF cũng không được").
 *
 * "Lưu PDF" trước đây đi qua hộp thoại in của trình duyệt. App ERP cài trên
 * iPhone không mở được hộp thoại ấy, còn trên máy khác thì khổ giấy tuỳ máy
 * in. Phiếu thu nay được vẽ thành ảnh (cùng bản vẽ gửi máy in nhiệt), rồi gói
 * vào một tệp PDF đúng khổ đã chọn ngay trên máy, không cần thư viện ngoài:
 * ảnh JPEG nhúng nguyên văn bằng bộ lọc `DCTDecode`, PDF chỉ cần năm đối tượng.
 */

export type KhoPdf = {
  /** Khổ trang, milimét. */
  rongMm: number;
  caoMm: number;
};

export type ViTriAnh = {
  /** Toạ độ góc trên bên trái của ảnh tính từ góc trên bên trái trang, milimét. */
  xMm: number;
  yMm: number;
  rongMm: number;
  caoMm: number;
};

const MM_RA_POINT = 72 / 25.4;

function so(value: number) {
  // PDF đọc số thập phân dấu chấm; hai chữ số lẻ là thừa đủ cho in ấn.
  return (Math.round(value * 100) / 100).toString();
}

/**
 * Dựng tệp PDF. `jpeg` là nguyên tệp JPEG, `rongPx` × `caoPx` là cỡ điểm ảnh
 * của nó (PDF cần biết, không tự đọc từ dữ liệu).
 */
export function taoPdfTuAnhJpeg(input: {
  jpeg: Uint8Array;
  rongPx: number;
  caoPx: number;
  trang: KhoPdf;
  anh: ViTriAnh;
}): Uint8Array {
  const { jpeg, rongPx, caoPx, trang, anh } = input;
  if (!(rongPx > 0 && caoPx > 0) || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error("Ảnh JPEG không hợp lệ.");
  }
  const W = trang.rongMm * MM_RA_POINT;
  const H = trang.caoMm * MM_RA_POINT;
  const w = anh.rongMm * MM_RA_POINT;
  const h = anh.caoMm * MM_RA_POINT;
  const x = anh.xMm * MM_RA_POINT;
  // Gốc toạ độ PDF ở góc dưới bên trái.
  const y = H - anh.yMm * MM_RA_POINT - h;

  const ve = `q ${so(w)} 0 0 ${so(h)} ${so(x)} ${so(y)} cm /Im0 Do Q\n`;
  const ma = new TextEncoder();
  const phan: Uint8Array[] = [];
  const viTri: number[] = [];
  let dem = 0;
  const day = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? ma.encode(chunk) : chunk;
    phan.push(bytes);
    dem += bytes.length;
  };
  const doiTuong = (n: number, noiDung: string) => {
    viTri[n] = dem;
    day(`${n} 0 obj\n${noiDung}\nendobj\n`);
  };

  // Dòng thứ hai mang byte > 127 để trình đọc biết tệp có dữ liệu nhị phân.
  day("%PDF-1.4\n");
  day(Uint8Array.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  doiTuong(1, "<< /Type /Catalog /Pages 2 0 R >>");
  doiTuong(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  doiTuong(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${so(W)} ${so(H)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  viTri[4] = dem;
  day(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(rongPx)} /Height ${Math.round(caoPx)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  day(jpeg);
  day("\nendstream\nendobj\n");
  viTri[5] = dem;
  day(`5 0 obj\n<< /Length ${ma.encode(ve).length} >>\nstream\n${ve}endstream\nendobj\n`);

  const xref = dem;
  let bang = "xref\n0 6\n0000000000 65535 f \n";
  for (let n = 1; n <= 5; n++) bang += `${String(viTri[n]).padStart(10, "0")} 00000 n \n`;
  day(bang);
  day(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const ket = new Uint8Array(dem);
  let o = 0;
  for (const p of phan) {
    ket.set(p, o);
    o += p.length;
  }
  return ket;
}

/**
 * Đặt ảnh phiếu lên khổ giấy: giấy cuộn thì trang dài đúng bằng phiếu; A4,
 * A5 thì phiếu nằm giữa, sát lề trên, phiếu dài quá thì thu nhỏ cho vừa một
 * trang (không bao giờ tràn sang trang thứ hai).
 */
export function batCucPhieu(
  kho: "a4" | "a5" | "k80" | "k58",
  rongPx: number,
  caoPx: number,
): { trang: KhoPdf; anh: ViTriAnh } {
  const tiLe = caoPx / rongPx;
  if (kho === "k80" || kho === "k58") {
    const rongTrang = kho === "k80" ? 80 : 58;
    const le = kho === "k80" ? 4 : 3;
    const rong = rongTrang - le * 2;
    const cao = rong * tiLe;
    return { trang: { rongMm: rongTrang, caoMm: cao + le * 2 }, anh: { xMm: le, yMm: le, rongMm: rong, caoMm: cao } };
  }
  const trang = kho === "a4" ? { rongMm: 210, caoMm: 297 } : { rongMm: 148, caoMm: 210 };
  const le = kho === "a4" ? 16 : 10;
  let rong = kho === "a4" ? 120 : 110;
  let cao = rong * tiLe;
  const caoToiDa = trang.caoMm - le * 2;
  if (cao > caoToiDa) {
    cao = caoToiDa;
    rong = cao / tiLe;
  }
  return { trang, anh: { xMm: (trang.rongMm - rong) / 2, yMm: le, rongMm: rong, caoMm: cao } };
}
