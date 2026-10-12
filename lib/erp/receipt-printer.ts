"use client";

import QRCode from "qrcode";

/**
 * QA-ERP-POS-05 — in phiếu thu ở quầy.
 *
 * Trình duyệt không được tự dò máy in trên mạng (lý do an ninh), nên có hai
 * đường, và màn hình nói rõ cả hai:
 *
 * 1. **Hộp thoại in của máy** — đường chính, chạy ở mọi máy. Máy in Wi-Fi, USB,
 *    AirPrint đã cài trên máy tính hoặc điện thoại đều hiện trong hộp thoại.
 *    Trước khi mở hộp thoại, trang đặt sẵn khổ giấy đã chọn (A4, A5, cuộn 80mm,
 *    cuộn 58mm) bằng quy tắc `@page`, nên người dùng không phải tự chỉnh.
 * 2. **Máy in nhiệt Bluetooth** — Web Bluetooth mở danh sách thiết bị quanh đó
 *    cho người dùng chọn, rồi gửi lệnh ESC/POS thẳng tới máy in. Máy in nhiệt
 *    rẻ thường không có bảng mã tiếng Việt, nên phiếu được **vẽ thành ảnh đen
 *    trắng rồi gửi dạng ảnh** (lệnh `GS v 0`): chữ có dấu và mã QR in ra đúng
 *    như trên màn hình. Chỉ Chrome/Edge trên Android, Windows, macOS có Web
 *    Bluetooth; iPhone và Safari chưa có.
 *
 * Lựa chọn khổ giấy và cách in lưu theo **từng máy** (localStorage): mỗi quầy
 * gắn một máy in riêng, không phải cài đặt chung của cả hệ thống.
 */

export type PaperSize = "a4" | "a5" | "k80" | "k58";
export type PrintMode = "system" | "bluetooth";

export const PAPER_LABELS: Readonly<Record<PaperSize, string>> = Object.freeze({
  a4: "A4",
  a5: "A5",
  k80: "Cuộn 80mm",
  k58: "Cuộn 58mm",
});

/**
 * Quy tắc `@page` cho từng khổ. Giấy cuộn không có chiều dài cố định: CSS
 * không nhận `size: 80mm auto` (trình duyệt bỏ cả dòng và về khổ A4/Letter,
 * nên phiếu cuộn trước 12/10/2026 in ra giữa một tờ A4). Chiều dài được đo từ
 * phiếu thật lúc in, xem `pageCssFor`.
 */
export const PAPER_PAGE_CSS: Readonly<Record<PaperSize, string>> = Object.freeze({
  a4: "size: A4 portrait; margin: 16mm;",
  a5: "size: A5 portrait; margin: 10mm;",
  k80: "size: 80mm 200mm; margin: 3mm;",
  k58: "size: 58mm 200mm; margin: 2mm;",
});

const PAPER_MARGIN_MM: Readonly<Record<PaperSize, number>> = Object.freeze({ a4: 16, a5: 10, k80: 3, k58: 2 });

/** `@page` đúng khổ; giấy cuộn dài bằng phiếu (`contentHeightMm`) cộng lề. */
export function pageCssFor(paper: PaperSize, contentHeightMm: number) {
  if (paper === "k80" || paper === "k58") {
    const margin = PAPER_MARGIN_MM[paper];
    const height = Math.max(40, Math.ceil(contentHeightMm + margin * 2 + 2));
    return `size: ${paper === "k80" ? 80 : 58}mm ${height}mm; margin: ${margin}mm;`;
  }
  return PAPER_PAGE_CSS[paper];
}

/** Bề ngang vùng in của phiếu trên từng khổ. */
export const PAPER_RECEIPT_WIDTH: Readonly<Record<PaperSize, string>> = Object.freeze({
  a4: "120mm",
  a5: "110mm",
  k80: "72mm",
  k58: "52mm",
});

