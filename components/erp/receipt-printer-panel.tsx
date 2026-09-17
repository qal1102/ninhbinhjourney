"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COUNTER_PRODUCT_LABELS,
  formatVnd,
  type CounterSaleReceipt,
} from "@/domain/erp-counter-sale";
import {
  PAPER_LABELS,
  bluetoothPrintingSupport,
  connectBluetoothPrinter,
  currentBluetoothPrinter,
  loadPrinterSettings,
  printLinesToBluetooth,
  printWithSystemDialog,
  savePrinterSettings,
  type PaperSize,
  type PrintLine,
  type PrinterSettings,
} from "@/lib/erp/receipt-printer";

function gioVietNam(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

function ngayVietNam(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/** Nội dung phiếu thu dạng dòng, dùng cho máy in nhiệt Bluetooth. */
export function receiptLinesForSale(siteName: string, receipt: CounterSaleReceipt): PrintLine[] {
  const lines: PrintLine[] = [
    { kind: "text", text: "PHIẾU THU BÁN VÉ", bold: true, center: true, small: true },
    { kind: "title", text: siteName },
    { kind: "text", text: receipt.saleCode, center: true, bold: true },
    { kind: "text", text: gioVietNam(receipt.soldAt), center: true, small: true },
  ];
  if (receipt.status === "voided") lines.push({ kind: "text", text: "ĐÃ HUỶ", center: true, bold: true });
  lines.push({ kind: "rule" });
  for (const line of receipt.lines) {
    lines.push({
      kind: "row",
      left: `${COUNTER_PRODUCT_LABELS[line.product]} x ${line.quantity}`,
      right: formatVnd(line.lineTotalVnd),
    });
  }
  lines.push({ kind: "rule" });
  lines.push({ kind: "row", left: "Tổng tiền", right: formatVnd(receipt.totalVnd), bold: true });
  if (receipt.paymentMethod === "qr-transfer") {
    lines.push({ kind: "row", left: "Chuyển khoản QR", right: formatVnd(receipt.totalVnd) });
    if (receipt.paymentReference) lines.push({ kind: "text", text: `Nội dung: ${receipt.paymentReference}`, small: true });
  } else {
    lines.push({ kind: "row", left: "Khách đưa", right: formatVnd(receipt.cashReceivedVnd) });
    lines.push({ kind: "row", left: "Tiền thối", right: formatVnd(receipt.changeVnd) });
  }
  lines.push({ kind: "text", text: `Người bán: ${receipt.soldByName}`, small: true });
  if (receipt.status !== "voided") {
    for (const line of receipt.lines) {
      lines.push({
        kind: "qr",
        value: line.ticketCode,
        caption: `${line.ticketCode} · ${COUNTER_PRODUCT_LABELS[line.product]} · ${line.entriesAllowed} lượt · dùng trong ngày ${ngayVietNam(receipt.businessDate)}`,
      });
    }
  }
  lines.push({ kind: "rule" });
  lines.push({
    kind: "text",
    text: "Phiếu thu bán vé, không phải hoá đơn giá trị gia tăng. Cảm ơn quý khách.",
    small: true,
    center: true,
  });
  return lines;
}

export function testPrintLines(siteName: string, paper: PaperSize): PrintLine[] {
  return [
    { kind: "text", text: "IN THỬ", bold: true, center: true },
    { kind: "title", text: siteName },
    { kind: "text", text: `Khổ giấy: ${PAPER_LABELS[paper]}`, center: true },
    { kind: "text", text: gioVietNam(new Date().toISOString()), center: true, small: true },
    { kind: "rule" },
    { kind: "text", text: "Tiếng Việt có dấu: Tràng An, Bái Đính, Tam Cốc, Tam Chúc." },
    { kind: "row", left: "Dòng trái", right: "Dòng phải" },
    { kind: "qr", value: "IN-THU-MAY-IN", caption: "Mã QR thử: điện thoại quét được là máy in đủ nét." },
    { kind: "rule" },
    { kind: "text", text: "Hai đầu đường gạch không bị cắt là khổ giấy đúng.", small: true, center: true },
  ];
}

export type ReceiptPrinter = {
  settings: PrinterSettings;
  setPaper: (paper: PaperSize) => void;
  setMode: (mode: PrinterSettings["mode"]) => void;
  bluetoothName: string | null;
  bluetoothReason: string;
  connect: () => Promise<void>;
  print: (input: { elementId: string; lines: PrintLine[] }) => Promise<void>;
  message: { tone: "ok" | "error"; text: string } | null;
  busy: boolean;
};

export function useReceiptPrinter(): ReceiptPrinter {
  const [settings, setSettings] = useState<PrinterSettings>({ paper: "k80", mode: "system" });
  const [bluetoothName, setBluetoothName] = useState<string | null>(null);
  const [bluetoothReason, setBluetoothReason] = useState("");
  const [message, setMessage] = useState<ReceiptPrinter["message"]>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Đọc lựa chọn đã lưu của máy này sau khi dựng xong, để không lệch với HTML máy chủ.
    const saved = loadPrinterSettings();
    const support = bluetoothPrintingSupport();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp cài đặt riêng của từng máy một lần khi mở màn hình
    setSettings(saved);
    setBluetoothReason(support.supported ? "" : support.reason);
    setBluetoothName(currentBluetoothPrinter()?.name ?? null);
  }, []);

  const update = useCallback((next: PrinterSettings) => {
    setSettings(next);
    savePrinterSettings(next);
  }, []);

  const setPaper = useCallback((paper: PaperSize) => update({ ...settings, paper }), [settings, update]);
  const setMode = useCallback(
    (mode: PrinterSettings["mode"]) => update({ ...settings, mode }),
    [settings, update],
  );

  const connect = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      const printer = await connectBluetoothPrinter();
      setBluetoothName(printer.name);
      update({ paper: settings.paper === "a4" || settings.paper === "a5" ? "k80" : settings.paper, mode: "bluetooth" });
      setMessage({ tone: "ok", text: `Đã nối ${printer.name}. Bấm "In thử" để kiểm.` });
    } catch (error) {
      // Người dùng đóng danh sách thiết bị: trình duyệt ném NotFoundError.
      const huy = error instanceof DOMException && error.name === "NotFoundError";
      const tuTaNem = error instanceof Error && error.name === "Error";
      setMessage({
        tone: "error",
        text: huy
          ? "Chưa chọn máy in nào. Bật máy in, để gần máy này rồi tìm lại."
          : tuTaNem
            ? error.message
            : "Chưa nối được máy in Bluetooth. Bật máy in, để gần máy này rồi thử lại.",
      });
    } finally {
      setBusy(false);
    }
  }, [settings.paper, update]);

  const print = useCallback(
    async ({ elementId, lines }: { elementId: string; lines: PrintLine[] }) => {
      setMessage(null);
      const printer = currentBluetoothPrinter();
      const cuon = settings.paper === "k80" || settings.paper === "k58";
      if (settings.mode === "bluetooth") {
        if (!printer) {
          setMessage({ tone: "error", text: "Máy in Bluetooth đã ngắt. Bấm \"Tìm máy in Bluetooth gần đây\" để nối lại." });
          return;
        }
        if (!cuon) {
          setMessage({ tone: "error", text: "Máy in nhiệt Bluetooth chỉ in giấy cuộn. Chọn khổ Cuộn 80mm hoặc Cuộn 58mm." });
          return;
        }
        setBusy(true);
        try {
          await printLinesToBluetooth(printer, lines, settings.paper as "k80" | "k58");
          setMessage({ tone: "ok", text: `Đã gửi lệnh in tới ${printer.name}.` });
        } catch {
          setMessage({ tone: "error", text: "Gửi lệnh in không thành. Kiểm tra máy in còn bật và còn giấy, rồi thử lại." });
        } finally {
          setBusy(false);
        }
        return;
      }
      if (!printWithSystemDialog(elementId, settings.paper)) {
        setMessage({ tone: "error", text: "Không tìm thấy phiếu để in. Xin tải lại trang." });
      }
    },
    [settings],
  );

  return { settings, setPaper, setMode, bluetoothName, bluetoothReason, connect, print, message, busy };
}

