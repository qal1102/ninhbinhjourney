"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  listTodayTicketsAction,
  lookupTicketsAction,
  collectOnSitePaymentAction,
  createCounterVisitorGroupAction,
  recordGateScanAction,
  refreshDemoTicketsAction,
} from "@/app/erp/actions";
import { MIN_SCANNED_CODE_LENGTH } from "@/domain/erp-camera-scan";
import type { ErpSite } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import { isDemoTicketCode } from "@/domain/erp-ticket-code";
import type { VisitorGroupStatus } from "@/domain/visitor-group";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { useGateCameraScanner } from "@/lib/erp/use-gate-camera-scanner";
import type {
  GateScanEvent,
  TicketSalesSummary,
  TicketSummary,
} from "@/lib/erp/gate-scan-repository";
import { ShiftCloseSiteWorkflow } from "./shift-close-workflow";
import { OfflineGateConsole } from "./offline-gate-console";
import { CounterSalePanel } from "./counter-sale-panel";
import type { CounterSaleWorkspace } from "@/lib/erp/counter-sale-repository";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  mode: "sales" | "checkin";
  shiftClosures: readonly ShiftCloseRecord[];
  gateScans: readonly GateScanEvent[];
  ticketSales: TicketSalesSummary | null;
  offlineGateEnabled?: boolean;
  counterSale?: CounterSaleWorkspace | null;
};
type Period = "day" | "week" | "month" | "year";

