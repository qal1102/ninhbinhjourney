"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OfflineGateDeviceState, OfflineGateQueueItem } from "@/domain/offline-gate";
import {
  digestTicketCode,
  loadOfflineGateState,
  saveOfflineGateState,
  stateWithManifest,
  stateWithQueuedScan,
  stateWithSyncResult,
} from "@/lib/erp/offline-gate-store";

const RESULT_LABELS = {
  accepted: "Tạm hợp lệ theo bộ vé của ca — cho khách vào và chờ máy chủ đối soát.",
  "not-found": "Không có trong bộ vé đã nạp — tạm từ chối và chờ máy chủ đối soát.",
  exhausted: "Vé đã hết lượt theo hàng đợi trên máy này — tạm từ chối.",
} as const;

export function OfflineGateConsole({ siteId, siteName }: { siteId: string; siteName: string }) {
  const router = useRouter();
  const [state, setState] = useState<OfflineGateDeviceState | null>(null);
  const [online, setOnline] = useState(true);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manifestActive, setManifestActive] = useState(false);
  const automaticSyncKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    loadOfflineGateState(siteId)
      .then((loaded) => {
        if (!active) return;
        setState(loaded);
        setManifestActive(Boolean(loaded.manifest && Date.parse(loaded.manifest.expiresAt) > Date.now()));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Không mở được kho ngoại tuyến."); });
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [siteId]);

  const pending = useMemo(() => state?.scans.filter((scan) => scan.syncStatus === "pending") ?? [], [state]);
  const diverged = useMemo(() => state?.scans.filter((scan) => scan.syncStatus === "diverged") ?? [], [state]);

  useEffect(() => {
    if (!state?.manifest || !manifestActive) return;
    const remainingMs = Date.parse(state.manifest.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setManifestActive(false), Math.max(remainingMs, 0));
    return () => window.clearTimeout(timer);
  }, [manifestActive, state?.manifest]);

  async function prepareManifest() {
    if (!state || !online) return;
    setBusy(true);
    try {
      if (pending.length > 0) {
        setMessage("Cần đồng bộ hết hàng đợi cũ trước khi nạp bộ vé mới.");
        return;
      }
      const response = await fetch("/api/erp/offline-gate/manifests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, deviceId: state.deviceId }),
      });
      if (!response.ok) throw new Error("Chưa nạp được bộ vé ngoại tuyến từ máy chủ.");
      const manifest = await response.json();
      const next = stateWithManifest(state, manifest);
      await saveOfflineGateState(next);
      setState(next);
      setManifestActive(true);
      setMessage(`Đã nạp ${manifest.ticketCount} vé tối thiểu, không gồm tên hay số điện thoại.`);
      setRefused(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa nạp được bộ vé ngoại tuyến.");
      setRefused(true);
    } finally {
      setBusy(false);
    }
  }

  async function queueScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state?.manifest || !manifestActive) {
      setMessage("Chưa có bộ vé còn hiệu lực. Hãy nạp vé khi đang có mạng trước ca.");
      setRefused(true);
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 6 || normalized.length > 60) {
      setMessage("Mã QR không hợp lệ.");
      setRefused(true);
      return;
    }
    setBusy(true);
    try {
      const codeDigest = await digestTicketCode(normalized);
      const queued = stateWithQueuedScan({
        state,
        code: normalized,
        codeDigest,
        scannedAt: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
      await saveOfflineGateState(queued.state);
      setState(queued.state);
      setMessage(RESULT_LABELS[queued.item.localResult]);
      setRefused(queued.item.localResult !== "accepted");
      setCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa ghi được vào hàng đợi ngoại tuyến.");
      setRefused(true);
    } finally {
      setBusy(false);
    }
  }

  const syncPending = useCallback(async (scans: readonly OfflineGateQueueItem[]) => {
    if (!state?.manifest || !online || scans.length === 0) return;
    setBusy(true);
    try {
      const batch = scans.slice(0, 200);
      // The first UUID is stable while the batch remains pending. If the
      // response is lost after commit, retrying reaches the same server batch.
      const response = await fetch("/api/erp/offline-gate/sync", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId, manifestId: state.manifest.manifestId, deviceId: state.deviceId,
          batchId: batch[0].idempotencyKey, scans: batch,
        }),
      });
      if (!response.ok) throw new Error("Mạng chưa ổn định; hàng đợi vẫn được giữ trên máy.");
      const result = await response.json();
      const next = stateWithSyncResult(state, result);
      await saveOfflineGateState(next);
      setState(next);
      setMessage(result.divergedCount > 0
        ? `Đã đồng bộ ${result.itemCount} lượt; ${result.divergedCount} lượt khác phán quyết cục bộ và cần quản lý xem.`
        : `Đã đồng bộ đủ ${result.itemCount} lượt, không mất hoặc ghi trùng.`);
      setRefused(result.divergedCount > 0);
      router.refresh();
    } catch {
      setMessage("Mạng chưa ổn định; hàng đợi vẫn được giữ trên máy.");
      setRefused(true);
    } finally {
      setBusy(false);
    }
  }, [online, router, siteId, state]);

  useEffect(() => {
    if (!online || busy || pending.length === 0) return;
    const syncKey = pending.slice(0, 200).map((scan) => scan.idempotencyKey).join(":");
    if (automaticSyncKey.current === syncKey) return;
    automaticSyncKey.current = syncKey;
    void syncPending(pending);
  }, [busy, online, pending, syncPending]);

  return (
    <section className="rounded-3xl border border-[#b8c9c2] bg-[#f5f8f6] p-5 shadow-sm sm:p-6" data-testid="offline-gate-console">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4b7566]">A3 · Cổng ngoại tuyến · {siteName}</p>
          <h2 className="mt-2 text-2xl font-black text-[#183f34]">Quét tiếp khi mất mạng</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c6f67]">Nạp trước bộ vé không PII. Lúc offline, quyết định là tạm thời; máy chủ T8 đối soát lại từng lượt khi có mạng và giữ nguyên khóa chống trùng.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${online ? "bg-[#dcefe7] text-[#226046]" : "bg-[#fff0cf] text-[#775217]"}`}>
          {online ? "Có mạng" : "Đang offline"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#718078]">Bộ vé</p><strong className="mt-1 block">{manifestActive ? `${state?.manifest?.ticketCount ?? 0} vé · còn hiệu lực` : "Chưa nạp / đã hết hạn"}</strong></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#718078]">Chờ đồng bộ</p><strong className="mt-1 block">{pending.length} lượt</strong></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#718078]">Sai lệch cần xem</p><strong className="mt-1 block">{diverged.length} lượt</strong></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={prepareManifest} disabled={!online || busy || !state} className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-50">Nạp vé cho ca</button>
        <button type="button" onClick={() => syncPending(pending)} disabled={!online || busy || pending.length === 0} className="min-h-11 rounded-xl border border-[#8da69c] px-4 text-sm font-black text-[#183f34] disabled:opacity-50">Đồng bộ {pending.length || ""}</button>
      </div>

      <form onSubmit={queueScan} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#b8c9c2] bg-white px-4 font-mono text-[#183f34]" placeholder="Quét hoặc nhập mã vé" />
        <button type="submit" disabled={busy || !manifestActive} className="min-h-12 rounded-xl bg-[#e7c78d] px-5 font-black text-[#3f321d] disabled:opacity-50">Ghi vào hàng đợi</button>
      </form>
      {message ? <p role={refused ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${refused ? "bg-[#fff0eb] text-[#873f31]" : "bg-[#e6f1eb] text-[#285b49]"}`}>{message}</p> : null}
      {state?.manifest ? <p className="mt-3 text-xs text-[#74827c]">Manifest {state.manifest.manifestId.slice(0, 8).toUpperCase()} · hết hạn {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(state.manifest.expiresAt))}</p> : null}
    </section>
  );
}
