"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESTINATIONS,
  destinationInterests,
  NINH_BINH_TOURISM_CORE,
  type DestinationCatalogItem,
  type DestinationInterest,
  type MobilityLevel,
} from "@/content/destinations";

type ViewMode = "map" | "list";
type FamilyFilter = "all" | "children" | "seniors";

const interestLabels: Record<DestinationInterest, string> = {
  heritage: "Di sản",
  nature: "Thiên nhiên",
  spirituality: "Tâm linh",
  photography: "Nhiếp ảnh",
  food: "Ẩm thực",
  family: "Gia đình",
};

const mobilityRank: Record<MobilityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

function pointPosition(coordinates: readonly [number, number]) {
  const [latitude, longitude] = coordinates;
  const { south, west, north, east } = NINH_BINH_TOURISM_CORE.bounds;
  return {
    left: `${((longitude - west) / (east - west)) * 100}%`,
    top: `${((north - latitude) / (north - south)) * 100}%`,
  };
}

function LocalTourismMap({
  destinations,
  selectedSlug,
  onSelect,
}: {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
  onSelect: (destination: DestinationCatalogItem, trigger: HTMLButtonElement) => void;
}) {
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
    <div
      className="relative min-h-[31rem] overflow-hidden rounded-3xl border border-[#b9cbc3] bg-[#dce9e3]"
      role="group"
      aria-label="Bản đồ ngữ cảnh Ninh Bình tourism core; không phải địa giới hành chính"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_70%,rgba(255,255,255,.74),transparent_24%),radial-gradient(circle_at_70%_25%,rgba(93,137,114,.18),transparent_28%),linear-gradient(145deg,#eaf2ed,#bed5ca)]" />
      <svg
        aria-hidden="true"
        className="absolute inset-[6%] h-[88%] w-[88%]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M 10 88 L 10 40 L 20 7 L 55 7 L 90 40 L 90 84 L 55 95 Z"
          fill="rgba(250,248,239,.58)"
          stroke="#527968"
          strokeWidth="1.2"
          strokeDasharray="2 2"
        />
        <path
          d="M 18 82 C 34 60, 32 35, 56 19 S 74 58, 86 72"
          fill="none"
          stroke="#8eb9b5"
          strokeWidth="2"
        />
        <path
          d="M 24 92 C 35 68, 50 74, 61 53 S 72 25, 79 14"
          fill="none"
          stroke="#a8cec1"
          strokeWidth="1"
        />
      </svg>
      <div className="absolute left-4 top-4 z-10 max-w-[14rem] rounded-2xl border border-white/80 bg-white/88 p-3 shadow-sm backdrop-blur">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#356957]">
          Local geographic fallback
        </p>
        <p className="mt-1 text-xs leading-5 text-[#59654b]">
          Tourism-core outline · không có lớp ranh giới Việt Nam · hoạt động
          không cần tile mạng.
        </p>
      </div>
      {destinations.map((destination, index) => {
        const active = destination.slug === selectedSlug;
        return (
          <button
            key={destination.id}
            type="button"
            onClick={(event) => onSelect(destination, event.currentTarget)}
            aria-label={`Mở ${destination.name.vi} trên bản đồ`}
            aria-pressed={active}
            className={`absolute z-20 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-sm font-extrabold shadow-lg transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#d58c35] ${
              active
                ? "scale-125 border-white bg-[#d58c35] text-[#151a17]"
                : "border-white bg-[#183f34] text-white hover:scale-110"
            }`}
            style={pointPosition(destination.coordinates)}
          >
            {index + 1}
          </button>
        );
      })}
      <p className="absolute bottom-3 right-4 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#436354]">
        WGS 84 · product scope, not an official boundary
      </p>
    </div>
  );
}

