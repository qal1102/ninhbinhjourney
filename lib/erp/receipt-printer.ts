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

/** Quy tắc `@page` cho từng khổ. Giấy cuộn để chiều dài tự chạy theo nội dung. */
export const PAPER_PAGE_CSS: Readonly<Record<PaperSize, string>> = Object.freeze({
  a4: "size: A4 portrait; margin: 16mm;",
  a5: "size: A5 portrait; margin: 10mm;",
  k80: "size: 80mm auto; margin: 3mm;",
  k58: "size: 58mm auto; margin: 2mm;",
});

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
    const paper = parsed.paper && parsed.paper in PAPER_LABELS ? parsed.paper : MAC_DINH.paper;
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

/**
 * In đúng một phần tử, đúng khổ giấy. Chỉ phần tử mang `data-print-active`
 * hiện ra khi in; mọi thứ khác của màn hình ERP bị ẩn.
 */
export function printWithSystemDialog(elementId: string, paper: PaperSize) {
  const target = document.getElementById(elementId);
  if (!target) return false;
  const style = document.createElement("style");
  style.setAttribute("data-receipt-print-style", "");
  style.textContent = `@page { ${PAPER_PAGE_CSS[paper]} }
@media print {
  body * { visibility: hidden !important; }
  [data-print-active="true"], [data-print-active="true"] * { visibility: visible !important; }
  [data-print-active="true"] {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: ${PAPER_RECEIPT_WIDTH[paper]} !important; max-width: ${PAPER_RECEIPT_WIDTH[paper]} !important;
    margin: 0 auto !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important;
    font-size: ${paper === "k58" ? "10px" : paper === "k80" ? "11px" : "13px"} !important;
  }
  [data-print-active="true"] img { width: ${paper === "k58" ? "32mm" : "40mm"} !important; height: auto !important; }
}`;
  document.head.appendChild(style);
  target.setAttribute("data-print-active", "true");
  const donDep = () => {
    target.removeAttribute("data-print-active");
    style.remove();
    window.removeEventListener("afterprint", donDep);
  };
  window.addEventListener("afterprint", donDep);
  window.print();
  // Có trình duyệt không bắn `afterprint`; dọn dự phòng sau khi hộp thoại đóng.
  window.setTimeout(donDep, 60_000);
  return true;
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
