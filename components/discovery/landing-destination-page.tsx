import Image from "next/image";
import Link from "next/link";
import { MiniRouteMap } from "@/components/discovery/mini-route-map";
import { ThuyetMinh } from "@/components/discovery/thuyet-minh";
import {
  DESTINATION_PAGE_SLUGS,
  destinations,
  type Destination,
  type DestinationFacts,
} from "@/content/landing-destinations";
import { SuongVen } from "@/components/shared/suong-ven";
import { JsonLd } from "@/components/shared/json-ld";
import { jsonLdDiemDen } from "@/domain/du-lieu-cau-truc";
import { absoluteUrl } from "@/lib/site-url";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import {
  destinationBackHref,
  destinationImageTransitionName,
  destinationRelatedHref,
  packageCatalogHref,
  withContinuityContext,
  type ContinuityContext,
} from "@/lib/page-continuity";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";

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
  lang = "vi",
}: {
  destination: Destination;
  facts: DestinationFacts;
  navigationContext: ContinuityContext;
  lang?: NgonNgu;
}) {
  const [latitude, longitude] = destination.position;
  const pairs = facts.pairWith
    .map((id) => destinations.find((item) => item.id === id))
    .filter((item): item is Destination => item !== undefined);

  const thongTin: { nhan: string; noiDung: string }[] = [
    { nhan: ch(lang, "Loại hình", "Type"), noiDung: destination.category[lang] },
    { nhan: ch(lang, "Nên dành", "Allow"), noiDung: destination.duration[lang] },
    { nhan: ch(lang, "Lúc nên tới", "Best time"), noiDung: facts.bestTime[lang] },
    { nhan: ch(lang, "Tránh đông", "Avoiding crowds"), noiDung: facts.crowdTip[lang] },
    { nhan: ch(lang, "Đường tới", "Getting there"), noiDung: facts.gettingThere[lang] },
    { nhan: ch(lang, "Vé vào cửa", "Entrance"), noiDung: facts.entranceFee[lang] },
  ];

  return (
    <main lang={lang} className="min-h-screen bg-[#fbfaf6] text-[#151a17]">
      <JsonLd
        du={jsonLdDiemDen({
          ten: destination.name[lang],
          moTa: destination.description[lang],
          url: absoluteUrl(`/destination/${DESTINATION_PAGE_SLUGS[destination.id]}`),
          anh: absoluteUrl(`/images/og/destination-${DESTINATION_PAGE_SLUGS[destination.id]}.jpg`),
          toaDo: [latitude, longitude],
        })}
      />
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 text-white sm:px-8">
          <Link
            href={destinationBackHref(navigationContext)}
            transitionTypes={["nav-back"]}
            className="rounded-full bg-black/25 px-4 py-2 text-sm font-bold backdrop-blur"
          >
            ← {ch(lang, "Khám phá", "Explore")}
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-black/25 px-3 py-1 text-xs font-bold backdrop-blur sm:inline">
              {ch(lang, "Thông tin tham khảo", "For reference")}
            </span>
            <NutNgonNgu lang={lang} tone="dark" />
          </div>
        </div>
      </header>

      <section
        data-customer-section="destination-hero"
        className="suong-canh relative min-h-[68vh] overflow-hidden bg-[#183f34]"
      >
        <SharedImageTransition
          name={destinationImageTransitionName(
            DESTINATION_PAGE_SLUGS[destination.id],
          )}
          className="absolute inset-0"
        >
          <Image
            src={destination.image}
            alt={destination.name[lang]}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: destination.imagePosition }}
          />
        </SharedImageTransition>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,23,.12),rgba(12,28,23,.84))]" />
        <SuongVen />
        <div className="suong-hien relative z-10 mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end px-5 pb-12 text-white sm:px-8 sm:pb-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#e7c78d]">
            {destination.category[lang]} · {destination.duration[lang]}
          </p>
          <h1 className="font-display mt-4 max-w-5xl text-6xl leading-[0.9] text-balance sm:text-8xl">
            {destination.name[lang]}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-white/82">
            {destination.tagline[lang]}
          </p>
        </div>
      </section>

      <section
        data-customer-section="destination-story"
        className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.58fr] lg:py-18"
      >
        <article>
          <h2 className="font-display text-4xl text-[#183f34]">{ch(lang, "Câu chuyện của điểm đến", "The story of this place")}</h2>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{destination.description[lang]}</p>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{destination.history[lang]}</p>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">{facts.significance[lang]}</p>
          <ThuyetMinh
            ten={destination.name[lang]}
            lang={lang}
            doan={[destination.description[lang], destination.history[lang], facts.significance[lang]]}
          />

          <h2 className="font-display mt-12 text-3xl text-[#183f34]">{ch(lang, "Đáng để ý", "Worth noticing")}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {destination.highlights[lang].map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-[#dcd9d1] bg-white px-4 py-3 font-semibold text-[#365247]"
              >
                {item}
              </li>
            ))}
          </ul>

          {facts.practical[lang].length > 0 ? (
            <>
              <h2 className="font-display mt-12 text-3xl text-[#183f34]">{ch(lang, "Trước khi đi", "Before you go")}</h2>
              <ul className="mt-5 space-y-3">
                {facts.practical[lang].map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-7 text-[#4d5b55]">
                    <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a15c]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            {destination.tags[lang].map((tag) => (
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
          <h2 className="font-display text-2xl text-[#183f34]">{ch(lang, "Đi thế nào", "How to visit")}</h2>
          {facts.operatorNote ? (
            <p className="mt-4 rounded-2xl border border-[#b8cfbf] bg-[#edf3f0] p-4 text-sm leading-6 text-[#365247]">
              {facts.operatorNote[lang]}
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
              <dt className="font-bold text-[#59654b]">{ch(lang, "Vị trí", "Location")}</dt>
              <dd className="mt-2">
                <MiniRouteMap
                  points={[
                    {
                      id: destination.id,
                      label: destination.name[lang],
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
                  {ch(lang, "Mở trên Google Maps", "Open in Google Maps")}
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
              {ch(lang, "Lập hành trình", "Plan my day")}
            </Link>
            <Link
              href={packageCatalogHref(navigationContext)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
            >
              {ch(lang, "Xem các gói đi sẵn", "See ready-made packages")}
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
              {ch(lang, "Đi cùng một chuyến", "Pair it with")}
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
                  <p className="font-display text-2xl">{item.name[lang]}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">{item.tagline[lang]}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
