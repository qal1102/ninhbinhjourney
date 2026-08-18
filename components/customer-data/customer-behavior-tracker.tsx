"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { CustomerEventName } from "@/domain/customer-events";
import {
  CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
  CUSTOMER_CONSENT_CHANGED_EVENT,
  CUSTOMER_SESSION_ID_STORAGE_KEY,
  getOrCreateCustomerAnonymousId,
  getVisitorPageType,
  isCustomerAnalyticsEnabled,
  parseCustomerAnalyticsConsent,
  sourceContextFromBrowser,
  type CustomerAnalyticsConsent,
} from "@/lib/customer-data/browser-tracking";

const EVENT_ENDPOINT = "/api/customer-events";
const SECTION_VIEW_MIN_MS = 1_000;
const SECTION_ENGAGED_MIN_MS = 5_000;
const IDLE_PAUSE_MS = 30_000;
const SCROLL_MILESTONES = [25, 50, 75, 90] as const;

type EventProperties = Record<string, string | number | boolean | null>;

type BrowserEvent = {
  event_id: string;
  event_name: CustomerEventName;
  schema_version: 1;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  page_view_id: string;
  source_context: Record<string, string>;
  consent_snapshot: CustomerAnalyticsConsent;
  properties: EventProperties;
};

type SectionState = {
  element: HTMLElement;
  sectionId: string;
  position: number;
  visible: boolean;
  maxVisibleRatio: number;
  activeMs: number;
  lastAccruedAt: number;
  viewed: boolean;
  engaged: boolean;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const value = Math.floor(Math.random() * 16);
    return (letter === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function storageId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
    return existing;
  }
  const id = createId();
  storage.setItem(key, id);
  return id;
}

function sectionIdFor(element: HTMLElement) {
  return element.dataset.customerSection || element.id || null;
}

function emitWithBeacon(event: BrowserEvent, preferBeacon = false) {
  const body = JSON.stringify(event);
  if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(EVENT_ENDPOINT, blob)) return;
  }

  void fetch(EVENT_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // Analytics must never block browsing or show a customer-facing error.
  });
}

