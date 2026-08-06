"use client";

import { useEffect, useRef, useState } from "react";

export type CinematicClip = {
  /** Tu-host: duong dan mp4 trong /public. Uu tien dung cai nay. */
  src?: string;
  /** Du phong: id video YouTube, dung khi chua co file mp4 tu-host. */
  youTubeId?: string;
  /** Giay bat dau -- bo qua doan dau chua vao hinh. */
  start?: number;
  /** Giay ket thuc. Xem canh bao ve `end` o duoi. */
  end?: number;
  /**
   * BAT BUOC. Khung hinh tinh nam DUOI trinh phat, luon luon hien.
   * Khong co no thi khoi video la mot hinh chu nhat den tuyen trong luc
   * trinh phat dang boot, va den vinh vien khi trinh duyet bat giam
   * chuyen dong -- ca hai deu da xay ra that va da chup duoc 05/08.
   */
  poster: string;
  eyebrow: string;
  headline: string;
};

/**
 * Bang video dien anh chay nen, tu dong chay, khong nut bam.
 *
 * BA LOP, XEP TU DUOI LEN -- day la diem mau chot:
 *  1. `poster` (<img>) -- luon hien, khong dieu kien. Khong bao gio con
 *     khung den.
 *  2. Trinh phat (mp4 hoac YouTube) -- chi gan khi can, va chi HIEN RA
 *     sau `REVEAL_DELAY_MS` ke tu luc gan.
 *  3. Scrim + chu.
 *
 * VI SAO PHAI TRE `REVEAL_DELAY_MS` TRUOC KHI HIEN TRINH PHAT:
 * YouTube ve mot cum nut `⏮ ⏸ ⏭` giua khung trong vai giay dau khi trinh
 * phat khoi dong, roi tu tan. Da do that tren production 05/08: chup moi
 * 3 giay suot 78 giay (4 vong lap) -- cum nut CHI hien luc t=0, khong bao
 * gio quay lai o cac vong sau. Nen day thuan tuy la van de THOI DIEM.
 * `controls=0` khong go duoc cum nay, va meo phong to 145% roi cat cung
 * khong: cum nut nam o TAM khung phat, ma tam thi phong bao nhieu lan
 * cung van la tam. Che no bang poster trong luc no dang tan la cach duy
 * nhat vua re vua chac.
 *
 * `eager`: gan trinh phat ngay luc mount thay vi doi cuon toi. Dung cho
 * clip DAU TIEN -- man intro khoa man hinh vai giay o dau trang, tan dung
 * dung khoang do de boot san. Khong bat `eager` cho ca ba: ba trinh phat
 * YouTube nap cung luc la qua nang tren 4G.
 */

/*
 * Do lai 06/08 tren ban build that: tu luc gan iframe toi luc trinh phat
 * ve xong khung dau va cum nut khoi dong tu tan mat LAU HON 1,4 giay.
 * De 1400ms thi player lo ra dung luc cum nut con dang mo -- da chup
 * duoc o video thu ba. 2600ms co du bien an toan.
 */
const REVEAL_DELAY_MS = 2600;
/** Boot som hon hai man hinh -- thua thoi gian de cum nut tan. */
const PRELOAD_MARGIN = "2000px 0px";

