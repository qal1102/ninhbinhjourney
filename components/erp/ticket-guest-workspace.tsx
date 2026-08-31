"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  listTodayTicketsAction,
  lookupTicketsAction,
  collectOnSitePaymentAction,
  recordGateScanAction,
  refreshDemoTicketsAction,
} from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type {
  GateScanEvent,
  TicketSalesSummary,
  TicketSummary,
} from "@/lib/erp/gate-scan-repository";
import { ShiftCloseSiteWorkflow } from "./shift-close-workflow";
import { OfflineGateConsole } from "./offline-gate-console";

/**
 * Trình duyệt chưa đưa BarcodeDetector vào kiểu DOM có sẵn, nên khai báo tối
 * thiểu ở đây — giống cách components/ops/check-in-console.tsx đã làm — để
 * dùng API thật của Chrome trên Android mà không cần thêm gói nào.
 */
type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorConstructor = new (input?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  mode: "sales" | "checkin";
  shiftClosures: readonly ShiftCloseRecord[];
  gateScans: readonly GateScanEvent[];
  ticketSales: TicketSalesSummary | null;
  offlineGateEnabled?: boolean;
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

/**
 * Nhãn hiển thị cho từng loại vé trong danh sách "quét thử được hôm nay".
 * Mirror thủ công PRODUCT_LABELS trong lib/erp/gate-scan-repository.ts vì
 * hằng số đó không export — đây chỉ là chữ hiển thị, sai thì hiện mã gốc
 * chứ không ảnh hưởng nghiệp vụ.
 */
const TICKET_PRODUCT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  adult: "Vé người lớn",
  child: "Vé trẻ em",
  combo: "Combo vé + thuyền/xe",
  group: "Vé đoàn",
  guest: "Vé khách mời",
});

