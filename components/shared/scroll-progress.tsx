"use client";

import { useEffect, useRef } from "react";

/**
 * Vach tien do cuon mong o dinh trang.
 *
 * Cap nhat qua requestAnimationFrame + transform (chay tren compositor),
 * khong dat state React moi khung hinh -- dat state se lam ca cay component
 * render lai theo tung pixel cuon.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let queued = false;

    function update() {
      queued = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar!.style.transform = `scaleX(${ratio})`;
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return <div ref={barRef} className="scroll-progress" aria-hidden="true" />;
}
