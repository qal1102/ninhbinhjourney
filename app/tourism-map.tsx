"use client";

import L from "leaflet";
import Image from "next/image";
import { useEffect, useState } from "react";
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

const welcomePosition: [number, number] = [20.2503, 105.897];
const expandedNinhBinhBounds: [[number, number], [number, number]] = [
  [19.82, 105.42],
  [20.72, 106.28],
];
const defaultZoom = 10;
const nearZoom = 13;

function markerIcon(active: boolean, neutral = false) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-marker ${active ? "nb-marker-active" : ""} ${neutral ? "nb-marker-neutral" : ""}">${active ? "•" : ""}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
    popupAnchor: [0, -16],
  });
}

function userIcon() {
  return L.divIcon({
    className: "",
    html: '<div class="nb-user-marker"></div>',
    iconAnchor: [9, 9],
    iconSize: [18, 18],
  });
}

function MapFocus({ activeDestinationId, destinations }: Pick<TourismMapProps, "activeDestinationId" | "destinations">) {
  const map = useMap();
  const active = destinations.find((destination) => destination.id === activeDestinationId);
  const target = active ? active.position : welcomePosition;

  useEffect(() => {
    if (active) {
      map.setView(target, 12, { animate: true });
      return;
    }

    map.setView(welcomePosition, defaultZoom, { animate: true });
  }, [active, map, target]);

  return null;
}

function LocationControl({
  copy,
  onPosition,
}: {
  copy: MapCopy;
  onPosition: (position: [number, number] | null) => void;
}) {
  const map = useMap();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function showStatus(message: string) {
    setStatus(message);
    window.setTimeout(() => {
      setStatus((current) => (current === message ? "" : current));
    }, 4500);
  }

  function isInsideRegion(position: [number, number]) {
    const [[south, west], [north, east]] = expandedNinhBinhBounds;
    return position[0] >= south && position[0] <= north && position[1] >= west && position[1] <= east;
  }

  function locate() {
    if (!navigator.geolocation) {
      showStatus(copy.locationDenied);
      return;
    }

    setBusy(true);
    showStatus(copy.locating);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const position: [number, number] = [result.coords.latitude, result.coords.longitude];
        if (isInsideRegion(position)) {
          onPosition(position);
          map.setView(position, nearZoom, { animate: true });
          showStatus(copy.locationFound);
        } else {
          onPosition(null);
          map.setView(welcomePosition, defaultZoom, { animate: true });
          showStatus(copy.locationOutside);
        }
        setBusy(false);
      },
      () => {
        onPosition(null);
        map.setView(welcomePosition, defaultZoom, { animate: true });
        showStatus(copy.locationDenied);
        setBusy(false);
      },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    if (!("permissions" in navigator)) return;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (!cancelled && permission.state === "granted") {
          locate();
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // Auto-locate only when permission is already granted; the visible button lets visitors opt in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="nb-location-control">
      <button type="button" onClick={locate} disabled={busy}>
        {busy ? copy.locating : copy.nearMe}
      </button>
      {status ? <p>{status}</p> : null}
    </div>
  );
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
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  return (
    <MapContainer
      center={welcomePosition}
      className="h-[560px] min-h-[70vh] w-full rounded-[8px]"
      maxBounds={expandedNinhBinhBounds}
      maxBoundsViscosity={0.65}
      maxZoom={16}
      minZoom={8}
      scrollWheelZoom={false}
      zoom={defaultZoom}
    >
      <MapFocus activeDestinationId={activeDestinationId} destinations={destinations} />
      <LocationControl copy={copy} onPosition={setUserPosition} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userPosition ? <Marker icon={userIcon()} position={userPosition} /> : null}
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
                  <Image src={destination.image} alt={destination.name[lang]} fill sizes="280px" className="object-cover" />
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
