import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackageBySlug, PACKAGES } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";
import {
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";

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
  const journeyValue = (await searchParams).journey;
  const journey = typeof journeyValue === "string" ? journeyValue : undefined;
  const flags = getExperiencePresentationFlags(readPublicEnvironment());
  const sites = item.siteIds
    .map((id) => DESTINATIONS.find((destination) => destination.id === id))
    .filter((destination) => destination !== undefined);

  return (
    <main className="min-h-screen bg-[#183f34] px-5 py-10 text-white sm:px-8 lg:py-16">
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
              {flags.sandboxCheckout
                ? `Demonstration Data · ${item.durationLabel}`
                : `Indicative catalog · ${item.durationLabel}`}
            </p>
            <h1 className="font-display mt-4 text-6xl leading-[0.92] sm:text-8xl">
              {item.name}
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/68">
              Dành cho {item.audience.toLocaleLowerCase("vi-VN")}. Giá và lịch
              là dữ liệu minh họa, được server tính lại trước khi xác nhận.
            </p>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
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
            <p className="text-sm text-[#59654b]">Demo price / adult</p>
            <p className="font-display mt-2 text-4xl text-[#183f34]">
              {item.demoPriceVnd.toLocaleString("vi-VN")} VND
            </p>
            <h2 className="mt-7 font-bold">Lịch minh họa</h2>
            <ol className="mt-3 space-y-3">
              {item.schedule.map((value) => (
                <li key={value} className="rounded-xl bg-[#f4f0e7] p-3 text-sm">
                  {value}
                </li>
              ))}
            </ol>
            {flags.sandboxCheckout ? (
              <>
                <p className="mt-6 text-xs leading-5 text-[#7a725f]">
                  Sandbox Payment — no real charge. Không yêu cầu số thẻ hoặc
                  dữ liệu thanh toán thật.
                </p>
                <Link
                  href={`/checkout?package=${item.slug}${journey ? `&journey=${journey}` : ""}`}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold"
                >
                  Tiếp tục checkout demo
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
