"use client";

import { useEffect, useState } from "react";
import type { ErpRole } from "@/domain/erp";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const alertsByRole: Record<ErpRole, Array<{ title: string; detail: string; tone: string }>> = {
  director: [
    { title: "Quản lý Tam Chúc đề nghị tăng cường", detail: "Bổ sung 4 xe trước 09:30 · Chờ phê duyệt", tone: "bg-[#c85b45]" },
    { title: "Yêu cầu chấp nhận rủi ro mở cửa", detail: "Một điểm mù liên lạc chưa đạt Go/No-Go", tone: "bg-[#d09b3f]" },
    { title: "Phương án xử lý chênh lệch tài chính", detail: "46 triệu · 8 giao dịch đã được phân loại", tone: "bg-[#477e6c]" },
  ],
  manager: [
    { title: "Khu vực bến gần ngưỡng sức chứa", detail: "83% · Cần điều phối trước 09:30", tone: "bg-[#c85b45]" },
    { title: "Một điều kiện đầu ca chưa đạt", detail: "Phân công người kiểm tra điểm mù liên lạc", tone: "bg-[#d09b3f]" },
    { title: "8 giao dịch cần đối chiếu", detail: "Giao kế toán ca xử lý trước 11:00", tone: "bg-[#477e6c]" },
  ],
  accountant: [
    { title: "12 hóa đơn điện tử truyền lỗi", detail: "38,6 triệu · Cần gửi lại trước 11:00", tone: "bg-[#c85b45]" },
    { title: "Hai bộ hồ sơ chưa đủ điều kiện", detail: "Thiếu biên bản nghiệm thu và giải trình chênh lệch", tone: "bg-[#d09b3f]" },
    { title: "Đối soát cổng vé Tràng An đã khớp", detail: "79,4 triệu · Sẵn sàng lập bút toán", tone: "bg-[#477e6c]" },
  ],
  employee: [
    { title: "Bạn có một việc mới", detail: "Kiểm tra làn đón khách A trước 09:20", tone: "bg-[#39749a]" },
    { title: "Sắp đến giờ bàn giao", detail: "Cập nhật bằng chứng cho việc đang mở", tone: "bg-[#d09b3f]" },
    { title: "Ca làm đã được xác nhận", detail: "07:30–12:15 · Đúng cơ sở được phân công", tone: "bg-[#477e6c]" },
  ],
};

export function ErpAppControls({ role }: { role: ErpRole }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("default");
  const alerts = alertsByRole[role];

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
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#c8523c]" />
        </summary>
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#d7dfda] bg-white p-4 shadow-2xl shadow-[#173f34]/15">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#477565]">Thông báo</p><h2 className="mt-1 text-lg font-black text-[#21372e]">{role === "director" ? "Chờ quyết định" : role === "manager" ? "Cần điều phối" : role === "accountant" ? "Cần kiểm tra" : "Việc của tôi"}</h2></div>
            <span className="rounded-full bg-[#ffe8e2] px-2.5 py-1 text-xs font-black text-[#934638]">3 mới</span>
          </div>
          <ol className="mt-3 divide-y divide-[#e7ece9]">
            {alerts.map((alert) => (
              <li key={alert.title} className="flex gap-3 py-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${alert.tone}`} />
                <div><p className="text-sm font-black text-[#2d4038]">{alert.title}</p><p className="mt-1 text-xs leading-5 text-[#75817b]">{alert.detail}</p></div>
              </li>
            ))}
          </ol>
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
