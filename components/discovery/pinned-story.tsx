"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type PinnedStoryBeat = {
  image: string;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
};

/**
 * Ghim mot khung 100vh, ba nhip anh/chu thay nhau theo dung vi tri cuon.
 *
 * Vi sao dung GSAP ScrollTrigger chu khong phai animation-timeline CSS:
 * animation-timeline: view() hien chi chay tren Chrome/Edge. Safari va
 * Firefox roi thang ve bo cuc tinh -- tuc la mot phan lon khach (iPhone)
 * xem ban khong co hieu ung nao. GSAP chay moi trinh duyet.
 *
 * Vi sao anh KHONG dissolve bang opacity: hai tam anh phong canh chi
 * tiet chong mo len nhau luon ra mot dong nhoe (da chup duoc tren
 * production va bi che thang). Dung clip-path wipe: tam moi lo dan de
 * len tam cu, khong bao gio co hai anh cung ban trong suot.
 *
 * Nguyen tac dan canh: MOI WIPE CHI CHAY KHI MAN HINH KHONG CO CHU --
 * neu khong, duong wipe cat ngang giua dong tieu de dang mo, nhin rat
 * ban. Chu tat han roi anh moi truot len, xong chu moi hien lai.
 *
 * Khong co JS / prefers-reduced-motion: roi ve bo cuc xep chong binh
 * thuong, doc tuan tu tu tren xuong -- khong bao gio vo layout.
 */
export function PinnedStory({ beats }: { beats: readonly PinnedStoryBeat[] }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const layers = gsap.utils.toArray<HTMLElement>(".pinned-story-beat");
      if (layers.length < 2) return;

      const mediaOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".pinned-story-media");
      const captionOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".pinned-story-caption");
      const linesOf = (el: HTMLElement) =>
        gsap.utils.toArray<HTMLElement>(el.querySelectorAll(".pinned-story-line"));

      // Trang thai dau: nhip 1 mo san, cac nhip sau an hoan toan duoi
      // duong wipe. Dat bang JS thay vi CSS de fallback khong-JS van
      // hien du ca ba nhip theo chieu doc.
      layers.forEach((layer, i) => {
        const media = mediaOf(layer);
        const caption = captionOf(layer);
        if (!media || !caption) return;
        gsap.set(layer, { position: "absolute", inset: 0, zIndex: i + 1 });
        gsap.set(media, { clipPath: i === 0 ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)" });
        gsap.set(caption, { zIndex: 20 + i });
        gsap.set(linesOf(caption), { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 18 });
        // Parallax nhe: anh ben trong lon hon khung mot chut de con dich
        // chuyen duoc ma khong bao gio ho mep.
        gsap.set(media.querySelector("img"), { scale: 1.12, yPercent: i === 0 ? 0 : 3 });
      });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          pin: ".pinned-story-sticky",
          pinSpacing: false,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      // Ken Burns rat cham chay suot ca man: khung hinh khong bao gio
      // dung im hoan toan, nhung cham toi muc khong ai thay "dang chay".
      layers.forEach((layer) => {
        const img = mediaOf(layer)?.querySelector("img");
        if (img) tl.to(img, { scale: 1.0, duration: 1 }, 0);
      });

      /*
       * Moi chuyen canh chiem mot doan (segment). Trong doan do, thu tu
       * BAT BUOC la: giu chu cu -> tat chu -> wipe anh (man hinh sach
       * chu) -> hien chu moi -> giu. Neu wipe chay luc con chu, duong
       * wipe cat ngang giua dong tieu de, nhin rat ban.
       *
       * Cac moc duoi tinh theo TY LE cua segment, khong phai so tuyet
       * doi, de van dung khi doi so nhip. Phai chua "hold" o dau doan --
       * lan truoc dat fade-out ngay tai vi tri 0 nen nhip 1 chua bao gio
       * dat opacity 1, do duoc 0.27 (bat qua Playwright, khong doan).
       */
      const segment = 1 / (layers.length - 1);
      const HOLD = 0.3; // giu chu cu
      const FADE_OUT = 0.14;
      const WIPE_AT = 0.46;
      const WIPE_DUR = 0.24;
      const FADE_IN_AT = 0.72;
      const FADE_IN_DUR = 0.16;

      layers.forEach((layer, i) => {
        if (i === 0) return;
        const prev = layers[i - 1];
        const at = (i - 1) * segment;

        const prevLines = linesOf(captionOf(prev)!);
        const lines = linesOf(captionOf(layer)!);

        // 1. Chu cu roi len va tat han
        tl.to(
          prevLines,
          { opacity: 0, y: -14, duration: segment * FADE_OUT, stagger: segment * 0.02 },
          at + segment * HOLD,
        );
        // 2. Anh moi truot len de len anh cu (man hinh dang sach chu)
        tl.to(
          mediaOf(layer)!,
          { clipPath: "inset(0% 0% 0% 0%)", duration: segment * WIPE_DUR },
          at + segment * WIPE_AT,
        );
        tl.to(
          mediaOf(layer)!.querySelector("img"),
          { yPercent: 0, duration: segment * WIPE_DUR },
          at + segment * WIPE_AT,
        );
        // 3. Chu moi hien tung dong mot
        tl.to(
          lines,
          { opacity: 1, y: 0, duration: segment * FADE_IN_DUR, stagger: segment * 0.02 },
          at + segment * FADE_IN_AT,
        );
      });
    }, root);

    return () => ctx.revert();
  }, [beats]);

  return (
    <section ref={rootRef} className="pinned-story">
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
              {/*
                Hai lop scrim, KHONG phai mot: anh Phat Diem co troi sang va
                cong trinh sang mau dung o goc trai duoi -- chi co gradient
                doc thi chu trang chim han, khong doc noi (da chup duoc).
                Lop doc lo day khung + lop ngang lo ben trai (noi chu can
                le) dam bao tuong phan tren ca ba anh sang toi khac nhau.
              */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,0)_30%,rgba(6,18,15,.55)_60%,rgba(6,18,15,.92))]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(6,18,15,.72),rgba(6,18,15,.34)_38%,transparent_72%)]" />
            </div>
            <div className="pinned-story-caption pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-16 text-white sm:px-8 sm:pb-20">
              <div className="mx-auto max-w-4xl">
                <p className="pinned-story-line text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">
                  {beat.eyebrow}
                </p>
                <h2 className="pinned-story-line font-display mt-4 text-[1.75rem] leading-[1.12] sm:text-5xl">
                  {beat.headline}
                </h2>
                <p className="pinned-story-line mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
                  {beat.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
