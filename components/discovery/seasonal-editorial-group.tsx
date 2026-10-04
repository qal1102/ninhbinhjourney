"use client";

import Image from "next/image";
import { useState } from "react";
import type {
  BrowserCopy,
  SeasonalExperience,
  SeasonalGroup,
} from "@/components/discovery/seasonal-experience-browser";

type GroupProps = {
  group: SeasonalGroup;
  groupIndex: number;
  copy: BrowserCopy;
  onOpen: (item: SeasonalExperience) => void;
  /** A15-TRUNG-THU-01: false từ 28/09/2026 giờ VN, xem lib/seasonal/mid-autumn-season.ts. */
  seasonOpen: boolean;
};

function SectionHeading({ group, groupIndex }: Pick<GroupProps, "group" | "groupIndex">) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
      <div>
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.3em] text-[#E7B96A]">
          {String(groupIndex + 1).padStart(2, "0")} · {group.eyebrow}
        </p>
        <h3
          id={`seasonal-${group.id}-title`}
          className="font-display mt-4 max-w-3xl text-4xl leading-[0.98] text-white sm:text-6xl lg:text-[4.65rem]"
        >
          {group.title}
        </h3>
      </div>
      <p className="max-w-2xl text-base leading-7 text-white/66 lg:justify-self-end lg:text-lg lg:leading-8">
        {group.body}
      </p>
    </div>
  );
}

function ConceptMark({ item, copy }: { item: SeasonalExperience; copy: BrowserCopy }) {
  if (!item.concept) return null;
  return (
    <span className="absolute left-4 top-4 border border-white/35 bg-[#14251f]/76 px-3 py-1.5 text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur-md sm:left-5 sm:top-5">
      {copy.conceptLabel}
    </span>
  );
}

/**
 * A15-TRUNG-THU-01. Đúng một mục dùng action "booking" (Bàn Trăng bên Ngô
 * Đồng) -- sau 27/09/2026 giờ VN, đánh dấu ngay trên thẻ trước khi khách kịp
 * bấm mở chi tiết, thay vì để họ tự khám phá ra ở bước sau.
 */
function SeasonClosedMark({ item, seasonOpen, copy }: { item: SeasonalExperience; seasonOpen: boolean; copy: BrowserCopy }) {
  if (seasonOpen || item.action !== "booking") return null;
  return (
    <span className="absolute left-4 top-4 border border-white/35 bg-[#14251f]/76 px-3 py-1.5 text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur-md sm:left-5 sm:top-5">
      {copy.bookingClosedBadge}
    </span>
  );
}

function ActionLine({ item, copy }: { item: SeasonalExperience; copy: BrowserCopy }) {
  return (
    <span className="mt-auto flex items-end justify-between gap-4 pt-6 text-sm font-bold text-[#F1D39D]">
      <span>{item.price ? `${copy.fromPrice} ${item.price}` : copy.actions[item.action]}</span>
      <span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-1.5">↗</span>
    </span>
  );
}

