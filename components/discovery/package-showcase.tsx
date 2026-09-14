import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import { PACE_LABEL, PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGE_IMAGE_SITE_ID } from "@/content/package-images";
import { CONTACT } from "@/content/contact";

type Language = "en" | "vi";

export type PackageShowcaseCopy = {
  label: string;
  title: string;
  intro: string;
  bookingNote: string;
  cta: string;
  viewAll: string;
  pricePerGuest: string;
  callNote: string;
  callCta: string;
  emailCta: string;
};

/*
 * `content/packages.ts` chi co chu tieng Viet (khong co truong Localized
 * nhu `destinations.ts`) -- dung nhu chinh /packages va /packages/[slug]
 * dang lam. Trang chu thi can ca hai ngon ngu nhu moi khoi khac, nen bang
 * duoi day DICH LAI dung nam ten/doi tuong/nhip da co trong PACKAGES,
 * khong bia them goi nao, khong doi gia hay lich. Thieu slug nao trong
 * bang thi component tu rot ve chu tieng Viet goc, khong bao gio trang.
 */
const PACKAGE_EN: Partial<
  Record<string, { name: string; audience: string; durationLabel: string; priceLabel?: string }>
> = {
  "heritage-day": {
    name: "Heritage in a Day",
    audience: "First visit to Ninh Bình",
    durationLabel: "1 day",
  },
  "slow-ninh-binh": {
    name: "Slow Ninh Bình",
    audience: "Parents and older travelers, light walking",
    durationLabel: "1 day",
  },
  "family-discovery": {
    name: "Family Discovery",
    audience: "Families with children",
    durationLabel: "1 day",
  },
  "cinematic-sunset": {
    name: "Cinematic Ninh Bình",
    audience: "Photographers and couples",
    durationLabel: "Half day and evening",
  },
  "ban-trang-tam-coc-2026": {
    name: "Moon Table by the Ngô Đồng",
    audience: "Two people closing a Tam Cốc day with a private dinner table",
    durationLabel: "19:00–21:30 · 2026 moon season",
    priceLabel: "2,480,000 VND · table for two",
  },
};

const PACE_LABEL_EN: Record<PackageCatalogItem["pace"], string> = {
  relaxed: "relaxed pace",
  balanced: "balanced pace",
  active: "active pace",
};

function packageDisplay(item: PackageCatalogItem, lang: Language) {
  const translation = PACKAGE_EN[item.slug];
  const name = lang === "en" && translation ? translation.name : item.name;
  const audience = lang === "en" && translation ? translation.audience : item.audience;
  const durationLabel =
    lang === "en" && translation ? translation.durationLabel : item.durationLabel;
  const paceLabel = lang === "en" ? PACE_LABEL_EN[item.pace] : PACE_LABEL[item.pace];
  const priceText = item.priceLabel
    ? lang === "en" && translation?.priceLabel
      ? translation.priceLabel
      : item.priceLabel
    : `${item.demoPriceVnd.toLocaleString("vi-VN")} VND`;
  const destination = DESTINATIONS.find(
    (candidate) => candidate.id === PACKAGE_IMAGE_SITE_ID[item.slug],
  );
  const image = destination?.image ?? "/images/destinations/trang-an.jpg";
  const imageAlt = destination ? destination.imageAlt[lang] : name;
  return { name, audience, durationLabel, paceLabel, priceText, image, imageAlt };
}

