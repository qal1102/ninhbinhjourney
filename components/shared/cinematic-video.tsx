"use client";

import { useEffect, useRef, useState } from "react";

export type CinematicClip = {
  /** Tu-host: duong dan mp4 trong /public. Uu tien dung cai nay. */
  src?: string;
  /** Du phong: id video YouTube, dung khi chua co file mp4 tu-host. */
  youTubeId?: string;
  /** Giay bat dau -- bo qua doan dau chua vao hinh. */
  start?: number;
  /** Giay ket thuc. */
  end?: number;
  poster?: string;
  eyebrow: string;
  headline: string;
  credit?: string;
};

/**
 * Bang video dien anh chay nen, tu dong chay, khong nut bam.
 *
 * Hai che do:
 *  1. `src` -- file mp4 tu-host trong /public/videos. DAY LA CHE DO NEN
 *     DUNG: khong khung vien YouTube, khong logo, chu dong hoan toan ve
 *     chat luong, va nhe hon han vi khong phai nhung ca mot trinh phat.
 *  2. `youTubeId` -- nhung YouTube. Dung khi chua co file tu-host. Giu
 *     nguyen watermark cua tac gia; khong cat, khong che.
 *
 * Video chi chay khi dang o trong man hinh (IntersectionObserver) --
 * bon bang video cung chay mot luc se an het bang thong va pin.
 * prefers-reduced-motion: dung han o khung poster.
 */
export function CinematicVideo({
  clip,
  className = "",
}: {
  clip: CinematicClip;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const reducedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = media.matches;
    // Doc qua listener thay vi setState thang trong than effect: doc
    // thang gay cascading render (lint chan), va cach nay con bat duoc
    // ca luc nguoi dung doi thiet lap giua chung.
    const onChange = () => {
      reducedRef.current = media.matches;
      setReduced(media.matches);
    };
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px 0px" },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  // Tam dung khi ra khoi man hinh, chay lai khi vao -- tiet kiem pin va
  // bang thong, nhat la tren dien thoai.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced) return;
    if (inView) void video.play().catch(() => {});
    else video.pause();
  }, [inView, reduced]);

  // Lap dung doan da chon thay vi lap ca video.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || clip.end === undefined) return;
    function onTime() {
      if (video!.currentTime >= clip.end!) video!.currentTime = clip.start ?? 0;
    }
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [clip.end, clip.start]);

  const ytSrc = clip.youTubeId
    ? `https://www.youtube-nocookie.com/embed/${clip.youTubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${clip.youTubeId}` +
      `&start=${clip.start ?? 0}${clip.end ? `&end=${clip.end}` : ""}` +
      `&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0`
    : "";

  return (
    <section
      ref={wrapRef}
      className={`relative h-[78vh] w-full overflow-hidden bg-[#06120f] sm:h-screen ${className}`.trim()}
    >
      {clip.src ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={reduced ? undefined : clip.src}
          poster={clip.poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ) : inView && !reduced && clip.youTubeId ? (
        // Phong to 1.45 lan roi cat bot: giau thanh dieu khien va dong
        // chu tieu de cua YouTube o hai mep, con lai dung khung hinh.
        <iframe
          className="pointer-events-none absolute left-1/2 top-1/2 h-[145%] w-[145%] -translate-x-1/2 -translate-y-1/2"
          src={ytSrc}
          title={clip.headline}
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        clip.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.34),rgba(6,18,15,.12)_38%,rgba(6,18,15,.86))]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-14 text-white sm:px-10 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">
            {clip.eyebrow}
          </p>
          <h2 className="font-display mt-4 text-3xl leading-[1.1] sm:text-6xl">{clip.headline}</h2>
          {clip.credit && (
            <p className="mt-5 text-xs tracking-wide text-white/55">{clip.credit}</p>
          )}
        </div>
      </div>
    </section>
  );
}
