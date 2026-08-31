import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import { PACE_LABEL, PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";

type Language = "en" | "vi";

export type PackageShowcaseCopy = {
  label: string;
  title: string;
  intro: string;
  bookingNote: string;
  cta: string;
  viewAll: string;
  pricePerGuest: string;
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

/*
 * Anh minh hoa cho tung goi lay THANG tu content/destinations.ts (kho anh
 * da duyet, dang dung o /packages/[slug]) -- khong them anh moi. Moi map
 * toi dung MOT diem co that trong `schedule` cua chinh goi do, khong chon
 * bua: heritage-day mo dau bang Trang An, slow-ninh-binh khep lai o Pho co
 * Hoa Lu buoi toi, family-discovery ghe Bai Dinh, ca cinematic-sunset lan
 * Ban Trang deu neo o Tam Coc -- Bich Dong (cung mot vung, hai goi khac
 * nhau, nen dung chung anh cung khong sai lech).
 */
const PACKAGE_IMAGE_SITE_ID: Record<string, string> = {
  "heritage-day": "10000000-0000-4000-8000-000000000001",
  "slow-ninh-binh": "10000000-0000-4000-8000-000000000004",
  "family-discovery": "10000000-0000-4000-8000-000000000003",
  "cinematic-sunset": "10000000-0000-4000-8000-000000000005",
  "ban-trang-tam-coc-2026": "10000000-0000-4000-8000-000000000005",
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
 * Khoi "gói trải nghiệm" tren trang chu: goi dau (heritage-day, dong khach
 * rong nhat) dung mot the lon nam-ngang kieu zigzag, bon goi con lai xep
 * thanh danh sach hang ngang so le trai/phai (`lg:mr-16` / `lg:ml-16`) --
 * co chu dich KHONG dung luoi the deu nhau (UI_UX_RULES.md da ghi lai hai
 * lan luoi the bi chu du an loai tren trang chu). Anh that, gia that tu
 * `content/packages.ts`, khong bia them.
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

  return (
    <section id="packages" data-customer-section="home-packages" className="bg-[#FBFAF6] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#3F7568]">{copy.label}</p>
          <RevealHeading
            as="h2"
            text={copy.title}
            className="font-display mt-4 text-4xl leading-tight text-[#183F34] sm:text-6xl"
          />
          <p className="mt-5 text-lg leading-relaxed text-[#4A5751]">{copy.intro}</p>
          <p className="mt-3 text-sm font-semibold text-[#3F7568]">{copy.bookingNote}</p>
        </Reveal>

        <Reveal
          delayMs={80}
          className="mt-14 grid overflow-hidden rounded-[10px] border border-[#A8CEC1]/60 bg-white shadow-xl shadow-[#183F34]/10 lg:grid-cols-[1.1fr_1fr]"
        >
          <div className="relative aspect-[4/3] lg:aspect-auto">
            <Image
              src={featuredDisplay.image}
              alt={featuredDisplay.imageAlt}
              fill
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#3F7568]">
              {featuredDisplay.durationLabel} · {featuredDisplay.paceLabel}
            </p>
            <h3 className="font-display mt-3 text-3xl text-[#183F34] sm:text-4xl">{featuredDisplay.name}</h3>
            <p className="mt-3 text-[#2C3B35]">{featuredDisplay.audience}</p>
            <p className="mt-5 font-display text-2xl text-[#183F34]">{featuredDisplay.priceText}</p>
            <p className="text-xs text-[#6D756F]">{copy.pricePerGuest}</p>
            <Link
              data-customer-track={`home-packages-${featured.slug}`}
              data-customer-content-id={featured.id}
              data-customer-content-type="package"
              href={featuredHref}
              className="mt-6 inline-flex w-fit min-h-11 items-center rounded-full bg-[#183F34] px-6 font-semibold text-white transition hover:bg-[#2C5F4F]"
            >
              {copy.cta}
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 flex flex-col gap-5 lg:gap-6">
          {rest.map((item, index) => {
            const display = packageDisplay(item, lang);
            const href = packageHref(item.slug, lang, source);
            const offsetClass = index % 2 === 0 ? "lg:mr-16" : "lg:ml-16";
            return (
              <Reveal
                key={item.slug}
                delayMs={Math.min(index, 3) * 60}
                className={`flex flex-col gap-5 rounded-[10px] border border-[#A8CEC1]/50 bg-white p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 ${offsetClass}`}
              >
                <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-[8px] sm:h-28 sm:w-40">
                  <Image src={display.image} alt={display.imageAlt} fill sizes="200px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">
                    {display.durationLabel} · {display.paceLabel}
                  </p>
                  <h3 className="font-display mt-1 text-2xl text-[#183F34]">{display.name}</h3>
                  <p className="mt-1 text-sm text-[#6D756F]">{display.audience}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="font-display text-xl text-[#183F34]">{display.priceText}</p>
                  <Link
                    data-customer-track={`home-packages-${item.slug}`}
                    data-customer-content-id={item.id}
                    data-customer-content-type="package"
                    href={href}
                    className="inline-flex min-h-10 items-center rounded-full border border-[#183F34]/40 px-5 text-sm font-semibold text-[#183F34] transition hover:bg-[#183F34]/8"
                  >
                    {copy.cta}
                  </Link>
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
