import Image from "next/image";
import Link from "next/link";
import { MiniRouteMap } from "@/components/discovery/mini-route-map";
import {
  DESTINATION_PAGE_SLUGS,
  destinations,
  type Destination,
  type DestinationFacts,
} from "@/content/landing-destinations";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import {
  destinationBackHref,
  destinationImageTransitionName,
  destinationRelatedHref,
  packageCatalogHref,
  withContinuityContext,
  type ContinuityContext,
} from "@/lib/page-continuity";

/**
 * Trang riêng cho những điểm đến chưa có hồ sơ sâu trong
 * `content/destinations.ts`.
 *
 * Chỉ dùng đúng chữ đã biên tập sẵn cho trang chủ: lời giới thiệu, lịch sử,
 * điểm nổi bật, giờ nên đi, cách tới, mẹo tránh đông. Không thêm con số, giờ
 * mở cửa hay giá vé nào mà nguồn chưa có — luật "không bịa dữ kiện về nơi có
 * thật" của dự án áp đầy đủ ở đây. Thiếu thì để trống, không lấp cho đầy.
 */
export function LandingDestinationPage({
  destination,
  facts,
  navigationContext,
}: {
  destination: Destination;
  facts: DestinationFacts;
  navigationContext: ContinuityContext;
}) {
  const [latitude, longitude] = destination.position;
  const pairs = facts.pairWith
    .map((id) => destinations.find((item) => item.id === id))
    .filter((item): item is Destination => item !== undefined);

  const thongTin: { nhan: string; noiDung: string }[] = [
    { nhan: "Loại hình", noiDung: destination.category.vi },
    { nhan: "Nên dành", noiDung: destination.duration.vi },
    { nhan: "Lúc nên tới", noiDung: facts.bestTime.vi },
    { nhan: "Tránh đông", noiDung: facts.crowdTip.vi },
    { nhan: "Đường tới", noiDung: facts.gettingThere.vi },
    { nhan: "Vé vào cửa", noiDung: facts.entranceFee.vi },
  ];

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#151a17]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 text-white sm:px-8">
          <Link
            href={destinationBackHref(navigationContext)}
            transitionTypes={["nav-back"]}
            className="rounded-full bg-black/25 px-4 py-2 text-sm font-bold backdrop-blur"
          >
            ← Khám phá
          </Link>
          <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold backdrop-blur">
            Thông tin tham khảo
          </span>
        </div>
      </header>

      <section
        data-customer-section="destination-hero"
        className="relative min-h-[68vh] overflow-hidden bg-[#183f34]"
      >
        <SharedImageTransition
          name={destinationImageTransitionName(
            DESTINATION_PAGE_SLUGS[destination.id],
          )}
          className="absolute inset-0"
        >
          <Image
            src={destination.image}
            alt={destination.name.vi}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: destination.imagePosition }}
          />
        </SharedImageTransition>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,23,.12),rgba(12,28,23,.84))]" />
        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end px-5 pb-12 text-white sm:px-8 sm:pb-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#e7c78d]">
            {destination.category.vi} · {destination.duration.vi}
          </p>
          <h1 className="font-display mt-4 max-w-5xl text-6xl leading-[0.9] text-balance sm:text-8xl">
            {destination.name.vi}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-white/82">
            {destination.tagline.vi}
          </p>
        </div>
      </section>

      <section
        data-customer-section="destination-story"
        className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.58fr] lg:py-18"
      >
        <article>
          <h2 className="font-display text-4xl text-[#183f34]">Câu chuyện của điểm đến</h2>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{destination.description.vi}</p>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{destination.history.vi}</p>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{facts.significance.vi}</p>

          <h2 className="font-display mt-12 text-3xl text-[#183f34]">Đáng để ý</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {destination.highlights.vi.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-[#dcd9d1] bg-white px-4 py-3 font-semibold text-[#365247]"
              >
                {item}
              </li>
            ))}
          </ul>

          {facts.practical.vi.length > 0 ? (
            <>
              <h2 className="font-display mt-12 text-3xl text-[#183f34]">Trước khi đi</h2>
              <ul className="mt-5 space-y-3">
                {facts.practical.vi.map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-7 text-[#4d5b55]">
                    <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a15c]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            {destination.tags.vi.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#e9ede8] px-3 py-1 text-sm font-bold text-[#365247]"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>

        <aside className="h-fit rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-[#183f34]">Đi thế nào</h2>
          {facts.operatorNote ? (
            <p className="mt-4 rounded-2xl border border-[#b8cfbf] bg-[#edf3f0] p-4 text-sm leading-6 text-[#365247]">
              {facts.operatorNote.vi}
            </p>
          ) : null}
          <dl className="mt-5 space-y-5 text-sm">
            {thongTin.map(({ nhan, noiDung }) => (
              <div key={nhan}>
                <dt className="font-bold text-[#59654b]">{nhan}</dt>
                <dd className="mt-1 leading-6">{noiDung}</dd>
              </div>
            ))}
            <div>
              <dt className="font-bold text-[#59654b]">Vị trí</dt>
              <dd className="mt-2">
                <MiniRouteMap
                  points={[
                    {
                      id: destination.id,
                      label: destination.name.vi,
                      coordinates: [latitude, longitude],
                    },
                  ]}
                  showLegend={false}
                  mapClassName="h-40"
                />
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-[#356957] underline underline-offset-4"
                >
                  Mở trên Google Maps
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-7 grid gap-3">
            <Link
              href={withContinuityContext("/plan", navigationContext, {
                from: undefined,
                package: undefined,
                parent: undefined,
              })}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              Lập hành trình
            </Link>
            <Link
              href={packageCatalogHref(navigationContext)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
            >
              Xem các gói đi sẵn
            </Link>
          </div>
        </aside>
      </section>

      {pairs.length > 0 ? (
        <section
          data-customer-section="destination-related"
          className="bg-[#183f34] px-5 py-12 text-white sm:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              Đi cùng một chuyến
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {pairs.map((item) => (
                <Link
                  key={item.id}
                  href={destinationRelatedHref(
                    DESTINATION_PAGE_SLUGS[item.id],
                    navigationContext,
                  )}
                  className="rounded-2xl border border-white/15 bg-white/8 p-5 transition hover:bg-white/12"
                >
                  <p className="font-display text-2xl">{item.name.vi}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">{item.tagline.vi}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
