"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ErpRole } from "@/domain/erp";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ErpAppControls({ role }: { role: ErpRole }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("default");
  const [inbox, setInbox] = useState<{
    count: number;
    items: { label: string; count: number; href: string; hrefLabel: string }[];
  } | null>(null);
  const [noticeLoaded, setNoticeLoaded] = useState(false);

  useEffect(() => {
    const environmentTimer = window.setTimeout(() => {
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
      setNotificationState("Notification" in window ? Notification.permission : "unsupported");
    }, 0);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }

    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const installed = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.clearTimeout(environmentTimer);
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/erp/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: "inbox" }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          count?: number;
          items?: { label: string; count: number; href: string; hrefLabel: string }[];
        };
      })
      .then((payload) => {
        if (!payload || !active) return;
        setInbox({
          count: payload.count ?? 0,
          items: payload.items ?? [],
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (active) setNoticeLoaded(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstallEvent(null);
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    if (permission === "granted") {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Đã bật thông báo điều hành", {
        body: "Các việc vượt ngưỡng sẽ xuất hiện tại trung tâm thông báo.",
        icon: "/brand/pwa-192.png",
        badge: "/brand/pwa-192.png",
        data: { url: "/erp" },
      });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!isStandalone && installEvent ? (
        <button type="button" onClick={installApp} className="hidden min-h-10 rounded-xl border border-[#ced8d1] px-3 text-sm font-bold text-[#43554e] hover:bg-[#f4f7f5] sm:block">
          Cài lên máy
        </button>
      ) : null}

      <details className="group relative">
        <summary aria-label="Mở trung tâm thông báo" className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-[#ced8d1] bg-white text-[#385047] transition hover:bg-[#f4f7f5]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          {inbox && inbox.count > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-[#c8523c] px-0.5 text-[9px] font-black leading-none text-white">
              {inbox.count > 9 ? "9+" : inbox.count}
            </span>
          ) : null}
        </summary>
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#d7dfda] bg-white p-4 shadow-2xl shadow-[#173f34]/15">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#477565]">Thông báo</p><h2 className="mt-1 text-lg font-black text-[#21372e]">{role === "director" ? "Việc cần quyết định" : role === "manager" ? "Việc cần điều phối" : role === "chief-accountant" ? "Việc cần duyệt" : role === "accountant" ? "Việc cần kiểm tra" : "Việc của tôi"}</h2></div>
          </div>
          {!noticeLoaded ? (
            <p className="mt-4 rounded-xl bg-[#f1f5f2] px-4 py-5 text-center text-sm leading-6 text-[#65746d]">
              Đang đọc hàng việc…
            </p>
          ) : inbox && inbox.items.some((item) => item.count > 0) ? (
            <ul className="mt-4 space-y-2">
              {inbox.items
                .filter((item) => item.count > 0)
                .map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f5f2] p-3 transition hover:bg-[#e6ede8]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-[#2d4038]">
                          {item.label}
                        </span>
                        <span className="block text-xs text-[#6d7a73]">
                          {item.hrefLabel}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#285e4b]">
                        {item.count}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : inbox ? (
            <p className="mt-4 rounded-xl bg-[#f1f5f2] px-4 py-5 text-center text-sm leading-6 text-[#65746d]">
              Không có việc gấp đang chờ tài khoản này.
            </p>
          ) : (
            <p className="mt-4 rounded-xl bg-[#f1f5f2] px-4 py-5 text-center text-sm leading-6 text-[#65746d]">
              Chưa đọc được hàng việc lúc này.
            </p>
          )}
          {notificationState === "default" ? (
            <button type="button" onClick={enableNotifications} className="mt-3 min-h-10 w-full rounded-xl bg-[#183f34] px-4 text-sm font-black text-white">Bật thông báo trên thiết bị</button>
          ) : null}
          {notificationState === "granted" ? <p className="mt-3 text-center text-xs font-bold text-[#34715b]">Thiết bị đã cho phép thông báo</p> : null}
          {notificationState === "denied" ? <p className="mt-3 text-xs leading-5 text-[#8b4a3e]">Thông báo đang bị chặn trong cài đặt trình duyệt.</p> : null}
          {!isStandalone && isIOS ? <p className="mt-3 border-t border-[#e7ece9] pt-3 text-xs leading-5 text-[#6e7b75]">Trên iPhone: Chia sẻ → Thêm vào Màn hình chính.</p> : null}
        </div>
      </details>
    </div>
  );
}
