"use client";

import Image from "next/image";

export type PinnedStoryBeat = {
  image: string;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
};

/**
 * Ghim 1 khung hinh, lan luot mo va tat 3 "nhip" anh + chu qua
 * animation-timeline: view() thuan CSS (khong GSAP, khong JS). Trinh
 * duyet chua ho tro hoac prefers-reduced-motion thi roi ve bo cuc xep
 * chong binh thuong (khong ghim, khong absolute) -- van doc duoc du noi
 * dung het, khong bao gio vo layout hay trong rong.
 */
export function PinnedStory({ beats }: { beats: readonly PinnedStoryBeat[] }) {
  return (
    <section className="pinned-story" style={{ ["--beat-count" as string]: beats.length }}>
      <div className="pinned-story-sticky">
        {beats.map((beat, index) => (
          <div key={beat.image} className="pinned-story-beat" data-beat={index + 1}>
            <div className="pinned-story-media">
              <Image
                src={beat.image}
                alt={beat.alt}
                fill
                sizes="100vw"
                className="object-cover"
                priority={index === 0}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.05),rgba(6,18,15,.08)_45%,rgba(6,18,15,.68))]" />
            </div>
            {/* Chu tach rieng khoi anh, tu fade voi khung hep hon va khong
                chong lap nhau -- anh duoc phep crossfade rong/mem, nhung
                2 khoi chu chong len nhau cung luc se khong doc duoc (bat
                qua chup anh thuc te tren mobile: 2 tieu de de len nhau). */}
            <div className="pinned-story-caption pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-16 text-white sm:px-8 sm:pb-20">
              <div className="mx-auto max-w-3xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">
                  {beat.eyebrow}
                </p>
                <h2 className="font-display mt-4 text-3xl leading-tight sm:text-5xl">{beat.headline}</h2>
                <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{beat.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