function formatChange(percent: number | null) {
  if (percent === null) return "Chưa đủ dữ liệu kỳ trước để so sánh";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("vi-VN")}% so với kỳ liền trước`;
}

export function TicketGuestWorkspace({ site, user, mode, shiftClosures, gateScans, ticketSales, offlineGateEnabled = false }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("day");
  const [scanCode, setScanCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanRefused, setScanRefused] = useState(false);
  // TC-22: mã vừa quét đang nợ tiền. Giữ lại mã và số tiền để nút "đã thu"
  // biết thu cho ai — nhân viên không phải gõ lại mã lần nữa.
  const [scanDue, setScanDue] = useState<{ code: string; amountVnd: number } | null>(null);
  const [collectPending, setCollectPending] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<TicketSummary[]>([]);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [todayTickets, setTodayTickets] = useState<TicketSummary[]>([]);
  const [todayTicketsMessage, setTodayTicketsMessage] = useState("");
  const [todayTicketsPending, setTodayTicketsPending] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const isDirector = user.role === "director";
  const sales = ticketSales ?? EMPTY_TICKET_SALES;
  const selected = sales.periods.find((item) => item.period === period) ?? sales.periods[0];

  const loadTodayTickets = useCallback(async () => {
    setTodayTicketsPending(true);
    try {
      const result = await listTodayTicketsAction({ siteId: site.id });
      setTodayTickets(result.tickets);
      setTodayTicketsMessage(result.message);
    } finally {
      setTodayTicketsPending(false);
    }
  }, [site.id]);

  useEffect(() => {
    if (mode !== "checkin") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách vé ngay khi mở màn hình soát vé
    void loadTodayTickets();
  }, [mode, loadTodayTickets]);

  // Vẽ QR thật cho từng mã vé còn hiệu lực hôm nay, cùng cách pass-experience.tsx
  // đang vẽ QR cho vé khách — không thêm gói đọc/vẽ mã nào khác.
  useEffect(() => {
    if (todayTickets.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- danh sách vé vừa rỗng thì dọn QR cũ theo
      setQrDataUrls({});
      return;
    }
    let active = true;
    void Promise.all(
      todayTickets.map(async (ticket) => {
        const url = await QRCode.toDataURL(ticket.ticketCode, {
          width: 160,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#183f34", light: "#ffffff" },
        });
        return [ticket.ticketCode, url] as const;
      }),
    ).then((pairs) => {
      if (active) setQrDataUrls(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [todayTickets]);

  async function handleRefreshDemoTickets() {
    setRefreshPending(true);
    try {
      const result = await refreshDemoTicketsAction();
      if (result.ok) {
        await loadTodayTickets();
      } else {
        setTodayTicketsMessage(result.message);
      }
    } finally {
      setRefreshPending(false);
    }
  }

  useEffect(() => {
    const detectorAvailable =
      typeof window !== "undefined" &&
      Boolean(
        (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor })
          .BarcodeDetector,
      );
    const mediaAvailable =
      typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chỉ trình duyệt mới biết máy có hỗ trợ camera hay không
    setCameraSupported(detectorAvailable && mediaAvailable);
  }, []);

  async function startCameraScan() {
    setCameraMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraMessage("Bạn chưa cho phép dùng camera. Mời bạn gõ mã vào ô bên dưới.");
      setCameraOpen(false);
    }
  }

  function stopCameraScan() {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  // Vòng quét chạy khi camera mở: đọc liên tục cho tới khi thấy mã hoặc bị đóng.
  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    const Detector = (
      window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const found = await detector.detect(videoRef.current);
        const raw = found[0]?.rawValue?.trim();
        if (raw) {
          setScanCode(raw.toUpperCase());
          stopCameraScan();
        }
      } catch {
        // Đọc thoáng qua bị lỗi (khung mờ, chưa lấy nét) thì bỏ qua, vòng quét vẫn tiếp tục.
      }
    }, 350);
    scanIntervalRef.current = timer;
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraOpen]);

  // Tắt hẳn camera khi rời trang hoặc component gỡ khỏi cây, đừng để đèn camera sáng mãi.
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current !== null) window.clearInterval(scanIntervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      setScanDue(
        result.decision?.result === "payment-due"
          ? { code: result.decision.code, amountVnd: result.decision.paymentDueVnd }
          : null,
      );
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
      {mode === "checkin" && offlineGateEnabled ? <OfflineGateConsole siteId={site.id} siteName={site.shortName} /> : null}
      {mode === "checkin" ? (
        <section className="rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#acd1c3]">Cổng A · {site.shortName}</p>
          <h2 className="mt-2 text-3xl font-black">Quét và ghi nhận QR</h2>
          <form onSubmit={recordScan} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input value={scanCode} onChange={(event) => setScanCode(event.target.value)} required autoComplete="off" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 font-mono text-white placeholder:text-white/40" placeholder="Đưa mã vào máy quét hoặc nhập mã QR" />
            <button type="submit" disabled={scanPending} className="min-h-12 rounded-xl bg-white px-5 font-black text-[#183f34] disabled:cursor-wait disabled:opacity-60">{scanPending ? "Đang ghi nhận..." : "Xác thực & ghi nhận"}</button>
            {cameraSupported ? (
              <button
                type="button"
                onClick={() => (cameraOpen ? stopCameraScan() : startCameraScan())}
                className="min-h-12 rounded-xl border border-white/25 px-5 font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183f34]"
              >
                {cameraOpen ? "Đóng camera" : "Quét bằng camera"}
              </button>
            ) : null}
          </form>
          {cameraOpen ? (
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
              <p className="bg-black/60 px-3 py-2 text-xs text-white/80">Mời bạn đưa mã QR vào giữa khung hình, máy tự đọc ạ.</p>
            </div>
          ) : null}
          {cameraMessage ? <p role="status" className="mt-2 text-xs text-white/70">{cameraMessage}</p> : null}
          {scanMessage ? <p role={scanRefused ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${scanRefused ? "bg-[#7d3226] text-[#ffd9d1]" : "bg-white/10"}`}>{scanMessage}</p> : null}
          {/* TC-22: khách chọn trả tiền tại điểm. Ô này chỉ hiện đúng lúc cần,
              và ghi rõ số tiền — nhân viên đứng ở cổng không có thời gian đi
              tra xem phải thu bao nhiêu. */}
          {scanDue ? (
            <div className="mt-3 rounded-xl border border-[#e6c07a]/60 bg-[#5a4620]/60 px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f0d79a]">Chưa thu tiền</p>
              <p className="mt-2 text-2xl font-black text-white">
                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(scanDue.amountVnd)}
              </p>
              <p className="mt-1 font-mono text-xs text-white/70">{scanDue.code}</p>
              <button
                type="button"
                disabled={collectPending}
                onClick={async () => {
                  setCollectPending(true);
                  try {
                    const ket_qua = await collectOnSitePaymentAction({ siteId: site.id, code: scanDue.code });
                    setScanMessage(ket_qua.message);
                    setScanRefused(!ket_qua.ok);
                    if (ket_qua.ok) {
                      setScanDue(null);
                      setScanCode(scanDue.code);
                    }
                    router.refresh();
                  } finally {
                    setCollectPending(false);
                  }
                }}
                className="mt-4 min-h-12 w-full rounded-xl bg-white px-5 text-sm font-black text-[#3f3016] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {collectPending ? "Đang ghi nhận…" : "Đã thu tiền"}
              </button>
              <p className="mt-3 text-xs leading-5 text-white/65">
                Ghi nhận xong, mã quay lại ô quét. Bạn quét thêm một lượt nữa là khách vào được ạ.
              </p>
            </div>
          ) : null}
          <div className="mt-6 border-t border-white/15 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Vé quét thử được hôm nay</p>
              {isDirector ? (
                <button
                  type="button"
                  onClick={handleRefreshDemoTickets}
                  disabled={refreshPending}
                  className="min-h-9 rounded-lg border border-white/25 px-3 text-xs font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183f34] disabled:cursor-wait disabled:opacity-60"
                >
                  {refreshPending ? "Đang làm mới…" : "Làm mới vé mẫu"}
                </button>
              ) : null}
            </div>
            {todayTicketsPending ? (
              <p className="mt-3 text-xs text-white/70">Đang tải danh sách vé…</p>
            ) : todayTickets.length === 0 ? (
              <p className="mt-3 text-xs text-white/70">
                {todayTicketsMessage || "Hôm nay chưa có vé nào còn hiệu lực tại cơ sở này."}{" "}
                {isDirector ? "Mời bạn bấm nút làm mới vé mẫu ở trên." : "Mời bạn nhờ giám đốc bấm nút làm mới vé mẫu."}
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayTickets.map((ticket) => (
                  <button
                    key={ticket.ticketCode}
                    type="button"
                    onClick={() => setScanCode(ticket.ticketCode)}
                    className="flex items-center gap-3 rounded-xl bg-white/95 p-3 text-left text-[#183f34] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183f34]"
                  >
                    {qrDataUrls[ticket.ticketCode] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not an optimizable asset
                      <img src={qrDataUrls[ticket.ticketCode]} alt={`Mã QR của vé ${ticket.ticketCode}`} className="h-16 w-16 shrink-0 rounded-md" />
                    ) : (
                      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-[#eef3f0] text-[10px] text-[#7b8881]">Đang tạo QR…</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm font-black">{ticket.ticketCode}</span>
                      <span className="mt-1 block text-xs text-[#5c6f67]">{TICKET_PRODUCT_LABELS[ticket.product] ?? ticket.product} · còn {ticket.entriesAllowed - ticket.entriesUsed} lượt</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 border-t border-white/15 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Khách mất mã — tra theo tên hoặc số điện thoại</p>
          <form onSubmit={lookupGuest} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/40" placeholder="Mã vé, tên khách, số điện thoại hoặc mã đặt chỗ" />
            <button type="submit" disabled={lookupPending} className="min-h-11 rounded-xl border border-white/25 px-5 font-black text-white disabled:cursor-wait disabled:opacity-60">{lookupPending ? "Đang tra..." : "Tra cứu"}</button>
          </form>
          {lookupMessage ? <p role="status" className="mt-2 text-xs text-white/70">{lookupMessage}</p> : null}
          {lookupResults.length > 0 ? <ul className="mt-3 space-y-2">{lookupResults.map((ticket) => <li key={ticket.ticketCode} className="rounded-lg bg-white/7 px-3 py-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-bold">{ticket.ticketCode}</span><button type="button" onClick={() => setScanCode(ticket.ticketCode)} className="rounded-md bg-white px-2 py-1 font-black text-[#183f34]">Đưa vào ô quét</button></div><p className="mt-1 text-white/70">{ticket.guestName || "Không có tên"} · {ticket.guestPhone || "Không có SĐT"} · {ticket.entriesUsed}/{ticket.entriesAllowed} lượt · hiệu lực {ticket.validOn}</p></li>)}</ul> : null}
        </div>{gateScans.length > 0 ? <div className="mt-5 border-t border-white/15 pt-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Quét gần nhất · toàn cơ sở</p><ul className="mt-3 space-y-2">{gateScans.map((scan) => <li key={scan.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/7 px-3 py-2 text-xs"><span className="font-mono font-bold">{scan.code}</span><span className="text-white/70">{scan.scannedByName} · {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(scan.scannedAt))}</span></li>)}</ul></div> : null}</section>
      ) : null}

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
