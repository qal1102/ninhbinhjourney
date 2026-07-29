"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  recordAttendanceAction,
  type AttendanceActionResult,
} from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import type { AttendanceEvent, CurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  events: AttendanceEvent[];
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function AttendancePanel({ site, user, events }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AttendanceActionResult | null>(null);
  const [locationFailed, setLocationFailed] = useState(false);
  const personalEvents = useMemo(
    () =>
      events
        .filter((event) => event.userId === user.id && event.siteId === site.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [events, site.id, user.id],
  );
  const latest = result?.success ? result.event : personalEvents[0];
  const nextType = latest?.type === "check-in" ? "check-out" : "check-in";

  async function submitLocation(input: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    useDemoLocation?: boolean;
  }) {
    setPending(true);
    try {
      const response = await recordAttendanceAction({
        siteId: site.id,
        type: nextType,
        ...input,
      });
      setResult(response);
      if (response.success) router.refresh();
    } catch {
      setResult({
        success: false,
        message: "Chưa thể ghi nhận chấm công. Hãy kiểm tra kết nối rồi thử lại.",
      });
    } finally {
      setPending(false);
    }
  }

  function readGps() {
    setResult(null);
    setLocationFailed(false);
    if (!("geolocation" in navigator)) {
      setLocationFailed(true);
      setResult({ success: false, message: "Thiết bị không hỗ trợ định vị GPS." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        void submitLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => {
        setLocationFailed(true);
        setResult({
          success: false,
          message: "Chưa lấy được vị trí. Hãy cấp quyền định vị rồi thử lại.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Ca của tôi</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">{user.name}</h2>
            <p className="mt-1 text-sm text-[#6f7c76]">{user.jobTitle} · {site.shortName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${latest?.type === "check-in" ? "bg-[#dcefe7] text-[#226046]" : "bg-[#eef1ef] text-[#69766f]"}`}>
            {latest?.type === "check-in" ? "Đang trong ca" : "Chưa vào ca"}
          </span>
        </div>

        <div className="mt-6 rounded-2xl bg-[#eff5f1] p-5">
          <p className="text-sm text-[#63736b]">Lượt gần nhất</p>
          <p className="mt-2 text-3xl font-black text-[#183f34]">
            {latest ? formatTime(latest.createdAt) : "Chưa có"}
          </p>
          <p className="mt-2 text-xs text-[#74827b]">
            {latest?.source === "gps" ? "GPS thiết bị" : latest ? "Quản lý xác nhận tại cơ sở" : "Bấm nút dưới để ghi nhận"}
          </p>
        </div>

        <button
          type="button"
          onClick={readGps}
          disabled={pending}
          className="mt-5 min-h-12 w-full rounded-xl bg-[#183f34] px-5 font-black text-white transition hover:bg-[#245747] disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Đang xác minh vị trí..." : nextType === "check-in" ? "Xác nhận vào ca bằng GPS" : "Xác nhận ra ca bằng GPS"}
        </button>
        <p className="mt-3 text-xs leading-5 text-[#75817b]">
          Hệ thống chỉ đọc vị trí khi bạn bấm chấm công; không theo dõi liên tục.
        </p>

        {result ? (
          <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${result.success ? "bg-[#e3f2eb] text-[#245e48]" : "bg-[#fff0ed] text-[#914438]"}`}>
            {result.message}
          </p>
        ) : null}

        {locationFailed ? <p className="mt-3 rounded-xl bg-[#fff0dc] px-4 py-3 text-sm font-bold text-[#76501d]">Không thể xác minh GPS. Hãy bật quyền vị trí và thử lại.</p> : null}
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Nhật ký cá nhân</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">Lượt vào / ra gần đây</h2>
          </div>
          <span className="text-xs text-[#7b8881]">Đồng bộ bảng công</span>
        </div>
        <ol className="mt-5 divide-y divide-[#e5eae7]">
          {personalEvents.slice(0, 8).map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${event.type === "check-in" ? "bg-[#2f8a68]" : "bg-[#9b6e35]"}`} />
                <div>
                  <p className="text-sm font-black text-[#2c3d36]">{event.type === "check-in" ? "Vào ca" : "Ra ca"}</p>
                  <p className="mt-1 text-xs text-[#7a8781]">{event.source === "gps" ? `GPS · ±${Math.round(event.accuracy ?? 0)} m` : "Quản lý xác nhận"}</p>
                </div>
              </div>
              <time className="text-sm font-bold text-[#52635b]">{formatTime(event.createdAt)}</time>
            </li>
          ))}
          {personalEvents.length === 0 ? (
            <li className="py-10 text-center text-sm text-[#7b8881]">Chưa có lượt chấm công.</li>
          ) : null}
        </ol>
      </section>
    </div>
  );
}
