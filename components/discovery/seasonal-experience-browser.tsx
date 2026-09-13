"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SeasonalEditorialGroup } from "@/components/discovery/seasonal-editorial-group";
import { CONTACT as contact } from "@/content/contact";

export type SeasonalAction = "booking" | "contact" | "gift" | "planning";

export type SeasonalExperience = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  image: string;
  price?: string;
  action: SeasonalAction;
  href?: string;
  concept?: boolean;
  editorial?: boolean;
  editorialAction?: string;
  gallery?: string[];
};

export type SeasonalGroup = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  ratio: "landscape" | "portrait";
  layout?: "catalog" | "feature" | "stories" | "mosaic" | "index" | "rail";
  items: SeasonalExperience[];
};

export type BrowserCopy = {
  explore: string;
  openDetail: string;
  close: string;
  fromPrice: string;
  actions: Record<SeasonalAction, string>;
  call: string;
  email: string;
  contactNote: string;
  conceptLabel: string;
  conceptNotice: string;
  editorialLabel: string;
  editorialNotice: string;
  selectStory: string;
  previousStory: string;
  nextStory: string;
  galleryLabel: string;
};

export function SeasonalExperienceBrowser({
  groups,
  copy,
  lang,
  source,
}: {
  groups: SeasonalGroup[];
  copy: BrowserCopy;
  lang: "en" | "vi";
  source: string;
}) {
  const [active, setActive] = useState<SeasonalExperience | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openExperience(item: SeasonalExperience) {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveMediaIndex(0);
    setActive(item);
  }

  const activeMedia = useMemo(
    () => active ? Array.from(new Set([active.image, ...(active.gallery ?? [])])) : [],
    [active],
  );

  const closeExperience = useCallback(() => {
    setActive(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExperience();
      if (event.key !== "Tab") return;

      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, closeExperience]);

  const planHref = `/plan?lang=${lang}&source=${encodeURIComponent(source)}`;

  function primaryHref(item: SeasonalExperience) {
    if (item.href) return item.href;
    if (item.action === "planning") return planHref;
    const subject = encodeURIComponent(
      lang === "vi"
        ? `Trao đổi về ${item.title} — Ninh Bình Journey`
        : `Enquiry about ${item.title} — Ninh Binh Journey`,
    );
    return `mailto:${contact.email}?subject=${subject}`;
  }

  return (
    <>
      <nav aria-label={copy.explore} className="mt-14 border-y border-white/14 sm:mt-20">
        <ol className="flex overflow-x-auto [scrollbar-width:none] lg:grid lg:grid-cols-7">
          {groups.map((group, index) => (
            <li key={group.id} className="shrink-0 border-r border-white/12 first:border-l lg:first:border-l-0">
              <a
                href={`#seasonal-${group.id}`}
                className="group flex min-h-[6.75rem] w-[11.5rem] flex-col justify-between px-4 py-4 text-white/66 transition hover:bg-white/[0.045] hover:text-white sm:w-[13rem] lg:w-auto"
              >
                <span className="text-[0.54rem] font-bold tracking-[0.2em] text-[#E7B96A]">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex items-end justify-between gap-3 text-[0.65rem] font-extrabold uppercase leading-4 tracking-[0.14em]">
                  {group.eyebrow}
                  <span aria-hidden="true" className="text-base transition-transform duration-500 group-hover:translate-x-1">↘</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-20 space-y-24 sm:mt-24 sm:space-y-32 lg:space-y-40">
        {groups.map((group, groupIndex) => {
          return <SeasonalEditorialGroup key={group.id} group={group} groupIndex={groupIndex} copy={copy} onOpen={openExperience} />;
        })}
      </div>

      {active ? (
        <div
          className="seasonal-dialog-backdrop fixed inset-0 z-[1600] grid place-items-end bg-[#07110d]/72 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeExperience();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seasonal-dialog-title"
            className="seasonal-dialog-panel relative max-h-[94vh] w-full overflow-y-auto rounded-t-[26px] bg-[#F7F3E9] text-[#183F34] shadow-2xl sm:max-w-5xl sm:rounded-[26px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              ref={closeButtonRef}
              onClick={closeExperience}
              className="absolute right-5 top-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-[#bcc8c1] bg-[#F7F3E9]/92 text-xl shadow-sm backdrop-blur"
              aria-label={copy.close}
            >
              ×
            </button>
            <div className="grid lg:grid-cols-[1.08fr_.92fr]">
              <div className="flex min-h-[310px] flex-col overflow-hidden bg-[#1a241f] sm:min-h-[470px] lg:min-h-[620px] lg:rounded-l-[26px]">
                <div className="relative min-h-[310px] flex-1 sm:min-h-[470px]">
                  <Image key={activeMedia[activeMediaIndex]} src={activeMedia[activeMediaIndex] ?? active.image} alt={active.title} fill sizes="(min-width: 1024px) 54vw, 100vw" className="seasonal-dialog-image object-cover" priority />
                </div>
                {activeMedia.length > 1 ? (
                  <div role="group" aria-label={copy.galleryLabel} className="grid grid-cols-3 gap-2 border-t border-white/12 bg-[#111a16] p-3">
                    {activeMedia.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        aria-label={`${copy.galleryLabel} ${index + 1}: ${active.title}`}
                        aria-pressed={index === activeMediaIndex}
                        onClick={() => setActiveMediaIndex(index)}
                        className={`relative aspect-[16/7] overflow-hidden border transition ${index === activeMediaIndex ? "border-[#E7B96A]" : "border-white/15 opacity-60 hover:opacity-100"}`}
                      >
                        <Image src={image} alt="" fill sizes="18vw" className="object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="relative flex flex-col p-6 sm:p-9 lg:p-10">
                <p className="pr-14 text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-[#6b7f75]">{active.kicker}</p>
                <h3 id="seasonal-dialog-title" className="font-display mt-4 pr-10 text-4xl leading-none sm:text-5xl">{active.title}</h3>
                <p className="mt-6 text-base leading-8 text-[#5c6c64]">{active.body}</p>
                {active.price ? <p className="mt-6 text-xl font-bold text-[#9B6A24]">{copy.fromPrice} {active.price}</p> : null}
                {active.editorial ? <p className="mt-6 border-l border-[#A66B3D] pl-4 text-xs uppercase leading-6 tracking-[0.12em] text-[#796B58]">{copy.editorialNotice}</p> : active.concept ? <p className="mt-5 rounded-2xl bg-[#EEE7D8] p-4 text-xs leading-6 text-[#6a604c]">{copy.conceptNotice}</p> : null}

                <div className="mt-8 space-y-3 lg:mt-auto lg:pt-10">
                  <a
                    data-customer-track="seasonal-experience-primary"
                    data-customer-content-id={active.id}
                    data-customer-content-type={active.action}
                    href={primaryHref(active)}
                    className="flex min-h-12 items-center justify-between rounded-full bg-[#183F34] px-6 font-extrabold text-white transition hover:bg-[#245544]"
                  >
                    {copy.actions[active.action]} <span aria-hidden="true">→</span>
                  </a>
                  <div className="grid grid-cols-2 gap-3">
                    <a href={contact.phoneHref} className="flex min-h-11 items-center justify-center rounded-full border border-[#bec9c3] px-4 text-sm font-bold">{copy.call}</a>
                    <a href={`mailto:${contact.email}`} className="flex min-h-11 items-center justify-center rounded-full border border-[#bec9c3] px-4 text-sm font-bold">{copy.email}</a>
                  </div>
                  <p className="pt-2 text-xs leading-5 text-[#748078]">{copy.contactNote} · {contact.phoneLabel}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
