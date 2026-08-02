"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ErpSite } from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  initialCameraId?: string;
};

type CameraStatus = "stable" | "attention" | "offline";

type CameraFeed = {
  id: string;
  name: string;
  zone: string;
  status: CameraStatus;
  people: number;
  confidence: number;
  note: string;
  position: string;
};

const zones: Record<string, string[]> = {
  "trang-an": ["Cổng A", "Bến thuyền 01", "Vùng chờ trung tâm", "Tuyến thuyền số 2"],
  "tam-chuc": ["Cổng Khách Điện", "Bến thuyền", "Điện Tam Thế", "Dốc Tháp Ngọc"],
  "tam-coc": ["Cổng vé", "Bến đò", "Vùng chờ", "Tuyến sông chính"],
  "bai-dinh": ["Cổng chính", "Bến xe điện", "Hành lang La Hán", "Khu Bảo Tháp"],
};

function createFeeds(site: ErpSite): CameraFeed[] {
  const siteZones = zones[site.id];
  return siteZones.map((zone, index) => ({
    id: `${site.id}-cam-${String(index + 1).padStart(2, "0")}`,
    name: `CAM ${String(index + 1).padStart(2, "0")}`,
    zone,
    status: index === 1 && site.snapshot.capacityPercent >= 80 ? "attention" : index === 3 ? "offline" : "stable",
    people: Math.round(site.snapshot.visitors * [0.08, 0.13, 0.06, 0.03][index]),
    confidence: [96, 93, 97, 0][index],
    note: index === 1 && site.snapshot.capacityPercent >= 80 ? "Mật độ tăng nhanh trong 8 phút" : index === 3 ? "Đang bảo trì kết nối" : "Luồng di chuyển bình thường",
    position: ["center", "45% 55%", "65% center", "35% center"][index],
  }));
}

const statusStyle: Record<CameraStatus, { label: string; className: string }> = {
  stable: { label: "Ổn định", className: "bg-[#dcf0e7] text-[#245f47]" },
  attention: { label: "Cần chú ý", className: "bg-[#ffe6bf] text-[#7a511d]" },
  offline: { label: "Mất tín hiệu", className: "bg-[#ecefed] text-[#68756f]" },
};

