import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import { PACE_LABEL, PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGE_IMAGE_SITE_ID } from "@/content/package-images";
import { goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { CONTACT } from "@/content/contact";
import { ProtectedMailLink } from "@/components/discovery/protected-mail-link";
import {
  packageCatalogHref,
  packageDetailHref,
  packageImageTransitionName,
  type ContinuityContext,
} from "@/lib/page-continuity";

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
 * Chữ tiếng Anh của gói đọc từ `content/packages-en.ts`, cùng nguồn với
 * /packages. Trước 01/10 khối này giữ một bảng dịch riêng, nên gói mới (Tam
 * Chúc) hiện tiếng Việt giữa trang chủ tiếng Anh.
 */
const PACE_LABEL_EN: Record<PackageCatalogItem["pace"], string> = {
  relaxed: "relaxed pace",
  balanced: "balanced pace",
  active: "active pace",
};

function packageDisplay(item: PackageCatalogItem, lang: Language) {
  const hienThi = goiHienThi(item, lang);
  const { name, audience, durationLabel } = hienThi;
  const paceLabel = lang === "en" ? PACE_LABEL_EN[item.pace] : PACE_LABEL[item.pace];
  const priceText = hienThi.priceLabel ?? `${item.demoPriceVnd.toLocaleString("vi-VN")} VND`;
  const destination = DESTINATIONS.find(
    (candidate) => candidate.id === PACKAGE_IMAGE_SITE_ID[item.slug],
  );
  const image = destination?.image ?? "/images/destinations/trang-an.jpg";
  const imageAlt = destination ? destination.imageAlt[lang] : name;
  return { name, audience, durationLabel, paceLabel, priceText, image, imageAlt };
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
  // Gói theo mùa đã hết cửa đặt (Bàn Trăng sau 27/09) không mời ở trang chủ nữa;
  // trang /packages vẫn giữ nó kèm nhãn "đã khép".
  const [featured, ...rest] = PACKAGES.filter((item) => !goiDaHetMua(item));
  const navigationContext: ContinuityContext = {
    lang,
    ...(source ? { source } : {}),
  };
  const featuredDisplay = packageDisplay(featured, lang);
  const featuredHref = packageDetailHref(
    featured.slug,
    navigationContext,
    "home",
  );
  const viewAllHref = packageCatalogHref(navigationContext, "home");
  const contactSubject =
    lang === "vi"
      ? "Hỏi về gói tham quan — Ninh Bình Journey"
      : "Enquiry about experience packages — Ninh Binh Journey";

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
            <ProtectedMailLink
              subject={contactSubject}
              track="home-packages-email"
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-[#183F34]/40 px-5 text-center text-sm font-semibold leading-5 text-[#183F34] transition hover:bg-[#183F34]/8 min-[280px]:px-6 min-[280px]:text-base"
            >
              {copy.emailCta}
            </ProtectedMailLink>
            <p className="text-sm leading-6 text-[#6D756F] sm:col-span-2 xl:col-span-1">{copy.callNote}</p>
          </div>
        </Reveal>

        <Reveal
          delayMs={80}
          className="mt-12 grid overflow-hidden rounded-[10px] border border-[#A8CEC1]/60 bg-white shadow-xl shadow-[#183F34]/10 xl:grid-cols-[1.1fr_1fr]"
        >
          <SharedImageTransition
            name={packageImageTransitionName(featured.slug)}
            className="relative aspect-[4/3] xl:aspect-auto"
          >
            <Image
              src={featuredDisplay.image}
              alt={featuredDisplay.imageAlt}
              fill
              sizes="(min-width: 1280px) 46vw, 100vw"
              className="object-cover"
            />
          </SharedImageTransition>
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
              transitionTypes={["nav-forward"]}
              className="mt-6 inline-flex min-h-11 max-w-full w-fit items-center justify-center rounded-full bg-[#183F34] px-6 text-center font-semibold leading-5 text-white transition hover:bg-[#2C5F4F]"
            >
              {copy.cta}
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 items-start gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-12">
          {rest.map((item, index) => {
            const display = packageDisplay(item, lang);
            const href = packageDetailHref(item.slug, navigationContext, "home");
            // Hang 1 = [lon, nho], hang 2 = [nho, lon], hang 3 lai ve [lon, nho]...
            // -- nhip zigzag that su doi ben moi hang, khong phai "lon luon o
            // trai" lap lai. `row` la hang thu may (0, 1, 2...), `position` la
            // vi tri trong hang (0 = trai, 1 = phai); the "lon" doi cho vi tri
            // theo do le/chan cua hang, roi CSS grid auto-flow tu xep dung cho
            // vi hai the cong lai luon dung 12 cot (7+5).
            const row = Math.floor(index / 2);
            const position = index % 2;
            const bigPosition = row % 2 === 0 ? 0 : 1;
            // Số gói lẻ thì thẻ cuối đứng một mình một hàng: trải hết 12 cột
            // thay vì để hở một ô trống bên cạnh.
            const leCuoi = rest.length % 2 === 1 && index === rest.length - 1;
            const big = position === bigPosition;
            return (
              <Reveal
                key={item.slug}
                delayMs={Math.min(index, 3) * 60}
                className={`overflow-hidden rounded-[10px] border border-[#A8CEC1]/50 bg-white shadow-lg shadow-[#183F34]/8 ${
                  leCuoi ? "md:col-span-2 xl:col-span-12" : big ? "xl:col-span-7" : "xl:col-span-5"
                }`}
              >
                <SharedImageTransition
                  name={packageImageTransitionName(item.slug)}
                  className={`relative w-full aspect-[16/10] ${leCuoi ? "xl:aspect-[21/8]" : big ? "xl:aspect-[7/6]" : "xl:aspect-[4/5]"}`}
                >
                  <Image
                    src={display.image}
                    alt={display.imageAlt}
                    fill
                    sizes={big ? "(min-width: 1280px) 58vw, 100vw" : "(min-width: 1280px) 40vw, 100vw"}
                    className="object-cover"
                  />
                </SharedImageTransition>
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
                      transitionTypes={["nav-forward"]}
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