function DestinationSheet({
  destination,
  onClose,
}: {
  destination: DestinationCatalogItem;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end bg-[#09110e]/48 p-3 lg:items-center lg:justify-end lg:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-sheet-title"
        className="max-h-[88vh] w-full overflow-y-auto rounded-3xl bg-[#fbfaf6] shadow-2xl lg:max-w-md"
      >
        <div className="relative aspect-[16/10]">
          <Image
            src={destination.image}
            alt={destination.imageAlt.vi}
            fill
            sizes="(max-width: 1024px) 100vw, 448px"
            className="rounded-t-3xl object-cover"
          />
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-[#151a17]/85 text-xl text-white backdrop-blur focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
            aria-label="Đóng chi tiết điểm đến"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
            {destination.suggestedMinutes} phút · đi bộ{" "}
            {destination.mobilityLevel}
          </p>
          <h2
            id="destination-sheet-title"
            className="font-display mt-3 text-4xl text-[#183f34]"
          >
            {destination.name.vi}
          </h2>
          <p className="mt-4 leading-7 text-[#4d5b55]">
            {destination.description.vi}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={`/destination/${destination.slug}`}
              className="inline-flex min-h-12 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              Xem câu chuyện
            </Link>
            <Link
              href={`/plan?add=${destination.id}`}
              className="inline-flex min-h-12 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
            >
              Thêm vào hành trình
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ExploreExperience() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [interest, setInterest] = useState<DestinationInterest | "all">("all");
  const [maxMinutes, setMaxMinutes] = useState(240);
  const [pace, setPace] = useState<"relaxed" | "balanced" | "active">(
    "balanced",
  );
  const [walking, setWalking] = useState<MobilityLevel>("moderate");
  const [family, setFamily] = useState<FamilyFilter>("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selected, setSelected] = useState<DestinationCatalogItem | null>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const filtered = useMemo(() => {
    const paceMinutes =
      pace === "relaxed" ? Math.min(maxMinutes, 180) : maxMinutes;
    return DESTINATIONS.filter((destination) => {
      if (interest !== "all" && !destination.interests.includes(interest)) {
        return false;
      }
      if (destination.suggestedMinutes > paceMinutes) return false;
      if (mobilityRank[destination.mobilityLevel] > mobilityRank[walking]) {
        return false;
      }
      if (family !== "all" && !destination.suitableFor.includes(family)) {
        return false;
      }
      return !availableOnly || destination.demoOpeningWindow.length > 0;
    });
  }, [availableOnly, family, interest, maxMinutes, pace, walking]);

  function selectDestination(
    destination: DestinationCatalogItem,
    trigger: HTMLButtonElement,
  ) {
    returnFocusRef.current = trigger;
    setSelected(destination);
  }

  function closeSheet() {
    setSelected(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  return (
    <div>
      <div className="grid gap-3 rounded-3xl border border-[#d7d5cd] bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-bold text-[#26342e]">
          Sở thích
          <select
            value={interest}
            onChange={(event) =>
              setInterest(event.target.value as DestinationInterest | "all")
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="all">Tất cả</option>
            {destinationInterests.map((item) => (
              <option key={item} value={item}>
                {interestLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          Thời gian
          <select
            value={maxMinutes}
            onChange={(event) => setMaxMinutes(Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value={90}>Tối đa 90 phút</option>
            <option value={150}>Tối đa 2,5 giờ</option>
            <option value={240}>Tối đa 4 giờ</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          Nhịp đi
          <select
            value={pace}
            onChange={(event) =>
              setPace(event.target.value as typeof pace)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="relaxed">Thư thả</option>
            <option value="balanced">Cân bằng</option>
            <option value="active">Năng động</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          Mức đi bộ
          <select
            value={walking}
            onChange={(event) =>
              setWalking(event.target.value as MobilityLevel)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="low">Thấp</option>
            <option value="moderate">Vừa</option>
            <option value="high">Cao</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          Phù hợp
          <select
            value={family}
            onChange={(event) =>
              setFamily(event.target.value as FamilyFilter)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="all">Mọi nhóm</option>
            <option value="seniors">Người lớn tuổi</option>
            <option value="children">Trẻ em</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl bg-[#edf3f0] px-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
            className="h-5 w-5 accent-[#183f34]"
          />
          Có khung giờ demo
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#59654b]" aria-live="polite">
          <strong className="text-[#183f34]">{filtered.length}</strong> điểm
          trong Ninh Bình tourism core
        </p>
        <div
          className="flex rounded-full border border-[#b9c4bd] bg-white p-1"
          aria-label="Chọn chế độ khám phá"
        >
          {(["map", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`min-h-10 rounded-full px-5 text-sm font-bold ${
                viewMode === mode
                  ? "bg-[#183f34] text-white"
                  : "text-[#365247]"
              }`}
            >
              {mode === "map" ? "Bản đồ" : "Danh sách"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        <div className={viewMode === "map" ? "block" : "hidden lg:block"}>
          <LocalTourismMap
            destinations={filtered}
            selectedSlug={selected?.slug ?? null}
            onSelect={selectDestination}
          />
        </div>
        <div
          className={`space-y-3 lg:max-h-[31rem] lg:overflow-y-auto lg:pr-2 ${
            viewMode === "list" ? "block" : "hidden lg:block"
          }`}
        >
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#aabbb2] bg-white p-8 text-center">
              <p className="font-display text-2xl text-[#183f34]">
                Chưa có điểm phù hợp
              </p>
              <button
                type="button"
                onClick={() => {
                  setInterest("all");
                  setMaxMinutes(240);
                  setPace("balanced");
                  setWalking("high");
                  setFamily("all");
                }}
                className="mt-4 min-h-11 rounded-full border border-[#183f34] px-5 font-bold"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            filtered.map((destination, index) => (
              <article
                key={destination.id}
                className={`grid grid-cols-[7rem_1fr] gap-4 rounded-2xl border bg-white p-3 transition ${
                  selected?.slug === destination.slug
                    ? "border-[#d58c35] shadow-md"
                    : "border-[#d7d5cd]"
                }`}
              >
                <div className="relative min-h-28 overflow-hidden rounded-xl">
                  <Image
                    src={destination.image}
                    alt={destination.imageAlt.vi}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
                <div className="py-1">
                  <p className="text-xs font-extrabold text-[#557568]">
                    {index + 1} · {destination.suggestedMinutes} phút · đi bộ{" "}
                    {destination.mobilityLevel}
                  </p>
                  <h2 className="font-display mt-1 text-xl text-[#183f34]">
                    {destination.name.vi}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#59654b]">
                    {destination.editorialLine.vi}
                  </p>
                  <button
                    type="button"
                    onClick={(event) =>
                      selectDestination(destination, event.currentTarget)
                    }
                    className="mt-3 min-h-9 rounded-full border border-[#8aa398] px-3 text-xs font-bold text-[#183f34]"
                  >
                    Tập trung trên bản đồ
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <DestinationSheet destination={selected} onClose={closeSheet} />
      ) : null}
    </div>
  );
}
