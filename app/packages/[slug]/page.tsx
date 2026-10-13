import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/shared/json-ld";
import { jsonLdGoi } from "@/domain/du-lieu-cau-truc";
import { absoluteUrl } from "@/lib/site-url";
import { apBangGia, getPackageBySlug, PACKAGES } from "@/content/packages";
import { docBangGia } from "@/lib/commerce/bang-gia";
import { giaGoi, giaLeGoi, goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
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
import { SharedImageTransition, SharedTitleTransition } from "@/components/shared/shared-image-transition";
import { ThanhDatCho } from "@/components/commerce/thanh-dat-cho";
import {
  checkoutHref,
  destinationFromPackageHref,
  destinationImageTransitionName,
  packageDetailBackHref,
  packageImageTransitionName,
  packageTitleTransitionName,
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
  const goc = getPackageBySlug((await params).slug);
  if (!goc) notFound();
  // Giá hiện hành từ bảng giá quầy (migration 124).
  const item = apBangGia(goc, await docBangGia());
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
    <>
      <ThanhDauTrang lang={lang} hienTai="goi" tone="dark" />
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
        <div data-thanh-dat-moc="anh" aria-hidden="true" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.72fr]">
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              {customerBookingEnabled
                ? `${ch(lang, "Giữ chỗ theo số chỗ còn trống", "Hold seats that are still free")} · ${chu.durationLabel}`
                : flags.sandboxCheckout
                  ? `${ch(lang, "Dữ liệu minh họa", "Sample data")} · ${chu.durationLabel}`
                : `${ch(lang, "Bảng giá tham khảo", "Reference prices")} · ${chu.durationLabel}`}
            </p>
            <SharedTitleTransition name={packageTitleTransitionName(item.slug)}>
              <h1 className="font-display mt-4 text-6xl leading-[0.92] sm:text-8xl">
                {chu.name}
              </h1>
            </SharedTitleTransition>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/68">
              {chu.editorialDescription ??
                ch(
                  lang,
                  item.loai === "ve" ? `Giá bằng đúng giá bán ở quầy. Trẻ 1m–1m3 khoảng nửa giá, dưới 1m không cần vé.` : `Hợp với: ${chu.audience}. ${item.giamPhanTram ? `Rẻ hơn mua lẻ ${item.giamPhanTram}%.` : "Giá bằng tổng vé các điểm trong lịch."}`,
                  item.loai === "ve" ? `The same price as at the ticket desk. Children 1–1.3 m pay about half, under 1 m free.` : `Best for: ${chu.audience}. ${item.giamPhanTram ? `${item.giamPhanTram}% less than single tickets.` : "Priced at the sum of the entry tickets."}`,
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
          <aside data-thanh-dat-moc="gia" className="h-fit rounded-3xl bg-[#fbfaf6] p-6 text-[#151a17] sm:p-8">
            <p className="text-sm text-[#59654b]">
              {item.priceLabel
                ? ch(lang, "Giá giới thiệu mùa 2026", "2026 introductory price")
                : ch(lang, "Giá mỗi người lớn", "Price per adult")}
            </p>
            <p className="font-display mt-2 text-4xl text-[#183f34]">
              {giaGoi(item, lang)}
            </p>
            {giaLeGoi(item, lang) ? <p className="mt-1 text-sm font-bold text-[#8a5a1f]">{giaLeGoi(item, lang)}</p> : null}
            {item.giaTreEmVnd ? (
              <p className="mt-1 text-sm text-[#59654b]">
                {ch(lang, `Trẻ 1m–1m3: ${item.giaTreEmVnd.toLocaleString("vi-VN")} VND · dưới 1m không cần vé`, `Child 1–1.3 m: VND ${item.giaTreEmVnd.toLocaleString("en-US")} · under 1 m free`)}
              </p>
            ) : null}
            <h2 className="mt-7 font-bold">{ch(lang, "Lịch đi", "Schedule")}</h2>
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
                {/* Câu "chuyển khoản là giả lập" chỉ nói một lần, ở trang đặt vé (soát 07/10/2026: lặp ở cả hai trang). */}
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
      {checkoutAvailable && !hetMua ? (
        <ThanhDatCho
          href={checkoutHref(item.slug, navigationContext)}
          gia={giaGoi(item, lang)}
          nhanGia={item.priceLabel ? ch(lang, "Giá giới thiệu mùa 2026", "2026 introductory price") : ch(lang, "Mỗi người lớn", "Per adult")}
          nut={customerBookingEnabled ? (item.loai === "ve" ? ch(lang, "Mua vé", "Buy ticket") : ch(lang, "Giữ chỗ", "Hold seats")) : ch(lang, "Tiếp tục", "Continue")}
          goiId={item.id}
        />
      ) : null}
    </>
  );
}
