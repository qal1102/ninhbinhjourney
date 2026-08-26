"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type {
  BrowserCopy,
  SeasonalExperience,
  SeasonalGroup,
} from "@/components/discovery/seasonal-experience-browser";

function brandName(title: string) {
  return title.split(" · ")[0] ?? title;
}

export function LuxuryCampaignArchive({
  group,
  groupIndex,
  copy,
  onOpen,
}: {
  group: SeasonalGroup;
  groupIndex: number;
  copy: BrowserCopy;
  onOpen: (item: SeasonalExperience) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(0);
  const active = group.items[activeIndex] ?? group.items[0];
  const media = useMemo(
    () => active ? Array.from(new Set([active.image, ...(active.gallery ?? [])])) : [],
    [active],
  );

  if (!active) return null;
  const activeMedia = media[mediaIndex] ?? active.image;

  function move(direction: -1 | 1) {
    const next = (activeIndex + direction + group.items.length) % group.items.length;
    setMediaIndex(0);
    setActiveIndex(next);
  }

  return (
    <section
      id={`seasonal-${group.id}`}
      aria-labelledby={`seasonal-${group.id}-title`}
      data-luxury-archive
      className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-20 overflow-clip bg-[#120f0d] text-[#F6F0E6]"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <span className="absolute -right-[6vw] top-8 font-display text-[35vw] leading-none text-[#D6AA6D]">A</span>
        <span className="absolute left-[7vw] top-[34rem] h-px w-[42vw] -rotate-[14deg] bg-[#D6AA6D]" />
      </div>

      <header className="relative mx-auto grid max-w-7xl gap-7 px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.3em] text-[#D6AA6D]">
            {String(groupIndex + 1).padStart(2, "0")} · {group.eyebrow}
          </p>
          <h3 id={`seasonal-${group.id}-title`} className="font-display mt-5 max-w-3xl text-5xl leading-[0.92] sm:text-7xl lg:text-[5.35rem]">
            {group.title}
          </h3>
        </div>
        <p className="max-w-2xl text-base leading-8 text-white/64 lg:justify-self-end lg:text-lg">{group.body}</p>
      </header>

      <div className="relative border-y border-white/14">
        <nav aria-label={copy.archiveNavigation} className="mx-auto flex max-w-7xl overflow-x-auto px-5 sm:px-8 xl:grid xl:grid-cols-8 xl:overflow-visible [scrollbar-width:none]">
          {group.items.map((item, index) => {
            const selected = index === activeIndex;
            return (
              <article key={item.id} data-seasonal-card={item.id} className="shrink-0 border-r border-white/12 first:border-l xl:min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${copy.selectStory}: ${item.title}`}
                  onClick={() => {
                    setMediaIndex(0);
                    setActiveIndex(index);
                  }}
                  className={`group flex min-h-[5.4rem] min-w-[9.8rem] items-center gap-3 px-4 text-left transition sm:min-w-[11rem] sm:px-5 xl:min-w-0 xl:px-3 ${selected ? "bg-[#F1E8D8] text-[#17120f]" : "text-white/72 hover:bg-white/[0.045] hover:text-white"}`}
                >
                  <span data-seasonal-card-media className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 xl:hidden">
                    <Image src={item.image} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                  <span data-seasonal-card-copy className="min-w-0">
                    <span className={`block text-[0.5rem] font-bold uppercase tracking-[0.18em] ${selected ? "text-[#8B5D39]" : "text-[#D6AA6D]"}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="mt-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] xl:text-[0.6rem]">{brandName(item.title)}</span>
                  </span>
                </button>
              </article>
            );
          })}
        </nav>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-10 lg:py-20">
        <aside className="order-2 lg:order-1 lg:col-span-4 lg:flex lg:min-h-[650px] lg:flex-col">
          <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.24em] text-[#D6AA6D]">{active.kicker}</p>
          <p className="font-display mt-4 text-5xl leading-[0.86] sm:text-6xl">{brandName(active.title)}</p>
          <h4 className="font-display mt-5 max-w-sm text-2xl leading-tight text-white/86 sm:text-3xl">{active.title.split(" · ").slice(1).join(" · ")}</h4>
          <p className="mt-6 max-w-sm text-sm leading-7 text-white/62 sm:text-base">{active.body}</p>

          <button
            type="button"
            onClick={() => onOpen(active)}
            aria-label={`${copy.openDetail}: ${active.title}`}
            className="group mt-8 flex w-full max-w-sm items-center justify-between border-y border-white/22 py-4 text-left text-sm font-extrabold text-white transition hover:border-[#D6AA6D]"
          >
            {active.editorialAction ?? copy.actions[active.action]}
            <span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-2">→</span>
          </button>

          <div className="mt-10 flex items-center gap-4 lg:mt-auto">
            <button type="button" onClick={() => move(-1)} aria-label={copy.previousStory} className="grid h-12 w-12 place-items-center rounded-full border border-white/24 text-xl transition hover:border-[#D6AA6D] hover:bg-[#D6AA6D] hover:text-[#17120f]">←</button>
            <p className="font-display text-3xl tabular-nums">
              {String(activeIndex + 1).padStart(2, "0")} <span className="text-lg text-white/35">/ {String(group.items.length).padStart(2, "0")}</span>
            </p>
            <button type="button" onClick={() => move(1)} aria-label={copy.nextStory} className="grid h-12 w-12 place-items-center rounded-full border border-white/24 text-xl transition hover:border-[#D6AA6D] hover:bg-[#D6AA6D] hover:text-[#17120f]">→</button>
          </div>
        </aside>

        <div className="order-1 lg:order-2 lg:col-span-8">
          <button
            type="button"
            data-luxury-stage
            onClick={() => onOpen(active)}
            aria-label={`${copy.openDetail}: ${active.title}`}
            className="group relative block aspect-[16/10] w-full overflow-hidden bg-[#27211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D6AA6D]"
          >
            <Image key={activeMedia} src={activeMedia} alt={active.title} fill priority={activeIndex === 0} sizes="(min-width: 1024px) 68vw, 100vw" className="luxury-archive-image object-cover" />
            <span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-white/12" />
            <span className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full border border-white/45 bg-black/15 text-xl text-white backdrop-blur transition duration-500 group-hover:rotate-45 group-hover:bg-white group-hover:text-black">↗</span>
          </button>

          {media.length > 1 ? (
            <div aria-label={copy.galleryLabel} className="mt-4 grid grid-cols-2 gap-3" role="group">
              {media.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setMediaIndex(index)}
                  aria-label={`${copy.galleryLabel} ${index + 1}: ${active.title}`}
                  aria-pressed={index === mediaIndex}
                  className={`group relative aspect-[16/6] overflow-hidden border transition ${index === mediaIndex ? "border-[#D6AA6D]" : "border-white/14 opacity-55 hover:opacity-100"}`}
                >
                  <Image src={image} alt="" fill sizes="(min-width: 1024px) 32vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.025]" />
                  <span aria-hidden="true" className="absolute bottom-2 left-2 text-[0.52rem] font-bold tracking-[0.18em] text-white">0{index + 1}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 border-t border-white/12 pt-4 text-[0.58rem] uppercase tracking-[0.18em] text-white/80">{copy.editorialNotice}</p>
          )}
        </div>
      </div>

      <footer className="relative border-t border-white/12 px-5 py-6 text-center text-[0.56rem] uppercase leading-5 tracking-[0.17em] text-white/80 sm:px-8">
        {copy.editorialNotice}
      </footer>
    </section>
  );
}
