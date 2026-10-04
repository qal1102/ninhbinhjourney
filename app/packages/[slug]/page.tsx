import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/shared/json-ld";
import { jsonLdGoi } from "@/domain/du-lieu-cau-truc";
import { absoluteUrl } from "@/lib/site-url";
import { getPackageBySlug, PACKAGES } from "@/content/packages";
import { giaGoi, goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { DESTINATIONS } from "@/content/destinations";
import { getPackageHeroImage } from "@/content/package-images";
import { MiniRouteMap } from "@/components/discovery/mini-route-map";
import {
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import {
  checkoutHref,
  destinationFromPackageHref,
  destinationImageTransitionName,
  packageDetailBackHref,
  packageImageTransitionName,
  readContinuityContext,
} from "@/lib/page-continuity";

export function generateStaticParams() {
  return PACKAGES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = getPackageBySlug((await params).slug);
  if (!item) return {};
  const chu = goiHienThi(item, "vi");
  const title = `${chu.name} | Ninh Bình Journey`;
  const description = chu.editorialDescription ?? `${chu.durationLabel} · ${chu.audience}`;
  const canonical = absoluteUrl(`/packages/${item.slug}`);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

export default async function PackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const item = getPackageBySlug((await params).slug);
  if (!item) notFound();
  const query = await searchParams;
  const navigationContext = readContinuityContext(query);
  const lang = await docNgonNgu(query);
  const chu = goiHienThi(item, lang);
  const hetMua = goiDaHetMua(item);
  const flags = getExperiencePresentationFlags(readPublicEnvironment());
  const customerBookingEnabled = isCustomerBookingEnabled();
  const checkoutAvailable = flags.sandboxCheckout || customerBookingEnabled;
  const sites = item.siteIds
    .map((id) => DESTINATIONS.find((destination) => destination.id === id))
    .filter((destination) => destination !== undefined);
  const hero = getPackageHeroImage(item, lang);

  return (
    <main lang={lang} data-customer-section="package-detail" className="min-h-screen bg-[#183f34] px-5 py-10 text-white sm:px-8 lg:py-16">
      <JsonLd
        du={jsonLdGoi({
          ten: chu.name,
          moTa: chu.editorialDescription ?? `${chu.durationLabel} · ${chu.audience}`,
          url: absoluteUrl(`/packages/${item.slug}`),
          anh: absoluteUrl(hero.src),
          thoiLuongPhut: item.durationMinutes,
          cacDiem: sites.map((site) => site.name[lang]),
          nhaToChuc: { ten: "Ninh Bình Journey", url: absoluteUrl("/") },
        })}
      />
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={packageDetailBackHref(navigationContext)}
            transitionTypes={["nav-back"]}
            className="text-sm font-bold text-[#e7c78d]"
          >
            ← {ch(lang, "So sánh gói", "Compare packages")}
          </Link>
          <NutNgonNgu lang={lang} tone="dark" />
        </div>
        <SharedImageTransition
          name={packageImageTransitionName(item.slug)}
          className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-3xl sm:aspect-[21/9]"
        >
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            priority
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover"
          />
        </SharedImageTransition>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.72fr]">
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              {customerBookingEnabled
                ? `${ch(lang, "Giữ chỗ theo số chỗ còn trống", "Hold seats that are still free")} · ${chu.durationLabel}`
                : flags.sandboxCheckout
                  ? `${ch(lang, "Dữ liệu minh họa", "Sample data")} · ${chu.durationLabel}`
                : `${ch(lang, "Bảng giá tham khảo", "Reference prices")} · ${chu.durationLabel}`}
            </p>
            <h1 className="font-display mt-4 text-6xl leading-[0.92] sm:text-8xl">
              {chu.name}
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/68">
              {chu.editorialDescription ??
                ch(
                  lang,
                  `Hợp với: ${chu.audience}. Giá là giá minh hoạ.`,
                  `Best for: ${chu.audience}. Prices are samples.`,
                )}
            </p>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  data-customer-track="package-destination"
                  data-customer-content-id={site.id}
                  data-customer-content-type="destination"
                  href={destinationFromPackageHref(
                    site.slug,
                    item.slug,
                    navigationContext,
                  )}
                  transitionTypes={["nav-forward"]}
                  className="overflow-hidden rounded-2xl border border-white/15 bg-white/7"
                >
                  <SharedImageTransition
                    name={destinationImageTransitionName(site.slug)}
                    className="relative aspect-[16/10]"
                  >
                    <Image
                      src={site.image}
                      alt={site.imageAlt[lang]}
                      fill
                      sizes="(min-width: 640px) 22vw, 100vw"
                      className="object-cover"
                    />
                  </SharedImageTransition>
                  <div className="p-5">
                    <p className="font-display text-2xl">{site.name[lang]}</p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      {site.editorialLine[lang]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            {sites.length > 0 ? (
              <div className="mt-9">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
                  {ch(lang, "Các điểm trong gói, trên bản đồ Ninh Bình", "The stops in this package, on the Ninh Binh map")}
                </p>
                <div className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <MiniRouteMap
                    tone="dark"
                    points={sites.map((site) => ({
                      id: site.id,
                      label: site.name[lang],
                      coordinates: site.coordinates,
                    }))}
                  />
                </div>
              </div>
            ) : null}
          </section>
          <aside className="h-fit rounded-3xl bg-[#fbfaf6] p-6 text-[#151a17] sm:p-8">
            <p className="text-sm text-[#59654b]">
              {item.priceLabel
                ? ch(lang, "Giá giới thiệu mùa 2026", "2026 introductory price")
                : ch(lang, "Giá minh họa / người lớn", "Sample price per adult")}
            </p>
            <p className="font-display mt-2 text-4xl text-[#183f34]">
              {giaGoi(item, lang)}
            </p>
            <h2 className="mt-7 font-bold">{ch(lang, "Lịch minh họa", "Sample schedule")}</h2>
            <ol className="mt-3 space-y-3">
              {chu.schedule.map((value) => (
                <li key={value} className="rounded-xl bg-[#f4f0e7] p-3 text-sm">
                  {value}
                </li>
              ))}
            </ol>
            {hetMua ? (
              <p data-testid="goi-het-mua" className="mt-6 rounded-xl bg-[#f4f0e7] p-4 text-sm leading-6 text-[#59654b]">
                {ch(
                  lang,
                  "Bàn Trăng chỉ mở trong mùa trăng 2026, và mùa ấy đã khép. Mời bạn xem các gói đi quanh năm, hoặc hẹn lại mùa trăng năm sau.",
                  "The Moon Table ran only through the 2026 moon season, which has now closed. Take a look at the year-round packages, or come back next moon season.",
                )}
              </p>
            ) : checkoutAvailable ? (
              <>
                <p className="mt-6 text-xs leading-5 text-[#7a725f]">
                  {ch(
                    lang,
                    "Chuyển khoản ở bản này là giả lập, không thu tiền. Không hỏi số thẻ, tài khoản ngân hàng hay dữ liệu thanh toán thật.",
                    "Payment in this version is simulated and takes no money. We never ask for a card number, bank account or real payment details.",
                  )}
                </p>
                <Link
                  data-customer-track="package-checkout"
                  data-customer-content-id={item.id}
                  data-customer-content-type="package"
                  href={checkoutHref(item.slug, navigationContext)}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold"
                >
                  {customerBookingEnabled ? ch(lang, "Giữ chỗ 15 phút", "Hold for 15 minutes") : ch(lang, "Tiếp tục bản trình diễn", "Continue the demo")}
                </Link>
              </>
            ) : (
              <p className="mt-6 rounded-xl bg-[#f4f0e7] p-4 text-sm leading-6 text-[#59654b]">
                {ch(
                  lang,
                  "Trang này đang là bảng giá tham khảo, chưa mở đặt trên web.",
                  "Online booking is not open here yet; this page is a reference price list.",
                )}
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
