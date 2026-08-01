"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { DESTINATIONS } from "@/content/destinations";

export type RouteStop = {
  id: string;
  siteId: string;
  label: string;
};

type ResolvedStop = RouteStop & {
  order: number;
  position: [number, number];
  name: string;
};

function stopIcon(order: number) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-route-pin">${order}</div>`,
    iconAnchor: [16, 16],
    iconSize: [32, 32],
    popupAnchor: [0, -18],
  });
}

function FitToRoute({ stops }: { stops: ResolvedStop[] }) {
  const map = useMap();

  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView(stops[0].position, 13, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(stops.map((stop) => stop.position)), {
      padding: [48, 48],
      animate: true,
    });
  }, [map, stops]);

  return null;
}

export default function ItineraryRouteMap({ stops }: { stops: RouteStop[] }) {
  const resolved = useMemo<ResolvedStop[]>(
    () =>
      stops.flatMap((stop, index) => {
        const destination = DESTINATIONS.find(
          (candidate) => candidate.id === stop.siteId,
        );
        if (!destination) return [];
        const [latitude, longitude] = destination.coordinates;
        return [
          {
            ...stop,
            order: index + 1,
            position: [latitude, longitude] as [number, number],
            name: destination.name.vi,
          },
        ];
      }),
    [stops],
  );

  const icons = useMemo(
    () => resolved.map((stop) => stopIcon(stop.order)),
    [resolved],
  );

  if (resolved.length === 0) {
    return (
      <div className="grid min-h-[24rem] place-items-center rounded-2xl bg-[#12211c] p-6 text-center text-sm leading-6 text-white/70">
        Chưa có điểm nào trong hành trình để hiển thị trên bản đồ.
      </div>
    );
  }

  return (
    <MapContainer
      center={resolved[0].position}
      className="min-h-[24rem] w-full overflow-hidden rounded-2xl"
      scrollWheelZoom={false}
      zoom={11}
    >
      <FitToRoute stops={resolved} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={resolved.map((stop) => stop.position)}
        pathOptions={{ color: "#e7c78d", weight: 3, dashArray: "6 5" }}
      />
      {resolved.map((stop, index) => (
        <Marker key={stop.id} icon={icons[index]} position={stop.position}>
          <Popup>
            <div className="bg-[#fbfaf6] p-3 text-[#1d2925]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3f7568]">
                Điểm {stop.order}
              </p>
              <h3 className="font-display mt-1 text-xl text-[#183f34]">
                {stop.name}
              </h3>
              <p className="mt-1 text-sm text-[#6d756f]">{stop.label}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
