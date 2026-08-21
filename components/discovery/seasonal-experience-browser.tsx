"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
};

export type SeasonalGroup = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  ratio: "landscape" | "portrait";
  items: SeasonalExperience[];
};

type BrowserCopy = {
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
};

const contact = {
  email: "xuantruong_nb@hn.vnn.vn",
  phoneHref: "tel:+842293876930",
  phoneLabel: "0229 387 6930",
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

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

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
      <nav aria-label={copy.explore} className="mt-14 flex gap-2 overflow-x-auto pb-2 sm:mt-16">
        {groups.map((group) => (
          <a
            key={group.id}
            href={`#seasonal-${group.id}`}
            className="shrink-0 rounded-full border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold text-white/80 transition hover:border-[#E7B96A]/70 hover:text-white"
          >
            {group.eyebrow}
          </a>
        ))}
      </nav>

      <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-24">
        {groups.map((group, groupIndex) => (
          <section
            key={group.id}
            id={`seasonal-${group.id}`}
            aria-labelledby={`seasonal-${group.id}-title`}
            className="scroll-mt-24 border-t border-white/12 pt-10"
          >
            <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-[#E7B96A]">
                  {String(groupIndex + 1).padStart(2, "0")} · {group.eyebrow}
                </p>
                <h3 id={`seasonal-${group.id}-title`} className="font-display mt-3 max-w-2xl text-4xl leading-none sm:text-5xl">
                  {group.title}
                </h3>
              </div>
              <p className="max-w-2xl text-base leading-7 text-white/66 lg:justify-self-end">
                {group.body}
              </p>
            </div>

            <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-5 sm:gap-5">
              {group.items.map((item) => (
                <article
                  key={item.id}
                  data-seasonal-card={item.id}
                  className="group w-[84vw] max-w-[410px] shrink-0 snap-start overflow-hidden rounded-[18px] border border-white/12 bg-[#20342d] shadow-[0_20px_55px_rgba(5,15,11,.18)] sm:w-[380px]"
                >
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    className="block h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E7B96A]"
                    aria-label={`${copy.openDetail}: ${item.title}`}
                  >
                    <div
                      data-seasonal-card-media
                      className={`relative overflow-hidden bg-[#2a4037] ${group.ratio === "portrait" ? "aspect-[4/5]" : "aspect-[16/10]"}`}
                    >
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(min-width: 640px) 380px, 84vw"
                        className="object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                      {item.concept ? (
                        <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-[#14251f]/78 px-3 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur">
                          {copy.conceptLabel}
                        </span>
                      ) : null}
                    </div>
                    <div data-seasonal-card-copy className="flex min-h-[245px] flex-col p-5 sm:p-6">
                      <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.2em] text-[#E7B96A]">{item.kicker}</p>
                      <h4 className="font-display mt-2 text-3xl leading-none text-white">{item.title}</h4>
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/68">{item.body}</p>
                      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
                        <p className="font-semibold text-[#F1D39D]">
                          {item.price ? `${copy.fromPrice} ${item.price}` : copy.actions[item.action]}
                        </p>
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/24 text-lg text-white transition group-hover:border-[#E7B96A] group-hover:bg-[#E7B96A] group-hover:text-[#17352c]">↗</span>
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[1600] grid place-items-end bg-[#07110d]/72 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActive(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seasonal-dialog-title"
            className="max-h-[94vh] w-full overflow-y-auto rounded-t-[26px] bg-[#F7F3E9] text-[#183F34] shadow-2xl sm:max-w-5xl sm:rounded-[26px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="grid lg:grid-cols-[1.08fr_.92fr]">
              <div className="relative min-h-[310px] overflow-hidden bg-[#d8dfda] sm:min-h-[470px] lg:min-h-[620px] lg:rounded-l-[26px]">
                <Image src={active.image} alt={active.title} fill sizes="(min-width: 1024px) 54vw, 100vw" className="object-cover" priority />
              </div>
              <div className="relative flex flex-col p-6 sm:p-9 lg:p-10">
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-[#bcc8c1] bg-[#F7F3E9]/92 text-xl"
                  aria-label={copy.close}
                >
                  ×
                </button>
                <p className="pr-14 text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-[#6b7f75]">{active.kicker}</p>
                <h3 id="seasonal-dialog-title" className="font-display mt-4 pr-10 text-4xl leading-none sm:text-5xl">{active.title}</h3>
                <p className="mt-6 text-base leading-8 text-[#5c6c64]">{active.body}</p>
                {active.price ? <p className="mt-6 text-xl font-bold text-[#9B6A24]">{copy.fromPrice} {active.price}</p> : null}
                {active.concept ? <p className="mt-5 rounded-2xl bg-[#EEE7D8] p-4 text-xs leading-6 text-[#6a604c]">{copy.conceptNotice}</p> : null}

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