export function CameraAiWorkspace({ site, initialCameraId }: Props) {
  const feeds = useMemo(() => createFeeds(site), [site]);
  const [filter, setFilter] = useState<"all" | CameraStatus>("all");
  const [selected, setSelected] = useState<CameraFeed | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialCameraId) return;
    const normalizedId = initialCameraId.padStart(2, "0");
    const requestedFeed = feeds.find((feed) => feed.id.endsWith(`-${normalizedId}`));
    if (!requestedFeed) return;
    const timer = window.setTimeout(() => {
      setSelected(requestedFeed);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [feeds, initialCameraId]);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const visibleFeeds = filter === "all" ? feeds : feeds.filter((feed) => feed.status === filter);
  const attentionCount = feeds.filter((feed) => feed.status === "attention").length;

  async function enterFullscreen() {
    await viewerRef.current?.requestFullscreen?.();
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Camera đang nhận", `${feeds.filter((feed) => feed.status !== "offline").length}/${feeds.length}`, "Gateway hoạt động"],
          ["Cần chú ý", String(attentionCount), attentionCount ? "Đã chuyển quản lý" : "Không có cảnh báo"],
          ["Mật độ ghi nhận", feeds.reduce((sum, feed) => sum + feed.people, 0).toLocaleString("vi-VN"), "Đếm ẩn danh"],
          ["Độ trễ hình ảnh", "1,4 giây", "Trong ngưỡng theo dõi"],
        ].map(([label, value, note], index) => (
          <article key={label} className={`rounded-2xl p-4 shadow-sm sm:p-5 ${index === 1 && attentionCount ? "border border-[#efd4a8] bg-[#fff9ed]" : "border border-[#d8e0db] bg-white"}`}>
            <p className="text-xs text-[#697770]">{label}</p><p className="mt-2 text-2xl font-black text-[#203a30] sm:text-3xl">{value}</p><p className="mt-2 text-xs text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Hiện trường {site.shortName}</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Camera theo khu vực</h2><p className="mt-2 text-xs text-[#7b8881]">Khung hình mô phỏng · {now?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "Đang đồng bộ"}</p></div>
          <div className="grid grid-cols-4 rounded-xl border border-[#d8e0db] bg-[#f7f9f7] p-1">
            {(["all", "stable", "attention", "offline"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 rounded-lg px-2 text-[11px] font-black transition sm:px-3 ${filter === value ? "bg-[#183f34] text-white" : "text-[#65756e]"}`}>{value === "all" ? "Tất cả" : statusStyle[value].label}</button>)}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {visibleFeeds.map((feed) => (
            <button key={feed.id} type="button" onClick={() => setSelected(feed)} className="group overflow-hidden rounded-2xl border border-[#dce3df] bg-[#122a23] text-left shadow-sm transition hover:border-[#769b8c]">
              <div className="relative aspect-video overflow-hidden">
                {feed.status !== "offline" ? <Image src={site.image} alt={`Khung hình ${feed.zone}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-[1.03]" style={{ objectPosition: feed.position }} /> : <div className="absolute inset-0 grid place-items-center bg-[#25342f] text-sm font-bold text-white/45">Không có tín hiệu</div>}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,18,14,.42),transparent_38%,rgba(5,18,14,.72))]" />
                {feed.status !== "offline" ? <div className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-[#8ff0c1]/35" /> : null}
                <div className="absolute left-3 top-3 flex items-center gap-2"><span className="rounded-md bg-black/55 px-2 py-1 text-[10px] font-black text-white">{feed.name}</span><span className={`rounded-md px-2 py-1 text-[10px] font-black ${statusStyle[feed.status].className}`}>{statusStyle[feed.status].label}</span></div>
                <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 text-white"><div><p className="font-black">{feed.zone}</p><p className="mt-1 text-xs text-white/62">{feed.note}</p></div>{feed.status !== "offline" ? <div className="shrink-0 text-right"><p className="text-xl font-black">{feed.people}</p><p className="text-[10px] text-white/55">người</p></div> : null}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">AI quan sát ẩn danh</p><h2 className="mt-2 text-xl font-black text-[#20342c]">Sự kiện gần đây</h2>
        <div className="mt-4 divide-y divide-[#e6ebe8]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 py-3 text-sm"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#c17a35]" /><div><p className="font-black text-[#34483f]">Mật độ tăng nhanh tại {zones[site.id][1]}</p><p className="mt-1 text-xs text-[#7a8781]">Đã chuyển quản lý cơ sở xác minh, chưa chuyển cấp giám đốc.</p></div><time className="text-xs text-[#87938d]">2 phút</time></div>
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 py-3 text-sm"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#398064]" /><div><p className="font-black text-[#34483f]">Luồng khách trở lại ngưỡng xanh</p><p className="mt-1 text-xs text-[#7a8781]">Hệ thống tự đóng cảnh báo theo ngưỡng.</p></div><time className="text-xs text-[#87938d]">18 phút</time></div>
        </div>
      </section>

      {selected && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[120] grid place-items-end bg-[#06130f]/78 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
          <button type="button" aria-label="Đóng camera" onClick={() => setSelected(null)} className="absolute inset-0" />
          <section role="dialog" aria-modal="true" aria-label={`Camera ${selected.zone}`} className="relative z-10 max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-[#eef2ef] shadow-2xl sm:max-w-5xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-4 bg-[#183f34] px-5 py-4 text-white"><div><p className="text-xs text-white/55">{selected.name} · {site.shortName}</p><h2 className="mt-1 text-xl font-black">{selected.zone}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl">×</button></div>
            <div className="grid gap-0 lg:grid-cols-[1.45fr_0.55fr]">
              <div ref={viewerRef} className="relative aspect-video min-h-60 overflow-hidden bg-[#0c1814]">
                {selected.status !== "offline" ? <Image src={site.image} alt={`Khung hình lớn ${selected.zone}`} fill sizes="100vw" priority className="object-cover opacity-85" style={{ objectPosition: selected.position }} /> : <div className="absolute inset-0 grid place-items-center text-white/45">Camera đang mất tín hiệu</div>}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35),transparent_35%,rgba(0,0,0,.45))]" />
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/55 px-3 py-2 text-xs font-black text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-[#65dda3]" />DEMO · {now?.toLocaleTimeString("vi-VN") ?? "Đang đồng bộ"}</div>
                {selected.status !== "offline" ? <div className="absolute bottom-[18%] left-[23%] h-20 w-16 rounded border-2 border-[#83e7b5]"><span className="absolute -top-6 left-0 bg-[#83e7b5] px-1.5 py-0.5 text-[9px] font-black text-[#11362a]">PERSON</span></div> : null}
                <button type="button" onClick={enterFullscreen} className="absolute bottom-4 right-4 rounded-lg bg-black/55 px-3 py-2 text-xs font-black text-white">Toàn màn hình</button>
              </div>
              <aside className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#477565]">Phân tích hiện trường</p>
                <div className="mt-4 rounded-xl border border-[#efd4a8] bg-[#fff9ed] p-4 text-sm leading-6 text-[#7a5a1d]">
                  <p className="font-black">Số đếm người và độ tin cậy tạm khoá</p>
                  <p className="mt-1">
                    Camera này chưa nối cảm biến đếm người thật — số liệu ở đây
                    trước nay là mô phỏng, không phải AI đo được. Đã tắt tạm
                    nút tạo sự cố từ camera để số mô phỏng không lọt vào nhật
                    ký sự cố thật, chờ quyết định hướng làm thật (T17,
                    docs/HANDOFF.md).
                  </p>
                </div>
                <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-[#5f7068]">
                  Phát hiện bất thường qua hình ảnh trực tiếp thì vẫn báo qua{" "}
                  <span className="font-bold">Báo cáo hiện trường</span> hoặc{" "}
                  <span className="font-bold">Sự cố &amp; điều phối</span> như bình thường.
                </p>
              </aside>
            </div>
          </section>
        </div>, document.body) : null}
    </div>
  );
}
