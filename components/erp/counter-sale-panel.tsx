"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createCounterSaleAction,
  voidCounterSaleAction,
} from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import {
  COUNTER_PRODUCT_LABELS,
  COUNTER_SALE_MAX_PARTY,
  computeCounterCart,
  counterCashSuggestions,
  counterChange,
  counterSaleReadiness,
  formatVnd,
  type CounterPrice,
  type CounterSaleReceipt,
} from "@/domain/erp-counter-sale";

type Workspace =
  | { available: true; prices: CounterPrice[]; sales: CounterSaleReceipt[] }
  | { available: false; message: string };

type Props = {
  site: ErpSite;
  userId: string;
  userRole: string;
  workspace: Workspace | null;
};

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
          aria-label={`Bớt một vé ${label.toLowerCase()}`}
          className="h-11 w-11 rounded-xl border border-[#ccd8d1] bg-white text-xl font-black text-[#183f34]"
        >
          −
        </button>
        <output aria-live="polite" className="min-w-10 text-center text-2xl font-black tabular-nums text-[#183f34]">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(COUNTER_SALE_MAX_PARTY, value + 1))}
          aria-label={`Thêm một vé ${label.toLowerCase()}`}
          className="h-11 w-11 rounded-xl border border-[#ccd8d1] bg-white text-xl font-black text-[#183f34]"
        >
          +
        </button>
        <div className="flex w-full gap-1 sm:ml-1 sm:w-auto">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-9 min-w-9 flex-1 rounded-lg px-2 text-sm font-black sm:flex-none ${
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
function ReceiptSheet({ site, receipt }: { site: ErpSite; receipt: CounterSaleReceipt }) {
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
      data-print-receipt
      className="mx-auto w-full max-w-sm rounded-2xl border border-[#d8e0db] bg-white p-5 text-[#1d2925] shadow-sm"
    >
      <header className="border-b border-dashed border-[#b8c6bf] pb-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em]">Phiếu thu bán vé</p>
        <p className="mt-1 text-lg font-black">{site.name}</p>
        <p className="mt-1 font-mono text-sm font-bold">{receipt.saleCode}</p>
        <p className="text-xs text-[#5c6f67]">{gioVietNam(receipt.soldAt)}</p>
        {daHuy ? (
          <p className="mt-2 rounded-lg border-2 border-[#8b3d31] px-2 py-1 text-base font-black uppercase tracking-[0.2em] text-[#8b3d31]">
            Đã huỷ
          </p>
        ) : null}
      </header>

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
        <div className="flex justify-between font-black">
          <dt>Tổng tiền</dt>
          <dd>{formatVnd(receipt.totalVnd)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Khách đưa</dt>
          <dd>{formatVnd(receipt.cashReceivedVnd)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Tiền thối</dt>
          <dd>{formatVnd(receipt.changeVnd)}</dd>
        </div>
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

      <p className="mt-4 border-t border-dashed border-[#b8c6bf] pt-2 text-center text-[11px] leading-4 text-[#5c6f67]">
        Phiếu thu bán vé, không phải hoá đơn giá trị gia tăng. Vé chỉ dùng trong
        ngày ghi trên phiếu. Cảm ơn quý khách.
      </p>
    </article>
  );
}

export function CounterSalePanel({ site, userId, userRole, workspace }: Props) {
  const router = useRouter();
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cashText, setCashText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<CounterSaleReceipt | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();
  // Một khoá cho mỗi tấm phiếu đang soạn. Mạng lỡ nhịp mà nhân viên bấm lại thì
  // máy chủ trả đúng phiếu cũ, không bán lần hai.
  const requestKey = useRef(khoaMoi());

  const prices = useMemo(() => (workspace?.available ? workspace.prices : []), [workspace]);
  const cart = useMemo(() => computeCounterCart({ adults, children, prices }), [adults, children, prices]);
  const cash = Number(cashText.replace(/[^0-9]/g, "")) || 0;
  const change = counterChange(cash, cart.totalVnd);
  const readiness = counterSaleReadiness({ cart, cashReceivedVnd: cash, cashCountedConfirmed: confirmed });
  const canVoid = userRole === "manager" || userRole === "director";

  // Đổi số vé hay số tiền thì lời xác nhận cũ không còn đúng với con số mới.
  function doiSo(fn: () => void) {
    fn();
    setConfirmed(false);
  }

  function soanPhieuMoi() {
    setAdults(1);
    setChildren(0);
    setCashText("");
    setConfirmed(false);
    requestKey.current = khoaMoi();
  }

  function xacNhanBan() {
    if (!readiness.ok || pending) return;
    setMessage(null);
    startTransition(async () => {
      const ketQua = await createCounterSaleAction({
        siteId: site.id,
        adults: cart.lines.find((l) => l.product === "adult")?.quantity ?? 0,
        children: cart.lines.find((l) => l.product === "child")?.quantity ?? 0,
        cashReceivedVnd: cash,
        cashCountedConfirmed: confirmed,
        requestKey: requestKey.current,
      });
      if (ketQua.ok) {
        setReceipt(ketQua.receipt);
        setMessage({ tone: "ok", text: ketQua.message });
        soanPhieuMoi();
        router.refresh();
      } else {
        setMessage({ tone: "error", text: ketQua.message });
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
      {/* Chỉ in đúng phiếu thu, không in cả màn hình ERP. */}
      <style>{`@media print { body * { visibility: hidden !important; } [data-print-receipt], [data-print-receipt] * { visibility: visible !important; } [data-print-receipt] { position: absolute; left: 0; top: 0; width: 80mm; max-width: 80mm; border: 0; box-shadow: none; } }`}</style>

      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Bán vé tại quầy</p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">Ra đơn, thu tiền mặt, đưa vé cho khách</h2>

      {!workspace || !workspace.available ? (
        <p className="mt-4 rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
          {workspace && !workspace.available
            ? workspace.message
            : "Quầy bán vé chưa nối được vào kho dữ liệu ở môi trường này, nên chưa bán được vé."}
        </p>
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
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
              </p>
            </div>

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
              <div className="mt-2 flex flex-wrap gap-2">
                {counterCashSuggestions(cart.totalVnd).map((goiY) => (
                  <button
                    key={goiY}
                    type="button"
                    onClick={() => doiSo(() => setCashText(String(goiY)))}
                    className="min-h-9 rounded-lg bg-[#eef3f0] px-3 text-sm font-black text-[#35594b]"
                  >
                    {goiY === cart.totalVnd ? "Đủ tiền" : formatVnd(goiY)}
                  </button>
                ))}
              </div>
              <p className={`mt-2 text-lg font-black tabular-nums ${change === null ? "text-[#8b3d31]" : "text-[#2d735b]"}`}>
                {cash === 0
                  ? "Chưa nhập tiền khách đưa"
                  : change === null
                    ? `Còn thiếu ${formatVnd(cart.totalVnd - cash)}`
                    : `Tiền thối lại: ${formatVnd(change)}`}
              </p>
            </div>

            <label className="flex gap-3 rounded-xl border-2 border-[#e7c78d] bg-[#fff8eb] p-4 text-sm leading-6 text-[#5d5037]">
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
              className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang lưu phiếu…" : "Xác nhận bán"}
            </button>
            {!readiness.ok ? (
              <p className="text-sm text-[#6e7b75]">{readiness.reason}</p>
            ) : null}
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
              <>
                <ReceiptSheet site={site} receipt={receipt} />
                <div className="mx-auto flex max-w-sm gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-11 flex-1 rounded-xl bg-[#183f34] px-4 font-black text-white"
                  >
                    In phiếu thu
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 font-black text-[#42574e]"
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[#b8c6bf] px-4 py-10 text-center text-sm text-[#6e7b75]">
                Bán xong, phiếu thu và mã QR hiện ở đây để đưa khách quét hoặc in ra.
              </p>
            )}
          </div>

          <div className="xl:col-span-2">
            <h3 className="text-lg font-black text-[#20342c]">
              {canVoid ? "Phiếu bán hôm nay tại cơ sở" : "Phiếu bạn đã bán hôm nay"}
            </h3>
            {workspace.sales.length === 0 ? (
              <p className="mt-2 text-sm text-[#6e7b75]">Chưa có phiếu nào hôm nay.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#e6ebe8] rounded-xl border border-[#e0e6e2]">
                {workspace.sales.map((sale) => {
                  const daQuaCong = sale.lines.some((line) => line.entriesUsed > 0);
                  const huyDuoc =
                    canVoid && sale.status === "completed" && sale.soldByAccountId !== userId && !daQuaCong;
                  return (
                    <li key={sale.saleCode} className="p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold">{sale.saleCode}</span>
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
                            onClick={() => setReceipt(sale)}
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
                      {canVoid && sale.status === "completed" && !huyDuoc ? (
                        <p className="mt-1 text-xs text-[#7b8881]">
                          {sale.soldByAccountId === userId
                            ? "Phiếu bạn tự bán: cần một quản lý khác huỷ."
                            : daQuaCong
                              ? "Khách đã qua cổng, không huỷ được."
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
                            className="mt-2 min-h-10 rounded-lg bg-[#8b3d31] px-4 text-sm font-black text-white disabled:opacity-50"
                          >
                            {pending ? "Đang huỷ…" : `Huỷ phiếu và hoàn ${formatVnd(sale.totalVnd)}`}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