/** Số điểm ảnh một dòng của đầu in nhiệt (203 dpi): 80mm → 576, 58mm → 384. */
export const PAPER_DOTS: Readonly<Record<"k80" | "k58", number>> = Object.freeze({ k80: 576, k58: 384 });

export type PrinterSettings = { paper: PaperSize; mode: PrintMode };

const STORAGE_KEY = "nbj-receipt-printer";
const MAC_DINH: PrinterSettings = { paper: "k80", mode: "system" };

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return MAC_DINH;
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    const paper = typeof parsed.paper === "string" && Object.hasOwn(PAPER_LABELS, parsed.paper) ? parsed.paper : MAC_DINH.paper;
    const mode = parsed.mode === "bluetooth" ? "bluetooth" : "system";
    return { paper, mode };
  } catch {
    return MAC_DINH;
  }
}

export function savePrinterSettings(settings: PrinterSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Trình duyệt chặn lưu (cửa sổ ẩn danh): vẫn in được, chỉ là lần sau chọn lại.
  }
}

// --- Đường 1: hộp thoại in của máy ------------------------------------------------

function choTaiXong(node: HTMLLinkElement | HTMLImageElement, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const xong = () => resolve();
    node.addEventListener("load", xong, { once: true });
    node.addEventListener("error", xong, { once: true });
    window.setTimeout(xong, timeoutMs);
  });
}

/**
 * In đúng một phần tử, đúng khổ giấy.
 *
 * Phiếu được chép sang một khung `<iframe>` riêng chỉ chứa phiếu rồi in khung
 * ấy. Cách cũ (12/10/2026 trở về trước) ẩn mọi thứ khác bằng `visibility:
 * hidden` ngay trên màn ERP: phần bị ẩn vẫn chiếm chỗ, nên bản in có trang
 * trắng theo sau, phiếu có khi rơi xuống trang hai, và giấy cuộn bị kéo dài
 * bằng cả màn hình. Khung riêng thì chỉ có phiếu, nên đo được chiều dài thật
 * cho giấy cuộn.
 */
export async function printWithSystemDialog(elementId: string, paper: PaperSize): Promise<boolean> {
  const target = document.getElementById(elementId);
  if (!target) return false;
  document.querySelectorAll("iframe[data-receipt-print-frame]").forEach((old) => old.remove());

  const frame = document.createElement("iframe");
  frame.setAttribute("data-receipt-print-frame", "");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Nằm ngoài màn hình nhưng vẫn dựng bố cục, để đo được chiều cao phiếu.
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAPER_RECEIPT_WIDTH[paper]};height:100px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }

  const kieu = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((node) => !node.hasAttribute("data-receipt-print-style"))
    .map((node) => node.outerHTML)
    .join("\n");
  const coChu = paper === "k58" ? "10px" : paper === "k80" ? "11px" : "13px";
  const coQr = paper === "k58" ? "32mm" : "40mm";
  doc.open();
  doc.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><base href="${window.location.origin}/">${kieu}
