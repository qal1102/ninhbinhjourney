"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";
import { MapTiles } from "@/components/shared/map-tiles";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import type { DestinationCatalogItem } from "@/content/destinations";

type ExploreMapProps = {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
  onSelect: (destination: DestinationCatalogItem, trigger: HTMLElement) => void;
};

const fallbackCenter: [number, number] = [20.2503, 105.897];

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function markerIcon(active: boolean, order: number, slug: string) {
  return L.divIcon({
    className: "",
    html: `<div class="nb-marker ${active ? "nb-marker-active" : ""}" data-map-destination="${escapeHtmlAttribute(slug)}">${order}</div>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
    popupAnchor: [0, -16],
  });
}

function fitMapToDestinations(
  map: L.Map,
  destinations: readonly DestinationCatalogItem[],
  animate: boolean,
) {
  if (destinations.length === 0) return;
  if (destinations.length === 1) {
    map.setView(destinations[0].coordinates as [number, number], 12, {
      animate,
    });
    return;
  }
  map.fitBounds(
    L.latLngBounds(
      destinations.map(
        (destination) => destination.coordinates as [number, number],
      ),
    ),
    { padding: [48, 48], animate, duration: animate ? 0.45 : undefined },
  );
}

function InvalidateOnResize({
  destinations,
  selectedSlug,
}: {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let wasHidden = container.clientWidth === 0 || container.clientHeight === 0;
    // /explore keeps this MapContainer mounted at all times and only toggles a
    // `hidden` class on its wrapper when the visitor switches to "Danh sách" on
    // mobile. Leaflet does not notice a container going display:none -> block on
    // its own, so without this the map comes back with cut-off/misaligned tiles
    // after the visitor flips back to "Bản đồ".
    const observer = new ResizeObserver(() => {
      // A mobile mode switch briefly gives the mounted map a 0 x 0 box.
      // Invalidating Leaflet at that moment can turn its projected centre into
      // NaN and crash the whole route. ResizeObserver fires again when visible.
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        wasHidden = true;
        return;
      }
      const becameVisible = wasHidden;
      wasHidden = false;
      map.invalidateSize({ animate: false, pan: true });
      if (!becameVisible) return;
      const selected = destinations.find(
        (destination) => destination.slug === selectedSlug,
      );
      if (selected) {
        map.setView(selected.coordinates as [number, number], 13, {
          animate: false,
        });
      } else {
        fitMapToDestinations(map, destinations, false);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [destinations, map, selectedSlug]);

  return null;
}

function FitToDestinations({
  destinations,
}: {
  destinations: readonly DestinationCatalogItem[];
}) {
  const map = useMap();
  const reducedMotion = useReducedMotion();
  const destinationSet = destinations.map((destination) => destination.slug).join("|");
  const previousDestinationSet = useRef<string | null>(null);

  useEffect(() => {
    if (previousDestinationSet.current === destinationSet) return;
    const isInitialView = previousDestinationSet.current === null;
    previousDestinationSet.current = destinationSet;
    const animate = !isInitialView && !reducedMotion;

    const container = map.getContainer();
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    fitMapToDestinations(map, destinations, animate);
  }, [destinationSet, destinations, map, reducedMotion]);

  return null;
}

function FocusSelectedDestination({
  destinations,
  selectedSlug,
}: {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
}) {
  const map = useMap();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const destination = destinations.find(({ slug }) => slug === selectedSlug);
    if (!destination) return;
    const container = map.getContainer();
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    const coordinates = destination.coordinates as [number, number];
    if (reducedMotion) {
      map.setView(coordinates, 13, { animate: false });
      return;
    }

    map.flyTo(coordinates, 13, { animate: true, duration: 0.65 });
  }, [destinations, map, reducedMotion, selectedSlug]);

  return null;
}

function MapAccessibilityLabel() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute("role", "region");
    container.setAttribute("data-explore-map-region", "");
    container.setAttribute("aria-label", "Bản đồ các điểm đến Ninh Bình");
  }, [map]);

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
          markerIcon(destination.slug === selectedSlug, index + 1, destination.slug),
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
      <MapAccessibilityLabel />
      <InvalidateOnResize
        destinations={destinations}
        selectedSlug={selectedSlug}
      />
      <FitToDestinations destinations={destinations} />
      <FocusSelectedDestination destinations={destinations} selectedSlug={selectedSlug} />
      <MapTiles />
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
