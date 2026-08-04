"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Luon bat dau false, khop voi server (khong co window luc SSR). Doc
  // prefersReducedMotion() ngay trong lazy initializer se chay lai tren
  // lan render dau tien o client va lech voi HTML server da gui, gay
  // canh bao hydration mismatch that (bat duoc qua Playwright). Khong
  // can xu ly rieng reduced-motion o day nua -- CSS
  // `.reveal-on-scroll { opacity: 1 }` duoi @media (prefers-reduced-motion)
  // da ep hien toan bo bat ke class "is-visible" co hay khong.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