<style data-receipt-frame>
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body { width: ${PAPER_RECEIPT_WIDTH[paper]}; margin: 0 auto !important; color: #000; font-size: ${coChu}; }
  body > * {
    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    position: static !important; left: auto !important;
  }
  img { width: ${coQr} !important; height: auto !important; }
  figure, tr, dl > div { break-inside: avoid; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
</style><style data-receipt-page>@page { ${PAPER_PAGE_CSS[paper]} }</style></head><body></body></html>`);
  doc.close();
  const ban = target.cloneNode(true) as HTMLElement;
  ban.removeAttribute("id");
  ban.removeAttribute("aria-hidden");
  doc.body.appendChild(doc.importNode(ban, true));

  // Chờ CSS và ảnh QR trong khung tải xong, có hạn, để không treo nút In.
  await Promise.all([
    ...Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) =>
      link.sheet ? Promise.resolve() : choTaiXong(link, 3000),
    ),
    ...Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : choTaiXong(img, 3000))),
  ]);
  try {
    await doc.fonts?.ready;
  } catch {
    // Không có API phông chữ: in bằng phông dự phòng.
  }

  const caoMm = (doc.body.scrollHeight * 25.4) / 96;
  const trang = doc.querySelector("style[data-receipt-page]");
  if (trang) trang.textContent = `@page { ${pageCssFor(paper, caoMm)} }`;

  const donDep = () => {
    win.removeEventListener("afterprint", donDep);
    frame.remove();
  };
  win.addEventListener("afterprint", donDep);
  try {
    win.focus();
    win.print();
  } catch {
    donDep();
    return false;
  }
  // Có trình duyệt không bắn `afterprint`; dọn dự phòng sau khi hộp thoại đóng.
  window.setTimeout(donDep, 60_000);
  return true;
}

// --- Tải PDF ngay trên máy ---------------------------------------------------------

/** Bề ngang ảnh phiếu khi làm PDF: gấp đôi đầu in 80mm để chữ nét khi in laser. */
const PDF_DOTS = 1152;

/**
 * Vẽ phiếu thành ảnh rồi gói thành tệp PDF đúng khổ đã chọn, tải về máy.
 * Không qua hộp thoại in, nên chạy cả trong app ERP cài trên iPhone.
 */
export async function downloadReceiptPdf(lines: readonly PrintLine[], paper: PaperSize, fileName: string) {
  const { taoPdfTuAnhJpeg, batCucPhieu } = await import("@/lib/erp/pdf-anh");
  const canvas = renderReceiptCanvas(lines, PDF_DOTS);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Không vẽ được phiếu thành ảnh.");
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const { trang, anh } = batCucPhieu(paper, canvas.width, canvas.height);
  const pdf = taoPdfTuAnhJpeg({ jpeg, rongPx: canvas.width, caoPx: canvas.height, trang, anh });
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Thu hồi ngay thì vài trình duyệt huỷ luôn lượt tải đang bắt đầu.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// --- Đường 2: máy in nhiệt Bluetooth -----------------------------------------------

/** Dịch vụ ghi phổ biến của máy in nhiệt Bluetooth giá rẻ trên thị trường. */
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
];

type BleCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
  writeValue: (data: BufferSource) => Promise<void>;
};

export type BluetoothPrinter = {
  name: string;
  write: (bytes: Uint8Array) => Promise<void>;
  isConnected: () => boolean;
};

type NavigatorBluetooth = {
  requestDevice: (options: unknown) => Promise<{
    name?: string;
    gatt?: {
      connected: boolean;
      connect: () => Promise<{
        getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<BleCharacteristic[]> }>>;
      }>;
    };
  }>;
};

export function bluetoothPrintingSupport(): { supported: boolean; reason: string } {
  if (typeof navigator === "undefined") return { supported: false, reason: "" };
  if (!window.isSecureContext) {
    return { supported: false, reason: "Chỉ tìm được máy in Bluetooth khi trang mở bằng địa chỉ https." };
  }
  if (!("bluetooth" in navigator)) {
    return {
      supported: false,
      reason:
        "Trình duyệt này chưa tìm được máy in Bluetooth (iPhone, Safari và Firefox chưa hỗ trợ). Dùng Chrome hoặc Edge trên Android, Windows, Mac — hoặc in qua hộp thoại của máy.",
    };
  }
  return { supported: true, reason: "" };
}

let mayInDangNoi: BluetoothPrinter | null = null;

export function currentBluetoothPrinter() {
  return mayInDangNoi && mayInDangNoi.isConnected() ? mayInDangNoi : null;
}

/**
 * Mở danh sách thiết bị Bluetooth quanh đó để người dùng chọn máy in. Trình
 * duyệt bắt buộc việc này phải bắt đầu từ một cú bấm.
 */
export async function connectBluetoothPrinter(): Promise<BluetoothPrinter> {
  const bluetooth = (navigator as unknown as { bluetooth: NavigatorBluetooth }).bluetooth;
  const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  if (!device.gatt) throw new Error("Thiết bị này không nhận kết nối in.");
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let ghi: BleCharacteristic | null = null;
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    ghi = characteristics.find((c) => c.properties.writeWithoutResponse || c.properties.write) ?? null;
    if (ghi) break;
  }
  if (!ghi) {
    throw new Error("Đã nối được nhưng thiết bị này không nhận lệnh in. Có thể đây không phải máy in nhiệt.");
  }
  const kenh = ghi;
  const gatt = device.gatt;
  mayInDangNoi = {
    name: device.name || "Máy in Bluetooth",
    isConnected: () => gatt.connected,
    write: async (bytes: Uint8Array) => {
      // Gói Bluetooth nhỏ: chia từng mẩu, nghỉ ngắn để máy in kịp nhận.
      const CO_MAU = 180;
      for (let i = 0; i < bytes.length; i += CO_MAU) {
        const mau = bytes.slice(i, i + CO_MAU);
        if (kenh.properties.writeWithoutResponse && kenh.writeValueWithoutResponse) {
          await kenh.writeValueWithoutResponse(mau);
        } else {
          await kenh.writeValue(mau);
        }
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
    },
  };
  return mayInDangNoi;
}

// --- Dựng phiếu thành ảnh rồi thành lệnh ESC/POS -----------------------------------

export type PrintLine =
  | { kind: "title"; text: string }
  | { kind: "text"; text: string; bold?: boolean; small?: boolean; center?: boolean }
  | { kind: "row"; left: string; right: string; bold?: boolean }
  | { kind: "rule" }
  | { kind: "qr"; value: string; caption: string };

function veQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const o = Math.floor(size / n);
  const le = x + Math.floor((size - o * n) / 2);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.data[r * n + c]) ctx.fillRect(le + c * o, y + r * o, o, o);
    }
  }
  return o * n;
}

function catDong(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const tu = text.split(/\s+/);
  const dong: string[] = [];
  let hienTai = "";
  for (const w of tu) {
    const thu = hienTai ? `${hienTai} ${w}` : w;
    if (ctx.measureText(thu).width > maxWidth && hienTai) {
      dong.push(hienTai);
      hienTai = w;
    } else {
      hienTai = thu;
    }
  }
  if (hienTai) dong.push(hienTai);
  return dong;
}

/** Vẽ phiếu lên canvas đúng bề ngang đầu in, trả về canvas đã vẽ. */
export function renderReceiptCanvas(lines: readonly PrintLine[], widthDots: number): HTMLCanvasElement {
  const scale = widthDots / 576;
  const le = Math.round(12 * scale);
  const rong = widthDots - le * 2;
  const font = (px: number, bold = false) =>
    `${bold ? "700" : "400"} ${Math.round(px * scale)}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;

  // Lượt 1: đo chiều cao.
  const nhap = document.createElement("canvas").getContext("2d")!;
  let cao = le;
  const khoi: Array<() => void> = [];
  const canvas = document.createElement("canvas");
  const ctx = () => canvas.getContext("2d")!;

  for (const line of lines) {
    if (line.kind === "title") {
      nhap.font = font(34, true);
      const d = catDong(nhap, line.text, rong);
      const y0 = cao;
      khoi.push(() => {
        const c = ctx();
        c.font = font(34, true);
        c.textAlign = "center";
        d.forEach((t, i) => c.fillText(t, widthDots / 2, y0 + Math.round(38 * scale) * (i + 1)));
      });
      cao += Math.round(38 * scale) * d.length + Math.round(8 * scale);
    } else if (line.kind === "text") {
      const px = line.small ? 22 : 26;
      nhap.font = font(px, line.bold);
      const d = catDong(nhap, line.text, rong);
      const y0 = cao;
      khoi.push(() => {
        const c = ctx();
        c.font = font(px, line.bold);
        c.textAlign = line.center ? "center" : "left";
        const x = line.center ? widthDots / 2 : le;
        d.forEach((t, i) => c.fillText(t, x, y0 + Math.round((px + 8) * scale) * (i + 1)));
      });
      cao += Math.round((px + 8) * scale) * d.length + Math.round(2 * scale);
    } else if (line.kind === "row") {
      const y0 = cao;
      khoi.push(() => {
        const c = ctx();
        c.font = font(26, line.bold);
        c.textAlign = "left";
        c.fillText(line.left, le, y0 + Math.round(30 * scale));
        c.textAlign = "right";
        c.fillText(line.right, widthDots - le, y0 + Math.round(30 * scale));
      });
      cao += Math.round(36 * scale);
    } else if (line.kind === "rule") {
      const y0 = cao + Math.round(10 * scale);
      khoi.push(() => {
        const c = ctx();
        c.fillStyle = "#000";
        for (let x = le; x < widthDots - le; x += Math.round(12 * scale)) {
          c.fillRect(x, y0, Math.round(6 * scale), Math.max(1, Math.round(2 * scale)));
        }
      });
      cao += Math.round(22 * scale);
    } else if (line.kind === "qr") {
      const co = Math.round(300 * scale);
      const y0 = cao + Math.round(8 * scale);
      khoi.push(() => {
        const c = ctx();
        veQr(c, line.value, Math.round((widthDots - co) / 2), y0, co);
        c.font = font(22);
        c.textAlign = "center";
        c.fillStyle = "#000";
        catDong(c, line.caption, rong).forEach((t, i) =>
          c.fillText(t, widthDots / 2, y0 + co + Math.round(28 * scale) * (i + 1)),
        );
      });
      nhap.font = font(22);
      cao += Math.round(8 * scale) + co + Math.round(28 * scale) * catDong(nhap, line.caption, rong).length + Math.round(12 * scale);
    }
  }
  cao += Math.round(40 * scale);

  canvas.width = widthDots;
  canvas.height = cao;
  const c = ctx();
  c.fillStyle = "#fff";
  c.fillRect(0, 0, widthDots, cao);
  c.fillStyle = "#000";
  for (const ve of khoi) {
    c.fillStyle = "#000";
    ve();
  }
  return canvas;
}

/**
 * Đổi canvas thành lệnh in ảnh ESC/POS. Chia thành từng dải 256 dòng: nhiều
 * máy in nhiệt rẻ không nhận một ảnh cao hàng nghìn dòng trong một lệnh.
 */
export function canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  return imageDataToEscPos(canvas.getContext("2d")!.getImageData(0, 0, width, height).data, width, height);
}

