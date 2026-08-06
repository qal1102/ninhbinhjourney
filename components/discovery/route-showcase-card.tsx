"use client";

import Image from "next/image";
import { useState, type PointerEventHandler } from "react";

export type RouteShowcaseStop = {
  id: string;
  name: string;
  image: string;
  imagePosition: string;
  category: string;
  duration: string;
};

export type RouteShowcaseCardCopy = {
  exploreStop: string;
  addRoute: string;
  stopLabel: string;
};

/**
 * Một tuyến có nhiều địa danh thì ảnh cũng phải đổi theo địa danh đang
 * được nói tới. Bản cũ lấy đúng một ảnh làm bìa cho cả tuyến, khiến ảnh
 * Phố cổ Hoa Lư nằm cạnh tiêu đề Hang Múa và ảnh Tràng An đứng tên Tam
 * Cốc. Component này biến từng chặng thành nút chọn ảnh có nhãn rõ ràng.
 */
export function RouteShowcaseCard({
  index,
  kicker,
  title,
  body,
  stops,
  copy,
  onExploreStop,
  onAddRoute,
  onPointerMove,
  onPointerLeave,
}: {
  index: number;
  kicker: string;
  title: string;
  body: string;
  stops: readonly RouteShowcaseStop[];
  copy: RouteShowcaseCardCopy;
  onExploreStop: (id: string) => void;
  onAddRoute: () => void;
  onPointerMove?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = stops[activeIndex] ?? stops[0];

  if (!active) return null;

  return (
    <article
      data-route-card
      data-active-stop={active.id}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="route-card group grid w-[88vw] shrink-0 snap-center overflow-hidden rounded-[12px] bg-[#183F34] text-white shadow-2xl shadow-[#183F34]/16 sm:w-[720px] lg:w-[1040px] lg:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="relative min-h-[300px] overflow-hidden sm:min-h-[390px] lg:min-h-[640px]">
        <div
          key={active.id}
          data-flip-src={active.id}
          className="route-stop-media absolute inset-0"
        >
          <Image
            src={active.image}
            alt={active.name}
            fill
            sizes="(min-width: 1024px) 470px, (min-width: 640px) 720px, 88vw"
            className="object-cover"
            style={{ objectPosition: active.imagePosition }}
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.06),rgba(6,18,15,.18)_48%,rgba(6,18,15,.82))]" />

        <span className="absolute right-5 top-5 text-xs font-extrabold tracking-[0.22em] text-white/88">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">
            {copy.stopLabel} {String(activeIndex + 1).padStart(2, "0")}
          </p>
          <p className="font-display mt-2 text-3xl leading-none text-white sm:text-4xl">
            {active.name}
          </p>
          <p className="mt-3 text-sm text-white/74">
            {active.category} · {active.duration}
          </p>
        </div>
      </div>

      <div className="flex flex-col p-6 sm:p-8 lg:p-12">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8CEC1]">{kicker}</p>
        <h3 className="font-display mt-5 max-w-xl text-4xl leading-[1.03] sm:text-5xl lg:text-[3.45rem]">
          {title}
        </h3>
        <p className="mt-6 max-w-xl text-[0.98rem] leading-7 text-white/76 sm:text-base sm:leading-8">
          {body}
        </p>

        <div className="mt-7 border-y border-white/14">
          {stops.map((stop, stopIndex) => {
            const selected = stopIndex === activeIndex;
            return (
              <button
                key={stop.id}
                type="button"
                aria-pressed={selected}
                onPointerEnter={() => setActiveIndex(stopIndex)}
                onFocus={() => setActiveIndex(stopIndex)}
                onClick={() => setActiveIndex(stopIndex)}
                className={`group/stop grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b border-white/14 py-3.5 text-left transition-colors last:border-b-0 ${
                  selected ? "text-[#F4D49B]" : "text-white/72 hover:text-white"
                }`}
              >
                <span className="text-[0.65rem] font-extrabold tracking-[0.2em]">
                  {String(stopIndex + 1).padStart(2, "0")}
                </span>
                <span className="font-semibold">{stop.name}</span>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full transition-transform ${
                    selected ? "scale-100 bg-[#E7B96A]" : "scale-0 bg-white"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
          <button
            type="button"
            onClick={() => onExploreStop(active.id)}
            className="rounded-full bg-[#FBFAF6] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#E7B96A]"
          >
            {copy.exploreStop}
          </button>
          <button
            type="button"
            onClick={onAddRoute}
            className="rounded-full border border-white/35 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
          >
            {copy.addRoute}
          </button>
        </div>
      </div>
    </article>
  );
}
