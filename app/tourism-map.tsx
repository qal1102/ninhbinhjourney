"use client";

import L from "leaflet";
import Image from "next/image";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Destination, DestinationId, Language, MapCopy } from "./ninh-binh-landing";

type TourismMapProps = {
  activeDestinationId: DestinationId | "welcome";
  copy: MapCopy;
  destinations: Destination[];
  lang: Language;
  onAdd: (id: DestinationId) => void;
  onDiscover: (id: DestinationId) => void;
  selectedIds: DestinationId[];
};

const welcomePosition: [number, number] = [20.28, 105.92];
const expandedNinhBinhBounds: [[number, number], [number, number]] = [
  [19.82, 105.42],
  [20.72, 106.28],
];

function markerIcon(active: boolean, neutral = false) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-marker ${active ? "nb-marker-active" : ""} ${neutral ? "nb-marker-neutral" : ""}">${active ? "•" : ""}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
    popupAnchor: [0, -16],
  });
}

function MapFocus({ activeDestinationId, destinations }: Pick<TourismMapProps, "activeDestinationId" | "destinations">) {
  const map = useMap();
  const active = destinations.find((destination) => destination.id === activeDestinationId);
  const target = active ? active.position : welcomePosition;

  useEffect(() => {
    if (active) {
      map.setView(target, 11, { animate: true });
      return;
    }

    map.fitBounds(expandedNinhBinhBounds, { animate: true, padding: [24, 24] });
  }, [active, map, target]);

  return null;
}

export default function TourismMap({
  activeDestinationId,
  copy,
  destinations,
  lang,
  onAdd,
  onDiscover,
  selectedIds,
}: TourismMapProps) {
  return (
    <MapContainer
      center={welcomePosition}
      className="h-[560px] min-h-[70vh] w-full rounded-[8px]"
      maxBounds={expandedNinhBinhBounds}
      maxBoundsViscosity={0.65}
      maxZoom={16}
      minZoom={8}
      scrollWheelZoom={false}
      zoom={9}
    >
      <MapFocus activeDestinationId={activeDestinationId} destinations={destinations} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker icon={markerIcon(activeDestinationId === "welcome", true)} position={welcomePosition}>
        <Tooltip direction="right" offset={[18, 0]} permanent>
          <span className="nb-here-badge">{copy.youAreHere}</span>
        </Tooltip>
        <Popup>
          <div className="bg-[#FBFAF6] p-4 text-[#1D2925]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">{copy.welcome}</p>
            <h3 className="mt-1 font-display text-2xl text-[#183F34]">Ninh Bình</h3>
            <p className="mt-2 text-sm leading-6 text-[#6D756F]">{copy.welcomeDescription}</p>
          </div>
        </Popup>
      </Marker>

      {destinations.map((destination) => {
        const active = destination.id === activeDestinationId;
        const selected = selectedIds.includes(destination.id);
        return (
          <Marker key={destination.id} icon={markerIcon(active)} position={destination.position}>
            {active ? (
              <Tooltip direction="right" offset={[18, 0]} permanent>
                <span className="nb-here-badge">{copy.youAreHere}</span>
              </Tooltip>
            ) : null}
            <Popup>
              <article className="bg-[#FBFAF6] text-[#1D2925]">
                <div className="relative h-36 w-full">
                  <Image
                    src={destination.image}
                    alt={destination.name[lang]}
                    fill
                    sizes="280px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(24,63,52,.45))]" />
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">
                    {destination.category[lang]} · {destination.duration[lang]}
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-[#183F34]">{destination.name[lang]}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6D756F]">{destination.shortDescription[lang]}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onDiscover(destination.id)}
                      className="rounded-full bg-[#183F34] px-3 py-2 text-sm font-bold text-white"
                    >
                      {copy.discover}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdd(destination.id)}
                      className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm font-bold text-[#183F34]"
                    >
                      {selected ? copy.added : copy.add}
                    </button>
                  </div>
                </div>
              </article>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
