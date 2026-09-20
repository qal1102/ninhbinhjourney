"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";
import { MapTiles, TILE_FALLBACK_NOTE_STATIC } from "@/components/shared/map-tiles";
import type { TripPassportLanguage, TripPassportStop } from "@/domain/trip-passport";

/**
 * Tên đặt bên trái điểm thay vì bên phải, để hai điểm gần nhau không đè chữ
 * lên nhau. Bái Đính nằm ngay tây bắc Tràng An.
 */
const LABEL_ON_LEFT = new Set(["10000000-0000-4000-8000-000000000003"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pinIcon(stop: TripPassportStop, fresh: boolean, lang: TripPassportLanguage) {
  const label = `<span class="nb-passport-label${LABEL_ON_LEFT.has(stop.id) ? " is-left" : ""}">${escapeHtml(stop.shortName[lang])}</span>`;
  if (!stop.lit) {
    return L.divIcon({
      className: "",
      html: `<div class="nb-passport-pin" data-place-id="${stop.id}" data-lit="false">${label}</div>`,
      iconAnchor: [8, 8],
      iconSize: [16, 16],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div class="nb-passport-pin is-lit${fresh ? " is-fresh" : ""}" data-place-id="${stop.id}" data-lit="true">${stop.visitOrder ?? ""}${label}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
  });
}

/**
 * Lề khi đưa các điểm vào khung. Mép dưới chừa rộng hơn: đó là chỗ dòng ghi
 * công OpenStreetMap, và là chỗ dải nhắn "ảnh nền chưa về kịp" hiện lên khi
 * mất ảnh nền — dải ấy không được đè lên điểm nào ở phía nam.
 */
const FIT_OPTIONS: L.FitBoundsOptions = {
  paddingTopLeft: [44, 36],
  paddingBottomRight: [44, 92],
  animate: false,
};

/**
 * Đưa đủ mọi điểm vào khung, và đưa lại mỗi khi khung đổi cỡ (xoay máy, kéo
 * cửa sổ). Leaflet chỉ đo khung một lần lúc dựng.
 */
function FitPlaces({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, FIT_OPTIONS);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [bounds, map]);

  return null;
}

/**
 * Phần vẽ bản đồ thật — kéo theo Leaflet nên chỉ được nạp qua `next/dynamic`
 * ở `trip-passport.tsx`, phía trình duyệt.
 *
 * Đây là một tấm hình để xem, không phải bản đồ để lái: tắt kéo, tắt phóng,
 * tắt cuộn. Trên điện thoại, một ngón tay vuốt qua bản đồ phải cuộn trang
 * chứ không bị bản đồ nuốt mất.
 */
export default function TripPassportMapCanvas({
  stops,
  freshIds,
  lang,
}: {
  stops: readonly TripPassportStop[];
  freshIds: readonly string[];
  lang: TripPassportLanguage;
}) {
  const bounds = useMemo(
    () => L.latLngBounds(stops.map((stop) => stop.coordinates as [number, number])),
    [stops],
  );
  const freshKey = freshIds.join("|");
  const markers = useMemo(() => {
    const fresh = new Set(freshKey ? freshKey.split("|") : []);
    return stops.map((stop) => ({
      stop,
      icon: pinIcon(stop, fresh.has(stop.id), lang),
    }));
  }, [stops, freshKey, lang]);

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={FIT_OPTIONS}
      zoomSnap={0.25}
      zoomControl={false}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      className="nb-passport-map h-full w-full"
    >
      <FitPlaces bounds={bounds} />
      <MapTiles fallbackNote={TILE_FALLBACK_NOTE_STATIC} />
      {markers.map(({ stop, icon }) => (
        <Marker
          key={stop.id}
          position={stop.coordinates as [number, number]}
          icon={icon}
          interactive={false}
          keyboard={false}
          // Nơi đã sáng nằm trên nơi còn mờ khi hai điểm sát nhau.
          zIndexOffset={stop.lit ? 1000 : 0}
        />
      ))}
    </MapContainer>
  );
}
