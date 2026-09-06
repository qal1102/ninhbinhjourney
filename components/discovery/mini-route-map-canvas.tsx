"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import { MapTiles, TILE_FALLBACK_NOTE_STATIC } from "@/components/shared/map-tiles";
import type { MiniRouteMapPoint } from "@/components/discovery/mini-route-map";

const fallbackCenter: [number, number] = [20.2503, 105.897];

function markerIcon(order: number) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-marker nb-marker-active">${order}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
    popupAnchor: [0, -16],
  });
}

/**
 * Đưa khung nhìn về đúng các điểm được truyền vào -- một điểm thì phóng
 * gần, nhiều điểm thì `fitBounds` sao cho tất cả cùng vào khung. Tách
 * thành component riêng như `explore-map.tsx`/`tourism-map.tsx` đã làm,
 * vì Leaflet chỉ đọc được view mới bên trong `useMap()`.
 */
function FitToPoints({ points }: { points: readonly MiniRouteMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0].coordinates as [number, number], 13, { animate: false });
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((point) => point.coordinates as [number, number])),
      { padding: [28, 28], animate: false },
    );
  }, [points, map]);

  return null;
}

/**
 * Phần vẽ bản đồ thật (nặng vì kéo theo Leaflet) -- luôn được tải qua
 * `next/dynamic` từ `mini-route-map.tsx`, không import thẳng ở đâu khác,
 * để chunk Leaflet chỉ tải khi khối bản đồ nhỏ này thật sự được gắn vào
 * trang (xem `IntersectionObserver` ở component bọc ngoài).
 */
export default function MiniRouteMapCanvas({
  points,
}: {
  points: readonly MiniRouteMapPoint[];
}) {
  const center = (points[0]?.coordinates as [number, number]) ?? fallbackCenter;
  const path = useMemo(
    () => points.map((point) => point.coordinates as [number, number]),
    [points],
  );

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      dragging={points.length > 1}
      zoomControl={points.length > 1}
      className="h-full w-full"
    >
      <FitToPoints points={points} />
      {/* Bản đồ nhỏ chỉ ghim vị trí, không bấm vào từng điểm, nên lời nhắn
          khi thiếu ảnh nền cũng nói đúng chừng đó. */}
      <MapTiles fallbackNote={TILE_FALLBACK_NOTE_STATIC} />
      {points.length > 1 ? (
        <Polyline
          positions={path}
          pathOptions={{ color: "#183F34", weight: 3, opacity: 0.6, dashArray: "1 8" }}
        />
      ) : null}
      {points.map((point, index) => (
        <Marker
          key={point.id}
          position={point.coordinates as [number, number]}
          icon={markerIcon(index + 1)}
          alt={point.label}
        />
      ))}
    </MapContainer>
  );
}