/** Phần thuần của `canvasToEscPos`: nhận mảng RGBA, trả lệnh in ảnh. */
export function imageDataToEscPos(data: ArrayLike<number>, width: number, height: number): Uint8Array {
  const byteWidth = Math.ceil(width / 8);
  const parts: number[] = [0x1b, 0x40];
  const DAI = 256;
  for (let y0 = 0; y0 < height; y0 += DAI) {
    const h = Math.min(DAI, height - y0);
    parts.push(0x1d, 0x76, 0x30, 0x00, byteWidth & 0xff, (byteWidth >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff);
    for (let y = y0; y < y0 + h; y++) {
      for (let bx = 0; bx < byteWidth; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= width) continue;
          const i = (y * width + x) * 4;
          const sang = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (sang < 160) byte |= 0x80 >> bit;
        }
        parts.push(byte);
      }
    }
  }
  // Đẩy giấy ra vài dòng rồi cắt (máy không có dao cắt thì bỏ qua lệnh cắt).
  parts.push(0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00);
  return Uint8Array.from(parts);
}

export async function printLinesToBluetooth(
  printer: BluetoothPrinter,
  lines: readonly PrintLine[],
  paper: "k80" | "k58",
) {
  const canvas = renderReceiptCanvas(lines, PAPER_DOTS[paper]);
  await printer.write(canvasToEscPos(canvas));
}
