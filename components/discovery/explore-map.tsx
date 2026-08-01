"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { DestinationCatalogItem } from "@/content/destinations";

type ExploreMapProps = {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
  onSelect: (destination: DestinationCatalogItem, trigger: HTMLElement) => void;
};

const fallbackCenter: [number, number] = [20.2503, 105.897];

function markerIcon(active: boolean, order: number) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-marker ${active ? "nb-marker-active" : ""}">${order}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
    popupAnchor: [0, -16],
  });
}

function FitToDestinations({
  destinations,
}: {
  destinations: readonly DestinationCatalogItem[];
}) {
  const map = useMap();

  useEffect(() => {
    if (destinations.length === 0) return;
    if (destinations.length === 1) {
      map.setView(destinations[0].coordinates as [number, number], 12, {
        animate: true,
      });
      return;
    }
    map.fitBounds(
      L.latLngBounds(
        destinations.map((destination) => destination.coordinates as [number, number]),
      ),
      { padding: [48, 48], animate: true },
    );
  }, [destinations, map]);

  return null;
}

export default function ExploreMap({
  destinations,
  selectedSlug,
  onSelect,
}: ExploreMapProps) {
  const icons = useMemo(
    () =>
      new Map(
        destinations.map((destination, index) => [
          destination.id,
          markerIcon(destination.slug === selectedSlug, index + 1),
        ]),
      ),
    [destinations, selectedSlug],
  );

  if (destinations.length === 0) {
    return (
      <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-[#8da69c] bg-[#edf3f0] p-8 text-center">
        <div>
          <p className="font-display text-2xl text-[#183f34]">
            Không có điểm phù hợp
          </p>
          <p className="mt-2 text-sm text-[#59654b]">
            Danh sách vẫn hoạt động; hãy nới một bộ lọc để xem lại điểm đến.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={fallbackCenter}
      className="min-h-[31rem] w-full overflow-hidden rounded-3xl border border-[#b9cbc3]"
      scrollWheelZoom={false}
      zoom={10}
    >
      <FitToDestinations destinations={destinations} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {destinations.map((destination) => (
        <Marker
          key={destination.id}
          alt={`Mở ${destination.name.vi} trên bản đồ`}
          icon={icons.get(destination.id)}
          position={destination.coordinates as [number, number]}
          eventHandlers={{
            click: (event) => {
              const element = event.target.getElement() as HTMLElement | null;
              onSelect(destination, element ?? document.body);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
