import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFTextField,
  decodePDFRawStream,
  rgb,
  type PDFFont,
  type PDFPage,
} from "@cantoo/pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { MAU_VAN_BAN, SUA_DIEU_KHOAN, type LoaiVanBan } from "@/domain/van-ban";
import { kyMaPhatHanh, matKhauChuPdf } from "./ky-so";

/**
 * Dựng và đọc tệp PDF văn bản.
 *
 * Phần chữ cố định (quốc hiệu, điều khoản, thông tin hệ thống điền, chân
 * trang có mã phát hành) vẽ thẳng vào nội dung trang. Ô của đối tác là ô
 * nhập AcroForm: trình đọc PDF (Edge, Chrome, Acrobat, điện thoại) điền được
 * mà không chạm vào nội dung trang. Vì thế băm nội dung trang lúc phát hành
 * và lúc nộp phải trùng nhau; sửa một chữ trong điều khoản là lệch băm.
 *
 * Mã phát hành đã ký nằm trong ô ẩn `nbj_ma` và trong mục thông tin của tệp.
 * Lớp mã hoá AES-256: mở xem không cần mật khẩu, được điền ô và in, không
 * được sửa nội dung hay chép chữ; chỉ mật khẩu chủ (máy chủ giữ) mới bỏ được.
 */

const O_MA = "nbj_ma";
const A4: [number, number] = [595.28, 841.89];
const LE = 50;
const XANH = rgb(0.094, 0.247, 0.204);
const XAM = rgb(0.38, 0.43, 0.41);
const CHI = rgb(0.13, 0.16, 0.15);

let phongChu: Promise<[Uint8Array, Uint8Array]> | null = null;
function napPhongChu() {
  phongChu ??= Promise.all([
    readFile(path.join(process.cwd(), "lib/van-ban/phong-chu/BeVietnamPro-Regular.ttf")),
    readFile(path.join(process.cwd(), "lib/van-ban/phong-chu/BeVietnamPro-SemiBold.ttf")),
  ]).then(([a, b]) => [new Uint8Array(a), new Uint8Array(b)] as [Uint8Array, Uint8Array]);
  return phongChu;
}

function catDong(chu: string, font: PDFFont, co: number, rong: number) {
  const dong: string[] = [];
  for (const doan of chu.split("\n")) {
    let hien = "";
    for (const tu of doan.split(/\s+/)) {
      const thu = hien ? `${hien} ${tu}` : tu;
      if (font.widthOfTextAtSize(thu, co) <= rong || !hien) hien = thu;
      else {
        dong.push(hien);
        hien = tu;
      }
    }
    dong.push(hien);
  }
  return dong;
}

export type DauVaoPhatHanh = {
  id: string;
  loai: LoaiVanBan;
  soVanBan: string;
  /** Giá trị các ô hệ thống, đã ghi vào sổ phát hành. */
  heThong: Record<string, string>;
  /** Bản thử: ô đối tác điền sẵn. Mẫu trống thì bỏ trống. */
  doiTac?: Record<string, string>;
  /** Bản thử "bị sửa": phần chữ đổi một câu nhưng mang mã của bản thật. */
  suaDieuKhoan?: boolean;
  phatHanhLuc: string;
  phatHanhBoi: string;
  urlTraMa: string;
};

type Ve = { doc: PDFDocument; thuong: PDFFont; dam: PDFFont };