function CatalogLayout({ group, copy, onOpen }: Omit<GroupProps, "groupIndex">) {
  const featured = group.items.at(-1) ?? group.items[0];
  const supporting = group.items.filter((item) => item.id !== featured?.id);

  return (
    <div data-seasonal-layout="catalog" className="mt-9 grid gap-px overflow-hidden bg-white/12 lg:grid-cols-12">
      {featured ? (
        <article data-seasonal-card={featured.id} className="bg-[#20342d] lg:col-span-7 lg:row-span-2">
          <button
            type="button"
            onClick={() => onOpen(featured)}
            aria-label={`${copy.openDetail}: ${featured.title}`}
            className="group grid h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A] sm:grid-cols-[1.08fr_.92fr] lg:grid-cols-1"
          >
            <div data-seasonal-card-media className="relative aspect-[4/5] overflow-hidden bg-[#2a4037] sm:aspect-[5/4] lg:aspect-[7/8]">
              <Image src={featured.image} alt={featured.title} fill sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover transition duration-1000 group-hover:scale-[1.018]" />
              <ConceptMark item={featured} copy={copy} />
              <span aria-hidden="true" className="absolute bottom-5 right-5 font-display text-7xl leading-none text-white/76">03</span>
            </div>
            <div data-seasonal-card-copy className="flex min-h-[270px] flex-col bg-[#20342d] p-6 sm:p-8 lg:min-h-[290px]">
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#E7B96A]">{featured.kicker}</p>
              <h4 className="font-display mt-3 text-4xl leading-none text-white sm:text-5xl">{featured.title}</h4>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/66">{featured.body}</p>
              <ActionLine item={featured} copy={copy} />
            </div>
          </button>
        </article>
      ) : null}

      <div className="grid gap-px bg-white/12 lg:col-span-5 lg:row-span-2 lg:grid-rows-2">
        {supporting.map((item, index) => (
          <article key={item.id} data-seasonal-card={item.id} className="h-full bg-[#172b24]">
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={`${copy.openDetail}: ${item.title}`}
              className="group grid h-full w-full grid-cols-[0.84fr_1.16fr] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A] sm:grid-cols-[0.72fr_1.28fr] lg:grid-cols-1 xl:grid-cols-[0.82fr_1.18fr]"
            >
              <div data-seasonal-card-media className="relative min-h-[255px] overflow-hidden bg-[#2a4037] lg:aspect-[16/9] lg:min-h-0 xl:aspect-auto xl:min-h-[330px]">
                <Image src={item.image} alt={item.title} fill sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 42vw, 42vw" className="object-cover transition duration-1000 group-hover:scale-[1.025]" />
                <span aria-hidden="true" className="absolute bottom-4 right-4 font-display text-5xl leading-none text-white/78">0{index + 1}</span>
              </div>
              <div data-seasonal-card-copy className="flex min-h-[255px] flex-col p-5 sm:p-7 xl:min-h-[330px]">
                <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] text-[#E7B96A]">{item.kicker}</p>
                <h4 className="font-display mt-3 text-3xl leading-none text-white">{item.title}</h4>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/64">{item.body}</p>
                <ActionLine item={item} copy={copy} />
              </div>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function FeatureLayout({ group, copy, onOpen, seasonOpen }: Omit<GroupProps, "groupIndex">) {
  const [featured, ...supporting] = group.items;
  if (!featured) return null;

  return (
    <div data-seasonal-layout="feature" className="mt-9">
      <article data-seasonal-card={featured.id} className="border-y border-white/14 py-5 sm:py-7">
        <button
          type="button"
          onClick={() => onOpen(featured)}
          aria-label={`${copy.openDetail}: ${featured.title}`}
          className="group grid w-full gap-7 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E7B96A] lg:grid-cols-12 lg:items-center"
        >
          <div data-seasonal-card-media className="relative aspect-[16/10] overflow-hidden bg-[#263b33] lg:col-span-8">
            <Image src={featured.image} alt={featured.title} fill sizes="(min-width: 1024px) 68vw, 100vw" className="object-cover transition duration-[1200ms] group-hover:scale-[1.018]" />
            <SeasonClosedMark item={featured} seasonOpen={seasonOpen} copy={copy} />
            <span className="absolute bottom-5 left-5 border-l border-white/60 pl-3 text-[0.58rem] font-extrabold uppercase tracking-[0.2em] text-white sm:bottom-7 sm:left-7">{featured.kicker}</span>
          </div>
          <div data-seasonal-card-copy className="flex min-h-[280px] flex-col lg:col-span-4 lg:py-4">
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#E7B96A]">{copy.fromPrice} {featured.price}</p>
            <h4 className="font-display mt-4 text-4xl leading-[0.95] text-white sm:text-5xl">{featured.title}</h4>
            <p className="mt-5 text-base leading-7 text-white/66">{featured.body}</p>
            <ActionLine item={featured} copy={copy} />
          </div>
        </button>
      </article>

      <div className="grid border-b border-white/14 sm:grid-cols-3">
        {supporting.map((item, index) => (
          <article key={item.id} data-seasonal-card={item.id} className="border-t border-white/14 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={`${copy.openDetail}: ${item.title}`}
              className="group flex h-full w-full flex-col p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A] sm:p-6"
            >
              <div data-seasonal-card-media className="relative aspect-[16/10] w-full overflow-hidden bg-[#263b33]">
                <Image src={item.image} alt={item.title} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover transition duration-1000 group-hover:scale-[1.025]" />
                <ConceptMark item={item} copy={copy} />
              </div>
              <div data-seasonal-card-copy className="flex min-h-[240px] flex-1 flex-col pt-5">
                <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] text-[#E7B96A]">0{index + 2} · {item.kicker}</p>
                <h4 className="font-display mt-3 text-3xl leading-none text-white">{item.title}</h4>
                <p className="mt-4 text-sm leading-6 text-white/62">{item.body}</p>
                <ActionLine item={item} copy={copy} />
              </div>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function StoriesLayout({ group, copy, onOpen }: Omit<GroupProps, "groupIndex">) {
  return (
    <div data-seasonal-layout="stories" className="mt-9 border-t border-white/14">
      {group.items.map((item, index) => (
        <article key={item.id} data-seasonal-card={item.id} className="border-b border-white/14 py-6 sm:py-8 lg:py-10">
          <button
            type="button"
            onClick={() => onOpen(item)}
            aria-label={`${copy.openDetail}: ${item.title}`}
            className="group grid w-full gap-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E7B96A] lg:grid-cols-12 lg:items-end"
          >
            <div data-seasonal-card-media className={`relative aspect-[16/9] overflow-hidden bg-[#263b33] lg:col-span-8 ${index % 2 ? "lg:col-start-5 lg:row-start-1" : "lg:col-start-1"}`}>
              <Image src={item.image} alt={item.title} fill sizes="(min-width: 1024px) 68vw, 100vw" className="object-cover saturate-[.92] transition duration-[1200ms] group-hover:scale-[1.02] group-hover:saturate-100" />
              <ConceptMark item={item} copy={copy} />
              <span aria-hidden="true" className="absolute bottom-4 right-5 font-display text-[5rem] leading-none text-white/75 sm:text-[7rem]">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div data-seasonal-card-copy className={`flex min-h-[255px] flex-col lg:col-span-4 lg:row-start-1 ${index % 2 ? "lg:col-start-1" : "lg:col-start-9"}`}>
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-[#E7B96A]">{item.kicker}</p>
              <h4 className="font-display mt-4 text-4xl leading-[0.96] text-white">{item.title}</h4>
              <p className="mt-5 text-sm leading-7 text-white/64">{item.body}</p>
              <ActionLine item={item} copy={copy} />
            </div>
          </button>
        </article>
      ))}
    </div>
  );
}

function MosaicLayout({ group, copy, onOpen }: Omit<GroupProps, "groupIndex">) {
  const cells = [
    "lg:col-span-7 lg:row-span-2",
    "lg:col-span-5",
    "lg:col-span-5",
  ];

  return (
    <div data-seasonal-layout="mosaic" className="mt-9 grid gap-4 lg:grid-cols-12">
      {group.items.map((item, index) => (
        <article key={item.id} data-seasonal-card={item.id} className={cells[index] ?? "lg:col-span-4"}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            aria-label={`${copy.openDetail}: ${item.title}`}
            className="group grid h-full w-full overflow-hidden border border-white/12 bg-[#20342d] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A] sm:grid-cols-[1.1fr_.9fr] lg:grid-cols-1"
          >
            <div data-seasonal-card-media className={`relative overflow-hidden bg-[#263b33] ${index === 0 ? "aspect-[16/12] lg:aspect-[7/6]" : "aspect-[16/10]"}`}>
              <Image src={item.image} alt={item.title} fill sizes={index === 0 ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 1024px) 42vw, 100vw"} className="object-cover transition duration-[1200ms] group-hover:scale-[1.02]" />
              <ConceptMark item={item} copy={copy} />
            </div>
            <div data-seasonal-card-copy className={`flex flex-col p-6 ${index === 0 ? "min-h-[285px] sm:p-8" : "min-h-[250px]"}`}>
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.21em] text-[#E7B96A]">{String(index + 1).padStart(2, "0")} · {item.kicker}</p>
              <h4 className={`font-display mt-3 leading-none text-white ${index === 0 ? "text-4xl sm:text-5xl" : "text-3xl"}`}>{item.title}</h4>
              <p className="mt-4 text-sm leading-6 text-white/64">{item.body}</p>
              <ActionLine item={item} copy={copy} />
            </div>
          </button>
        </article>
      ))}
    </div>
  );
}

function IndexLayout({ group, copy, onOpen }: Omit<GroupProps, "groupIndex">) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = group.items[activeIndex] ?? group.items[0];
  if (!active) return null;

  return (
    <div data-seasonal-layout="index" className="mt-9 grid overflow-hidden border-y border-white/14 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="border-white/14 lg:border-r">
        {group.items.map((item, index) => {
          const selected = index === activeIndex;
          return (
            <article key={item.id} data-seasonal-card={item.id} className="border-b border-white/12 last:border-b-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                aria-pressed={selected}
                aria-label={`${copy.selectStory}: ${item.title}`}
                className={`group grid w-full grid-cols-[3.2rem_1fr_auto] items-center gap-3 px-2 py-5 text-left transition sm:px-5 ${selected ? "bg-[#E7B96A] text-[#17352c]" : "text-white hover:bg-white/[0.045]"}`}
              >
                <div data-seasonal-card-media className="relative aspect-square overflow-hidden bg-[#263b33]">
                  <Image src={item.image} alt="" fill sizes="52px" className="object-cover" />
                </div>
                <div data-seasonal-card-copy>
                  <p className={`text-[0.54rem] font-extrabold uppercase tracking-[0.18em] ${selected ? "text-[#17352c]" : "text-[#E7B96A]"}`}>{String(index + 1).padStart(2, "0")} · {item.kicker}</p>
                  <h4 className="font-display mt-1 text-2xl leading-none">{item.title}</h4>
                </div>
                <span aria-hidden="true" className="text-xl transition-transform group-hover:translate-x-1">→</span>
              </button>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onOpen(active)}
        aria-label={`${copy.openDetail}: ${active.title}`}
        className="group relative min-h-[560px] overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A] sm:min-h-[680px]"
      >
        <Image key={active.image} src={active.image} alt={active.title} fill sizes="(min-width: 1024px) 64vw, 100vw" className="seasonal-index-image object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#08120e]/92 via-[#08120e]/8 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
          <span className="block max-w-2xl text-sm leading-7 text-white/74">{active.body}</span>
          <span className="mt-5 inline-flex items-center gap-3 border-b border-white/45 pb-2 text-sm font-extrabold text-white">
            {copy.actions[active.action]} <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-2">→</span>
          </span>
        </span>
      </button>
    </div>
  );
}

export function SeasonalEditorialGroup(props: GroupProps) {
  const { group, groupIndex } = props;
  const layout = group.layout ?? "catalog";

  return (
    <section
      id={`seasonal-${group.id}`}
      aria-labelledby={`seasonal-${group.id}-title`}
      data-seasonal-group={group.id}
      className="scroll-mt-24 border-t border-white/12 pt-12 sm:pt-16"
    >
      <SectionHeading group={group} groupIndex={groupIndex} />
      {layout === "feature" ? <FeatureLayout {...props} /> : null}
      {layout === "stories" ? <StoriesLayout {...props} /> : null}
      {layout === "mosaic" ? <MosaicLayout {...props} /> : null}
      {layout === "index" ? <IndexLayout {...props} /> : null}
      {layout === "catalog" || layout === "rail" ? <CatalogLayout {...props} /> : null}
    </section>
  );
}
