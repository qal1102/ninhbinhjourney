"use client";

import { DanhSachGon } from "@/components/erp/danh-sach-gon";

import Link from "next/link";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createCounterSaleAction,
  docMaKhachQuetAction,
  duongDanVeKhachAction,
  taoMaKhachQuetAction,
  voidCounterSaleAction,
} from "@/app/erp/actions";
import { capVeMoiAction } from "@/app/erp/ve-doan-actions";
import { DuaVeChoKhach } from "./dua-ve-cho-khach";
import { BanVeDoan } from "./ban-ve-doan";
import type { DienPhieuDoan } from "@/domain/soat-giay-to";
import type { CounterSaleWorkspace } from "@/lib/erp/counter-sale-repository";
import type { ErpSite } from "@/domain/erp";
import {
  ReceiptPrinterSettings,
  TestPrintSheet,
  receiptLinesForSale,
  testPrintLines,
  useReceiptPrinter,
} from "./receipt-printer-panel";
import {
  COUNTER_PAYMENT_METHOD_LABELS,
  COUNTER_PRODUCT_LABELS,
  COUNTER_COMP_MAX,
  COUNTER_SALE_MAX_PARTY,
  computeCounterCart,
  counterCashSuggestions,
  counterChange,
  counterPaymentReference,
  counterSaleReadiness,
  formatVnd,
  type CounterSaleReceipt,
} from "@/domain/erp-counter-sale";

type Props = {
  site: ErpSite;
  userId: string;
  userRole: string;
  workspace: CounterSaleWorkspace | null;
  /** Từ màn Soát giấy tờ: AI đã đọc danh sách đoàn, mở sẵn ô Vé đoàn. */
  dienSanDoan?: DienPhieuDoan | null;
};

type LoaiPhieu = "le" | "doan" | "moi";

const TEN_LOAI: Record<LoaiPhieu, string> = { le: "Vé lẻ", doan: "Vé đoàn", moi: "Vé mời" };