export function ReceiptPrinterSettings({
  printer,
  onTestPrint,
}: {
  printer: ReceiptPrinter;
  onTestPrint: () => void;
}) {
  const { settings } = printer;
  return (
    <details className="rounded-xl border border-[#d8e0db] bg-[#f7f9f7] p-3 text-sm">
      <summary className="cursor-pointer font-black text-[#20342c]">
        Máy in phiếu thu · {PAPER_LABELS[settings.paper]} ·{" "}
        {settings.mode === "bluetooth" ? printer.bluetoothName ?? "Bluetooth chưa nối" : "hộp thoại in của máy"}
      </summary>

      <fieldset className="mt-3">
        <legend className="text-xs font-black text-[#5c6f67]">Khổ giấy</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PAPER_LABELS) as PaperSize[]).map((paper) => (
            <label
              key={paper}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-xs font-black ${
                settings.paper === paper ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
              }`}
            >
              <input
                type="radio"
                name="receipt-paper"
                value={paper}
                checked={settings.paper === paper}
                onChange={() => printer.setPaper(paper)}
                className="sr-only"
              />
              {PAPER_LABELS[paper]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-xs font-black text-[#5c6f67]">Cách in</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-2 rounded-lg border border-[#ccd8d1] bg-white p-2">
            <input
              type="radio"
              name="receipt-mode"
              checked={settings.mode === "system"}
              onChange={() => printer.setMode("system")}
              className="mt-1 accent-[#183f34]"
            />
            <span>
              <strong className="block text-xs text-[#20342c]">Hộp thoại in của máy</strong>
              <span className="text-xs text-[#6e7b75]">Máy in Wi-Fi, USB, AirPrint đã cài trên máy này hiện trong hộp thoại.</span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-2 rounded-lg border border-[#ccd8d1] bg-white p-2">
            <input
              type="radio"
              name="receipt-mode"
              checked={settings.mode === "bluetooth"}
              onChange={() => printer.setMode("bluetooth")}
              disabled={Boolean(printer.bluetoothReason)}
              className="mt-1 accent-[#183f34]"
            />
            <span>
              <strong className="block text-xs text-[#20342c]">Máy in nhiệt Bluetooth</strong>
              <span className="text-xs text-[#6e7b75]">In thẳng không qua hộp thoại, chỉ giấy cuộn 80mm hoặc 58mm.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {printer.bluetoothReason ? (
        <p className="mt-2 text-xs leading-5 text-[#6b5326]">{printer.bluetoothReason}</p>
      ) : (
        <button
          type="button"
          onClick={() => void printer.connect()}
          disabled={printer.busy}
          className="mt-3 min-h-10 w-full rounded-lg border border-[#183f34] bg-white px-3 text-xs font-black text-[#183f34] disabled:opacity-50"
        >
          {printer.bluetoothName ? `Đang nối ${printer.bluetoothName} · tìm máy khác` : "Tìm máy in Bluetooth gần đây"}
        </button>
      )}

      <button
        type="button"
        onClick={onTestPrint}
        disabled={printer.busy}
        className="mt-2 min-h-10 w-full rounded-lg bg-[#183f34] px-3 text-xs font-black text-white disabled:opacity-50"
      >
        In thử
      </button>

      <p className="mt-2 text-xs leading-4 text-[#6e7b75]">
        Máy này nhớ lựa chọn riêng. Trang web không tự dò được máy in trên mạng Wi-Fi; máy in đã cài trên máy tính
        hoặc điện thoại sẽ hiện ngay trong hộp thoại in.
      </p>

      {printer.message ? (
        <p
          role={printer.message.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${
            printer.message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
          }`}
        >
          {printer.message.text}
        </p>
      ) : null}
    </details>
  );
}

/** Tờ in thử cho đường hộp thoại in. Nằm ngoài màn hình, chỉ hiện khi in. */
export function TestPrintSheet({ id, siteName, paper }: { id: string; siteName: string; paper: PaperSize }) {
  return (
    <article id={id} aria-hidden="true" className="fixed -left-[9999px] top-0 w-[72mm] bg-white p-3 text-[#000]">
      <p className="text-center text-xs font-black uppercase tracking-[0.2em]">In thử</p>
      <p className="mt-1 text-center text-lg font-black">{siteName}</p>
      <p className="text-center text-xs">Khổ giấy: {PAPER_LABELS[paper]}</p>
      <p className="mt-2 border-t border-dashed border-black pt-2 text-sm">
        Tiếng Việt có dấu: Tràng An, Bái Đính, Tam Cốc, Tam Chúc.
      </p>
      <p className="mt-2 border-t border-dashed border-black pt-2 text-center text-xs">
        Hai đầu đường gạch không bị cắt là khổ giấy đúng.
      </p>
    </article>
  );
}

