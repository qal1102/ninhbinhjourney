"use client";

import { useEffect } from "react";

/**
 * Dừng chuyển động SMIL của một SVG khi khách bật giảm chuyển động. Chuyển
 * động SVG không chịu `prefers-reduced-motion` trong CSS, nên phải dừng bằng
 * `pauseAnimations()`; đổi cài đặt giữa chừng thì chạy lại hoặc dừng theo.
 */
export function DungChuyenDongSvg({ id }: { id: string }) {
  useEffect(() => {
    const svg = document.getElementById(id) as SVGSVGElement | null;
    if (!svg || typeof svg.pauseAnimations !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ap = () => (mq.matches ? svg.pauseAnimations() : svg.unpauseAnimations());
    ap();
    mq.addEventListener("change", ap);
    return () => mq.removeEventListener("change", ap);
  }, [id]);
  return null;
}
