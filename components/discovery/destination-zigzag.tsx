"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type ZigzagItem = {
  id: string;
  name: string;
  image: string;
  imagePosition: string;
  category: string;
  duration: string;
  tagline: string;
  description: string;
  highlights: string[];
};

export type ZigzagCopy = {
  sectionLabel: string;
  sectionTitle: string;
  sectionIntro: string;
  explore: string;
  add: string;
  added: string;
  ctaTitle: string;
  ctaBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaOffer: string;
};

/**
 * Toan bo 15 diem den xep so le trai-phai, cuon toi dau thong tin hien
 * toi do, ket bang mot khoi moi lap hanh trinh.
 *
 * Chuyen dong bang GSAP ScrollTrigger (khong phai animation-timeline CSS)
 * vi ly do da ghi trong pinned-story.tsx: animation-timeline chi chay
 * Chrome/Edge, Safari/Firefox se khong thay hieu ung nao.
 *
 * Noi dung lay THANG tu mang `destinations` da bien tap san (tagline,
 * description, highlights) -- khong tu viet them cau moi o day. Bai hoc
 * tra gia: cac cau "mood" tu che ra vua sao rong vua pham dung nhung loi
 * ma UI_UX_RULES.md#voice-rules cam.
 */
export function DestinationZigzag({
  items,
  copy,
  onExplore,
  onAdd,
  isAdded,
}: {
  items: readonly ZigzagItem[];
  copy: ZigzagCopy;
  onExplore: (id: string) => void;
  onAdd: (id: string) => void;
  isAdded: (id: string) => boolean;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".zigzag-row").forEach((row) => {
        const media = row.querySelector(".zigzag-media");
        const copyEl = row.querySelector(".zigzag-copy");
        const fromLeft = row.dataset.side === "left";

        // Anh va chu vao tu hai phia doi nhau, lech nhip mot chut de
        // khong "bung" cung luc nhu banner quang cao.
        gsap.from(media, {
          opacity: 0,
          xPercent: fromLeft ? -6 : 6,
          yPercent: 4,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: row, start: "top 82%", once: true },
        });
        gsap.from(copyEl!.children, {
          opacity: 0,
          y: 26,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.08,
          delay: 0.12,
          scrollTrigger: { trigger: row, start: "top 82%", once: true },
        });

        // Parallax rat nhe trong khung anh -- anh nhinh hon khung nen
        // khong bao gio ho mep khi dich chuyen.
        const img = media?.querySelector("img");
        if (img) {
          gsap.fromTo(
            img,
            { yPercent: -5 },
            {
              yPercent: 5,
              ease: "none",
              scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }
      });
    }, root);

    return () => ctx.revert();
  }, [items]);

  return (
    <section ref={rootRef} id="all-destinations" className="bg-[#FBFAF6] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{copy.sectionLabel}</p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183F34] sm:text-6xl">
            {copy.sectionTitle}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#4A5751]">{copy.sectionIntro}</p>
        </div>

        <div className="mt-16 flex flex-col gap-20 lg:gap-28">
          {items.map((item, index) => {
            const fromLeft = index % 2 === 0;
            return (
              <article
                key={item.id}
                data-side={fromLeft ? "left" : "right"}
                className="zigzag-row grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
              >
                <div
                  className={`zigzag-media relative aspect-[4/3] overflow-hidden rounded-[10px] bg-[#E8E4DA] ${
                    fromLeft ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 1024px) 46vw, 100vw"
                    className="scale-110 object-cover"
                    style={{ objectPosition: item.imagePosition }}
                  />
                </div>

                <div className={`zigzag-copy ${fromLeft ? "lg:order-2" : "lg:order-1"}`}>
                  {/* KHONG danh so 01/02/03 o day: 15 diem den khong phai
                      mot chuoi tuan tu, khach khong can biet cai nao "thu
                      may". Danh so chi dung khi thu tu mang thong tin that
                      (quy trinh, dong thoi gian). Theo skill frontend-design
                      cua Anthropic -- va do la loi phan xa em vua mac. */}
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#3F7568]">
                    {item.category} · {item.duration}
                  </p>
                  <h3 className="font-display mt-3 text-3xl text-[#183F34] sm:text-5xl">{item.name}</h3>
                  <p className="mt-3 text-lg text-[#2C3B35]">{item.tagline}</p>
                  <p className="mt-4 leading-relaxed text-[#4A5751]">{item.description}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {item.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="rounded-full border border-[#A8CEC1]/70 bg-white px-3 py-1 text-sm text-[#2C3B35]"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onExplore(item.id)}
                      className="min-h-11 rounded-full bg-[#183F34] px-6 font-semibold text-[#FBFAF6] transition hover:bg-[#2C5F4F]"
                    >
                      {copy.explore}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdd(item.id)}
                      className="min-h-11 rounded-full border border-[#183F34]/40 px-6 font-semibold text-[#183F34] transition hover:bg-[#183F34]/8"
                    >
                      {isAdded(item.id) ? copy.added : copy.add}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Ket: nguoi doc vua luot qua 15 noi, cau hoi dat dung luc con
            dang phan van -- dan thang sang bo lap hanh trinh. */}
        <div className="zigzag-row mt-24 rounded-[10px] bg-[#183F34] px-6 py-14 text-center text-[#FBFAF6] sm:px-12 lg:mt-32 lg:py-20">
          <div className="zigzag-copy mx-auto max-w-3xl">
            <h3 className="font-display text-3xl leading-tight sm:text-5xl">{copy.ctaTitle}</h3>
            <p className="mt-5 text-lg leading-relaxed text-[#D8E5DE]">{copy.ctaBody}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/plan"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#E7B96A] px-8 font-bold text-[#183F34] transition hover:bg-[#F2CE8C]"
              >
                {copy.ctaPrimary}
              </Link>
              <Link
                href="/packages"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#FBFAF6]/40 px-8 font-semibold transition hover:bg-white/10"
              >
                {copy.ctaSecondary}
              </Link>
            </div>
            <p className="mt-6 text-sm text-[#A8CEC1]">{copy.ctaOffer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
