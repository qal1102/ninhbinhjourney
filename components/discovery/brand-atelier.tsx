"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BrowserCopy,
  SeasonalExperience,
  SeasonalGroup,
} from "@/components/discovery/seasonal-experience-browser";

type AtelierTone = NonNullable<SeasonalExperience["atelierTone"]>;

const themes: Record<AtelierTone, { surface: string; ink: string; accent: string }> = {
  linen: { surface: "#EEE9DF", ink: "#24231F", accent: "#6B543C" },
  pearl: { surface: "#F2EEE7", ink: "#171715", accent: "#6C5144" },
  sage: { surface: "#DFE1D6", ink: "#30362C", accent: "#4D5946" },
  forest: { surface: "#D4D9CA", ink: "#1F382A", accent: "#3F583F" },
  cognac: { surface: "#9A4324", ink: "#FFF7EC", accent: "#FFE0B5" },
};

const chapterLayout = [
  {
    article: "lg:min-h-[92svh]",
    media: "lg:col-span-7 lg:col-start-1",
    copy: "lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-14",
  },
  {
    article: "lg:min-h-[96svh]",
    media: "lg:col-span-6 lg:col-start-7 lg:row-start-1",
    copy: "lg:col-span-4 lg:col-start-2 lg:row-start-1 lg:self-end lg:pb-20",
  },
  {
    article: "lg:min-h-[104svh]",
    media: "lg:col-span-9 lg:col-start-2",
    copy: "lg:col-span-5 lg:col-start-7 lg:pt-4",
  },
  {
    article: "lg:min-h-[96svh]",
    media: "lg:col-span-6 lg:col-start-2",
    copy: "lg:col-span-4 lg:col-start-9 lg:self-center",
  },
];

function splitTitle(title: string) {
  const [brand, ...rest] = title.split(" · ");
  return { brand, story: rest.join(" · ") };
}