async function veVanBan(v: DauVaoPhatHanh, sua: boolean): Promise<Ve> {
  const mau = MAU_VAN_BAN[v.loai];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [thuongTtf, damTtf] = await napPhongChu();
  // Nhúng trọn phông: bộ cắt phông của fontkit lỗi với Be Vietnam Pro, mà trọn phông chỉ ~130KB.
  const thuong = await doc.embedFont(thuongTtf, { subset: false });
  const dam = await doc.embedFont(damTtf, { subset: false });
  doc.setTitle(`${mau.ten} ${v.soVanBan}`);
  doc.setAuthor("Ninh Bình Điều hành");
  doc.setCreator("Ninh Bình Điều hành");
  doc.setProducer("Ninh Bình Điều hành");
  doc.setSubject(`Mã phát hành ${v.id}`);
  doc.setCreationDate(new Date(v.phatHanhLuc));
  doc.setModificationDate(new Date(v.phatHanhLuc));

  const form = doc.getForm();
  const rongChu = A4[0] - LE * 2;
  let trang: PDFPage = doc.addPage(A4);
  let y = A4[1] - LE;

  const sangTrangNeuCan = (can: number) => {
    if (y - can < LE + 40) {
      trang = doc.addPage(A4);
      y = A4[1] - LE;
    }
  };
  const viet = (chu: string, opts: { co?: number; font?: PDFFont; mau?: ReturnType<typeof rgb>; giua?: boolean; x?: number; rong?: number; cach?: number } = {}) => {
    const co = opts.co ?? 10.5;
    const font = opts.font ?? thuong;
    const rong = opts.rong ?? rongChu;
    for (const dong of catDong(chu, font, co, rong)) {
      sangTrangNeuCan(co * 1.5);
      const x = opts.giua ? (A4[0] - font.widthOfTextAtSize(dong, co)) / 2 : (opts.x ?? LE);
      trang.drawText(dong, { x, y: y - co, size: co, font, color: opts.mau ?? CHI });
      y -= co * (opts.cach ?? 1.5);
    }
  };

  // Đầu trang: bên phát hành, quốc hiệu, mã QR tra mã phát hành.
  const qr = await doc.embedPng(await QRCode.toBuffer(v.urlTraMa, { type: "png", margin: 1, width: 220, errorCorrectionLevel: "M" }));
  trang.drawImage(qr, { x: A4[0] - LE - 64, y: A4[1] - LE - 64, width: 64, height: 64 });
  trang.drawText(v.id, { x: A4[0] - LE - 64, y: A4[1] - LE - 76, size: 8, font: dam, color: XANH });
  viet(mau.benA, { co: 8.5, font: dam, mau: XANH, rong: rongChu - 80 });
  y -= 6;
  viet("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", { co: 11, font: dam, giua: true });
  viet("Độc lập – Tự do – Hạnh phúc", { co: 10.5, font: dam, giua: true });
  // Tiêu đề xuống dưới mã QR (cao 76pt), kẻo tiêu đề dài chạm vào mã.
  y = Math.min(y - 16, A4[1] - LE - 88);
  viet(mau.tieuDe, { co: 15, font: dam, giua: true, mau: XANH });
  viet(`Số: ${v.heThong.so_van_ban ?? v.soVanBan}`, { co: 10.5, giua: true, mau: XAM });
  y -= 10;

  // Phần hệ thống điền: vẽ chữ cố định, nên nằm trong băm.
  viet("Thông tin do hệ thống điền", { co: 9.5, font: dam, mau: XAM });
  for (const o of mau.o.filter((x) => x.ai === "he-thong")) {
    const giaTri = v.heThong[o.khoa] ?? "";
    sangTrangNeuCan(18);
    trang.drawText(`${o.nhan}:`, { x: LE, y: y - 10.5, size: 10, font: thuong, color: XAM });
    const dong = catDong(giaTri, dam, 10.5, rongChu - 170);
    dong.forEach((d, i) => trang.drawText(d, { x: LE + 170, y: y - 10.5 - i * 15, size: 10.5, font: dam, color: CHI }));
    y -= Math.max(1, dong.length) * 15 + 3;
  }
  y -= 8;
  viet(`Bên A: ${mau.benA}`, { co: 10 });
  viet(`Bên B: ${mau.benB}, thông tin điền ở các ô dưới đây.`, { co: 10 });
  y -= 6;

  // Ô của đối tác: AcroForm, không nằm trong nội dung trang.
  viet(`Phần ${mau.benB.toLowerCase()} điền`, { co: 9.5, font: dam, mau: XAM });
  for (const o of mau.o.filter((x) => x.ai === "doi-tac")) {
    const cao = o.dai ? 34 : 20;
    sangTrangNeuCan(cao + 8);
    const nhan = o.chon ? `${o.nhan} (${o.chon.join(" / ")})` : o.nhan;
    const dongNhan = catDong(`${nhan}${o.batBuoc ? " *" : ""}`, thuong, 9.5, 160);
    dongNhan.forEach((d, i) => trang.drawText(d, { x: LE, y: y - 13 - i * 12, size: 9.5, font: thuong, color: XAM }));
    const o_ = form.createTextField(o.khoa);
    if (o.dai) o_.enableMultiline();
    if (v.doiTac?.[o.khoa]) o_.setText(v.doiTac[o.khoa]);
    o_.addToPage(trang, {
      x: LE + 170,
      y: y - cao,
      width: rongChu - 170,
      height: cao,
      font: thuong,
      textColor: CHI,
      backgroundColor: rgb(0.965, 0.976, 0.969),
      borderColor: rgb(0.78, 0.83, 0.8),
      borderWidth: 0.8,
    });
    o_.setFontSize(o.dai ? 9.5 : 10.5);
    y -= Math.max(cao, dongNhan.length * 12 + 4) + 7;
  }
  y -= 8;

  // Điều khoản.
  const sua_ = sua ? SUA_DIEU_KHOAN[v.loai] : null;
  for (const dk of mau.dieuKhoan) {
    sangTrangNeuCan(40);
    viet(dk.tieuDe, { co: 10.5, font: dam, mau: XANH });
    for (const doan of dk.doan) viet(sua_ ? doan.replace(sua_.cu, sua_.moi) : doan, { co: 10, cach: 1.55 });
    y -= 4;
  }

  // Chữ ký hai bên.
  sangTrangNeuCan(110);
  y -= 14;
  const cot = rongChu / 2;
  for (const [i, chu] of [`ĐẠI DIỆN BÊN A`, `BÊN B`].entries()) {
    const x = LE + i * cot + (cot - dam.widthOfTextAtSize(chu, 10.5)) / 2;
    trang.drawText(chu, { x, y: y - 10.5, size: 10.5, font: dam, color: CHI });
    const phu = "(Ký, ghi rõ họ tên)";
    trang.drawText(phu, { x: LE + i * cot + (cot - thuong.widthOfTextAtSize(phu, 9)) / 2, y: y - 25, size: 9, font: thuong, color: XAM });
  }
  y -= 100;

  // Mã đã ký: ô ẩn, chỉ đọc. Giá trị đặt sau khi băm (xem `phatHanhPdf`).
  const oMa = form.createTextField(O_MA);
  oMa.addToPage(doc.getPage(0), { x: 0, y: 0, width: 1, height: 1, hidden: true, borderWidth: 0 });
  oMa.enableReadOnly();

  form.updateFieldAppearances(thuong);

  // Chân trang mọi trang: mã phát hành nằm trong nội dung, sửa là lệch băm.
  const tong = doc.getPageCount();
  const ngay = new Date(v.phatHanhLuc).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  doc.getPages().forEach((p, i) => {
    p.drawLine({ start: { x: LE, y: LE + 22 }, end: { x: A4[0] - LE, y: LE + 22 }, thickness: 0.5, color: rgb(0.8, 0.84, 0.82) });
    p.drawText(`Mã phát hành ${v.id} · phát hành ${ngay} bởi ${v.phatHanhBoi}`, { x: LE, y: LE + 10, size: 7.5, font: dam, color: XANH });
    p.drawText("Tệp do hệ thống Ninh Bình Điều hành phát hành và mã hoá. Chỉ điền vào các ô; sửa chữ in sẵn thì cổng nhận văn bản sẽ trả lại.", {
      x: LE,
      y: LE,
      size: 7,
      font: thuong,
      color: XAM,
    });
    const so = `${i + 1}/${tong}`;
    p.drawText(so, { x: A4[0] - LE - thuong.widthOfTextAtSize(so, 7.5), y: LE + 10, size: 7.5, font: thuong, color: XAM });
  });
  return { doc, thuong, dam };
}

