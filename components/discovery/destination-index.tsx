"use client";

import Image from "next/image";
import { useState } from "react";

export type IndexItem = {
  id: string;
  ordinal: string;
  name: string;
  image: string;
  imagePosition: string;
  category: string;
  duration: string;
  tagline: string;
};

export type IndexCopy = {
  sectionLabel: string;
  sectionTitle: string;
  sectionIntro: string;
  hint: string;
  openLabel: string;
};

/**
 * Danh mục hai mặt phẳng học từ split-screen editorial của MERSI:
 * tên địa điểm cuộn ở trái, ảnh đang chọn bám khung ở phải và mở ra
 * bằng clip-path. Ảnh luôn đứng yên ở một nơi có chủ đích, không còn
 * bay theo con trỏ rồi che chính danh sách như bản cũ.
 *
 * Mobile không có hover nên giữ ảnh thu nhỏ ngay trong từng hàng. Chạm
 * một lần vẫn mở chi tiết; không dựng tương tác hai-chạm chỉ để phô diễn.
 */
export function DestinationIndex({
  items,
  copy,
  onSelect,
}: {
  items: readonly IndexItem[];
  copy: IndexCopy;
  onSelect: (id: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex] ?? items[0] ?? null;

  return (
    <section id="destination-index" className="bg-[#FBFAF6] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{copy.sectionLabel}</p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183F34] sm:text-6xl">
            {copy.sectionTitle}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#4A5751]">{copy.sectionIntro}</p>
          <p className="mt-4 hidden text-sm text-[#6D756F] lg:block">{copy.hint}</p>
        </div>

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,.72fr)] xl:gap-20">
          <ul className="border-b border-[#183F34]/14">
            {items.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(item.id)}
                    onPointerEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    className={`group grid w-full grid-cols-[3rem_4rem_1fr_auto] items-center gap-3 border-t border-[#183F34]/14 py-5 text-left transition-colors sm:grid-cols-[3.5rem_5rem_1fr_auto] sm:gap-5 sm:py-6 lg:grid-cols-[3.5rem_1fr_auto] lg:px-2 lg:py-7 ${
                      selected ? "bg-[#183F34]/[0.045]" : "hover:bg-[#183F34]/[0.025]"
                    }`}
                  >
                    <span className="text-[0.66rem] font-extrabold tracking-[0.2em] text-[#3F7568]">
                      {item.ordinal}
                    </span>

                    <span
                      data-flip-src={item.id}
                      className="relative h-16 w-16 overflow-hidden rounded-[8px] bg-[#E8E4DA] sm:h-20 sm:w-20 lg:hidden"
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                        style={{ objectPosition: item.imagePosition }}
                      />
                    </span>

                    <span className="min-w-0">
                      <span
                        className={`font-display block text-2xl leading-tight transition-colors sm:text-4xl lg:text-[2.7rem] ${
                          selected ? "text-[#3F7568]" : "text-[#183F34] group-hover:text-[#3F7568]"
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="mt-1.5 block text-[0.66rem] uppercase tracking-[0.18em] text-[#6D756F] sm:text-xs">
                        {item.category} · {item.duration}
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-xl transition-transform duration-300 ${
                        selected
                          ? "translate-x-1 text-[#3F7568]"
                          : "text-[#183F34]/30 group-hover:translate-x-1 group-hover:text-[#3F7568]"
                      }`}
                    >
                      →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {active ? (
            <button
              type="button"
              onClick={() => onSelect(active.id)}
              aria-label={`${copy.openLabel}: ${active.name}`}
              className="group sticky top-20 hidden h-[min(72vh,680px)] w-full overflow-hidden rounded-[12px] bg-[#183F34] text-left shadow-2xl shadow-[#183F34]/20 lg:block"
            >
              <span
                key={active.id}
                data-flip-src={active.id}
                className="destination-index-preview absolute inset-0"
              >
                <Image
                  src={active.image}
                  alt={active.name}
                  fill
                  sizes="(min-width: 1280px) 460px, 36vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                  style={{ objectPosition: active.imagePosition }}
                />
              </span>
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.04),rgba(6,18,15,.14)_44%,rgba(6,18,15,.88))]" />
              <span className="absolute left-6 top-6 text-[0.68rem] font-extrabold tracking-[0.24em] text-[#F4D49B]">
                {active.ordinal}
              </span>
              <span className="absolute inset-x-0 bottom-0 p-7 text-white xl:p-9">
                <span className="font-display block text-4xl leading-none xl:text-5xl">{active.name}</span>
                <span className="mt-4 block max-w-sm text-sm leading-6 text-white/76">{active.tagline}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F4D49B]">
                  {copy.openLabel} <span aria-hidden="true">↗</span>
                </span>
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
