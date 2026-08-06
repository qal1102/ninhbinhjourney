"use client";

import Image from "next/image";
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

        /*
         * Anh va chu vao tu HAI PHIA DOI NHAU, lech nhip mot chut de
         * khong "bung" cung luc nhu banner quang cao.
         *
         * Bien do da nang manh len 05/08: ban cu dat xPercent 6 va y 26,
         * nho toi muc chu du an cuon qua ma khong nhan ra co hieu ung nao
         * ("sao no khong tu 2 ben di qua"). Gio anh di 14% be ngang cua
         * chinh no va lo dan bang clip-path, con chu thi tung dong mot
         * truot vao tu phia doi dien.
         *
         * Dung clip-path (khong phai opacity) cho anh: hai tam anh chi
         * tiet chong mo len nhau luon ra mot dong nhoe -- bai hoc da tra
         * gia o PinnedStory, ghi trong HANDOFF dot muoi mot.
         */
        gsap.fromTo(
          media,
          {
            xPercent: fromLeft ? -14 : 14,
            clipPath: fromLeft ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)",
          },
          {
            xPercent: 0,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.15,
            ease: "power3.out",
            scrollTrigger: { trigger: row, start: "top 84%", once: true },
          },
        );
        gsap.from(copyEl!.children, {
          opacity: 0,
          xPercent: fromLeft ? 10 : -10,
          y: 30,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.09,
          delay: 0.22,
          scrollTrigger: { trigger: row, start: "top 84%", once: true },
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
                  // `data-flip-src` cho phep trang chu tim dung tam anh
                  // dang hien de lam diem XUAT PHAT cho hieu ung no ra
                  // khung chi tiet -- khong phai luon prop qua nhieu lop.
                  data-flip-src={item.id}
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

        {/*
          Khoi ket ("Chua biet nen bat dau tu dau?") da chuyen sang
          components/discovery/journey-cta.tsx ngay 05/08: danh muc gio
          chia lam hai nhip (zigzag cho vai diem dau + DestinationIndex
          cho phan con lai), nen khoi ket phai dung SAU CA HAI chu khong
          con thuoc rieng zigzag.
        */}
      </div>
    </section>
  );
}
