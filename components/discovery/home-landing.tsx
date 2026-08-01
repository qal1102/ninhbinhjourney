"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLockup } from "@/components/shared/brand-lockup";
import type { Language } from "@/app/ninh-binh-landing";

type Props = {
  initialLang: Language;
  source: string;
  clientDemo: boolean;
  presentationMode: boolean;
};

const COPY = {
  vi: {
    skip: "Bỏ qua intro",
    navExplore: "Khám phá",
    navPlan: "Lập hành trình",
    navOps: "Điều hành nội bộ",
    identity: ["Ninh Bình", "Thiên nhiên", "Di sản", "Kỳ quan"],
    eyebrow: "Một điểm đến · Một lõi dữ liệu · Một phòng điều hành",
    title: "Khám phá nhẹ nhàng. Điều hành nhìn thấy toàn cảnh.",
    body: "Một cửa ngõ ngắn gọn cho du khách và một hệ điều hành nội bộ để theo dõi sức chứa, check-in, sự cố và dấu vết vận hành.",
    plan: "Lập hành trình thật",
    explore: "Xem điểm đến",
    scope: "Phạm vi demo ưu tiên",
    scopeTitle: "Bái Đính và Tam Chúc trên cùng một màn hình quản lý.",
    scopeBody:
      "Sếp không cần mở nhiều báo cáo. Màn hình tổng quan gom tình trạng hai cơ sở, điểm nghẽn cần chú ý và luồng công việc của đội vận hành.",
    siteLabel: "Cơ sở vận hành",
    baiDinh: "Bái Đính",
    baiDinhNote: "Sức chứa theo ca · check-in · sự cố · nhật ký thao tác",
    tamChuc: "Tam Chúc",
    tamChucNote: "Sức chứa theo ca · check-in · sự cố · phối hợp liên cơ sở",
    openOps: "Mở trung tâm điều hành",
    demoNote: "Dữ liệu minh hoạ, không phải số liệu vận hành thật.",
    visualLabel: "Hai địa danh, hai ngữ cảnh rõ ràng",
    visualTitle: "Không dùng ảnh đẹp nhưng sai địa điểm.",
    baiDinhCaption:
      "Bái Đính được thể hiện như một quần thể hành hương quy mô lớn giữa núi đá vôi.",
    tamCocCaption:
      "Tam Cốc trở về đúng tuyến thuyền Ngô Đồng giữa đồng lúa và núi karst.",
    editorialImage: "Hình minh hoạ biên tập gốc · không phải ảnh tư liệu",
    routeLabel: "Route builder",
    routeTitle: "Một nút, một quy trình thật.",
    routeBody:
      "Nút Build a route giờ đi thẳng tới bộ lập hành trình đầy đủ, nơi yêu cầu được xác nhận, tuyến được tạo và vẫn có thể chỉnh sửa — không còn ô nhập giả tạo cảm giác bấm mà không chạy.",
    buildRoute: "Build a route",
    footer: "Cửa ngõ du lịch và hệ điều hành điểm đến Ninh Bình",
  },
  en: {
    skip: "Skip intro",
    navExplore: "Explore",
    navPlan: "Plan a journey",
    navOps: "Internal operations",
    identity: ["Ninh Binh", "Nature", "Heritage", "Wonder"],
    eyebrow: "One destination · One data core · One operating room",
    title: "Easy to explore. Clear enough to operate.",
    body: "A concise visitor gateway paired with an internal operating system for capacity, check-in, incidents and auditable action.",
    plan: "Plan a real journey",
    explore: "Explore destinations",
    scope: "Priority demonstration scope",
    scopeTitle: "Bai Dinh and Tam Chuc on one management screen.",
    scopeBody:
      "Leadership should not have to open a stack of reports. The overview brings both sites, attention points and operating workflows into one room.",
    siteLabel: "Operating site",
    baiDinh: "Bai Dinh",
    baiDinhNote: "Slot capacity · check-in · incidents · audit trail",
    tamChuc: "Tam Chuc",
    tamChucNote: "Slot capacity · check-in · incidents · cross-site coordination",
    openOps: "Open operations centre",
    demoNote: "Illustrative demo data, not live operational figures.",
    visualLabel: "Two places with distinct visual context",
    visualTitle: "No more attractive but incorrect destination images.",
    baiDinhCaption:
      "Bai Dinh reads as a large pilgrimage complex set among limestone hills.",
    tamCocCaption:
      "Tam Coc returns to the Ngo Dong boat route between rice fields and karsts.",
    editorialImage: "Original editorial visual · not documentary photography",
    routeLabel: "Route builder",
    routeTitle: "One button, one real workflow.",
    routeBody:
      "Build a route now opens the full journey planner, where the request is confirmed, the route is generated and every stop remains editable — no decorative input that appears to do nothing.",
    buildRoute: "Build a route",
    footer: "Ninh Binh visitor gateway and destination operating system",
  },
} as const;