export function CustomerBehaviorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [consentRevision, setConsentRevision] = useState(0);

  useEffect(() => {
    const onConsentChanged = () => setConsentRevision((current) => current + 1);
    window.addEventListener(CUSTOMER_CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(CUSTOMER_CONSENT_CHANGED_EVENT, onConsentChanged);
  }, []);

  useEffect(() => {
    const pageType = getVisitorPageType(pathname);
    if (!pageType || !isCustomerAnalyticsEnabled() || window.top !== window) return;

    const consent = parseCustomerAnalyticsConsent(
      window.localStorage.getItem(CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY),
    );
    if (!consent) return;

    let anonymousId: string;
    let sessionId: string;
    try {
      anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      sessionId = storageId(window.sessionStorage, CUSTOMER_SESSION_ID_STORAGE_KEY);
    } catch {
      // Private browsing/storage policy can block storage. Do not fall back to
      // a less controllable identifier.
      return;
    }

    const pageViewId = createId();
    const sourceContext = sourceContextFromBrowser(
      new URLSearchParams(search),
      document.referrer,
      window.location.origin,
    );
    const emit = (
      eventName: CustomerEventName,
      properties: EventProperties,
      preferBeacon = false,
    ) => {
      if (
        !parseCustomerAnalyticsConsent(
          window.localStorage.getItem(CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY),
        )
      ) {
        return;
      }
      emitWithBeacon(
        {
          event_id: createId(),
          event_name: eventName,
          schema_version: 1,
          occurred_at: new Date().toISOString(),
          anonymous_id: anonymousId,
          session_id: sessionId,
          page_view_id: pageViewId,
          source_context: sourceContext,
          consent_snapshot: consent,
          properties,
        },
        preferBeacon,
      );
    };

    emit("page_viewed", {
      page_path: pathname,
      page_type: pageType,
      referrer_class: sourceContext.referrer_class,
    });

    if (
      sourceContext.qr_source_id &&
      sourceContext.campaign_id &&
      sourceContext.placement_id
    ) {
      emit("qr_opened", {
        qr_source_id: sourceContext.qr_source_id,
        campaign_id: sourceContext.campaign_id,
        placement_id: sourceContext.placement_id,
        destination_path: pathname,
      });
    }

    let latestInteractionAt = Date.now();
    const states = new Map<HTMLElement, SectionState>();
    let observer: IntersectionObserver | null = null;
    let interval = 0;
    let scrollRaf = 0;
    const reachedDepths = new Set<number>();

    const canAccrue = () =>
      document.visibilityState === "visible" && document.hasFocus();

    const emitSectionThresholds = (state: SectionState, preferBeacon = false) => {
      if (!state.viewed && state.activeMs >= SECTION_VIEW_MIN_MS) {
        state.viewed = true;
        emit(
          "section_viewed",
          {
            section_id: state.sectionId,
            page_path: pathname,
            position: state.position,
            visible_ms: Math.round(state.activeMs),
          },
          preferBeacon,
        );
      }
      if (!state.engaged && state.activeMs >= SECTION_ENGAGED_MIN_MS) {
        state.engaged = true;
        emit(
          "section_engaged",
          {
            section_id: state.sectionId,
            active_ms: Math.round(state.activeMs),
            max_visible_ratio: Number(state.maxVisibleRatio.toFixed(3)),
          },
          preferBeacon,
        );
      }
    };

    const accrue = (now = Date.now()) => {
      for (const state of states.values()) {
        if (!state.visible) {
          state.lastAccruedAt = now;
          continue;
        }
        const activeUntil = canAccrue()
          ? Math.min(now, latestInteractionAt + IDLE_PAUSE_MS)
          : state.lastAccruedAt;
        if (activeUntil > state.lastAccruedAt) {
          state.activeMs += activeUntil - state.lastAccruedAt;
          emitSectionThresholds(state);
        }
        state.lastAccruedAt = now;
      }
    };

    const registerSections = () => {
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(
          "main[data-customer-section], main [data-customer-section], main section[id]",
        ),
      ).filter((element) => sectionIdFor(element));
      targets.forEach((element, index) => {
        if (states.has(element)) return;
        const sectionId = sectionIdFor(element);
        if (!sectionId) return;
        const state: SectionState = {
          element,
          sectionId,
          position: index + 1,
          visible: false,
          maxVisibleRatio: 0,
          activeMs: 0,
          lastAccruedAt: Date.now(),
          viewed: false,
          engaged: false,
        };
        states.set(element, state);
        observer?.observe(element);
      });
    };

    observer = new IntersectionObserver(
      (entries) => {
        accrue();
        for (const entry of entries) {
          const state = states.get(entry.target as HTMLElement);
          if (!state) continue;
          state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          state.maxVisibleRatio = Math.max(
            state.maxVisibleRatio,
            entry.intersectionRatio,
          );
          state.lastAccruedAt = Date.now();
          if (!state.visible) emitSectionThresholds(state);
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    registerSections();

    const mutationObserver = new MutationObserver(() => registerSections());
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    interval = window.setInterval(() => accrue(), 500);

    const markInteraction = () => {
      accrue();
      latestInteractionAt = Date.now();
    };

    const onScroll = () => {
      markInteraction();
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        const root = document.documentElement;
        const scrollable = root.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const percent = Math.min(100, Math.floor((window.scrollY / scrollable) * 100));
        for (const depth of SCROLL_MILESTONES) {
          if (percent >= depth && !reachedDepths.has(depth)) {
            reachedDepths.add(depth);
            emit("scroll_depth_reached", { depth_percent: depth, page_path: pathname });
          }
        }
      });
    };

    const onClick = (event: MouseEvent) => {
      markInteraction();
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-customer-track]")
        : null;
      if (!target) return;
      const section = target.closest<HTMLElement>(
        "[data-customer-section], section[id]",
      );
      const sectionId = section ? sectionIdFor(section) : null;
      const elementId = target.dataset.customerTrack;
      if (!elementId || !sectionId) return;
      emit("content_clicked", {
        element_id: elementId,
        content_id: target.dataset.customerContentId ?? elementId,
        content_type: target.dataset.customerContentType ?? "cta",
        section_id: sectionId,
      }, Boolean(target.closest("a[href]")));
    };

    const onPageHide = () => {
      accrue();
      for (const state of states.values()) emitSectionThresholds(state, true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("focus", markInteraction);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      onPageHide();
      mutationObserver.disconnect();
      observer?.disconnect();
      window.clearInterval(interval);
      window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("focus", markInteraction);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [consentRevision, pathname, search]);

  return null;
}
