"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

type Language = "en" | "vi";

type ChapterId =
  | "destinations-highlights"
  | "curated-routes"
  | "packages"
  | "ai"
  | "mid-autumn"
  | "seasonal-brand-atelier"
  | "partnerships";

type Chapter = {
  id: ChapterId;
  label: string;
  shortLabel: string;
  description: string;
};

type ConciergeCopy = {
  inlineLabel: string;
  inlineAria: string;
  open: string;
  close: string;
  eyebrow: string;
  title: string;
  introduction: string;
  current: string;
  navigationAria: string;
  chapters: Chapter[];
};

const COPY: Record<Language, ConciergeCopy> = {
  vi: {
    inlineLabel: "Mục lục hành trình",
    inlineAria: "Đi tới một phần trên trang Ninh Bình Journey",
    open: "Mở trợ lý hành trình",
    close: "Đóng trợ lý hành trình",
    eyebrow: "Gợi ý nhanh",
    title: "Bạn muốn xem phần nào?",
    introduction:
      "Đi thẳng tới điểm đến, gói có sẵn, mùa Trăng hoặc câu chuyện dành cho thương hiệu.",
    current: "Đang xem",
    navigationAria: "Các phần được gợi ý",
    chapters: [
      {
        id: "destinations-highlights",
        label: "Lần đầu đến Ninh Bình",
        shortLabel: "Điểm đến",
        description: "Bắt đầu với những nơi làm nên một chuyến đi Ninh Bình.",
      },
      {
        id: "curated-routes",
        label: "Xem các tuyến gợi ý",
        shortLabel: "Tuyến đi",
        description: "Ghép các điểm dừng thành một ngày có nhịp đi rõ ràng.",
      },
      {
        id: "packages",
        label: "Chọn gói có sẵn",
        shortLabel: "Gói hành trình",
        description: "Xem lịch trình, mức giá và cách giữ chỗ của năm gói.",
      },
      {
        id: "ai",
        label: "Tự lập hành trình",
        shortLabel: "Lập hành trình",
        description: "Chọn thời lượng, nhịp đi và điều bạn muốn ưu tiên.",
      },
      {
        id: "partnerships",
        label: "Trao đổi một cơ hội hợp tác",
        shortLabel: "Hợp tác",
        description: "Liên hệ về sự kiện, ghi hình hoặc một mùa đồng hành tại Ninh Bình.",
      },
      {
        id: "mid-autumn",
        label: "Quà và bàn tiệc mùa Trăng",
        shortLabel: "Mùa Trăng",
        description: "Khám phá hộp bánh, bàn tiệc và những trải nghiệm theo mùa.",
      },
      {
        id: "seasonal-brand-atelier",
        label: "Câu chuyện dành cho thương hiệu",
        shortLabel: "Thương hiệu",
        description: "Đi tới chương hình ảnh và những đề xuất kết nối thương hiệu.",
      },
    ],
  },
  en: {
    inlineLabel: "Journey index",
    inlineAria: "Jump to a chapter on Ninh Binh Journey",
    open: "Open journey concierge",
    close: "Close journey concierge",
    eyebrow: "A quick guide",
    title: "Where would you like to go?",
    introduction:
      "Go straight to the places, ready-made packages, moon season or stories for brands.",
    current: "Now viewing",
    navigationAria: "Suggested chapters",
    chapters: [
      {
        id: "destinations-highlights",
        label: "First time in Ninh Binh",
        shortLabel: "Places",
        description: "Begin with the places that shape a Ninh Binh journey.",
      },
      {
        id: "curated-routes",
        label: "Browse signature routes",
        shortLabel: "Routes",
        description: "See how several stops can become one well-paced day.",
      },
      {
        id: "packages",
        label: "Choose a ready-made package",
        shortLabel: "Packages",
        description: "Compare the itinerary, price and reservation path of five packages.",
      },
      {
        id: "ai",
        label: "Build my own journey",
        shortLabel: "Journey builder",
        description: "Choose your time, pace and the things that matter most.",
      },
      {
        id: "partnerships",
        label: "Discuss a partnership",
        shortLabel: "Partnerships",
        description: "Talk to the team about an event, production or a season in Ninh Binh.",
      },
      {
        id: "mid-autumn",
        label: "Moon gifts and dinner",
        shortLabel: "Moon season",
        description: "Explore mooncakes, seasonal tables and experiences after dark.",
      },
      {
        id: "seasonal-brand-atelier",
        label: "Concepts for brands",
        shortLabel: "Brands",
        description: "Enter the image-led chapter of independent brand proposals.",
      },
    ],
  },
};

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeNothing() {
  return () => {};
}