function khoaMoi() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function Stepper({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#dfe6e2] bg-[#f7f9f7] p-3">
      <p className="text-sm font-black text-[#20342c]">{label}</p>
      <p className="text-xs text-[#6e7b75]">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`Bớt một vé ${label.toLowerCase()}`}
          className="h-11 w-11 rounded-xl border border-[#ccd8d1] bg-white text-xl font-black text-[#183f34] disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <output aria-live="polite" className="min-w-10 text-center text-2xl font-black tabular-nums text-[#183f34]">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(COUNTER_SALE_MAX_PARTY, value + 1))}
          disabled={value >= COUNTER_SALE_MAX_PARTY}
          aria-label={`Thêm một vé ${label.toLowerCase()}`}
          className="h-11 w-11 rounded-xl border border-[#ccd8d1] bg-white text-xl font-black text-[#183f34] disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
        <div className="flex w-full gap-1 sm:ml-1 sm:w-auto">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={value === n}
              className={`h-11 min-w-11 flex-1 rounded-lg px-2 text-sm font-black sm:flex-none ${
                value === n ? "bg-[#183f34] text-white" : "bg-white text-[#42574e] ring-1 ring-[#dfe6e2]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Phiếu thu in cho khách. Ghi rõ không phải hoá đơn giá trị gia tăng. */
export function ReceiptSheet({ id, site, receipt }: { id: string; site: ErpSite; receipt: CounterSaleReceipt }) {
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => {
    let huy = false;
    Promise.all(
      receipt.lines.map(async (line) => [
        line.ticketCode,
        await QRCode.toDataURL(line.ticketCode, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        }),
      ] as const),
    )
      .then((cap) => {
        if (!huy) setQr(Object.fromEntries(cap));
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, [receipt]);

  const daHuy = receipt.status === "voided";
  return (
    <article
      id={id}
      className="mx-auto w-full max-w-sm rounded-2xl border border-[#d8e0db] bg-white p-5 text-[#1d2925] shadow-sm"
    >
      <header className="border-b border-dashed border-[#b8c6bf] pb-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em]">
          {receipt.saleKind === "group" ? "Phiếu thu vé đoàn" : receipt.saleKind === "comp" ? "Phiếu vé mời" : "Phiếu thu bán vé"}
        </p>
        <p className="mt-1 text-lg font-black">{site.name}</p>
        <p className="mt-1 font-mono text-sm font-bold">{receipt.saleCode}</p>
        <p className="text-xs text-[#5c6f67]">{gioVietNam(receipt.soldAt)}</p>
        {daHuy ? (
          <p className="mt-2 rounded-lg border-2 border-[#8b3d31] px-2 py-1 text-base font-black uppercase tracking-[0.2em] text-[#8b3d31]">
            Đã huỷ
          </p>
        ) : null}
      </header>

      {receipt.saleKind === "group" ? (
        <dl className="mt-3 space-y-0.5 text-xs" data-testid="phieu-thong-tin-doan">
          <div className="flex justify-between gap-2"><dt className="text-[#5c6f67]">Trưởng đoàn</dt><dd className="text-right font-bold">{receipt.groupLeaderName}{receipt.groupLeaderPhone ? ` · ${receipt.groupLeaderPhone}` : ""}</dd></div>
          {receipt.travelCompany ? (
            <div className="flex justify-between gap-2"><dt className="text-[#5c6f67]">Công ty</dt><dd className="text-right font-bold">{receipt.travelCompany.name}{receipt.travelCompany.taxCode ? ` · MST ${receipt.travelCompany.taxCode}` : ""}</dd></div>
          ) : null}
          {receipt.groupCode ? (
            <div className="flex justify-between gap-2"><dt className="text-[#5c6f67]">Mã đoàn</dt><dd className="font-mono font-bold">{receipt.groupCode}</dd></div>
          ) : null}
          {receipt.invoiceRequested ? <p className="font-bold text-[#24533f]">Có đề nghị xuất hoá đơn cho công ty.</p> : null}
        </dl>
      ) : receipt.saleKind === "comp" ? (
        <dl className="mt-3 space-y-0.5 text-xs" data-testid="phieu-thong-tin-moi">
          <div className="flex justify-between gap-2"><dt className="text-[#5c6f67]">Người mời</dt><dd className="text-right font-bold">{receipt.compInviterName}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-[#5c6f67]">Lý do</dt><dd className="text-right">{receipt.compReason}</dd></div>
        </dl>
      ) : null}

      <table className="mt-3 w-full text-sm">
        <tbody>
          {receipt.lines.map((line) => (
            <tr key={line.ticketCode} className="align-top">
              <td className="py-1">
                {COUNTER_PRODUCT_LABELS[line.product]} × {line.quantity}
                <span className="block text-xs text-[#5c6f67]">
                  {line.unitPriceVnd === 0 ? "miễn phí" : `${formatVnd(line.unitPriceVnd)} một vé`}
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">{formatVnd(line.lineTotalVnd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-2 space-y-1 border-t border-dashed border-[#b8c6bf] pt-2 text-sm tabular-nums">
        {receipt.discountVnd > 0 ? (
          <>
            <div className="flex justify-between">
              <dt>{receipt.saleKind === "comp" ? "Trị giá vé" : "Tạm tính"}</dt>
              <dd>{formatVnd(receipt.totalVnd + receipt.discountVnd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{receipt.saleKind === "comp" ? "Vé mời" : `Ưu đãi công ty ${receipt.discountPercent}%`}</dt>
              <dd>−{formatVnd(receipt.discountVnd)}</dd>
            </div>
          </>
        ) : null}
        <div className="flex justify-between font-black">
          <dt>Tổng tiền</dt>
          <dd>{formatVnd(receipt.totalVnd)}</dd>
        </div>
        {receipt.paymentMethod === "complimentary" ? (
          <div className="flex justify-between">
            <dt>{COUNTER_PAYMENT_METHOD_LABELS.complimentary}</dt>
            <dd>0 đ</dd>
          </div>
        ) : receipt.paymentMethod === "qr-transfer" ? (
          <div className="flex justify-between">
            <dt>{COUNTER_PAYMENT_METHOD_LABELS["qr-transfer"]}</dt>
            <dd>{receipt.paymentReference ?? "đã nhận"}</dd>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <dt>Khách đưa</dt>
              <dd>{formatVnd(receipt.cashReceivedVnd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tiền thối</dt>
              <dd>{formatVnd(receipt.changeVnd)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between text-xs text-[#5c6f67]">
          <dt>Người bán</dt>
          <dd>{receipt.soldByName}</dd>
        </div>
      </dl>

      {!daHuy ? (
        <div className="mt-4 grid gap-4">
          {receipt.lines.map((line) => (
            <figure key={line.ticketCode} className="text-center">
              {qr[line.ticketCode] ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR là ảnh sinh tại chỗ, không phải tệp tĩnh
                <img
                  src={qr[line.ticketCode]}
                  alt={`Mã QR vé ${line.ticketCode}`}
                  className="mx-auto h-40 w-40"
                />
              ) : (
                <div className="mx-auto h-40 w-40 rounded-lg bg-[#eef1ef]" aria-hidden="true" />
              )}
              <figcaption className="mt-1 text-xs">
                <span className="block font-bold">Nhân viên cổng quét mã này để cho vào</span>
                <span className="block font-mono font-bold">{line.ticketCode}</span>
                {COUNTER_PRODUCT_LABELS[line.product]} · cho {line.entriesAllowed} lượt vào ·
                dùng trong ngày {ngayVietNam(receipt.businessDate)}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[#8b3d31]">
          Huỷ bởi {receipt.voidedByName} lúc {receipt.voidedAt ? gioVietNam(receipt.voidedAt) : ""}. Lý do:{" "}
          {receipt.voidReason}
        </p>
      )}

      <p className="mt-4 border-t border-dashed border-[#b8c6bf] pt-2 text-center text-xs leading-4 text-[#5c6f67]">
        Phiếu thu bán vé, không phải hoá đơn giá trị gia tăng. Vé chỉ dùng trong
        ngày ghi trên phiếu. Cảm ơn quý khách.
      </p>
    </article>
  );
}

export function CounterSalePanel({ site, userId, userRole, workspace, dienSanDoan = null }: Props) {
  const router = useRouter();
  const [loai, setLoai] = useState<LoaiPhieu>(dienSanDoan ? "doan" : "le");
  const [nguoiMoi, setNguoiMoi] = useState("");
  const [lyDoMoi, setLyDoMoi] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cashText, setCashText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr-transfer">("cash");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<CounterSaleReceipt | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();
  // Một khoá cho mỗi tấm phiếu đang soạn. Mạng lỡ nhịp mà nhân viên bấm lại thì
  // máy chủ trả đúng phiếu cũ, không bán lần hai.
  const [khoaDau] = useState(khoaMoi);
  const requestKey = useRef(khoaDau);
  const [reference, setReference] = useState(() => counterPaymentReference(khoaDau));
  const printer = useReceiptPrinter();

  const prices = useMemo(() => (workspace?.available ? workspace.prices : []), [workspace]);
  const cart = useMemo(() => computeCounterCart({ adults, children, prices }), [adults, children, prices]);
  const cash = Number(cashText.replace(/[^0-9]/g, "")) || 0;
  const change = counterChange(cash, cart.totalVnd);
  const readiness = counterSaleReadiness({ cart, cashReceivedVnd: cash, cashCountedConfirmed: confirmed, paymentMethod });
  // Khách quét QR (12/10/2026): mã đang chờ khách quét, và đường dẫn vé của
  // phiếu đang mở để gửi sang điện thoại khách.
  const [maCho, setMaCho] = useState<{ url: string; manKhachUrl: string; expiresAt: number; key: string; totalVnd: number } | null>(null);
  const [conGiay, setConGiay] = useState(0);
  const [veDienThoai, setVeDienThoai] = useState<{ saleCode: string; url: string } | null>(null);

  // Phiếu vừa bán (hay vừa bấm "Xem, in lại") nằm dưới biểu mẫu: cuộn tới để
  // người bán thấy ngay, không tưởng là chưa có gì (chủ dự án 12/10/2026).
  function denPhieu() {
    window.requestAnimationFrame(() =>
      document.getElementById("khoi-phieu-vua-ban")?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }),
    );
  }

  function moPhieu(phieu: CounterSaleReceipt) {
    setReceipt(phieu);
    denPhieu();
  }

  // Có phiếu là có đường dẫn vé cho điện thoại khách.
  useEffect(() => {
    if (!receipt || receipt.status === "voided") return;
    let huy = false;
    void duongDanVeKhachAction({ siteId: site.id, saleCode: receipt.saleCode, businessDate: receipt.businessDate }).then((kq) => {
      if (!huy && kq.url) setVeDienThoai({ saleCode: receipt.saleCode, url: kq.url });
    });
    return () => {
      huy = true;
    };
  }, [receipt, site.id]);

  // Đang chờ khách quét: hỏi kho hai giây một lần, khách trả xong là hiện phiếu.
  useEffect(() => {
    if (!maCho) return;
    let huy = false;
    const dem = window.setInterval(() => setConGiay(Math.max(0, Math.ceil((maCho.expiresAt - Date.now()) / 1000))), 1000);
    const hoi = window.setInterval(async () => {
      const kq = await docMaKhachQuetAction({ siteId: site.id, requestKey: maCho.key }).catch(() => null);
      if (huy || !kq?.receipt) return;
      huy = true;
      setMaCho(null);
      setMessage({ tone: "ok", text: `Khách đã quét và trả ${formatVnd(kq.receipt.totalVnd)}. Vé đã hiện trên điện thoại khách (phiếu ${kq.receipt.saleCode}).` });
      soanPhieuMoi();
      moPhieu(kq.receipt);
      router.refresh();
    }, 2000);
    return () => {
      huy = true;
      window.clearInterval(dem);
      window.clearInterval(hoi);
    };
    // soanPhieuMoi, moPhieu chỉ đặt state; không cần chạy lại theo chúng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maCho, site.id, router]);

  function taoMaKhachQuet() {
    if (pending || cart.partySize === 0) return;
    setMessage(null);
    startTransition(async () => {
      const kq = await taoMaKhachQuetAction({
        siteId: site.id,
        adults: cart.lines.find((l) => l.product === "adult")?.quantity ?? 0,
        children: cart.lines.find((l) => l.product === "child")?.quantity ?? 0,
        requestKey: requestKey.current,
      });
      if (kq.ok) {
        setMaCho({ url: kq.url, manKhachUrl: kq.manKhachUrl, expiresAt: kq.expiresAt, key: requestKey.current, totalVnd: kq.totalVnd });
        setConGiay(Math.ceil((kq.expiresAt - Date.now()) / 1000));
      } else {
        setMessage({ tone: "error", text: kq.message });
      }
    });
  }

  function huyMaCho() {
    setMaCho(null);
    // Mã cũ có thể vẫn nằm trên máy khách: phiếu sau phải mang khoá mới.
    requestKey.current = khoaMoi();
    setReference(counterPaymentReference(requestKey.current));
  }
  const canVoid = userRole === "manager" || userRole === "director";
  // Chỗ màn Hướng dẫn khoanh (components/shared/chi-diem.tsx), dời theo từng
  // bước: tiền khách đưa → ô xác nhận đã đếm → nút bán → phiếu thu.
  const buocChi =
    receipt && cash === 0 && !confirmed
      ? "xong"
      : paymentMethod === "cash" && cash === 0
        ? "tien"
        : !confirmed
          ? "dem"
          : "ban";
  const chi = (buoc: typeof buocChi, loi: string) =>
    buocChi === buoc ? { "data-chi": "ban-quay", "data-chi-loi": loi } : {};
  const inThu = () =>
    void printer.print({ elementId: "counter-test-print", lines: testPrintLines(site.name, printer.settings.paper) });

  // Đổi số vé hay số tiền thì lời xác nhận cũ không còn đúng với con số mới.
  function doiSo(fn: () => void) {
    fn();
    setConfirmed(false);
    if (maCho) huyMaCho();
  }

  function soanPhieuMoi() {
    setAdults(1);
    setChildren(0);
    setCashText("");
    setConfirmed(false);
    requestKey.current = khoaMoi();
    setReference(counterPaymentReference(requestKey.current));
  }

  function xacNhanBan() {
    if (!readiness.ok || pending) return;
    setMessage(null);
    startTransition(async () => {
      const ketQua = await createCounterSaleAction({
        siteId: site.id,
        adults: cart.lines.find((l) => l.product === "adult")?.quantity ?? 0,
        children: cart.lines.find((l) => l.product === "child")?.quantity ?? 0,
        paymentMethod,
        cashReceivedVnd: paymentMethod === "qr-transfer" ? cart.totalVnd : cash,
        paymentReference: paymentMethod === "qr-transfer" ? reference : null,
        cashCountedConfirmed: confirmed,
        requestKey: requestKey.current,
      });
      if (ketQua.ok) {
        setMessage({ tone: "ok", text: ketQua.message });
        soanPhieuMoi();
        moPhieu(ketQua.receipt);
        router.refresh();
      } else {
        setMessage({ tone: "error", text: ketQua.message });
      }
    });
  }

  function capVeMoi() {
    if (pending || cart.partySize === 0) return;
    setMessage(null);
    startTransition(async () => {
      const kq = await capVeMoiAction({
        siteId: site.id,
        adults,
        children,
        inviterAccountId: nguoiMoi,
        reason: lyDoMoi,
        requestKey: requestKey.current,
      });
      if (kq.ok) {
        setMessage({ tone: "ok", text: kq.message });
        soanPhieuMoi();
        setLyDoMoi("");
        moPhieu(kq.receipt);
        router.refresh();
      } else {
        setMessage({ tone: "error", text: kq.message });
      }
    });
  }

  function xacNhanHuy(saleCode: string) {
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      const ketQua = await voidCounterSaleAction({ siteId: site.id, saleCode, reason: voidReason });
      if (ketQua.ok) {
        setReceipt(ketQua.receipt);
        setVoiding(null);
        setVoidReason("");
        setMessage({ tone: "ok", text: ketQua.message });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: ketQua.message });
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Bán vé tại quầy</p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">Ra đơn, thu tiền, đưa vé cho khách</h2>
      <TestPrintSheet id="counter-test-print" siteName={site.name} paper={printer.settings.paper} />

      {!workspace || !workspace.available ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
            {workspace && !workspace.available
              ? workspace.message
              : "Quầy bán vé chưa nối được vào kho dữ liệu ở môi trường này, nên chưa bán được vé."}
          </p>
          {/* Nối và in thử máy in không cần kho dữ liệu: quầy chuẩn bị máy in trước được. */}
          <div className="max-w-xl">
            <ReceiptPrinterSettings printer={printer} onTestPrint={inThu} />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div role="tablist" aria-label="Loại phiếu" className="grid grid-cols-3 rounded-xl bg-[#eef3f0] p-1" data-testid="loai-phieu-quay">
              {(["le", "doan", "moi"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={loai === item}
                  onClick={() => {
                    setLoai(item);
                    setMessage(null);
                    if (maCho) huyMaCho();
                  }}
                  className={`min-h-11 rounded-lg text-sm font-black ${loai === item ? "bg-[#183f34] text-white" : "text-[#42574e]"}`}
                  {...(item === "doan"
                    ? { "data-chi": "phieu-doan", "data-chi-loi": "Bấm Vé đoàn: ghi trưởng đoàn, chọn công ty để có ưu đãi, rồi thu tiền." }
                    : item === "moi"
                      ? { "data-chi": "ve-moi", "data-chi-loi": "Bấm Vé mời: chọn người mời, ghi lý do, cấp vé 0 đ." }
                      : {})}
                >
                  {TEN_LOAI[item]}
                </button>
              ))}
            </div>

            {loai === "doan" ? (
              <BanVeDoan
                site={site}
                prices={prices}
                congTy={workspace.congTy}
                dienSan={dienSanDoan}
                onDaBan={(phieu, text) => {
                  setMessage({ tone: "ok", text });
                  moPhieu(phieu);
                  router.refresh();
                }}
              />
            ) : (
            <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stepper
                label="Người lớn"
                hint={(() => {
                  const p = prices.find((item) => item.product === "adult");
                  return p ? `${formatVnd(p.unitPriceVnd)} một vé` : "Chưa có giá";
                })()}
                value={adults}
                onChange={(n) => doiSo(() => setAdults(n))}
              />
              <Stepper
                label="Trẻ dưới 1m3"
                hint={(() => {
                  const p = prices.find((item) => item.product === "child");
                  if (!p) return "Chưa có giá";
                  return p.unitPriceVnd === 0 ? "Miễn phí, vẫn giữ một lượt vào" : `${formatVnd(p.unitPriceVnd)} một vé`;
                })()}
                value={children}
                onChange={(n) => doiSo(() => setChildren(n))}
              />
            </div>

            <div className="rounded-xl bg-[#183f34] p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Tổng tiền</p>
              <p className="mt-1 text-4xl font-black tabular-nums">{formatVnd(cart.totalVnd)}</p>
              <p className="mt-1 text-xs text-white/70">
                {cart.partySize} khách · giá lấy từ bảng giá quầy hôm nay
                {userRole === "director" ? (
                  <>
                    {" · "}
                    <Link href="/erp/bang-gia-quay" className="font-bold text-white underline underline-offset-2">
                      Sửa giá
                    </Link>
                  </>
                ) : null}
              </p>
            </div>

            {loai === "moi" ? (
              <div className="space-y-3 rounded-xl border-2 border-[#e7c78d] bg-[#fff8eb] p-4" data-testid="ve-moi">
                <p className="text-sm leading-6 text-[#5d5037]">
                  Vé mời không thu tiền. Phiếu ghi trị giá vé, <strong>người mời</strong> và lý do; báo cáo và đối soát cuối ca tách riêng,
                  không lẫn vào tiền bán. Tối đa {COUNTER_COMP_MAX} khách một phiếu.
                </p>
                <label className="block text-xs font-black text-[#5c6f67]">
                  Người mời
                  <select
                    value={nguoiMoi}
                    onChange={(e) => setNguoiMoi(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c]"
                  >
                    <option value="">Chọn người mời…</option>
                    {workspace.nguoiMoi.map((nguoi) => (
                      <option key={nguoi.id} value={nguoi.id}>
                        {nguoi.name} · {nguoi.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-black text-[#5c6f67]">
                  Lý do mời
                  <input
                    value={lyDoMoi}
                    onChange={(e) => setLyDoMoi(e.target.value)}
                    maxLength={300}
                    placeholder="Ví dụ: Đoàn báo chí khảo sát lễ hội"
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c]"
                  />
                </label>
                <button
                  type="button"
                  onClick={capVeMoi}
                  disabled={pending || cart.partySize === 0 || cart.partySize > COUNTER_COMP_MAX || !nguoiMoi || lyDoMoi.trim().length < 5}
                  className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Đang cấp vé…" : `Cấp vé mời · ${cart.partySize} khách · 0 đ`}
                </button>
                <p className="text-xs text-[#6e7b75]">
                  {!nguoiMoi ? "Chọn người mời." : lyDoMoi.trim().length < 5 ? "Ghi lý do mời, ít nhất năm ký tự." : cart.partySize > COUNTER_COMP_MAX ? `Tối đa ${COUNTER_COMP_MAX} khách.` : `Trị giá vé ${formatVnd(cart.totalVnd)}, ghi vào sổ vé mời.`}
                </p>
              </div>
            ) : (
            <>
            <div role="radiogroup" aria-label="Cách khách trả tiền" className="grid grid-cols-2 gap-2">
              {(["cash", "qr-transfer"] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === pt}
                  onClick={() => doiSo(() => setPaymentMethod(pt))}
                  className={`min-h-11 rounded-xl border text-sm font-black ${
                    paymentMethod === pt ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
                  }`}
                >
                  {pt === "cash" ? "Tiền mặt" : "Khách quét QR"}
                </button>
              ))}
            </div>

            {paymentMethod === "cash" ? (
              <div>
                <label htmlFor="counter-cash" className="text-sm font-black text-[#20342c]">
                  Tiền khách đưa
                </label>
                <input
                  id="counter-cash"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cash ? new Intl.NumberFormat("vi-VN").format(cash) : cashText}
                  onChange={(event) => doiSo(() => setCashText(event.target.value))}
                  placeholder="Ví dụ: 500.000"
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#ccd8d1] px-4 text-xl font-black tabular-nums text-[#183f34] outline-none focus:border-[#4f806f]"
                />
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  {...chi("tien", "Bấm \"Đủ tiền\", hoặc gõ số tiền khách đưa vào ô ngay trên.")}
                >
                  {counterCashSuggestions(cart.totalVnd).map((goiY) => (
                    <button
                      key={goiY}
                      type="button"
                      onClick={() => doiSo(() => setCashText(String(goiY)))}
                      className="min-h-11 rounded-lg bg-[#eef3f0] px-3 text-sm font-black text-[#35594b]"
                    >
                      {goiY === cart.totalVnd ? "Đủ tiền" : formatVnd(goiY)}
                    </button>
                  ))}
                </div>
                <p className={`mt-2 text-lg font-black tabular-nums ${cash === 0 ? "text-[#6e7b75]" : change === null ? "text-[#8b3d31]" : "text-[#2d735b]"}`}>
                  {cash === 0
                    ? "Chưa nhập tiền khách đưa"
                    : change === null
                      ? `Còn thiếu ${formatVnd(cart.totalVnd - cash)}`
                      : `Tiền thối lại: ${formatVnd(change)}`}
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="khach-quet-qr">
                {maCho ? (
                  <>
                    <button
                      type="button"
                      onClick={() => window.open(maCho.manKhachUrl, "nbj-man-khach")}
                      data-testid="mo-man-khach"
                      className="min-h-12 w-full rounded-xl bg-[#e7c78d] px-4 text-sm font-black text-[#183f34]"
                    >
                      Mở màn hình cho khách (số tiền, đồng hồ 15 phút)
                    </button>
                    <DuaVeChoKhach
                      url={maCho.url}
                      tieuDe={`Mời khách quét · ${formatVnd(maCho.totalVnd)}`}
                      loiDan="Khách mở camera điện thoại quét mã này: coi như đã trả (bản trình diễn), vé hiện ngay trên máy khách và phiếu tự hiện ở đây. Khách ở xa thì gửi đường dẫn qua Zalo."
                      chuChiaSe="Mở đường dẫn để trả và nhận vé Ninh Bình:"
                    />
                    <p role="status" className="flex items-center justify-between gap-3 rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
                      <span>{conGiay > 0 ? "Đang chờ khách quét…" : "Mã đã hết hạn giữ chỗ."}</span>
                      <span className="tabular-nums">{String(Math.floor(conGiay / 60)).padStart(2, "0")}:{String(conGiay % 60).padStart(2, "0")}</span>
                    </p>
                    <button type="button" onClick={huyMaCho} className="min-h-11 w-full rounded-xl border border-[#ccd8d1] px-4 text-sm font-black text-[#42574e]">
                      {conGiay > 0 ? "Huỷ mã, bán lại" : "Tạo mã mới"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="rounded-xl border border-[#b8cfbf] bg-[#edf3f0] p-4 text-sm leading-6 text-[#365247]">
                      Bấm tạo mã: màn hình hiện một mã QR. Khách quét bằng điện thoại là trả xong và
                      nhận vé ngay trên máy mình; phiếu tự ghi tên bạn, không cần tích xác nhận.
                    </p>
                    <button
                      type="button"
                      onClick={taoMaKhachQuet}
                      disabled={pending || cart.partySize === 0}
                      className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "Đang tạo mã…" : `Tạo mã cho khách quét · ${formatVnd(cart.totalVnd)}`}
                    </button>
                  </>
                )}
              </div>
            )}

            {paymentMethod === "cash" ? (
            <>
            <label
              className="flex gap-3 rounded-xl border-2 border-[#e7c78d] bg-[#fff8eb] p-4 text-sm leading-6 text-[#5d5037]"
              {...chi("dem", "Tích ô này: bạn xác nhận đã đếm đủ tiền.")}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#183f34]"
              />
              <span>
                <strong>
                  {cash > 0 && change !== null
                      ? `Tôi đã đếm đủ ${formatVnd(cash)} khách đưa, thối lại ${formatVnd(change)}, và bỏ ${formatVnd(cart.totalVnd)} vào quỹ.`
                      : `Tôi đã đếm đủ tiền khách đưa và bỏ ${formatVnd(cart.totalVnd)} vào quỹ.`}
                </strong>{" "}
                Nếu sai lệch, tôi chịu trách nhiệm. Phiếu ghi tên người bán và giờ bán.
              </span>
            </label>

            <button
              type="button"
              onClick={xacNhanBan}
              disabled={!readiness.ok || pending}
              {...chi("ban", "Bấm \"Xác nhận bán\". Phiếu ghi thật vào sổ.")}
              className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang lưu phiếu…" : "Xác nhận bán"}
            </button>
            {!readiness.ok ? (
              <p className="text-sm text-[#6e7b75]">{readiness.reason}</p>
            ) : null}
            </>
            ) : null}
            </>
            )}
            </>
            )}
            {message ? (
              <p
                role={message.tone === "error" ? "alert" : "status"}
                className={`rounded-xl px-4 py-3 text-sm font-bold ${
                  message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
                }`}
              >
                {message.text}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {receipt ? (
              <div
                id="khoi-phieu-vua-ban"
                className="scroll-mt-20 space-y-3"
                {...chi("xong", "Phiếu thu đã ra, in được ngay. Tiền quầy tự cộng vào đối soát cuối ca.")}
              >
                <ReceiptSheet id="counter-receipt" site={site} receipt={receipt} />
                <div className="mx-auto flex max-w-sm flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void printer.print({ elementId: "counter-receipt", lines: receiptLinesForSale(site.name, receipt) })
                    }
                    disabled={printer.busy}
                    className="min-h-11 flex-1 rounded-xl bg-[#183f34] px-4 font-black text-white"
                  >
                    In phiếu thu
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void printer.downloadPdf({
                        lines: receiptLinesForSale(site.name, receipt),
                        fileName: `phieu-thu-${receipt.saleCode}.pdf`,
                      })
                    }
                    disabled={printer.busy}
                    className="min-h-11 rounded-xl border border-[#183f34] bg-white px-4 font-black text-[#183f34]"
                    data-testid="tai-pdf-phieu"
                  >
                    Tải PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 font-black text-[#42574e]"
                  >
                    Đóng
                  </button>
                </div>
                {printer.message ? (
                  <p
                    role={printer.message.tone === "error" ? "alert" : "status"}
                    className={`mx-auto max-w-sm rounded-lg px-3 py-2 text-xs font-bold ${
                      printer.message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
                    }`}
                  >
                    {printer.message.text}
                  </p>
                ) : null}
                {receipt.status !== "voided" && veDienThoai?.saleCode === receipt.saleCode ? (
                  <DuaVeChoKhach
                    className="mx-auto max-w-sm"
                    url={veDienThoai.url}
                    tieuDe="Gửi vé sang điện thoại khách"
                    loiDan="Khách quét mã này bằng camera là có vé trên máy, mất phiếu giấy vẫn vào được. Hoặc gửi đường dẫn qua Zalo."
                    chuChiaSe="Vé Ninh Bình của bạn, mở để xem và lưu:"
                  />
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#b8c6bf] px-4 py-10 text-center text-sm text-[#6e7b75]">
                Bán xong, phiếu thu hiện ở đây: in ra cho khách, hoặc cho khách quét mã để có vé trên điện thoại.
              </p>
            )}
            <ReceiptPrinterSettings printer={printer} onTestPrint={inThu} />
          </div>

          <div className="xl:col-span-2">
            <h3 className="text-lg font-black text-[#20342c]">
              {canVoid ? "Phiếu bán hôm nay tại cơ sở" : "Phiếu bạn đã bán hôm nay"}
            </h3>
            {workspace.sales.length === 0 ? (
              <p className="mt-2 text-sm text-[#6e7b75]">Chưa có phiếu nào hôm nay.</p>
            ) : (
              <div className="mt-3">
              <p className="mb-2 text-xs text-[#5d7268]">
                {workspace.sales.length} phiếu · {formatVnd(workspace.sales.filter((sale) => sale.status !== "voided").reduce((tong, sale) => tong + sale.totalVnd, 0))}
              </p>
              <DanhSachGon
                tenMuc="phiếu"
                soDau={5}
                goiYTim="Tìm theo mã phiếu hay người bán"
                className="divide-y divide-[#e6ebe8] rounded-xl border border-[#e0e6e2]"
                tim={workspace.sales.map((sale) => `${sale.saleCode} ${sale.soldByName}`)}
                muc={workspace.sales.map((sale) => {
                  const daQuaCong = sale.lines.some((line) => line.entriesUsed > 0);
                  const huyDuoc =
                    canVoid && sale.status === "completed" && sale.soldByAccountId !== userId && !daQuaCong;
                  return (
                    <div key={sale.saleCode} className="p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold">{sale.saleCode}</span>
                          {sale.saleKind === "group" ? (
                            <span className="ml-2 rounded-full bg-[#e1edf4] px-2 py-0.5 text-xs font-bold text-[#315f79]">
                              Đoàn · {sale.groupLeaderName}
                              {sale.travelCompany ? ` · ${sale.travelCompany.name}` : ""}
                            </span>
                          ) : sale.saleKind === "comp" ? (
                            <span className="ml-2 rounded-full bg-[#fff0ce] px-2 py-0.5 text-xs font-bold text-[#77531c]">
                              Vé mời · {sale.compInviterName}
                            </span>
                          ) : null}
                          {daQuaCong ? (
                            <span className="ml-2 rounded-full bg-[#e7efe9] px-2 py-0.5 text-xs font-bold text-[#35594b]">Đã qua cổng</span>
                          ) : null}
                          <span className="text-[#6e7b75]">
                            {" "}
                            · {gioVietNam(sale.soldAt)} · {sale.soldByName} · {sale.adults} người lớn
                            {sale.children > 0 ? `, ${sale.children} trẻ` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <strong className="tabular-nums">{formatVnd(sale.totalVnd)}</strong>
                          {sale.status === "voided" ? (
                            <span className="rounded-full bg-[#fdeceb] px-2 py-0.5 text-xs font-black text-[#8b3d31]">Đã huỷ</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => moPhieu(sale)}
                            className="rounded-lg border border-[#ccd8d1] px-2 py-1 text-xs font-black text-[#35594b]"
                          >
                            Xem, in lại
                          </button>
                          {huyDuoc ? (
                            <button
                              type="button"
                              onClick={() => {
                                setVoiding(voiding === sale.saleCode ? null : sale.saleCode);
                                setVoidReason("");
                              }}
                              className="rounded-lg border border-[#e3b8b0] px-2 py-1 text-xs font-black text-[#8b3d31]"
                            >
                              Huỷ phiếu
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {canVoid && sale.status === "completed" && !huyDuoc && sale.soldByAccountId === userId ? (
                        <p className="mt-1 text-xs text-[#7b8881]">
                          {sale.soldByAccountId === userId
                            ? "Phiếu bạn tự bán: cần một quản lý khác huỷ."
                            : null}
                        </p>
                      ) : null}
                      {voiding === sale.saleCode ? (
                        <div className="mt-3 rounded-xl bg-[#fdf3f1] p-3">
                          <label htmlFor={`void-${sale.saleCode}`} className="text-xs font-black text-[#8b3d31]">
                            Lý do huỷ, và đã hoàn tiền cho khách chưa
                          </label>
                          <textarea
                            id={`void-${sale.saleCode}`}
                            value={voidReason}
                            onChange={(event) => setVoidReason(event.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-[#e3b8b0] p-2 text-sm"
                            placeholder="Ví dụ: khách đổi ý trước khi vào cổng, đã hoàn đủ tiền mặt"
                          />
                          <button
                            type="button"
                            disabled={pending || voidReason.trim().length < 10}
                            onClick={() => xacNhanHuy(sale.saleCode)}
                            className="mt-2 min-h-11 rounded-lg bg-[#8b3d31] px-4 text-sm font-black text-white disabled:opacity-50"
                          >
                            {pending ? "Đang huỷ…" : `Huỷ phiếu và hoàn ${formatVnd(sale.totalVnd)}`}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
