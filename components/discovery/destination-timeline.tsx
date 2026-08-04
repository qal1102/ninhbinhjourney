"use client";

import { useState } from "react";

type Localized = { vi: string; en: string };

export type DestinationTimelineEntry = {
  year: Localized;
  label: Localized;
  detail: Localized;
};

export function DestinationTimeline({
  entries,
}: {
  entries: readonly DestinationTimelineEntry[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!entries.length) return null;
  const active = entries[activeIndex];

  return (
    <section className="mt-12 border-t border-[#dcd9d1] pt-8">
      <h2 className="font-display text-3xl text-[#183f34]">Dòng thời gian</h2>
      <div
        role="tablist"
        aria-label="Các mốc thời gian"
        className="mt-6 flex gap-2 overflow-x-auto pb-1"
      >
        {entries.map((entry, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={entry.year.vi + index}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIndex(index)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-[0.1em] transition ${
                isActive
                  ? "border-[#183f34] bg-[#183f34] text-white"
                  : "border-[#d7d5cd] bg-white text-[#59654b] hover:border-[#183f34]"
              }`}
            >
              {entry.year.vi}
            </button>
          );
        })}
      </div>
      <div key={activeIndex} className="fade-up mt-6 max-w-2xl">
        <h3 className="font-display text-2xl text-[#183f34]">{active.label.vi}</h3>
        <p className="mt-3 text-lg leading-8 text-[#4d5b55]">{active.detail.vi}</p>
      </div>
    </section>
  );
}
