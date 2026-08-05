"use client";

import { useEffect } from "react";

/*
 * Hai trang thai cua chu tieu de. "Nghi" la bo so goc da dung tu truoc
 * (opsz 84 / SOFT 40 / wght 620) -- nen khi khong co JS, khi bat giam
 * chuyen dong, hoac khi trang dung yen, chu hien Y HET nhu truoc dot nay.
 * "Cuon" manh hon va cung hon mot chut.
 */
const REST = { opsz: 84, soft: 40, wght: 620 };
const MOVING = { opsz: 120, soft: 8, wght: 540 };

/** Cuon nhanh hon nguong nay (px moi khung hinh) thi coi la "dang cuon". */
const FULL_SPEED_PX = 34;
/** He so lam muot: cang nho cang lì, tranh chu giat theo tung cu lan chuot. */
const EASING = 0.12;
/** Duoi nguong nay coi nhu da dung han -- tranh ghi CSS var vo han. */
const SETTLED = 0.002;

/**
 * Ghi `--display-opsz` / `--display-soft` / `--display-wght` len <html>
 * theo toc do cuon. `.font-display` trong globals.css doc ba bien nay.
 *
 * Khong render gi ca -- dat mot lan o layout la du cho moi trang.
 *
 * Chay trong mot vong requestAnimationFrame duy nhat va CHI ghi khi gia
 * tri thuc su doi: ghi CSS var moi khung hinh se ep trinh duyet tinh lai
 * kieu chu lien tuc, rat ton tren dien thoai.
 */
export function ScrollType() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let lastY = window.scrollY;
    let progress = 0;
    let applied = -1;
    let frame = 0;

    function tick() {
      const y = window.scrollY;
      const speed = Math.abs(y - lastY);
      lastY = y;

      const target = Math.min(speed / FULL_SPEED_PX, 1);
      progress += (target - progress) * EASING;
      if (progress < SETTLED) progress = 0;

      // Chi ghi khi doi du lon de mat nhin ra -- tranh ghi moi khung hinh.
      if (Math.abs(progress - applied) > 0.01) {
        applied = progress;
        const mix = (from: number, to: number) => Math.round(from + (to - from) * progress);
        root.style.setProperty("--display-opsz", String(mix(REST.opsz, MOVING.opsz)));
        root.style.setProperty("--display-soft", String(mix(REST.soft, MOVING.soft)));
        root.style.setProperty("--display-wght", String(mix(REST.wght, MOVING.wght)));
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      root.style.removeProperty("--display-opsz");
      root.style.removeProperty("--display-soft");
      root.style.removeProperty("--display-wght");
    };
  }, []);

  return null;
}
