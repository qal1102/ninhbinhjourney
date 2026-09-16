"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import { getPackageBySlug } from "@/content/packages";
import { getPackageHeroImage } from "@/content/package-images";
import { packageImageTransitionName } from "@/lib/page-continuity";

export default function PackageDetailLoading() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const item = getPackageBySlug(slug);

  if (!item) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#183f34] text-[#e7c78d]">
        <p className="text-xs font-extrabold uppercase tracking-[0.24em]">
          Đang mở hành trình…
        </p>
      </main>
    );
  }

  const hero = getPackageHeroImage(item);

  return (
    <main
      data-route-loading="package-detail"
      className="min-h-screen bg-[#183f34] px-5 py-10 text-white sm:px-8 lg:py-16"
      aria-busy="true"
      aria-label="Đang mở chi tiết gói hành trình"
    >
      <div className="mx-auto max-w-6xl">
        <span className="text-sm font-bold text-[#e7c78d]">← So sánh gói</span>
        <div
          className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-3xl bg-cover bg-center sm:aspect-[21/9]"
          style={{ backgroundImage: `url(${hero.src})` }}
        >
          <SharedImageTransition
            name={packageImageTransitionName(item.slug)}
            className="absolute inset-0"
          >
            <Image
              src={hero.src}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 1152px, 100vw"
              className="object-cover"
            />
          </SharedImageTransition>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_48%,rgba(8,24,19,.42))]" />
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.72fr]">
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              Đang chuẩn bị lịch trình · {item.durationLabel}
            </p>
            <h1 className="font-display mt-4 text-5xl leading-[0.92] sm:text-7xl">
              {item.name}
            </h1>
            <div className="mt-8 h-px w-28 overflow-hidden bg-white/15">
              <span className="block h-full w-1/2 animate-pulse bg-[#e7c78d] motion-reduce:animate-none" />
            </div>
          </section>
          <aside className="h-48 rounded-3xl border border-white/10 bg-white/7 p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">
              Ninh Bình Journey
            </p>
            <p className="font-display mt-5 text-2xl text-white/78">
              Lịch trình đang được đặt vào đúng nhịp của chuyến đi.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