export function CinematicVideo({
  clip,
  className = "",
  eager = false,
  eagerDelayMs = 0,
}: {
  clip: CinematicClip;
  className?: string;
  /** Gan trinh phat ngay luc mount thay vi doi cuon toi gan. */
  eager?: boolean;
  /**
   * Hoan `eagerDelayMs` mili giay roi moi gan. Dung de RAI DEU ba trinh
   * phat trong khung intro 6,5 giay thay vi nap ca ba cung mot luc --
   * nap dong thoi thi tren 4G ca ba cung cham, va cai dau tien (cai khach
   * gap som nhat) lai la cai bi thiet nhat.
   */
  eagerDelayMs?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Gan trinh phat: ngay lap tuc neu `eager`, khong thi doi cuon gan toi.
  useEffect(() => {
    if (reduced || mounted) return;
    if (eager) {
      // queueMicrotask (khi khong hoan) thay vi goi setState thang trong
      // than effect: goi thang gay cascading render (lint chan) -- cung
      // cach da dung o components/commerce/booking-confirmation.tsx.
      if (eagerDelayMs <= 0) {
        queueMicrotask(() => setMounted(true));
        return;
      }
      const id = window.setTimeout(() => setMounted(true), eagerDelayMs);
      return () => window.clearTimeout(id);
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [eager, eagerDelayMs, reduced, mounted]);

  // Hien trinh phat sau khi no da co thoi gian ve xong khung dau va cum
  // nut khoi dong da tan.
  useEffect(() => {
    if (!mounted) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [mounted]);

  // mp4: tam dung khi ra khoi man hinh -- tiet kiem pin va bang thong.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip.src || reduced) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [clip.src, reduced]);

  // Lap dung doan da chon thay vi lap ca video (chi lam duoc voi mp4).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip.src || clip.end === undefined) return;
    function onTime() {
      if (video!.currentTime >= clip.end!) video!.currentTime = clip.start ?? 0;
    }
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [clip.src, clip.end, clip.start]);

  /*
   * EP LAP DUNG DOAN DA CHON.
   *
   * Nhung YouTube o che do `loop=1&playlist=ID` BO QUA tham so `end`. Da
   * do that: chup tai t=21s/39s/54s ra ba canh khac han nhau, video chay
   * tuot qua moc 30 giay. Hau qua khong chi la "sai doan": ngay 06/08 da
   * chup duoc tren mobile mot khung co WATERMARK/chu cua tac gia phu kin
   * man hinh -- vi doan phat da troi ra ngoai vung 12-30 giay von duoc
   * chon ky.
   *
   * Cach vá, khong can nap thu vien ngoai nao: bat `enablejsapi=1` roi
   * dinh ky `postMessage` lenh `seekTo(start)` theo dung do dai doan. Neu
   * vi ly do nao do postMessage khong an, video chi don gian chay tiep
   * nhu truoc -- khong co gi vo.
   */
  const ytSrc = clip.youTubeId
    ? `https://www.youtube-nocookie.com/embed/${clip.youTubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${clip.youTubeId}` +
      `&start=${clip.start ?? 0}${clip.end ? `&end=${clip.end}` : ""}` +
      `&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1`
    : "";

  useEffect(() => {
    if (!revealed || !clip.youTubeId || clip.end === undefined) return;
    const frame = iframeRef.current;
    if (!frame) return;

    const start = clip.start ?? 0;
    const segment = Math.max(clip.end - start, 4);

    function rewind() {
      frame?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [start, true] }),
        "*",
      );
    }

    // Dong bo ngay mot lan khi trinh phat vua lo ra, roi cu moi do dai
    // doan thi keo ve dau doan.
    rewind();
    const id = window.setInterval(rewind, segment * 1000);
    return () => window.clearInterval(id);
  }, [revealed, clip.youTubeId, clip.start, clip.end]);

  return (
    <section
      ref={wrapRef}
      className={`cinematic-frame relative h-[78vh] w-full overflow-hidden bg-[#06120f] sm:h-screen ${className}`.trim()}
    >
      {/* Lop 1 -- luon hien, khong bao gio de lo khung den. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={clip.poster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Lop 2 -- trinh phat, mo dan len tren poster khi da san sang. */}
      {mounted && !reduced ? (
        <div
          className="cinematic-player absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: revealed ? 1 : 0 }}
        >
          {clip.src ? (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              src={clip.src}
              poster={clip.poster}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          ) : clip.youTubeId ? (
            <iframe
              ref={iframeRef}
              src={ytSrc}
              title={clip.headline}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : null}

      {/* Lop 3 -- scrim + chu. */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.34),rgba(6,18,15,.12)_38%,rgba(6,18,15,.86))]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-14 text-white sm:px-10 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">
            {clip.eyebrow}
          </p>
          <h2 className="font-display mt-4 text-3xl leading-[1.1] sm:text-6xl">{clip.headline}</h2>
        </div>
      </div>
    </section>
  );
}
