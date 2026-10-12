"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { nhanBaoDongAction } from "@/app/erp/khan-cap-actions";
import { banDoTai, docBaoDong, giayDaQua, tenLoaiKhanCap, type BaoDong } from "@/domain/khan-cap";

/**
 * Cảnh báo khẩn cấp cho cấp trên (giám đốc, quản lý cơ sở), migration 121.
 *
 * Hỏi kho mỗi 8 giây (và ngay khi quay lại tab). Có báo động chưa ai nhận thì
 * hộp cảnh báo đỏ bật lên trên mọi thứ (kể cả bản đồ), máy rung lặp lại, kêu
 * tiếng báo và hiện thông báo hệ thống. Đóng hộp thì còn một dải đỏ bám đầu
 * màn, vẫn rung: chỉ bấm "Đã nhận" mới tắt. Người nhận trước thì máy khác
 * cũng tắt ở lần hỏi kế tiếp.
 */

const HOI_MS = 8000;
const NHIP_RUNG_MS = 4000;

function gio(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function daQuaChu(giay: number) {
  if (giay < 60) return `${giay} giây trước`;
  return `${Math.floor(giay / 60)} phút ${giay % 60} giây trước`;
}

/** Tiếng báo ngắn bằng WebAudio, không cần tệp âm thanh. Trình duyệt chặn thì im. */
function keu(ctxRef: { current: AudioContext | null }) {
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctx) return;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    void ctx.resume();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // Không phát được tiếng: rung và hộp cảnh báo vẫn còn.
  }
}