/** Băm phần nội dung trang (đã giải nén), bỏ qua ô nhập và chú thích. */
export function bamNoiDung(doc: PDFDocument) {
  const bam = createHash("sha256");
  doc.getPages().forEach((p, i) => {
    bam.update(`|trang:${i}|`);
    const noiDung = p.node.Contents();
    if (!noiDung) return;
    const ds = noiDung instanceof PDFArray ? noiDung.asArray().map((r) => doc.context.lookup(r)) : [noiDung];
    for (const s of ds) {
      if (s instanceof PDFRawStream) bam.update(decodePDFRawStream(s).decode());
      else if (s && "getContents" in s && typeof s.getContents === "function") bam.update(s.getContents() as Uint8Array);
    }
  });
  return bam.digest("hex");
}

export function bamTep(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function napLai(ve: Ve) {
  // Lưu một lần rồi nạp lại để luồng nội dung ở đúng dạng sẽ đọc lúc nộp.
  const lan1 = await PDFDocument.load(await ve.doc.save());
  lan1.registerFontkit(fontkit);
  return lan1;
}

/** Từ điển thông tin của tệp (tiêu đề, tác giả…); thư viện không mở hàm này ra ngoài. */
function thongTinTep(doc: PDFDocument): PDFDict | undefined {
  const goc = doc.context.lookup(doc.context.trailerInfo.Info);
  return goc instanceof PDFDict ? goc : undefined;
}

async function niemPhong(doc: PDFDocument, ma: string) {
  doc.getForm().getTextField(O_MA).setText(ma);
  thongTinTep(doc)?.set(PDFName.of("NBJMa"), PDFHexString.fromText(ma));
  doc.encrypt({
    ownerPassword: matKhauChuPdf(),
    userPassword: "",
    algorithm: "AES-256",
    permissions: {
      printing: "highResolution",
      fillingForms: true,
      modifying: false,
      copying: false,
      annotating: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
  return doc.save({ updateFieldAppearances: false });
}

export async function phatHanhPdf(v: DauVaoPhatHanh): Promise<{ bytes: Uint8Array; maBamNoiDung: string; maBamTep: string }> {
  const mau = MAU_VAN_BAN[v.loai];
  const that = await napLai(await veVanBan(v, false));
  const maBamNoiDung = bamNoiDung(that);
  const ma = kyMaPhatHanh({ id: v.id, loai: v.loai, phienBan: mau.phienBan, maBam: maBamNoiDung });
  // Bản thử "bị sửa": dựng lại với một câu điều khoản khác, nhưng mang mã (và băm) của bản thật.
  const dich = v.suaDieuKhoan ? await napLai(await veVanBan(v, true)) : that;
  const bytes = await niemPhong(dich, ma);
  return { bytes, maBamNoiDung, maBamTep: bamTep(bytes) };
}

/**
 * Bản thử "PDF ngoài hệ thống": trông y như văn bản thật nhưng tự soạn bên
 * ngoài, không có mã phát hành, không mã hoá, không ghi sổ. Cổng phải trả.
 */
export async function pdfNgoaiHeThong(v: DauVaoPhatHanh): Promise<Uint8Array> {
  const ve = await veVanBan(v, false);
  return ve.doc.save();
}

export type DocTep =
  | { loai: "khong-phai-pdf" }
  | { loai: "hong"; loi: string }
  | { loai: "ma-hoa-la" }
  | {
      loai: "doc-duoc";
      coMaHoa: boolean;
      ma: string | null;
      giaTri: Record<string, string>;
      maBamNoiDung: string;
      soTrang: number;
      /** Bản đã gỡ mã hoá, gửi cho AI đọc bằng mắt. */
      banDoc: Uint8Array;
    };

/** Bỏ bảng tham chiếu cũ và từ điển mã hoá còn sót sau khi giải mã, kẻo bản lưu ra vẫn bị coi là đã mã hoá. */
function donDauMaHoa(doc: PDFDocument) {
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFRawStream ? obj.dict : obj instanceof PDFDict ? obj : null;
    if (!dict) continue;
    const kieu = dict.get(PDFName.of("Type"));
    const loc = dict.get(PDFName.of("Filter"));
    if ((kieu instanceof PDFName && kieu.asString() === "/XRef") || (loc instanceof PDFName && loc.asString() === "/Standard" && dict.has(PDFName.of("O")))) {
      doc.context.delete(ref);
    }
  }
}

async function moTep(bytes: Uint8Array): Promise<{ doc: PDFDocument; coMaHoa: boolean } | { loi: "ma-hoa-la" } | { loi: string }> {
  try {
    return { doc: await PDFDocument.load(bytes, { updateMetadata: false }), coMaHoa: false };
  } catch (error) {
    const loi = error instanceof Error ? error.message : String(error);
    if (!/encrypted/i.test(loi)) return { loi };
  }
  try {
    return { doc: await PDFDocument.load(bytes, { password: matKhauChuPdf(), updateMetadata: false }), coMaHoa: true };
  } catch (error) {
    const loi = error instanceof Error ? error.message : String(error);
    return /password/i.test(loi) ? { loi: "ma-hoa-la" } : { loi };
  }
}

export async function docTepTaiLen(bytes: Uint8Array): Promise<DocTep> {
  const dau = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!dau.includes("%PDF-")) return { loai: "khong-phai-pdf" };
  const mo = await moTep(bytes);
  if ("loi" in mo) return mo.loi === "ma-hoa-la" ? { loai: "ma-hoa-la" } : { loai: "hong", loi: mo.loi };
  const { doc, coMaHoa } = mo;
  const giaTri: Record<string, string> = {};
  let ma: string | null = null;
  try {
    for (const o of doc.getForm().getFields()) {
      if (!(o instanceof PDFTextField)) continue;
      const ten = o.getName();
      const chu = o.getText() ?? "";
      if (ten === O_MA) ma = chu;
      else giaTri[ten] = chu;
    }
  } catch {
    // Tệp không có biểu mẫu: để `ma` null, cổng sẽ báo "không có mã phát hành".
  }
  if (!ma) {
    const goc = thongTinTep(doc)?.lookup(PDFName.of("NBJMa"));
    if (goc instanceof PDFHexString) ma = goc.decodeText();
  }
  const maBamNoiDung = bamNoiDung(doc);
  donDauMaHoa(doc);
  return {
    loai: "doc-duoc",
    coMaHoa,
    ma,
    giaTri,
    maBamNoiDung,
    soTrang: doc.getPageCount(),
    banDoc: await doc.save({ updateFieldAppearances: false }),
  };
}
