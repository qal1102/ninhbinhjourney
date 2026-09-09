"use client";

import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

const getServerSnapshot = () => false;

function getSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
}

function subscribe(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  const legacyMediaQuery = mediaQuery as unknown as {
    addListener(listener: () => void): void;
    removeListener(listener: () => void): void;
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  }

  // Safari before 14 only exposes the legacy MediaQueryList listener API.
  legacyMediaQuery.addListener(onStoreChange);
  return () => legacyMediaQuery.removeListener(onStoreChange);
}

/**
 * A hydration-safe, live preference for motion-sensitive interfaces.
 *
 * The server snapshot intentionally stays `false`: CSS remains the first
 * reduced-motion safeguard during SSR, then the client reconciles this hook
 * after hydration and keeps it in sync when the operating-system preference
 * changes.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
