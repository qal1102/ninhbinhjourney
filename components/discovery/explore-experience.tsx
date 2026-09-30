"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import {
  DESTINATIONS,
  destinationInterests,
  type DestinationCatalogItem,
  type DestinationInterest,
  type MobilityLevel,
} from "@/content/destinations";
import {
  destinationFromExploreHref,
  destinationImageTransitionName,
  planDestinationHref,
  type ContinuityContext,
} from "@/lib/page-continuity";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";
import { NHAN_SO_THICH, nhanThoiLuong } from "@/content/destination-labels";

type ViewMode = "map" | "list";
type FamilyFilter = "all" | "children" | "seniors";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const interestLabels = NHAN_SO_THICH;

const mobilityRank: Record<MobilityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};



const ExploreMap = dynamic(() => import("./explore-map"), {
  loading: () => (
    <div className="grid min-h-[31rem] place-items-center rounded-3xl border border-[#b9cbc3] bg-[#dce9e3]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#a8cec1] border-t-[#183f34]" />
    </div>
  ),
  ssr: false,
});

function DestinationSheet({
  destination,
  onClose,
  navigationContext,
  lang,
}: {
  destination: DestinationCatalogItem;
  onClose: () => void;
  navigationContext: ContinuityContext;
  lang: NgonNgu;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButton.current?.focus());

    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKey);
    };
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
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-sheet-title"
        data-testid="explore-detail-sheet"
        className="max-h-[88vh] w-full overflow-y-auto rounded-3xl bg-[#fbfaf6] shadow-2xl lg:max-w-md"
      >
        <SharedImageTransition
          name={destinationImageTransitionName(destination.slug)}
          className="relative aspect-[16/10]"
        >
          <Image
            src={destination.image}
            alt={destination.imageAlt[lang]}
            fill
            sizes="(max-width: 1024px) 100vw, 448px"
            className="rounded-t-3xl object-cover"
          />
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-[#151a17]/85 text-xl text-white backdrop-blur focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
            aria-label={ch(lang, "Đóng chi tiết điểm đến", "Close destination details")}
          >
            ×
          </button>
        </SharedImageTransition>
        <div className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
            {nhanThoiLuong(destination.suggestedMinutes, destination.mobilityLevel, lang)}
          </p>
          <h2
            id="destination-sheet-title"
            className="font-display mt-3 text-4xl text-[#183f34]"
          >
            {destination.name[lang]}
          </h2>
          <p className="mt-4 leading-7 text-[#4d5b55]">
            {destination.description[lang]}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={destinationFromExploreHref(
                destination.slug,
                navigationContext,
              )}
              transitionTypes={["nav-forward"]}
              className="inline-flex min-h-12 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              {ch(lang, "Đọc thêm", "Read more")}
            </Link>
            <Link
              href={planDestinationHref(
                "add",
                destination.id,
                navigationContext,
              )}
              className="inline-flex min-h-12 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
            >
              {ch(lang, "Thêm vào hành trình", "Add to my day")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ExploreExperience({
  navigationContext,
  lang = "vi",
}: {
  navigationContext: ContinuityContext;
  lang?: NgonNgu;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [interest, setInterest] = useState<DestinationInterest | "all">("all");
  const [maxMinutes, setMaxMinutes] = useState(240);
  const [pace, setPace] = useState<"relaxed" | "balanced" | "active">(
    "balanced",
  );
  const [walking, setWalking] = useState<MobilityLevel>("moderate");
  const [family, setFamily] = useState<FamilyFilter>("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [detailDestination, setDetailDestination] =
    useState<DestinationCatalogItem | null>(null);
  const reducedMotion = useReducedMotion();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const resultsStatusRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const scrollFrameRef = useRef<number | null>(null);
  const ignoreScrollRef = useRef(false);
  const releaseScrollTimerRef = useRef<number | null>(null);
  const scrollGenerationRef = useRef(0);
  const focusMapAfterSelectionRef = useRef(false);

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

  const activeDestination =
    filtered.find((destination) => destination.slug === activeSlug) ?? null;

  const registerCard = useCallback(
    (slug: string, element: HTMLElement | null) => {
      if (element) cardRefs.current.set(slug, element);
      else cardRefs.current.delete(slug);
    },
    [],
  );

  const scheduleScrollRelease = useCallback((delay = 140) => {
    if (releaseScrollTimerRef.current !== null) {
      window.clearTimeout(releaseScrollTimerRef.current);
    }
    releaseScrollTimerRef.current = window.setTimeout(() => {
      ignoreScrollRef.current = false;
      releaseScrollTimerRef.current = null;
    }, delay);
  }, []);

  const suppressScrollSync = useCallback((initialDelay = 180) => {
    ignoreScrollRef.current = true;
    scrollGenerationRef.current += 1;
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    scheduleScrollRelease(initialDelay);
  }, [scheduleScrollRelease]);

  const scrollCardIntoList = useCallback(
    (slug: string) => {
      const list = listRef.current;
      const card = cardRefs.current.get(slug);
      if (!list || !card || window.innerWidth < 1024) return;

      const listRect = list.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const top =
        list.scrollTop +
        cardRect.top -
        listRect.top -
        (list.clientHeight - cardRect.height) / 2;
      suppressScrollSync();
      list.scrollTo({
        top: Math.max(0, top),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion, suppressScrollSync],
  );

  const scheduleActiveFromScroll = useCallback(
    (root: HTMLElement | null) => {
      if (ignoreScrollRef.current) {
        // Release follows the tail of the real smooth-scroll event stream,
        // instead of guessing how long the browser animation will take.
        scheduleScrollRelease();
        return;
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }

      const generation = scrollGenerationRef.current;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        if (
          ignoreScrollRef.current ||
          generation !== scrollGenerationRef.current
        ) {
          return;
        }

        const rootRect = root?.getBoundingClientRect() ?? {
          top: 0,
          bottom: window.innerHeight,
          height: window.innerHeight,
        };
        const activationLine = rootRect.top + rootRect.height * 0.46;
        let nextSlug: string | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const [slug, card] of cardRefs.current) {
          const cardRect = card.getBoundingClientRect();
          if (cardRect.bottom <= rootRect.top || cardRect.top >= rootRect.bottom) {
            continue;
          }
          const cardCenter = cardRect.top + cardRect.height / 2;
          const distance = Math.abs(cardCenter - activationLine);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nextSlug = slug;
          }
        }

        if (nextSlug) setActiveSlug(nextSlug);
      });
    },
    [scheduleScrollRelease],
  );

  useEffect(() => {
    if (viewMode !== "list") return;
    const mobileViewport = window.matchMedia("(max-width: 1023px)");
    const handleWindowScroll = () => {
      if (mobileViewport.matches) scheduleActiveFromScroll(null);
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [scheduleActiveFromScroll, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !focusMapAfterSelectionRef.current) return;

    // Focus after React has committed the mobile mode switch. Focusing from the
    // originating click handler is racy for keyboard activation: the browser
    // can restore focus to the button after that button has become hidden.
    // The panel itself is the target because the Leaflet child loads through a
    // dynamic import and might not exist yet on a cold production visit.
    const mapPanel = mapPanelRef.current;
    if (!mapPanel) return;

    focusMapAfterSelectionRef.current = false;
    mapPanel.focus({ preventScroll: true });
    mapPanel.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeSlug, reducedMotion, viewMode]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (releaseScrollTimerRef.current !== null) {
        window.clearTimeout(releaseScrollTimerRef.current);
      }
    },
    [],
  );

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    if (mode !== "list" || !activeSlug || window.innerWidth >= 1024) return;

    suppressScrollSync();
    window.requestAnimationFrame(() => {
      cardRefs.current.get(activeSlug)?.scrollIntoView({
        block: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });
  }

  function focusDestinationFromList(destination: DestinationCatalogItem) {
    // Clicking or keyboard-focusing a control near the edge of this nested
    // scroller can make the browser reveal it by a few pixels. That synthetic
    // scroll must not immediately overwrite the explicit destination choice.
    suppressScrollSync();
    setActiveSlug(destination.slug);
    if (window.innerWidth >= 1024) return;

    focusMapAfterSelectionRef.current = true;
    setViewMode("map");
  }

  function selectDestinationFromMap(
    destination: DestinationCatalogItem,
    trigger: HTMLElement,
  ) {
    returnFocusRef.current = trigger;
    setActiveSlug(destination.slug);
    scrollCardIntoList(destination.slug);
    setDetailDestination(destination);
  }

  function openDestinationDetail(
    destination: DestinationCatalogItem,
    trigger: HTMLElement,
  ) {
    returnFocusRef.current = trigger;
    suppressScrollSync();
    setActiveSlug(destination.slug);
    setDetailDestination(destination);
  }

  const closeSheet = useCallback(() => {
    setDetailDestination(null);
    window.requestAnimationFrame(() => {
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected && returnTarget.getClientRects().length > 0) {
        returnTarget.focus({ preventScroll: true });
      } else {
        resultsStatusRef.current?.focus({ preventScroll: true });
      }
    });
  }, []);

  function clearActiveDestination() {
    suppressScrollSync();
    setActiveSlug(null);
  }

  return (
    <div data-testid="explore-experience">
      <div className="grid gap-3 rounded-3xl border border-[#d7d5cd] bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-bold text-[#26342e]">
          {ch(lang, "Sở thích", "Interest")}
          <select
            value={interest}
            data-explore-filter="interest"
            onChange={(event) => {
              setInterest(event.target.value as DestinationInterest | "all");
              clearActiveDestination();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="all">{ch(lang, "Tất cả", "All")}</option>
            {destinationInterests.map((item) => (
              <option key={item} value={item}>
                {interestLabels[item][lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          {ch(lang, "Thời gian", "Time")}
          <select
            value={maxMinutes}
            onChange={(event) => {
              setMaxMinutes(Number(event.target.value));
              clearActiveDestination();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value={90}>{ch(lang, "Tối đa 90 phút", "Up to 90 min")}</option>
            <option value={150}>{ch(lang, "Tối đa 2,5 giờ", "Up to 2.5 hours")}</option>
            <option value={240}>{ch(lang, "Tối đa 4 giờ", "Up to 4 hours")}</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          {ch(lang, "Nhịp đi", "Pace")}
          <select
            value={pace}
            onChange={(event) => {
              setPace(event.target.value as typeof pace);
              clearActiveDestination();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="relaxed">{ch(lang, "Thư thả", "Relaxed")}</option>
            <option value="balanced">{ch(lang, "Cân bằng", "Balanced")}</option>
            <option value="active">{ch(lang, "Năng động", "Active")}</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          {ch(lang, "Mức đi bộ", "Walking")}
          <select
            value={walking}
            onChange={(event) => {
              setWalking(event.target.value as MobilityLevel);
              clearActiveDestination();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="low">{ch(lang, "Thấp", "Low")}</option>
            <option value="moderate">{ch(lang, "Vừa", "Moderate")}</option>
            <option value="high">{ch(lang, "Cao", "High")}</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#26342e]">
          {ch(lang, "Phù hợp", "Suits")}
          <select
            value={family}
            onChange={(event) => {
              setFamily(event.target.value as FamilyFilter);
              clearActiveDestination();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="all">{ch(lang, "Mọi nhóm", "Everyone")}</option>
            <option value="seniors">{ch(lang, "Người lớn tuổi", "Older travellers")}</option>
            <option value="children">{ch(lang, "Trẻ em", "Children")}</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl bg-[#edf3f0] px-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => {
              setAvailableOnly(event.target.checked);
              clearActiveDestination();
            }}
            className="h-5 w-5 accent-[#183f34]"
          />
          {ch(lang, "Còn khung giờ", "Open today")}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p
          ref={resultsStatusRef}
          tabIndex={-1}
          data-testid="explore-results-status"
          className="text-sm text-[#59654b] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356957]"
          aria-live="polite"
        >
          <strong className="text-[#183f34]">{filtered.length}</strong>{" "}
          {ch(lang, "điểm hợp với bộ lọc của bạn", filtered.length === 1 ? "place matches your filters" : "places match your filters")}
        </p>
        <div
          className="flex rounded-full border border-[#b9c4bd] bg-white p-1"
          aria-label={ch(lang, "Chọn chế độ khám phá", "Choose how to explore")}
        >
          {(["map", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => switchView(mode)}
              aria-pressed={viewMode === mode}
              data-explore-view={mode}
              className={`min-h-11 rounded-full px-5 text-sm font-bold ${
                viewMode === mode
                  ? "bg-[#183f34] text-white"
                  : "text-[#365247]"
              }`}
            >
              {mode === "map" ? ch(lang, "Bản đồ", "Map") : ch(lang, "Danh sách", "List")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        <div
          ref={mapPanelRef}
          role="region"
          aria-label={ch(lang, "Bản đồ và điểm đến đang xem", "Map and the place in view")}
          tabIndex={-1}
          data-explore-map-focus
          data-explore-view-panel="map"
          className={`${viewMode === "map" ? "block" : "hidden lg:block"} focus-visible:rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356957]`}
        >
          <ExploreMap
            destinations={filtered}
            selectedSlug={activeDestination?.slug ?? null}
            onSelect={selectDestinationFromMap}
            lang={lang}
          />
          {activeDestination ? (
            <div
              data-testid="explore-active-destination"
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#b9cbc3] bg-[#183f34] px-4 py-3 text-[#fbfaf6] shadow-sm"
              aria-live="polite"
            >
              <div className="min-w-0">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#e7b96a]">
                  {ch(lang, "Đang xem trên bản đồ", "On the map")}
                </p>
                <p className="font-display mt-1 truncate text-xl">
                  {activeDestination.name[lang]}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) =>
                  openDestinationDetail(activeDestination, event.currentTarget)
                }
                className="min-h-11 rounded-full border border-white/40 px-4 text-xs font-bold transition hover:border-[#e7b96a] hover:text-[#f4d49b]"
              >
                {ch(lang, "Xem chi tiết", "Details")}
              </button>
            </div>
          ) : null}
        </div>
        <div
          ref={listRef}
          role="region"
          aria-label={ch(lang, "Danh sách điểm đến phù hợp", "Matching places")}
          tabIndex={0}
          data-explore-list
          data-explore-view-panel="list"
          onScroll={(event) => scheduleActiveFromScroll(event.currentTarget)}
          className={`space-y-3 focus-visible:rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356957] lg:max-h-[31rem] lg:overflow-y-auto lg:pr-2 ${
            viewMode === "list" ? "block" : "hidden lg:block"
          }`}
        >
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#aabbb2] bg-white p-8 text-center">
              <p className="font-display text-2xl text-[#183f34]">
                {ch(lang, "Chưa có điểm phù hợp", "Nothing matches yet")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setInterest("all");
                  setMaxMinutes(240);
                  setPace("balanced");
                  setWalking("high");
                  setFamily("all");
                  setAvailableOnly(false);
                  clearActiveDestination();
                }}
                className="mt-4 min-h-11 rounded-full border border-[#183f34] px-5 font-bold"
              >
                {ch(lang, "Xóa bộ lọc", "Clear filters")}
              </button>
            </div>
          ) : (
            filtered.map((destination, index) => (
              <article
                key={destination.id}
                ref={(element) => registerCard(destination.slug, element)}
                id={`explore-card-${destination.slug}`}
                data-explore-destination={destination.slug}
                data-active={activeDestination?.slug === destination.slug ? "true" : "false"}
                aria-current={
                  activeDestination?.slug === destination.slug ? "location" : undefined
                }
                className={`grid scroll-m-4 grid-cols-[7rem_1fr] gap-4 rounded-2xl border bg-white p-3 transition ${
                  activeDestination?.slug === destination.slug
                    ? "border-[#d58c35] bg-[#fffdf8] shadow-[0_16px_36px_rgba(24,63,52,0.12)]"
                    : "border-[#d7d5cd] hover:border-[#8aa398]"
                }`}
              >
                <div className="relative min-h-28 overflow-hidden rounded-xl">
                  <Image
                    src={destination.image}
                    alt={destination.imageAlt[lang]}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
                <div className="py-1">
                  <p className="text-xs font-extrabold text-[#557568]">
                    {index + 1} · {nhanThoiLuong(destination.suggestedMinutes, destination.mobilityLevel, lang)}
                  </p>
                  <h2 className="font-display mt-1 text-xl text-[#183f34]">
                    {destination.name[lang]}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#59654b]">
                    {destination.editorialLine[lang]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-explore-focus={destination.slug}
                      onClick={() => focusDestinationFromList(destination)}
                      className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold transition ${
                        activeDestination?.slug === destination.slug
                          ? "bg-[#183f34] text-white"
                          : "border border-[#8aa398] text-[#183f34] hover:bg-[#edf3f0]"
                      }`}
                    >
                      {ch(lang, "Xem trên bản đồ", "Show on map")}
                    </button>
                    <button
                      type="button"
                      data-testid={`explore-detail-${destination.slug}`}
                      onClick={(event) =>
                        openDestinationDetail(destination, event.currentTarget)
                      }
                      className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-[#356957] underline decoration-[#8aa398] underline-offset-4"
                    >
                      {ch(lang, "Xem chi tiết", "Details")}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {detailDestination ? (
        <DestinationSheet
          destination={detailDestination}
          onClose={closeSheet}
          navigationContext={navigationContext}
          lang={lang}
        />
      ) : null}
    </div>
  );
}