function chapterHref(id: ChapterId) {
  return `#${id}`;
}

function ChapterArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <path d="M4 10h11" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}

/**
 * Public chapter index and lightweight journey concierge.
 *
 * This deliberately uses native hash links rather than an API or an ERP-style
 * command parser. Every destination still works without client JavaScript,
 * while the client layer only adds current-section context and an accessible
 * sheet for small screens or long pages.
 */
export function JourneyConcierge({ lang }: { lang: Language }) {
  const copy = COPY[lang];
  const [activeId, setActiveId] = useState<ChapterId>(copy.chapters[0].id);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const activeChapter = useMemo(
    () => copy.chapters.find((chapter) => chapter.id === activeId) ?? copy.chapters[0],
    [activeId, copy.chapters],
  );

  useEffect(() => {
    const targets = copy.chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((target): target is HTMLElement => Boolean(target));
    if (!targets.length) return;

    let frame = 0;
    const chooseCurrentChapter = () => {
      frame = 0;
      const readingLine = window.innerHeight * 0.28;
      const atReadingLine = targets
        .filter((target) => {
          const rect = target.getBoundingClientRect();
          return rect.top <= readingLine && rect.bottom >= readingLine;
        })
        .sort(
          (left, right) =>
            Math.abs(left.getBoundingClientRect().top - readingLine) -
            Math.abs(right.getBoundingClientRect().top - readingLine),
        )[0];
      const current =
        atReadingLine ??
        targets.reduce((closest, target) => {
          const closestDistance = Math.abs(
            closest.getBoundingClientRect().top - readingLine,
          );
          const targetDistance = Math.abs(
            target.getBoundingClientRect().top - readingLine,
          );
          return targetDistance < closestDistance ? target : closest;
        });
      setActiveId((previous) =>
        previous === current.id ? previous : (current.id as ChapterId),
      );
    };

    const scheduleCurrentChapter = () => {
      if (!frame) frame = window.requestAnimationFrame(chooseCurrentChapter);
    };

    chooseCurrentChapter();
    window.addEventListener("scroll", scheduleCurrentChapter, { passive: true });
    window.addEventListener("resize", scheduleCurrentChapter);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleCurrentChapter);
      window.removeEventListener("resize", scheduleCurrentChapter);
    };
  }, [copy.chapters]);

  const closeDialog = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

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
  }, [closeDialog, open]);

  const markNavigation = (id: ChapterId) => {
    setActiveId(id);
    if (open) closeDialog();
  };

  const portal = mounted
    ? createPortal(
        <div data-customer-section="home-journey-concierge">
          <button
            ref={triggerRef}
            type="button"
            onClick={openDialog}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="journey-concierge-dialog"
            aria-label={copy.open}
            data-customer-track="journey-concierge-open"
            data-customer-content-id="journey-concierge"
            data-customer-content-type="navigation"
            className="fixed bottom-3 right-3 z-[80] inline-flex min-h-12 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-white/25 bg-[#183F34] px-3.5 text-sm font-extrabold text-white shadow-[0_14px_42px_rgba(10,31,24,.3)] transition hover:bg-[#24594A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B96A] motion-reduce:transition-none max-[279px]:h-14 max-[279px]:w-14 max-[279px]:justify-center max-[279px]:p-0 sm:bottom-5 sm:right-5 sm:px-4"
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#E7B96A]/65 text-[#E7B96A]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              >
                <path d="M12 3 9.7 9.7 3 12l6.7 2.3L12 21l2.3-6.7L21 12l-6.7-2.3L12 3Z" />
              </svg>
            </span>
            <span className="max-w-[9rem] truncate max-[279px]:sr-only">
              {lang === "vi" ? "Trợ lý hành trình" : "Journey concierge"}
            </span>
          </button>

          {open ? (
            <div className="pointer-events-none fixed inset-0 z-[1100]">
              <button
                type="button"
                aria-label={copy.close}
                onClick={closeDialog}
                className="pointer-events-auto absolute inset-0 bg-[#071B15]/42 backdrop-blur-[2px]"
              />
              <section
                ref={dialogRef}
                id="journey-concierge-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="journey-concierge-title"
                aria-describedby="journey-concierge-description"
                className="pointer-events-auto absolute inset-x-2 bottom-2 max-h-[calc(100dvh-1rem)] min-w-0 overflow-y-auto rounded-[24px] border border-[#D7D4C8] bg-[#F8F4EA] p-4 text-[#183F34] shadow-[0_28px_90px_rgba(7,27,21,.38)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(27rem,calc(100vw-2.5rem))] sm:p-5"
              >
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[#183F34]/14 pb-4">
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#7C673E]">
                      {copy.eyebrow}
                    </p>
                    <h2
                      id="journey-concierge-title"
                      className="font-display mt-2 text-[clamp(1.65rem,8vw,2.2rem)] leading-[1.02]"
                    >
                      {copy.title}
                    </h2>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={closeDialog}
                    aria-label={copy.close}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#183F34]/24 bg-white/65 text-xl transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3F7568] motion-reduce:transition-none"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                <p
                  id="journey-concierge-description"
                  className="mt-4 text-sm leading-6 text-[#526159]"
                >
                  {copy.introduction}
                </p>
                <p className="mt-3 text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">
                  {copy.current}: {activeChapter.shortLabel}
                </p>

                <nav aria-label={copy.navigationAria} className="mt-4">
                  <ul className="divide-y divide-[#183F34]/12 border-y border-[#183F34]/12">
                    {copy.chapters.map((chapter) => {
                      const current = chapter.id === activeId;
                      return (
                        <li key={chapter.id}>
                          <a
                            href={chapterHref(chapter.id)}
                            aria-current={current ? "location" : undefined}
                            onClick={() => markNavigation(chapter.id)}
                            data-customer-track={`journey-concierge-${chapter.id}`}
                            data-customer-content-id={chapter.id}
                            data-customer-content-type="section-navigation"
                            className={`group grid min-h-14 min-w-0 grid-cols-[1fr_auto] items-center gap-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3F7568] motion-reduce:transition-none ${
                              current ? "text-[#183F34]" : "text-[#43534C] hover:text-[#183F34]"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold leading-5">
                                {chapter.label}
                              </span>
                              <span className="mt-0.5 block text-xs leading-5 text-[#6D756F]">
                                {chapter.description}
                              </span>
                            </span>
                            <span
                              className={`grid h-8 w-8 place-items-center rounded-full border transition motion-reduce:transition-none ${
                                current
                                  ? "border-[#183F34] bg-[#183F34] text-white"
                                  : "border-[#183F34]/22 group-hover:border-[#183F34]/55"
                              }`}
                            >
                              <ChapterArrow />
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </section>
            </div>
          ) : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <nav
        aria-label={copy.inlineAria}
        data-customer-section="home-journey-index"
        className="min-w-0 overflow-hidden border-y border-[#183F34]/12 bg-[#F3EEE3] text-[#183F34]"
      >
        <div className="mx-auto flex min-w-0 max-w-7xl flex-col px-4 min-[280px]:px-5 sm:px-8 lg:flex-row lg:items-center lg:gap-8">
          <p className="shrink-0 pt-4 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#6E6148] lg:py-5">
            {copy.inlineLabel}
          </p>
          <ol className="flex min-w-0 snap-x snap-proximity gap-6 overflow-x-auto py-4 [scrollbar-width:none] lg:flex-1 lg:justify-between lg:gap-4 lg:py-5 [&::-webkit-scrollbar]:hidden">
            {copy.chapters.map((chapter) => {
              const current = chapter.id === activeId;
              return (
                <li key={chapter.id} className="shrink-0 snap-start">
                  <a
                    href={chapterHref(chapter.id)}
                    aria-current={current ? "location" : undefined}
                    onClick={() => markNavigation(chapter.id)}
                    data-customer-track={`journey-index-${chapter.id}`}
                    data-customer-content-id={chapter.id}
                    data-customer-content-type="section-navigation"
                    className={`relative inline-flex min-h-8 items-center whitespace-nowrap pb-1 text-xs font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3F7568] motion-reduce:transition-none ${
                      current ? "text-[#183F34]" : "text-[#56635D] hover:text-[#183F34]"
                    }`}
                  >
                    {chapter.shortLabel}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 bottom-0 h-px origin-left bg-[#B5863E] transition-transform duration-300 motion-reduce:transition-none ${
                        current ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
      {portal}
    </>
  );
}