function packageHref(slug: string, lang: Language, source: string) {
  return `/packages/${slug}?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
}

/**
 * Khoi "gói trải nghiệm" tren trang chu.
 *
 * WEB-STRUCT-02 (31/08): ban cu goi dau dung the lon, bon goi con lai xep
 * thanh danh sach hang ngang MONG so le trai/phai (`lg:mr-16`/`lg:ml-16`)
 * -- doc nhu mot dong danh sach, khong ai thay ro tung goi. Chu du an che
 * thang "5 gói trải nghiệm sao lại là 1 dòng?".
 *
 * Ban moi: van giu goi dau la the lon nam-ngang (khong doi, da ro). Bon
 * goi con lai chuyen sang nhip bien tap LON/NHO so le theo hang -- hang 1
 * la [lon, nho], hang 2 la [nho, lon] (`lg:col-span-7`/`lg:col-span-5`
 * tren luoi 12 cot) -- ANH khac ty le (16/10 cho the lon, 4/5 cho the
 * nho) chu khong chi doi vi tri, nen KHONG phai luoi the deu tam tap (mau
 * do da bi chu du an loai hai lan tren chinh trang nay, xem
 * UI_UX_RULES.md#known-incident). Ten/gia/lich lay THANG tu
 * `content/packages.ts`, khong bia them goi nao.
 */
export function PackageShowcase({
  lang,
  source,
  copy,
}: {
  lang: Language;
  source: string;
  copy: PackageShowcaseCopy;
}) {
  const [featured, ...rest] = PACKAGES;
  const featuredDisplay = packageDisplay(featured, lang);
  const featuredHref = packageHref(featured.slug, lang, source);
  const viewAllHref = `/packages?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
  const contactSubject = encodeURIComponent(
    lang === "vi"
      ? "Hỏi về gói trải nghiệm — Ninh Bình Journey"
      : "Enquiry about experience packages — Ninh Binh Journey",
  );

  return (
    <section id="packages" data-customer-section="home-packages" className="scroll-mt-20 bg-[#FBFAF6] px-4 py-16 min-[280px]:px-5 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-5xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#3F7568]">{copy.label}</p>
          <RevealHeading
            as="h2"
            text={copy.title}
            className="font-display mt-4 max-w-4xl text-[clamp(2.35rem,6vw,4.75rem)] leading-[0.98] text-[#183F34] [text-wrap:balance]"
          />
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#4A5751] sm:text-lg sm:leading-8">{copy.intro}</p>
          <p className="mt-3 text-sm font-semibold text-[#3F7568]">{copy.bookingNote}</p>
          {/*
            WEB-STRUCT-02: ngoai nut vao tung goi, phai co loi dat cho qua
            dien thoai. So/email that lay THANG tu `content/contact.ts`
            (nguon dung chung voi `seasonal-experience-browser.tsx`),
            khong bia so khac.
          */}
          <div className="mt-6 grid max-w-5xl gap-3 sm:grid-cols-2 xl:grid-cols-[max-content_max-content_minmax(0,1fr)] xl:items-center">
            <a
              href={CONTACT.phoneHref}
              data-customer-track="home-packages-call"
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-[#183F34] px-5 text-center text-sm font-semibold leading-5 text-white transition hover:bg-[#2C5F4F] min-[280px]:px-6 min-[280px]:text-base"
            >
              {copy.callCta} · {CONTACT.phoneLabel}
            </a>
            <a
              href={`mailto:${CONTACT.email}?subject=${contactSubject}`}
              data-customer-track="home-packages-email"
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-[#183F34]/40 px-5 text-center text-sm font-semibold leading-5 text-[#183F34] transition hover:bg-[#183F34]/8 min-[280px]:px-6 min-[280px]:text-base"
            >
              {copy.emailCta}
            </a>
            <p className="text-sm leading-6 text-[#6D756F] sm:col-span-2 xl:col-span-1">{copy.callNote}</p>
          </div>
        </Reveal>

        <Reveal
          delayMs={80}
          className="mt-12 grid overflow-hidden rounded-[10px] border border-[#A8CEC1]/60 bg-white shadow-xl shadow-[#183F34]/10 xl:grid-cols-[1.1fr_1fr]"
        >
          <div className="relative aspect-[4/3] xl:aspect-auto">
            <Image
              src={featuredDisplay.image}
              alt={featuredDisplay.imageAlt}
              fill
              sizes="(min-width: 1280px) 46vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#3F7568]">
              {featuredDisplay.durationLabel} · {featuredDisplay.paceLabel}
            </p>
            <h3 className="font-display mt-3 text-3xl leading-tight text-[#183F34] sm:text-4xl">{featuredDisplay.name}</h3>
            <p className="mt-3 text-[#2C3B35]">{featuredDisplay.audience}</p>
            <p className="mt-5 break-words font-display text-2xl leading-tight text-[#183F34]">{featuredDisplay.priceText}</p>
            {/* QA-P2-09: Bàn Trăng tính theo bàn hai khách; ghi thêm "mỗi người lớn" ngay dưới là tự nói ngược. */}
            {featured.priceLabel ? null : <p className="text-xs text-[#6D756F]">{copy.pricePerGuest}</p>}
            <Link
              data-customer-track={`home-packages-${featured.slug}`}
              data-customer-content-id={featured.id}
              data-customer-content-type="package"
              href={featuredHref}
              className="mt-6 inline-flex min-h-11 max-w-full w-fit items-center justify-center rounded-full bg-[#183F34] px-6 text-center font-semibold leading-5 text-white transition hover:bg-[#2C5F4F]"
            >
              {copy.cta}
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 items-start gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-12">
          {rest.map((item, index) => {
            const display = packageDisplay(item, lang);
            const href = packageHref(item.slug, lang, source);
            // Hang 1 = [lon, nho], hang 2 = [nho, lon], hang 3 lai ve [lon, nho]...
            // -- nhip zigzag that su doi ben moi hang, khong phai "lon luon o
            // trai" lap lai. `row` la hang thu may (0, 1, 2...), `position` la
            // vi tri trong hang (0 = trai, 1 = phai); the "lon" doi cho vi tri
            // theo do le/chan cua hang, roi CSS grid auto-flow tu xep dung cho
            // vi hai the cong lai luon dung 12 cot (7+5).
            const row = Math.floor(index / 2);
            const position = index % 2;
            const bigPosition = row % 2 === 0 ? 0 : 1;
            const big = position === bigPosition;
            return (
              <Reveal
                key={item.slug}
                delayMs={Math.min(index, 3) * 60}
                className={`overflow-hidden rounded-[10px] border border-[#A8CEC1]/50 bg-white shadow-lg shadow-[#183F34]/8 ${
                  big ? "xl:col-span-7" : "xl:col-span-5"
                }`}
              >
                <div className={`relative w-full aspect-[16/10] ${big ? "xl:aspect-[7/6]" : "xl:aspect-[4/5]"}`}>
                  <Image
                    src={display.image}
                    alt={display.imageAlt}
                    fill
                    sizes={big ? "(min-width: 1280px) 58vw, 100vw" : "(min-width: 1280px) 40vw, 100vw"}
                    className="object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">
                      {display.durationLabel} · {display.paceLabel}
                    </p>
                    <h3 className={`font-display mt-2 break-words leading-tight text-[#183F34] ${big ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>
                      {display.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#6D756F]">{display.audience}</p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[#183F34]/12 pt-4">
                    <p className="min-w-0 break-words font-display text-lg leading-tight text-[#183F34] sm:text-xl">{display.priceText}</p>
                    <Link
                      data-customer-track={`home-packages-${item.slug}`}
                      data-customer-content-id={item.id}
                      data-customer-content-type="package"
                      href={href}
                      className="inline-flex min-h-10 max-w-full items-center justify-center rounded-full border border-[#183F34]/40 px-5 text-center text-sm font-semibold leading-5 text-[#183F34] transition hover:bg-[#183F34] hover:text-white"
                    >
                      {copy.cta}
                    </Link>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            data-customer-track="home-packages-view-all"
            data-customer-content-id="packages-catalog"
            data-customer-content-type="secondary-cta"
            href={viewAllHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#183F34]/30 px-6 font-semibold text-[#183F34] transition hover:bg-[#183F34]/6"
          >
            {copy.viewAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
