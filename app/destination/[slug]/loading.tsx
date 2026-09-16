"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import { getDestinationBySlug } from "@/content/destinations";
import { getLandingDestinationBySlug } from "@/content/landing-destinations";
import { destinationImageTransitionName } from "@/lib/page-continuity";

export default function DestinationLoading() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const catalogDestination = getDestinationBySlug(slug);
  const landingDestination = getLandingDestinationBySlug(slug)?.destination;
  const image = catalogDestination?.image ?? landingDestination?.image;
  const imagePosition = landingDestination?.imagePosition;
  const name = catalogDestination?.name.vi ?? landingDestination?.name.vi;

  if (!image || !name) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#183f34] text-[#e7c78d]">
        <p className="text-xs font-extrabold uppercase tracking-[0.24em]">
          Đang mở điểm đến…
        </p>
      </main>
    );
  }

  return (
    <main
      data-route-loading="destination"
      className="min-h-screen bg-[#fbfaf6] text-[#151a17]"
      aria-busy="true"
      aria-label={`Đang mở ${name}`}
    >
      <section className="relative min-h-[68vh] overflow-hidden bg-[#183f34]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${image})`,
            ...(imagePosition ? { backgroundPosition: imagePosition } : {}),
          }}
        >
          <SharedImageTransition
            name={destinationImageTransitionName(slug)}
            className="absolute inset-0"
          >
            <Image
              src={image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={imagePosition ? { objectPosition: imagePosition } : undefined}
            />
          </SharedImageTransition>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,23,.16),rgba(12,28,23,.86))]" />
        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end px-5 pb-12 text-white sm:px-8 sm:pb-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#e7c78d]">
            Đang mở câu chuyện điểm đến
          </p>
          <h1 className="font-display mt-4 max-w-5xl text-6xl leading-[0.9] text-balance sm:text-8xl">
            {name}
          </h1>
          <div className="mt-8 h-px w-32 overflow-hidden bg-white/20">
            <span className="block h-full w-1/2 animate-pulse bg-[#e7c78d] motion-reduce:animate-none" />
          </div>
        </div>
      </section>
    </main>
  );
}
