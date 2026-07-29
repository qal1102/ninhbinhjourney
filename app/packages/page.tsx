import Link from "next/link";
import { PACKAGES } from "@/content/packages";
import {
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";

export const metadata = {
  title: "Gói hành trình | Ninh Bình Journey",
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const journeyValue = (await searchParams).journey;
  const journey = typeof journeyValue === "string" ? journeyValue : undefined;
  const flags = getExperiencePresentationFlags(readPublicEnvironment());

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <Link href={journey ? `/journey/${journey}` : "/plan"} className="text-sm font-bold text-[#356957]">
          ← Quay lại hành trình
        </Link>
        <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {flags.sandboxCheckout
            ? "Demonstration Data · service-commerce only"
            : "Indicative catalog · online booking unavailable"}
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-5xl leading-[0.95] text-[#183f34] sm:text-7xl">
          Bốn cách đóng gói, không có lựa chọn đánh lạc hướng.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          Giá dưới đây là dữ liệu minh họa theo người lớn, không phải giá thị
          trường hiện hành. Donation và sponsorship không đi vào tổng checkout.
        </p>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {PACKAGES.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
                    {item.durationLabel} · {item.pace}
                  </p>
                  <h2 className="font-display mt-2 text-3xl text-[#183f34]">
                    {item.name}
                  </h2>
                  <p className="mt-2 text-sm text-[#59654b]">{item.audience}</p>
                </div>
                <div className="rounded-2xl bg-[#f4f0e7] px-4 py-3 text-right">
                  <p className="font-display text-xl">
                    {item.demoPriceVnd.toLocaleString("vi-VN")} VND
                  </p>
                  <p className="text-xs text-[#645c4b]">mỗi người lớn · demo</p>
                </div>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold">Bao gồm</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
                    {item.inclusions.map((value) => (
                      <li key={value}>✓ {value}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-bold">Không bao gồm</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
                    {item.exclusions.map((value) => (
                      <li key={value}>— {value}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={`/packages/${item.slug}${journey ? `?journey=${journey}` : ""}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
                >
                  Xem chi tiết
                </Link>
                {flags.sandboxCheckout ? (
                  <Link
                    href={`/checkout?package=${item.slug}${journey ? `&journey=${journey}` : ""}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
                  >
                    Chọn gói
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
