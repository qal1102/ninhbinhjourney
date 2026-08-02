"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lookupTicketsAction, recordGateScanAction } from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type {
  GateScanEvent,
  TicketSalesSummary,
  TicketSummary,
} from "@/lib/erp/gate-scan-repository";
import { ShiftCloseSiteWorkflow } from "./shift-close-workflow";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  mode: "sales" | "checkin";
  shiftClosures: readonly ShiftCloseRecord[];
  gateScans: readonly GateScanEvent[];
  ticketSales: TicketSalesSummary | null;
};
type Period = "day" | "week" | "month" | "year";

const EMPTY_TICKET_SALES: TicketSalesSummary = {
  periods: [
    { period: "day", label: "Hôm nay", ticketCount: 0, changePercent: null },
    { period: "week", label: "7 ngày", ticketCount: 0, changePercent: null },
    { period: "month", label: "30 ngày", ticketCount: 0, changePercent: null },
    { period: "year", label: "365 ngày", ticketCount: 0, changePercent: null },
  ],
  productShares: [],
  recentSales: [],
};

function formatChange(percent: number | null) {
  if (percent === null) return "Chưa đủ dữ liệu kỳ trước để so sánh";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("vi-VN")}% so với kỳ liền trước`;
}

export function TicketGuestWorkspace({ site, user, mode, shiftClosures, gateScans, ticketSales }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("day");
  const [scanCode, setScanCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanRefused, setScanRefused] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<TicketSummary[]>([]);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const sales = ticketSales ?? EMPTY_TICKET_SALES;
  const selected = sales.periods.find((item) => item.period === period) ?? sales.periods[0];

async function recordScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = scanCode.trim().toUpperCase();
    if (normalized.length < 6) { setScanMessage("Mã QR không hợp lệ."); return; }
    setScanPending(true);
    try {
      // T8: one key per attempt, so a retry after a dropped response returns
      // the first outcome instead of admitting the same person twice. The gate
      // is exactly where the network is worst.
      const result = await recordGateScanAction({
        siteId: site.id,
        code: normalized,
        idempotencyKey: `${site.id}:${normalized}:${Date.now()}`,
      });
      setScanMessage(result.message);
      setScanRefused(!result.success);
      if (result.success) {
        setScanCode("");
      }
      router.refresh();
    } finally {
      setScanPending(false);
    }
  }

  async function lookupGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = lookupQuery.trim();
    if (query.length < 3) {
      setLookupMessage("Nhập ít nhất 3 ký tự của mã vé, tên khách hoặc số điện thoại.");
      setLookupResults([]);
      return;
    }
    setLookupPending(true);
    try {
      const result = await lookupTicketsAction({ siteId: site.id, query });
      setLookupResults(result.tickets);
      setLookupMessage(result.message);
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {mode === "checkin" ? <section className="rounded-3xl bg-[#183f34] p-5 text-white sm:p-7"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#acd1c3]">Cổng A · {site.shortName}</p><h2 className="mt-2 text-3xl font-black">Quét và ghi nhận QR</h2><form onSubmit={recordScan} className="mt-5 flex flex-col gap-2 sm:flex-row"><input value={scanCode} onChange={(event) => setScanCode(event.target.value)} required autoComplete="off" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 font-mono text-white placeholder:text-white/40" placeholder="Đưa mã vào máy quét hoặc nhập mã QR" /><button type="submit" disabled={scanPending} className="min-h-12 rounded-xl bg-white px-5 font-black text-[#183f34] disabled:cursor-wait disabled:opacity-60">{scanPending ? "Đang ghi nhận..." : "Xác thực & ghi nhận"}</button></form>{scanMessage ? <p role={scanRefused ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${scanRefused ? "bg-[#7d3226] text-[#ffd9d1]" : "bg-white/10"}`}>{scanMessage}</p> : null}<div className="mt-6 border-t border-white/15 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Khách mất mã — tra theo tên hoặc số điện thoại</p>
          <form onSubmit={lookupGuest} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/40" placeholder="Mã vé, tên khách, số điện thoại hoặc mã đặt chỗ" />
            <button type="submit" disabled={lookupPending} className="min-h-11 rounded-xl border border-white/25 px-5 font-black text-white disabled:cursor-wait disabled:opacity-60">{lookupPending ? "Đang tra..." : "Tra cứu"}</button>
          </form>
          {lookupMessage ? <p role="status" className="mt-2 text-xs text-white/70">{lookupMessage}</p> : null}
          {lookupResults.length > 0 ? <ul className="mt-3 space-y-2">{lookupResults.map((ticket) => <li key={ticket.ticketCode} className="rounded-lg bg-white/7 px-3 py-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-bold">{ticket.ticketCode}</span><button type="button" onClick={() => setScanCode(ticket.ticketCode)} className="rounded-md bg-white px-2 py-1 font-black text-[#183f34]">Đưa vào ô quét</button></div><p className="mt-1 text-white/70">{ticket.guestName || "Không có tên"} · {ticket.guestPhone || "Không có SĐT"} · {ticket.entriesUsed}/{ticket.entriesAllowed} lượt · hiệu lực {ticket.validOn}</p></li>)}</ul> : null}
        </div>{gateScans.length > 0 ? <div className="mt-5 border-t border-white/15 pt-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Quét gần nhất · toàn cơ sở</p><ul className="mt-3 space-y-2">{gateScans.map((scan) => <li key={scan.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/7 px-3 py-2 text-xs"><span className="font-mono font-bold">{scan.code}</span><span className="text-white/70">{scan.scannedByName} · {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(scan.scannedAt))}</span></li>)}</ul></div> : null}</section> : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Vé đã bán</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">{selected.label}</h2>
          </div>
          <div className="grid grid-cols-4 rounded-xl bg-[#f0f4f1] p-1">
            {(["day", "week", "month", "year"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setPeriod(item)} className={`min-h-9 rounded-lg px-2 text-xs font-black ${period === item ? "bg-[#183f34] text-white" : "text-[#65756e]"}`}>
                {item === "day" ? "Ngày" : item === "week" ? "Tuần" : item === "month" ? "Tháng" : "Năm"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-2">
          <article className="rounded-xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">Số vé phát hành</p>
            <p className="mt-2 text-2xl font-black">{selected.ticketCount.toLocaleString("vi-VN")}</p>
          </article>
          <article className="rounded-xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">So kỳ liền trước</p>
            <p className={`mt-2 text-sm font-black ${selected.changePercent === null ? "text-[#7b8881]" : selected.changePercent >= 0 ? "text-[#2d735b]" : "text-[#8b3d31]"}`}>
              {formatChange(selected.changePercent)}
            </p>
          </article>
        </div>
        <p className="mt-4 text-xs text-[#8a958f]">
          Đếm trực tiếp từ vé đã phát hành, không phải doanh thu quy đổi — hệ
          thống chưa lưu giá bán trên từng vé.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Cơ cấu sản phẩm · 30 ngày gần nhất</p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">Loại vé đang bán chạy</h2>
          {sales.productShares.length === 0 ? (
            <p className="mt-5 text-sm text-[#7b8881]">Chưa có vé nào phát hành trong 30 ngày gần nhất.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {sales.productShares.map((item) => (
                <div key={item.product} className="rounded-xl border border-[#e0e6e2] p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-black text-[#30443b]">{item.productLabel}</p>
                    <strong>{item.count} vé · {item.sharePercent}%</strong>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]">
                    <div className="h-full rounded-full bg-[#397a62]" style={{ width: `${item.sharePercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Vé phát hành gần nhất</p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">Từ mã QR đến đối soát</h2>
          {sales.recentSales.length === 0 ? (
            <p className="mt-5 text-sm text-[#7b8881]">Chưa có vé nào được phát hành.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {sales.recentSales.map((item) => (
                <details key={item.ticketCode} className="rounded-xl border border-[#e0e6e2] p-4">
                  <summary className="flex cursor-pointer list-none justify-between gap-3">
                    <div>
                      <p className="font-black text-[#30443b]">{item.ticketCode} · {item.productLabel}</p>
                      <p className="mt-1 text-xs text-[#7b8881]">
                        {item.channelLabel} · {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(item.issuedAt))}
                      </p>
                    </div>
                  </summary>
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e6ebe8] pt-3 text-xs">
                    <div><dt className="text-[#849089]">Trạng thái</dt><dd className="mt-1 font-bold">{item.status}</dd></div>
                    <div><dt className="text-[#849089]">Khách</dt><dd className="mt-1 font-bold">{item.guestName || "Không có tên"}</dd></div>
                  </dl>
                </details>
              ))}
            </div>
          )}
        </article>
      </section>

      {mode === "sales" && (user.role === "employee" || user.role === "manager") ? (
        <ShiftCloseSiteWorkflow
          site={site}
          user={user}
          records={shiftClosures}
        />
      ) : null}
    </div>
  );
}