const EMPTY_TICKET_SALES: TicketSalesSummary = {
  periods: [
    { period: "day", label: "Hôm nay", ticketCount: 0, entryCount: 0, changePercent: null },
    { period: "week", label: "7 ngày", ticketCount: 0, entryCount: 0, changePercent: null },
    { period: "month", label: "30 ngày", ticketCount: 0, entryCount: 0, changePercent: null },
    { period: "year", label: "365 ngày", ticketCount: 0, entryCount: 0, changePercent: null },
  ],
  productShares: [],
  recentSales: [],
  truncated: false,
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

export function TicketGuestWorkspace({ site, user, mode, shiftClosures, gateScans, ticketSales, offlineGateEnabled = false, counterSale = null }: Props) {
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
  // TC-18: đoàn mua tại quầy — số người + nhãn đoàn, hệ thống tự sinh mã.
  const [counterPartySize, setCounterPartySize] = useState("");
  const [counterGroupLabel, setCounterGroupLabel] = useState("");
  const [counterPending, setCounterPending] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [counterGroup, setCounterGroup] = useState<VisitorGroupStatus | null>(null);
  // Giữ ngoài state: đổi giá trị này không cần dựng lại màn hình, và nó phải
  // sống sót qua mọi lần dựng lại giữa hai lượt gửi của cùng một tấm phiếu.
  const counterRequestKeyRef = useRef<string | null>(null);
  const [counterQr, setCounterQr] = useState("");
  // TC-16: camera chỉ đổ mã vào đúng ô quét bên dưới, luồng xử lý giữ nguyên.
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useGateCameraScanner(videoRef, setScanCode);
  const isDirector = user.role === "director";
  // Mã QR phóng to để quét bằng điện thoại. Sinh riêng ở kích thước lớn chứ
  // không kéo giãn tấm 160 pixel: kéo giãn thì các ô vuông nhoè cạnh, và đó
  // đúng là thứ làm camera đọc trượt.
  const [zoomedQr, setZoomedQr] = useState<{ code: string; url: string } | null>(null);
  const openTicketQrZoom = useCallback(async (code: string) => {
    try {
      const url = await QRCode.toDataURL(code, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#183f34", light: "#ffffff" },
      });
      setZoomedQr({ code, url });
    } catch {
      // Vẽ hỏng thì thôi, không dựng lớp phủ rỗng cho người dùng nhìn.
    }
  }, []);
  useEffect(() => {
    if (!zoomedQr) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomedQr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedQr]);
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

  // TC-18: vẽ QR thật cho mã đoàn quầy vừa lập, cùng cách vẽ QR vé ở trên.
  useEffect(() => {
    if (!counterGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chưa có phiếu đoàn nào thì dọn QR cũ
      setCounterQr("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(counterGroup.groupCode, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#183f34", light: "#ffffff" },
    }).then((url) => {
      if (active) setCounterQr(url);
    });
    return () => {
      active = false;
    };
  }, [counterGroup]);

  async function submitCounterGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const partySize = Number(counterPartySize);
    // Khoá chống lập trùng: giữ nguyên qua mọi lần gửi lại của CÙNG một tấm
    // phiếu, chỉ đổi khi đã lập xong. Nút tự khoá lúc đang chờ chỉ chặn được
    // cú bấm thứ hai trên cùng màn hình; nó không chặn được lượt gửi lại sau
    // khi kết nối 4G ở quầy rơi giữa chừng — và tấm phiếu thừa ấy cộng thẳng
    // vào ô "vé đã bán" của giám đốc.
    const key = counterRequestKeyRef.current ?? crypto.randomUUID();
    counterRequestKeyRef.current = key;
    setCounterPending(true);
    try {
      const result = await createCounterVisitorGroupAction({
        siteId: site.id,
        partySize,
        groupLabel: counterGroupLabel,
        idempotencyKey: key,
      });
      if (result.ok) {
        setCounterGroup(result.status);
        setCounterMessage("");
        setCounterPartySize("");
        setCounterGroupLabel("");
        // Phiếu đã lập xong: tấm tiếp theo phải mang khoá mới, không thì máy
        // chủ lại trả về đúng tấm vừa rồi.
        counterRequestKeyRef.current = null;
      } else {
        setCounterGroup(null);
        setCounterMessage(result.message);
      }
    } finally {
      setCounterPending(false);
    }
  }

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

  async function recordScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = scanCode.trim().toUpperCase();
    if (normalized.length < MIN_SCANNED_CODE_LENGTH) { setScanMessage("Mã QR không hợp lệ."); return; }
    // Ghi nhận xong là xong việc của camera; đừng để đèn camera sáng tiếp.
    camera.stop();
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
            {/* TC-16: nút luôn hiện. Máy nào không quét được thì bấm vào là
                biết vì sao, hơn hẳn một nút biến mất không lời giải thích. */}
            <button
              type="button"
              onClick={camera.toggle}
              className="min-h-12 rounded-xl border border-white/25 px-5 font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183f34]"
            >
              {camera.open ? "Đóng camera" : "Quét bằng camera"}
            </button>
          </form>
          {camera.open ? (
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
              <p className="bg-black/60 px-3 py-2 text-xs text-white/80">Mời bạn đưa mã QR vào giữa khung hình, máy tự đọc ạ.</p>
            </div>
          ) : null}
          {camera.message ? <p role="status" className="mt-2 text-xs leading-5 text-white/80">{camera.message}</p> : null}
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
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Vé còn hiệu lực hôm nay</p>
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
              /* Chỗ này là lý do chủ dự án nói "quét cái gì". Toàn bộ vé mẫu
                 hết hiệu lực từ đầu tháng 8, nên danh sách rỗng và màn hình
                 không có một mã QR nào để chĩa điện thoại vào. Nút kéo vé về
                 thì có, nhưng nó là một nút nhỏ nằm trên tiêu đề, và một câu
                 chữ xám mách nước ở dưới — người dùng thật không thấy.
                 Nay lời mời làm việc ấy trở thành hành động chính, to và rõ. */
              <div className="mt-3 rounded-2xl border border-white/20 bg-white/8 p-4">
                <p className="text-sm font-bold text-white/90">
                  {todayTicketsMessage || "Hôm nay chưa có vé nào còn hiệu lực tại cơ sở này."}
                </p>
                {isDirector ? (
                  <>
                    <p className="mt-2 text-xs leading-5 text-white/70">
                      Muốn thử quét thì bấm nút dưới đây: hệ thống kéo bộ vé mẫu về đúng ngày hôm nay và hiện mã QR ngay tại đây. Bạn mở màn hình này trên máy tính rồi dùng điện thoại quét chính mã ấy là chạy trọn vòng.
                    </p>
                    <button
                      type="button"
                      onClick={handleRefreshDemoTickets}
                      disabled={refreshPending}
                      className="mt-3 min-h-12 w-full rounded-xl bg-white px-5 font-black text-[#183f34] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183f34] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    >
                      {refreshPending ? "Đang kéo vé mẫu về…" : "Kéo vé mẫu về hôm nay để quét thử"}
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-white/70">
                    Bạn vẫn quét được vé khách đưa: nhập mã vào ô phía trên, hoặc tra theo tên và số điện thoại ở mục bên dưới. Riêng vé mẫu để tập quét thì chỉ giám đốc kéo về được.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayTickets.map((ticket) => (
                  <div
                    key={ticket.ticketCode}
                    className="flex items-center gap-3 rounded-xl bg-white/95 p-3 text-left text-[#183f34]"
                  >
                    {/* Bấm vào QR là phóng to. Mã 64 pixel trên màn hình thì
                        mắt người đọc được, còn camera điện thoại chĩa vào rất
                        khó bắt nét — mà quét bằng điện thoại mới đúng là việc
                        màn hình này sinh ra để làm. */}
                    <button
                      type="button"
                      onClick={() => void openTicketQrZoom(ticket.ticketCode)}
                      title="Phóng to mã QR để quét bằng điện thoại"
                      className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
                    >
                      {qrDataUrls[ticket.ticketCode] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not an optimizable asset
                        <img src={qrDataUrls[ticket.ticketCode]} alt={`Phóng to mã QR của vé ${ticket.ticketCode}`} className="h-16 w-16 rounded-md" />
                      ) : (
                        <span className="grid h-16 w-16 place-items-center rounded-md bg-[#eef3f0] text-[10px] text-[#7b8881]">Đang tạo QR…</span>
                      )}
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-black">{ticket.ticketCode}</span>
                        {isDemoTicketCode(ticket.ticketCode) ? (
                          <span className="shrink-0 rounded-full bg-[#fdf0dd] px-2 py-0.5 text-[10px] font-black text-[#8a5e30]">mẫu</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-[#dff1e8] px-2 py-0.5 text-[10px] font-black text-[#246249]">khách thật</span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-[#5c6f67]">{TICKET_PRODUCT_LABELS[ticket.product] ?? ticket.product} · còn {ticket.entriesAllowed - ticket.entriesUsed} lượt</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setScanCode(ticket.ticketCode)}
                          className="min-h-9 rounded-lg bg-[#183f34] px-3 text-xs font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
                        >
                          Đưa vào ô quét
                        </button>
                        <button
                          type="button"
                          onClick={() => void openTicketQrZoom(ticket.ticketCode)}
                          className="min-h-9 rounded-lg border border-[#c3d2cb] px-3 text-xs font-black text-[#2c463c] outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
                        >
                          Phóng to QR
                        </button>
                      </span>
                    </span>
                  </div>
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

      {/* QA-ERP-POS-04: bán vé tại quầy có thu tiền mặt. Đứng trước phiếu đoàn
          vì đây là việc quầy làm nhiều nhất trong ngày. */}
      {mode === "sales" ? (
        <CounterSalePanel site={site} userId={user.id} userRole={user.role} workspace={counterSale ?? null} />
      ) : null}

      {/* TC-18: đoàn mua tại quầy — vẫn là logic đoàn trưởng, chỉ khác chỗ
          treo vé. Mã đoàn và mã từng người luôn do máy sinh (ERP-UX-06):
          không có ô nào cho gõ tay mã. */}
      {mode === "sales" ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Đoàn mua tại quầy</p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">Lập phiếu đoàn, đưa QR cho khách</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6f67]">
            Nhập số người và một nhãn để dễ nhận ra đoàn này — ví dụ nơi xuất phát
            hoặc tên đoàn. Hệ thống tự sinh mã đoàn và mã riêng cho từng người;
            đoàn trưởng có thể tự điền tên từng người sau, hoặc bỏ qua — ai chưa
            điền vẫn đi tham quan bình thường.
          </p>
          <form onSubmit={submitCounterGroup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-xs font-bold text-[#5c6f67] sm:w-32">
              Số người
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={45}
                required
                value={counterPartySize}
                onChange={(event) => setCounterPartySize(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#d8e0db] px-3 text-[#20342c]"
                placeholder="Ví dụ: 32"
              />
            </label>
            <label className="min-w-0 flex-1 text-xs font-bold text-[#5c6f67]">
              Nhãn đoàn
              <input
                type="text"
                required
                maxLength={120}
                value={counterGroupLabel}
                onChange={(event) => setCounterGroupLabel(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#d8e0db] px-3 text-[#20342c]"
                placeholder="Ví dụ: Đoàn Hà Nội – công ty ABC"
              />
            </label>
            <button
              type="submit"
              disabled={counterPending}
              className="min-h-11 rounded-xl bg-[#183f34] px-5 font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[#183f34] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {counterPending ? "Đang lập phiếu…" : "Lập phiếu đoàn"}
            </button>
          </form>
          {counterMessage ? (
            <p role="alert" className="mt-3 rounded-xl bg-[#fdeceb] px-4 py-3 text-sm font-bold text-[#8b3d31]">
              {counterMessage}
            </p>
          ) : null}
          {counterGroup ? (
            <div className="mt-4 flex flex-col items-start gap-4 rounded-xl border border-[#d8e0db] bg-[#f3f6f4] p-4 sm:flex-row sm:items-center">
              {counterQr ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not an optimizable asset
                <img src={counterQr} alt={`Mã QR đoàn ${counterGroup.groupCode}`} className="h-32 w-32 shrink-0 rounded-lg bg-white p-2" />
              ) : null}
              <div className="min-w-0">
                <p className="font-mono text-lg font-black text-[#183f34]">{counterGroup.groupCode}</p>
                <p className="mt-1 text-sm text-[#3f524a]">
                  {counterGroup.groupLabel} · {counterGroup.memberCount.toLocaleString("vi-VN")} người
                </p>
                <p className="mt-2 text-xs leading-5 text-[#7b8881]">
                  Đưa mã QR này cho khách quét ở cổng. Đoàn trưởng có thể tự điền
                  tên từng người tại trang <span className="font-mono">/doan/{counterGroup.groupCode}</span>.
                </p>
              </div>
            </div>
          ) : null}
        </section>
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
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <article className="rounded-xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">Lượt khách được vào</p>
            <p className="mt-2 text-2xl font-black">{selected.entryCount.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#8a958f]">cộng số lượt ghi trên từng vé</p>
          </article>
          <article className="rounded-xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">Tấm vé đã phát</p>
            <p className="mt-2 text-2xl font-black">{selected.ticketCount.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#8a958f]">một vé đoàn là một tấm, dù cho nhiều người vào</p>
          </article>
          <article className="col-span-2 rounded-xl bg-[#f3f6f4] p-4 lg:col-span-1">
            <p className="text-xs text-[#718078]">Lượt khách so kỳ liền trước</p>
            <p className={`mt-2 text-sm font-black ${selected.changePercent === null ? "text-[#7b8881]" : selected.changePercent >= 0 ? "text-[#2d735b]" : "text-[#8b3d31]"}`}>
              {formatChange(selected.changePercent)}
            </p>
          </article>
        </div>
        {sales.truncated ? (
          <p role="alert" className="mt-4 rounded-xl bg-[#fdeceb] px-4 py-3 text-xs font-bold leading-5 text-[#8b3d31]">
            Số vé quá nhiều để đọc hết một lần, nên các con số trên đang thấp hơn
            thực tế. Xin báo bộ phận kỹ thuật chuyển phép đếm này vào kho dữ liệu.
          </p>
        ) : null}
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
                    <strong className="text-right">
                      {item.entryCount.toLocaleString("vi-VN")} lượt · {item.sharePercent}%
                      <span className="block text-xs font-bold text-[#7b8881]">
                        {item.ticketCount.toLocaleString("vi-VN")} tấm vé
                      </span>
                    </strong>
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

      {/* Chủ dự án nói thẳng: "account giám đốc có thể check luôn mấy chức
          năng đó cho lẹ nhé tao đã nói rồi." Đúng — họ đăng nhập bằng đúng
          một tài khoản, và một màn hình ẩn với tài khoản ấy là một màn hình
          không tồn tại. Chốt ca vốn là việc của người trực, nhưng giám đốc
          phải xem và thử được, nên bỏ hàng rào vai ở đây. */}
      {mode === "sales" ? (
        <ShiftCloseSiteWorkflow
          site={site}
          user={user}
          records={shiftClosures}
        />
      ) : null}

      {zoomedQr ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Mã QR của vé ${zoomedQr.code}`}
          onClick={() => setZoomedQr(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 text-center text-[#183f34]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not an optimizable asset */}
            <img src={zoomedQr.url} alt={`Mã QR của vé ${zoomedQr.code}`} className="mx-auto w-full max-w-xs" />
            <p className="mt-3 font-mono text-sm font-black">{zoomedQr.code}</p>
            <p className="mt-2 text-xs leading-5 text-[#5c6f67]">
              Mời bạn mở màn hình này trên máy tính rồi dùng điện thoại quét chính mã trên đây — đúng như khách chìa mã ở cổng.
            </p>
            <button
              type="button"
              onClick={() => setZoomedQr(null)}
              className="mt-4 min-h-12 w-full rounded-xl bg-[#183f34] px-5 font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
