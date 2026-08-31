"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

export type MiniRouteMapPoint = {
  id: string;
  label: string;
  coordinates: readonly [number, number];
};

const MiniRouteMapCanvas = dynamic(() => import("@/components/discovery/mini-route-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#D7E6DD]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8CEC1] border-t-[#183F34]" />
    </div>
  ),
});

/**
 * Bản đồ nhỏ, chỉ ghim tọa độ thật -- thay cho việc in thẳng dãy số
 * "20.2503, 105.8970" ra mặt khách (khách không đọc được toạ độ, chỉ máy
 * mới cần). Dùng ở trang chi tiết điểm đến (một ghim) và trang chi tiết
 * gói (nhiều ghim theo từng chặng trong `schedule`).
 *
 * Lười tải giống cách trang chủ đã làm cho `TourismMap`
 * (`app/ninh-binh-landing.tsx`, kỹ thuật `IntersectionObserver`): chunk
 * Leaflet (~152 KB) chỉ tải khi khối này sắp vào khung nhìn, không tải
 * ngay lúc trang chi tiết dựng xong.
 */
export function MiniRouteMap({
  points,
  tone = "light",
  showLegend = true,
  className = "",
  mapClassName = "h-56 sm:h-64",
}: {
  points: readonly MiniRouteMapPoint[];
  tone?: "light" | "dark";
  showLegend?: boolean;
  className?: string;
  mapClassName?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [nearViewport]);

  if (points.length === 0) return null;

  return (
    <div className={className}>
      <div
        ref={wrapRef}
        className={`relative w-full overflow-hidden rounded-[10px] border ${
          tone === "dark" ? "border-white/15" : "border-[#A8CEC1]/60"
        } ${mapClassName}`}
      >
        {nearViewport ? <MiniRouteMapCanvas points={points} /> : (
          <div className="grid h-full w-full place-items-center bg-[#D7E6DD]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8CEC1] border-t-[#183F34]" />
          </div>
        )}
      </div>
      {showLegend ? (
        <ol className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs ${tone === "dark" ? "text-white/72" : "text-[#4A5751]"}`}>
          {points.map((point, index) => (
            <li key={point.id}>
              <span className={`font-bold ${tone === "dark" ? "text-[#E7B96A]" : "text-[#183F34]"}`}>
                {index + 1}.
              </span>{" "}
              {point.label}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
