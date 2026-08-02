"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { lookupTicketsAction, recordGateScanAction } from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import { ERP_SITE_FINANCE } from "@/domain/erp-operating-data";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type {
  GateScanEvent,
  TicketSummary,
} from "@/lib/erp/gate-scan-repository";
import { ShiftCloseSiteWorkflow } from "./shift-close-workflow";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  mode: "sales" | "checkin";
  shiftClosures: readonly ShiftCloseRecord[];
  gateScans: readonly GateScanEvent[];
};
type Period = "day" | "week" | "month" | "year";

const products = [
  ["Vé người lớn", 46, "120.000 đ", "Không hoàn sau khi qua cổng"],
  ["Combo vé + thuyền/xe", 28, "250.000 đ", "Đổi giờ trước 60 phút"],
  ["Vé trẻ em", 14, "60.000 đ", "Đối chiếu chiều cao tại cổng"],
  ["Vé đoàn", 12, "98.000 đ", "Từ 20 khách · đối soát theo hợp đồng"],
] as const;

const transactions = [
  { code: "NB-82431", product: "Combo vé + thuyền/xe", channel: "Quầy vé A", quantity: 2, total: "500.000 đ", payment: "Thẻ", employee: "Đỗ Thị Lan", time: "10:05", status: "Đã qua cổng", qr: "QR-NB-82431-02" },
  { code: "NB-82424", product: "Vé đoàn", channel: "Đối tác TA-018", quantity: 42, total: "4.116.000 đ", payment: "Công nợ", employee: "Trần Minh Anh", time: "09:10", status: "Đã nhận 38/42", qr: "GROUP-TA018-82424" },
  { code: "NB-82419", product: "Vé người lớn", channel: "Website", quantity: 6, total: "720.000 đ", payment: "Chuyển khoản", employee: "Hệ thống", time: "08:20", status: "Đã qua cổng", qr: "WEB-NB-82419" },
] as const;

export function TicketGuestWorkspace({ site, user, mode, shiftClosures, gateScans }: Props) {
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
  const baseRevenue = ERP_SITE_FINANCE.find((item) => item.id === site.id)!.revenueMillion;
  const values = useMemo(() => ({
    day: { label: "Hôm nay", revenue: `${baseRevenue} triệu`, tickets: site.snapshot.visitors.toLocaleString("vi-VN"), compare: "+5,2% so với cùng thứ tuần trước", average: "+7,1% so với bình quân ngày 3 năm" },
    week: { label: "7 ngày", revenue: `${(baseRevenue * 6.4 / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`, tickets: Math.round(site.snapshot.visitors * 6.1).toLocaleString("vi-VN"), compare: "+6,8% so với tuần trước", average: "+4,6% so với bình quân tuần 3 năm" },
    month: { label: "Tháng 7", revenue: `${(baseRevenue * 20 / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`, tickets: Math.round(site.snapshot.visitors * 19.4).toLocaleString("vi-VN"), compare: "+8,4% so với tháng trước", average: "+11,2% so với bình quân tháng 3 năm" },
    year: { label: "Năm 2026", revenue: `${(baseRevenue * 150 / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`, tickets: Math.round(site.snapshot.visitors * 147).toLocaleString("vi-VN"), compare: "+12,6% so với cùng kỳ 2025", average: "+15,3% so với bình quân năm 2023–2025" },
  }), [baseRevenue, site.snapshot.visitors]);
  const selected = values[period];

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

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Vé & doanh thu</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">{selected.label}</h2></div><div className="grid grid-cols-4 rounded-xl bg-[#f0f4f1] p-1">{(["day", "week", "month", "year"] as const).map((item) => <button key={item} type="button" onClick={() => setPeriod(item)} className={`min-h-9 rounded-lg px-2 text-xs font-black ${period === item ? "bg-[#183f34] text-white" : "text-[#65756e]"}`}>{item === "day" ? "Ngày" : item === "week" ? "Tuần" : item === "month" ? "Tháng" : "Năm"}</button>)}</div></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><article className="rounded-xl bg-[#f3f6f4] p-4"><p className="text-xs text-[#718078]">Doanh thu</p><p className="mt-2 text-2xl font-black">{selected.revenue}</p></article><article className="rounded-xl bg-[#f3f6f4] p-4"><p className="text-xs text-[#718078]">Số vé</p><p className="mt-2 text-2xl font-black">{selected.tickets}</p></article><article className="rounded-xl bg-[#f3f6f4] p-4"><p className="text-xs text-[#718078]">So kỳ trước</p><p className="mt-2 text-sm font-black text-[#2d735b]">{selected.compare}</p></article><article className="rounded-xl bg-[#f3f6f4] p-4"><p className="text-xs text-[#718078]">So bình quân</p><p className="mt-2 text-sm font-black text-[#2d735b]">{selected.average}</p></article></div></section>

      <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Cơ cấu sản phẩm</p><h2 className="mt-2 text-xl font-black text-[#20342c]">Loại vé và chính sách</h2><div className="mt-5 space-y-4">{products.map(([name, share, price, policy]) => <details key={name} className="rounded-xl border border-[#e0e6e2] p-4"><summary className="cursor-pointer list-none"><div className="flex justify-between gap-3"><div><p className="font-black text-[#30443b]">{name}</p><p className="mt-1 text-xs text-[#7b8881]">{price}</p></div><strong>{share}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#397a62]" style={{ width: `${share}%` }} /></div></summary><div className="mt-3 border-t border-[#e6ebe8] pt-3 text-sm text-[#607068]"><p><strong>Chính sách:</strong> {policy}</p><p className="mt-2"><strong>Tài khoản doanh thu:</strong> 5111 · Thuế GTGT theo cấu hình sản phẩm</p></div></details>)}</div></article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Giao dịch gần nhất</p><h2 className="mt-2 text-xl font-black text-[#20342c]">Từ mã QR đến đối soát</h2><div className="mt-5 space-y-3">{transactions.map((item) => <details key={item.code} className="rounded-xl border border-[#e0e6e2] p-4"><summary className="flex cursor-pointer list-none justify-between gap-3"><div><p className="font-black text-[#30443b]">{item.code} · {item.product}</p><p className="mt-1 text-xs text-[#7b8881]">{item.channel} · {item.time}</p></div><span className="text-sm font-black">{item.total}</span></summary><dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e6ebe8] pt-3 text-xs"><div><dt className="text-[#849089]">QR</dt><dd className="mt-1 font-mono font-bold">{item.qr}</dd></div><div><dt className="text-[#849089]">Trạng thái</dt><dd className="mt-1 font-bold">{item.status}</dd></div><div><dt className="text-[#849089]">Thanh toán</dt><dd className="mt-1 font-bold">{item.payment}</dd></div><div><dt className="text-[#849089]">Người ghi nhận</dt><dd className="mt-1 font-bold">{item.employee}</dd></div></dl></details>)}</div></article></section>

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
