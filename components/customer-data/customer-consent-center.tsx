"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
  CUSTOMER_CONSENT_CHANGED_EVENT,
  getOrCreateCustomerAnonymousId,
  isCustomerConsentSurface,
  parseCustomerConsentPreferences,
} from "@/lib/customer-data/browser-tracking";

type ConsentResponse = {
  accepted?: boolean;
  consent?: Record<string, string>;
  error?: { message?: string };
};

export function CustomerConsentCenter() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = parseCustomerConsentPreferences(
        window.localStorage.getItem(CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY),
      );
      if (stored) {
        setHasDecision(true);
        setAnalytics(stored.product_analytics === "granted");
        setMarketing(stored.marketing_communications === "granted");
      } else {
        setOpen(true);
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open || !hasDecision) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasDecision, open]);

  async function save(nextAnalytics: boolean, nextMarketing: boolean) {
    setPending(true);
    setMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-consents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous_id: anonymousId,
          product_analytics: nextAnalytics,
          marketing_communications: nextMarketing,
        }),
      });
      const payload = (await response.json()) as ConsentResponse;
      if (!response.ok || !payload.accepted || !payload.consent) {
        throw new Error(payload.error?.message ?? "Chưa thể lưu lựa chọn quyền riêng tư.");
      }
      window.localStorage.setItem(
        CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
        JSON.stringify(payload.consent),
      );
      setAnalytics(nextAnalytics);
      setMarketing(nextMarketing);
      setHasDecision(true);
      setOpen(false);
      window.dispatchEvent(new Event(CUSTOMER_CONSENT_CHANGED_EVENT));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa thể lưu lựa chọn quyền riêng tư.");
    } finally {
      setPending(false);
    }
  }

  if (!ready || !isCustomerConsentSurface(pathname)) return null;

  if (!hasDecision) {
    return (
      <aside className="fixed inset-x-3 bottom-3 z-[1300] mx-auto max-w-3xl rounded-3xl border border-white/20 bg-[#183f34] p-5 text-white shadow-2xl sm:bottom-5 sm:p-6" aria-label="Lựa chọn quyền riêng tư">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">Quyền riêng tư</p>
        <h2 className="font-display mt-2 text-2xl">Bạn chọn dữ liệu nào được dùng.</h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          Dữ liệu cần thiết chỉ phục vụ hành trình bạn yêu cầu. Phân tích trải nghiệm là lựa chọn riêng; nhận thông tin giới thiệu luôn tắt cho tới khi bạn tự bật.
        </p>
        <Link href="/quyen-rieng-tu" className="mt-2 inline-block text-xs font-bold text-white/80 underline underline-offset-2">Xem thông báo xử lý dữ liệu của Xuân Trường</Link>
        {message ? <p className="mt-3 text-sm text-[#ffd9d1]" role="alert">{message}</p> : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={pending} onClick={() => void save(false, false)} className="min-h-11 rounded-full border border-white/35 px-5 text-sm font-bold disabled:opacity-50">
            Chỉ dùng phần cần thiết
          </button>
          <button type="button" disabled={pending} onClick={() => void save(true, false)} className="min-h-11 rounded-full bg-[#e7c78d] px-5 text-sm font-extrabold text-[#183f34] disabled:opacity-50">
            {pending ? "Đang lưu…" : "Cho phép phân tích"}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-[1200] min-h-10 rounded-full border border-[#b9c5bf] bg-white/95 px-4 text-xs font-bold text-[#29463b] shadow-lg backdrop-blur" aria-label="Mở trung tâm quyền riêng tư">
        Quyền riêng tư
      </button>
      {open ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-[#0f1b17]/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-consent-title" className="w-full max-w-xl rounded-3xl bg-[#fbfaf6] p-6 text-[#17251f] shadow-2xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#5b766b]">Có thể đổi bất cứ lúc nào</p>
                <h2 id="customer-consent-title" className="font-display mt-2 text-3xl text-[#183f34]">Quyền riêng tư của bạn</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-[#cbd2cd]" aria-label="Đóng">×</button>
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex gap-4 rounded-2xl border border-[#d8ded9] bg-white p-4">
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-5 w-5 accent-[#27634f]" />
                <span><strong className="block">Phân tích trải nghiệm</strong><span className="mt-1 block text-sm leading-6 text-[#637068]">Đo trang, phần nội dung và thao tác đã khai báo; không thu nội dung bạn gõ hay liên hệ.</span></span>
              </label>
              <label className="flex gap-4 rounded-2xl border border-[#d8ded9] bg-white p-4">
                <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 h-5 w-5 accent-[#27634f]" />
                <span><strong className="block">Thông tin giới thiệu</strong><span className="mt-1 block text-sm leading-6 text-[#637068]">Chỉ có hiệu lực khi bạn chủ động để lại liên hệ. CUS-05 chưa gửi email hoặc SMS thật.</span></span>
              </label>
            </div>
            {message ? <p className="mt-4 rounded-xl bg-[#fff0ef] p-3 text-sm text-[#8f2f2c]" role="alert">{message}</p> : null}
            <Link href="/quyen-rieng-tu" className="mt-4 inline-block text-xs font-bold text-[#456257] underline underline-offset-2">Xem thông báo xử lý dữ liệu</Link>
            <button type="button" disabled={pending} onClick={() => void save(analytics, marketing)} className="mt-6 min-h-12 w-full rounded-full bg-[#183f34] px-5 font-extrabold text-white disabled:opacity-50">
              {pending ? "Đang lưu…" : "Lưu lựa chọn"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
