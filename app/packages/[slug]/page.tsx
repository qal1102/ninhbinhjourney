import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackageBySlug, PACKAGES } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";
import {
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";

export function generateStaticParams() {
  return PACKAGES.map((item) => ({ slug: item.slug }));
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
  const journeyValue = query.journey;
  const journey = typeof journeyValue === "string" ? journeyValue : undefined;
  const source = typeof query.source === "string" ? query.source : undefined;
  const lang = query.lang === "en" ? "en" : "vi";
  const flags = getExperiencePresentationFlags(readPublicEnvironment());
  const customerBookingEnabled = isCustomerBookingEnabled();
  const checkoutAvailable = flags.sandboxCheckout || customerBookingEnabled;
  const sites = item.siteIds
    .map((id) => DESTINATIONS.find((destination) => destination.id === id))
    .filter((destination) => destination !== undefined);

  return (
    <main data-customer-section="package-detail" className="min-h-screen bg-[#183f34] px-5 py-10 text-white sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/packages${journey ? `?journey=${journey}` : ""}`}
          className="text-sm font-bold text-[#e7c78d]"
        >
          ← So sánh gói
        </Link>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.72fr]">
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              {customerBookingEnabled
                ? `Giữ chỗ theo công suất ERP · ${item.durationLabel}`
                : flags.sandboxCheckout
                  ? `Dữ liệu minh họa · ${item.durationLabel}`
                : `Bảng giá tham khảo · ${item.durationLabel}`}
            </p>
            <h1 className="font-display mt-4 text-6xl leading-[0.92] sm:text-8xl">
              {item.name}
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/68">
              {item.editorialDescription ?? `Dành cho ${item.audience.toLocaleLowerCase("vi-VN")}. Giá và lịch là dữ liệu minh họa, được server tính lại trước khi xác nhận.`}
            </p>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  data-customer-track="package-destination"
                  data-customer-content-id={site.id}
                  data-customer-content-type="destination"
                  href={`/destination/${site.slug}?journey=${journey ?? ""}`}
                  className="rounded-2xl border border-white/15 bg-white/7 p-5"
                >
                  <p className="font-display text-2xl">{site.name.vi}</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    {site.editorialLine.vi}
                  </p>
                </Link>
              ))}
            </div>
          </section>
          <aside className="h-fit rounded-3xl bg-[#fbfaf6] p-6 text-[#151a17] sm:p-8">
            <p className="text-sm text-[#59654b]">
              {item.priceLabel ? "Giá giới thiệu mùa 2026" : "Giá minh họa / người lớn"}
            </p>
            <p className="font-display mt-2 text-4xl text-[#183f34]">
              {item.priceLabel ?? `${item.demoPriceVnd.toLocaleString("vi-VN")} VND`}
            </p>
            <h2 className="mt-7 font-bold">Lịch minh họa</h2>
            <ol className="mt-3 space-y-3">
              {item.schedule.map((value) => (
                <li key={value} className="rounded-xl bg-[#f4f0e7] p-3 text-sm">
                  {value}
                </li>
              ))}
            </ol>
            {checkoutAvailable ? (
              <>
                <p className="mt-6 text-xs leading-5 text-[#7a725f]">
                  Thanh toán mô phỏng — không thu tiền. Không yêu cầu số thẻ,
                  tài khoản ngân hàng hoặc dữ liệu thanh toán thật.
                </p>
                <Link
                  data-customer-track="package-checkout"
                  data-customer-content-id={item.id}
                  data-customer-content-type="package"
                  href={`/checkout?package=${item.slug}&lang=${lang}${journey ? `&journey=${journey}` : ""}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold"
                >
                  {customerBookingEnabled ? "Giữ chỗ 15 phút" : "Tiếp tục bản trình diễn"}
                </Link>
              </>
            ) : (
              <p className="mt-6 rounded-xl bg-[#f4f0e7] p-4 text-sm leading-6 text-[#59654b]">
                Online booking is not configured on this production surface.
                This page is an indicative catalog, not an offer to transact.
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