export function CanhBaoKhanCap() {
  const hop = useRef<HTMLDialogElement>(null);
  const [ds, setDs] = useState<BaoDong[]>([]);
  const [lech, setLech] = useState(0);
  const [bayGio, setBayGio] = useState(0);
  const [loi, setLoi] = useState("");
  const [dang, batDau] = useTransition();
  const daThongBao = useRef(new Set<string>());
  const am = useRef<AudioContext | null>(null);
  const tieuDeGoc = useRef<string | null>(null);

  const hoi = useCallback(async () => {
    try {
      const res = await fetch("/api/erp/khan-cap", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; baoDong?: unknown[]; bayGio?: string };
      if (!data.ok || !Array.isArray(data.baoDong)) return;
      const moi = data.baoDong.map(docBaoDong).filter((b): b is BaoDong => b !== null);
      if (data.bayGio) setLech(Date.parse(data.bayGio) - Date.now());
      setDs(moi);
    } catch {
      // Mạng chập chờn: lần hỏi sau lấy lại.
    }
  }, []);

  useEffect(() => {
    // Hỏi lần đầu ngay sau khi dựng xong, rồi đều đặn mỗi 8 giây.
    const dau = window.setTimeout(hoi, 0);
    const id = window.setInterval(hoi, HOI_MS);
    const khiHien = () => {
      if (document.visibilityState === "visible") void hoi();
    };
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      window.clearTimeout(dau);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", khiHien);
    };
  }, [hoi]);

  // Có báo động mới: mở hộp, thông báo hệ thống một lần cho mỗi mã.
  useEffect(() => {
    if (ds.length === 0) {
      if (hop.current?.open) hop.current.close();
      if (tieuDeGoc.current !== null) {
        document.title = tieuDeGoc.current;
        tieuDeGoc.current = null;
      }
      return;
    }
    const coMoi = ds.some((b) => !daThongBao.current.has(b.ma));
    if (coMoi && hop.current && !hop.current.open) hop.current.showModal();
    if (tieuDeGoc.current === null) tieuDeGoc.current = document.title;
    document.title = `(${ds.length}) KHẨN CẤP · ${tieuDeGoc.current}`;
    for (const b of ds) {
      if (daThongBao.current.has(b.ma)) continue;
      daThongBao.current.add(b.ma);
      keu(am);
      if ("Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
        void navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(`BÁO KHẨN CẤP · ${b.siteName}`, {
              body: `${tenLoaiKhanCap(b.loai)}. ${b.nguoiBaoTen} báo${b.ghiChu ? `: ${b.ghiChu}` : "."}`,
              tag: `khan-cap-${b.ma}`,
              requireInteraction: true,
              icon: "/brand/erp-192.png",
              badge: "/brand/erp-192.png",
              data: { url: `/erp?khanCap=${b.ma}` },
              // `vibrate` có ở Chrome Android dù chưa vào kiểu chuẩn của TypeScript.
              ...({ vibrate: [500, 200, 500, 200, 1000], renotify: true } as object),
            }),
          )
          .catch(() => undefined);
      }
    }
  }, [ds]);

  // Còn báo động chưa nhận: rung và kêu lặp lại, đồng hồ chạy.
  useEffect(() => {
    if (ds.length === 0) return;
    const rung = () => {
      if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 800]);
    };
    rung();
    const r = window.setInterval(() => {
      rung();
      keu(am);
    }, NHIP_RUNG_MS);
    const d = window.setInterval(() => setBayGio(Date.now() + lech), 1000);
    return () => {
      window.clearInterval(r);
      window.clearInterval(d);
      if ("vibrate" in navigator) navigator.vibrate(0);
    };
  }, [ds.length, lech]);

  function nhan(ma: string) {
    setLoi("");
    batDau(async () => {
      const kq = await nhanBaoDongAction(ma);
      if (!kq.ok) {
        setLoi(kq.message);
        return;
      }
      setDs((cu) => cu.filter((b) => b.ma !== ma));
      void hoi();
    });
  }

  if (ds.length === 0) {
    return <dialog ref={hop} className="hidden" aria-hidden="true" />;
  }

  const giay = (b: BaoDong) => (bayGio ? giayDaQua(b.baoLuc, bayGio) : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => hop.current?.showModal()}
        className="sticky top-16 z-30 flex min-h-12 w-full items-center justify-center gap-2 bg-[#c62828] px-4 text-sm font-black text-white motion-safe:animate-pulse"
        data-testid="dai-canh-bao-khan-cap"
      >
        {ds.length} báo khẩn cấp chưa ai nhận · {ds[0].siteName} · bấm để xem và nhận
      </button>
      <dialog
        ref={hop}
        aria-labelledby="canh-bao-khan-cap-tieu-de"
        onClick={(e) => {
          if (e.target === e.currentTarget) hop.current?.close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-white p-0 text-[#20342c] shadow-2xl backdrop:bg-[#2a0b08]/75"
        data-testid="hop-canh-bao-khan-cap"
      >
        <div className="flex items-center justify-between gap-3 bg-[#c62828] px-5 py-4 text-white">
          <h2 id="canh-bao-khan-cap-tieu-de" className="text-lg font-black">
            BÁO KHẨN CẤP · {ds.length} chưa nhận
          </h2>
          <button type="button" onClick={() => hop.current?.close()} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-xl font-black" aria-label="Thu nhỏ">
            ×
          </button>
        </div>
        <ul className="divide-y divide-[#f0d6d3]">
          {ds.map((b) => (
            <li key={b.ma} className="space-y-3 p-5">
              <div>
                <p className="text-xl font-black text-[#8b1f1a]">{tenLoaiKhanCap(b.loai)}</p>
                <p className="mt-1 text-sm text-[#42554c]">
                  {b.siteName} · {b.nguoiBaoTen} báo lúc {gio(b.baoLuc)} · <span aria-live="polite">{daQuaChu(giay(b))}</span>
                </p>
                {b.ghiChu ? <p className="mt-2 rounded-xl bg-[#fbf3f2] px-3 py-2 text-sm">{b.ghiChu}</p> : null}
              </div>
              {b.anhUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư, đường dẫn ký có hạn
                <img src={b.anhUrl} alt="Ảnh hiện trường người báo vừa chụp" className="max-h-64 w-full rounded-2xl object-cover" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => nhan(b.ma)}
                  disabled={dang}
                  className="min-h-12 flex-1 rounded-2xl bg-[#c62828] px-5 text-base font-black text-white disabled:opacity-60"
                  data-testid="nut-da-nhan-khan-cap"
                >
                  Đã nhận
                </button>
                {b.viDo !== null && b.kinhDo !== null ? (
                  <a
                    href={banDoTai(b.viDo, b.kinhDo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-2xl border-2 border-[#183f34] px-4 text-sm font-black text-[#183f34]"
                  >
                    Mở bản đồ{b.saiSoM ? ` · ±${b.saiSoM} m` : ""}
                  </a>
                ) : (
                  <span className="inline-flex min-h-12 items-center text-xs text-[#8a6d3b]">Người báo chưa gửi được vị trí</span>
                )}
              </div>
              {b.incidentId ? (
                <p className="text-xs text-[#6e7b75]">
                  Đã mở hồ sơ sự cố P1 {b.incidentId}; xử lý tiếp ở màn Sự cố của cơ sở.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {loi ? (
          <p role="alert" className="mx-5 mb-5 rounded-xl bg-[#fdecea] px-3 py-2 text-sm font-bold text-[#8b1f1a]">
            {loi}
          </p>
        ) : null}
      </dialog>
    </>
  );
}