export function BrandAtelier({
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
  const [currentId, setCurrentId] = useState(group.items[0]?.id ?? "");
  const chapterRefs = useRef(new Map<string, HTMLElement>());
  const indexRef = useRef<HTMLElement>(null);
  const indexItemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const currentIndex = Math.max(0, group.items.findIndex((item) => item.id === currentId));
  const currentTone = group.items[currentIndex]?.atelierTone ?? "linen";
  const theme = themes[currentTone];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.getAttribute("data-atelier-chapter");
        if (id) setCurrentId(id);
      },
      { rootMargin: "-24% 0px -48% 0px", threshold: [0, 0.12, 0.35, 0.65] },
    );

    chapterRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [group.items]);

  useEffect(() => {
    const index = indexRef.current;
    const item = indexItemRefs.current.get(currentId);
    if (!index || !item) return;
    const left = item.offsetLeft - (index.clientWidth - item.clientWidth) / 2;
    index.scrollTo({
      left: Math.max(0, left),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [currentId]);

  const shellStyle = {
    "--atelier-surface": theme.surface,
    "--atelier-ink": theme.ink,
    "--atelier-accent": theme.accent,
  } as CSSProperties;

  return (
    <section
      id={`seasonal-${group.id}`}
      aria-labelledby={`seasonal-${group.id}-title`}
      data-atelier-current={currentId}
      style={shellStyle}
      className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-20 overflow-clip bg-[var(--atelier-surface)] text-[var(--atelier-ink)] transition-[background-color,color] duration-700"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[58rem] overflow-hidden opacity-[0.07]">
        <svg viewBox="0 0 1600 720" className="h-full w-full" preserveAspectRatio="none">
          <path d="M-80 568C122 420 284 626 466 474C664 308 776 565 956 389C1138 212 1272 408 1684 116" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M-120 624C136 456 296 666 493 509C692 349 806 606 997 431C1191 252 1328 439 1704 170" fill="none" stroke="currentColor" strokeWidth="0.55" />
        </svg>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-14 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:pb-24">
        <div>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[var(--atelier-accent)]">
            {String(groupIndex + 1).padStart(2, "0")} · {group.eyebrow}
          </p>
          <h3 id={`seasonal-${group.id}-title`} className="font-display mt-5 max-w-3xl text-5xl leading-[0.94] sm:text-7xl lg:text-[5.4rem]">
            {group.title}
          </h3>
        </div>
        <p className="max-w-xl text-base leading-8 opacity-70 lg:justify-self-end lg:text-lg">{group.body}</p>
      </div>

      <div className="sticky top-0 z-30 border-y border-current/12 bg-[color:var(--atelier-surface)]/90 backdrop-blur-xl transition-colors duration-700">
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <nav ref={indexRef} aria-label={copy.atelierNavigation} className="flex items-center gap-6 overflow-x-auto py-4 pr-12 [scrollbar-width:none] lg:pr-0">
            {group.items.map((item, index) => {
              const { brand } = splitTitle(item.title);
              const selected = item.id === currentId;
              return (
                <a
                  key={item.id}
                  ref={(node) => {
                    if (node) indexItemRefs.current.set(item.id, node);
                    else indexItemRefs.current.delete(item.id);
                  }}
                  href={`#atelier-${item.id}`}
                  aria-current={selected ? "step" : undefined}
                  className={`group/index shrink-0 text-[0.62rem] font-extrabold uppercase tracking-[0.2em] transition-opacity ${selected ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
                >
                  <span className="mr-2 font-medium">{String(index + 1).padStart(2, "0")}</span>
                  {brand}
                </a>
              );
            })}
          </nav>
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-0 grid h-full w-11 place-items-center bg-gradient-to-l from-[var(--atelier-surface)] via-[var(--atelier-surface)] to-transparent text-sm lg:hidden">→</span>
          <div aria-hidden="true" className="h-px bg-current/10">
            <span
              className="block h-px bg-[var(--atelier-accent)] transition-[width] duration-700 ease-out"
              style={{ width: `${((currentIndex + 1) / group.items.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {group.items.map((item, index) => {
          const { brand, story } = splitTitle(item.title);
          const isCurrent = currentId === item.id;
          const isFinale = item.atelierFinale;
          const layout = chapterLayout[index] ?? chapterLayout[0];
          const ref = (node: HTMLElement | null) => {
            if (node) chapterRefs.current.set(item.id, node);
            else chapterRefs.current.delete(item.id);
          };

          if (isFinale) {
            return (
              <article
                ref={ref}
                key={item.id}
                id={`atelier-${item.id}`}
                data-seasonal-card={item.id}
                data-atelier-chapter={item.id}
                data-atelier-finale="true"
                data-in-view={isCurrent ? "true" : "false"}
                className="relative left-1/2 min-h-[108svh] w-screen -translate-x-1/2 scroll-mt-28 bg-[#93401F] text-[#FFF7EC] lg:min-h-[124svh]"
              >
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  aria-label={`${copy.openDetail}: ${item.title}`}
                  className="group/finale relative mx-auto grid min-h-[100svh] w-full max-w-7xl gap-10 overflow-hidden px-5 py-16 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#F4C28D] sm:px-8 lg:sticky lg:top-0 lg:grid-cols-12 lg:items-center lg:py-12"
                >
                  <svg aria-hidden="true" viewBox="0 0 1200 680" className="atelier-river-line pointer-events-none absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="none">
                    <path d="M-100 560C154 338 328 652 535 430C720 230 846 489 1012 286C1112 164 1218 190 1320 92" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="8 10" />
                    <path d="M-80 610C176 398 346 691 559 475C756 275 870 538 1042 334C1137 222 1248 230 1340 142" fill="none" stroke="currentColor" strokeWidth="0.45" />
                  </svg>
                  <span aria-hidden="true" className="pointer-events-none absolute -right-8 top-[8%] font-display text-[38vw] leading-none text-white/[0.035] lg:right-[2%] lg:text-[20rem]">05</span>

                  <div data-seasonal-card-media className="atelier-media relative z-10 aspect-[4/5] overflow-hidden bg-[#78351f] shadow-[0_36px_100px_rgba(45,14,4,.42)] lg:col-span-7 lg:col-start-1 lg:max-h-[82svh]">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(min-width: 1024px) 58vw, 100vw"
                      className="atelier-image object-cover"
                    />
                    <span className="absolute bottom-5 left-5 border-l border-white/50 pl-3 text-[0.58rem] font-extrabold uppercase tracking-[0.24em] text-white/82 sm:bottom-7 sm:left-7">
                      Ninh Bình · 2026
                    </span>
                  </div>

                  <div data-seasonal-card-copy className="relative z-10 lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-16">
                    <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.25em] text-[#FFE0B5]">{item.kicker}</p>
                    <p className="font-display mt-5 text-6xl leading-[0.82] sm:text-7xl lg:text-[6.4rem]">{brand}</p>
                    <h4 className="font-display mt-5 max-w-md text-3xl leading-none sm:text-4xl">{story}</h4>
                    <p className="mt-6 max-w-md text-base leading-8 text-white/76">{item.body}</p>
                    <span className="mt-8 inline-flex items-center gap-4 border-b border-white/45 pb-2 text-sm font-extrabold">
                      {item.editorialAction ?? copy.actions[item.action]}
                      <span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover/finale:translate-x-2">→</span>
                    </span>
                    <p className="mt-10 max-w-sm text-[0.62rem] uppercase leading-5 tracking-[0.16em] text-white/80">{copy.editorialNotice}</p>
                  </div>
                </button>
              </article>
            );
          }

          return (
            <article
              ref={ref}
              key={item.id}
              id={`atelier-${item.id}`}
              data-seasonal-card={item.id}
              data-atelier-chapter={item.id}
              data-in-view={isCurrent ? "true" : "false"}
              className={`flex scroll-mt-32 items-center border-b border-current/10 py-16 sm:py-20 lg:py-28 ${layout.article}`}
            >
              <button
                type="button"
                onClick={() => onOpen(item)}
                aria-label={`${copy.openDetail}: ${item.title}`}
                className="group/chapter grid w-full gap-8 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--atelier-accent)] lg:grid-cols-12"
              >
                <div data-seasonal-card-media className={`atelier-media relative aspect-[4/5] overflow-hidden bg-black/5 shadow-[0_30px_90px_rgba(53,45,29,.16)] ${layout.media}`}>
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 68vw, 100vw"
                    className="atelier-image object-cover"
                  />
                  <span aria-hidden="true" className="absolute bottom-4 right-4 font-display text-6xl leading-none text-white/86 mix-blend-difference sm:bottom-6 sm:right-6 sm:text-7xl">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute left-4 top-4 border border-white/45 bg-[#F8F3E9]/86 px-3 py-1.5 text-[0.56rem] font-extrabold uppercase tracking-[0.19em] text-[#243329] backdrop-blur sm:left-6 sm:top-6">
                    {copy.editorialLabel}
                  </span>
                </div>

                <div data-seasonal-card-copy className={layout.copy}>
                  <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[var(--atelier-accent)]">{item.kicker}</p>
                  <p className="font-display mt-4 text-5xl leading-[0.88] sm:text-6xl">{brand}</p>
                  <h4 className="font-display mt-4 text-2xl leading-tight sm:text-3xl">{story}</h4>
                  <p className="mt-5 max-w-md text-[0.95rem] leading-7 opacity-68">{item.body}</p>
                  <span className="mt-7 inline-flex items-center gap-3 border-b border-current/28 pb-2 text-sm font-extrabold">
                    {item.editorialAction ?? copy.actions[item.action]}
                    <span aria-hidden="true" className="transition-transform duration-500 group-hover/chapter:translate-x-2">→</span>
                  </span>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