export function HomeLanding({
  initialLang,
  source,
  clientDemo,
  presentationMode,
}: Props) {
  const [lang, setLang] = useState<Language>(initialLang);
  const [introVisible, setIntroVisible] = useState(true);
  const t = COPY[lang];

  const routeQuery = useMemo(() => {
    const params = new URLSearchParams({ lang });
    if (source) params.set("source", source);
    return params.toString();
  }, [lang, source]);

  useEffect(() => {
    window.localStorage.setItem("ninh-binh-lang", lang);
    document.cookie = `ninh-binh-lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      () => setIntroVisible(false),
      presentationMode ? 60_000 : reduced ? 1400 : 6500,
    );

    function skipWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIntroVisible(false);
    }

    window.addEventListener("keydown", skipWithEscape);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", skipWithEscape);
    };
  }, [presentationMode]);

  function switchLanguage(nextLang: Language) {
    setLang(nextLang);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("lang", nextLang);
    window.history.replaceState(
      null,
      "",
      `${nextUrl.pathname}?${nextUrl.searchParams.toString()}${nextUrl.hash}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#1d2925]">
      {introVisible ? (
        <div className="opening-screen" data-testid="opening-intro">
          <Image
            src="/images/destinations/intro-trang-an-rain.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="opening-image object-cover"
          />
          <div className="opening-vignette" />
          <button
            type="button"
            className="opening-skip"
            onClick={() => setIntroVisible(false)}
          >
            {t.skip}
          </button>
          <div className="opening-sequence" aria-label={t.identity.join(", ")}>
            {t.identity.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
          <div className="opening-lockup" aria-hidden="true">
            <p>{t.identity[0]}</p>
            <div />
            <span>{t.identity.slice(1).join(" · ")}</span>
          </div>
        </div>
      ) : null}

      <section className="relative min-h-[92svh] overflow-hidden bg-[#183f34] text-white">
        <Image
          src="/images/destinations/trang-an.jpg"
          alt={
            lang === "vi"
              ? "Thuyền giữa cảnh quan núi đá vôi Ninh Bình"
              : "Boats among Ninh Binh limestone karsts"
          }
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-78"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,17,14,.36),rgba(5,17,14,.22)_34%,rgba(12,35,29,.92))]" />
        <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <BrandLockup inverse />
          <nav className="hidden items-center gap-6 text-sm font-bold text-white/76 lg:flex" aria-label="Primary">
            <Link href={`/explore?${routeQuery}`} className="hover:text-[#e7c78d]">
              {t.navExplore}
            </Link>
            <Link href={`/plan?${routeQuery}`} className="hover:text-[#e7c78d]">
              {t.navPlan}
            </Link>
            <Link href="/erp/login" className="hover:text-[#e7c78d]">
              {t.navOps}
            </Link>
          </nav>
          <div className="flex rounded-full border border-white/25 bg-black/15 p-1 text-sm backdrop-blur">
            {(["vi", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option === "vi" ? "Chuyển sang tiếng Việt" : "Switch to English"}
                aria-pressed={lang === option}
                onClick={() => switchLanguage(option)}
                className={`min-h-10 min-w-11 rounded-full px-3 font-extrabold transition ${
                  lang === option
                    ? "bg-[#fbfaf6] text-[#183f34]"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div className="relative z-[1] mx-auto flex min-h-[92svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 sm:px-8 sm:pb-20">
          {clientDemo ? (
            <p className="mb-5 w-fit rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-bold text-white/76 backdrop-blur">
              Client demo · shared operational core
            </p>
          ) : null}
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d] sm:text-sm">
            {t.eyebrow}
          </p>
          <h1 className="font-display mt-5 max-w-5xl text-5xl leading-[0.96] sm:text-7xl lg:text-[6.7rem]">
            {t.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78 sm:text-xl">
            {t.body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/plan?${routeQuery}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#e7b96a] px-6 font-extrabold text-[#183f34] transition hover:bg-[#f1ca83]"
            >
              {t.plan}
            </Link>
            <Link
              href={`/explore?${routeQuery}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/35 px-6 font-extrabold transition hover:bg-white/10"
            >
              {t.explore}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#e2ece6] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
              {t.scope}
            </p>
            <h2 className="font-display mt-4 text-5xl leading-[0.98] text-[#183f34] sm:text-7xl">
              {t.scopeTitle}
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4d5b55]">
              {t.scopeBody}
            </p>
            {/* T2: both operator entry points now open the ERP that actually
                works. They used to open /demo/ops, the console of an
                abandoned stack with an empty database behind it. */}
            <Link
              href="/erp/login"
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#183f34] px-6 font-extrabold text-white transition hover:bg-[#24594a]"
            >
              {t.openOps}
            </Link>
            <p className="mt-3 text-xs text-[#4d5b55]">{t.demoNote}</p>
          </div>

          <div className="grid gap-4">
            {[t.baiDinh, t.tamChuc].map((site, index) => (
              <article
                key={site}
                className="rounded-3xl border border-[#bdd1c6] bg-[#fbfaf6] p-6 shadow-sm sm:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#6a745f]">
                      {t.siteLabel} · 0{index + 1}
                    </p>
                    <h3 className="font-display mt-3 text-4xl text-[#183f34] sm:text-5xl">
                      {site}
                    </h3>
                  </div>
                  <span className="rounded-full border border-[#9fc5b5] bg-[#e9f3ee] px-3 py-1 text-xs font-extrabold text-[#356957]">
                    Shared room
                  </span>
                </div>
                <p className="mt-6 border-t border-[#d4ded7] pt-5 leading-7 text-[#59654b]">
                  {index === 0 ? t.baiDinhNote : t.tamChucNote}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
            {t.visualLabel}
          </p>
          <h2 className="font-display mt-4 max-w-4xl text-5xl leading-none text-[#183f34] sm:text-7xl">
            {t.visualTitle}
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {[
              {
                name: t.baiDinh,
                image: "/images/destinations/editorial/bai-dinh-editorial.png",
                caption: t.baiDinhCaption,
              },
              {
                name: "Tam Cốc",
                image: "/images/destinations/editorial/tam-coc-editorial.png",
                caption: t.tamCocCaption,
              },
            ].map((place) => (
              <article key={place.name} className="overflow-hidden rounded-3xl bg-[#183f34] text-white">
                <div className="relative aspect-[3/2]">
                  <Image
                    src={place.image}
                    alt={place.caption}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-[#fbfaf6]/92 px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[#183f34] backdrop-blur">
                    {t.editorialImage}
                  </span>
                </div>
                <div className="p-6 sm:p-8">
                  <h3 className="font-display text-4xl">{place.name}</h3>
                  <p className="mt-3 leading-7 text-white/72">{place.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2ede3] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#76501b]">
              {t.routeLabel}
            </p>
            <h2 className="font-display mt-4 text-5xl leading-none text-[#183f34] sm:text-7xl">
              {t.routeTitle}
            </h2>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#59654b]">
              {t.routeBody}
            </p>
          </div>
          <Link
            href={`/plan?${routeQuery}`}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#e7b96a] px-7 font-extrabold text-[#183f34] transition hover:bg-[#f1ca83]"
          >
            {t.buildRoute} →
          </Link>
        </div>
      </section>

      <footer className="bg-[#151a17] px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLockup inverse product="DestinationOS" />
          <p className="text-sm text-white/52">{t.footer}</p>
        </div>
      </footer>
    </main>
  );
}
