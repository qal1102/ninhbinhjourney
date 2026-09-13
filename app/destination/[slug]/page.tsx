import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DESTINATIONS,
  getDestinationBySlug,
} from "@/content/destinations";
import { DestinationTimeline } from "@/components/discovery/destination-timeline";
import { LandingDestinationPage } from "@/components/discovery/landing-destination-page";
import { MiniRouteMap } from "@/components/discovery/mini-route-map";
import {
  DESTINATION_PAGE_SLUGS,
  getLandingDestinationBySlug,
} from "@/content/landing-destinations";
import { absoluteUrl } from "@/lib/site-url";

type DestinationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Mười lăm điểm đến đều có trang riêng: chín trang hồ sơ sâu, và sáu trang
 * dựng từ chữ đã biên tập cho trang chủ. Trước ngày 13/09/2026 chỉ có chín —
 * sáu nơi còn lại không có địa chỉ nào để máy tìm kiếm lập chỉ mục.
 */
export function generateStaticParams() {
  const slugs = new Set([
    ...DESTINATIONS.map((destination) => destination.slug),
    ...Object.values(DESTINATION_PAGE_SLUGS),
  ]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DestinationPageProps): Promise<Metadata> {
  const slug = (await params).slug;
  const destination = getDestinationBySlug(slug);
  const landing = destination ? undefined : getLandingDestinationBySlug(slug);
  if (!destination && !landing) return {};
  const title = `${destination?.name.vi ?? landing!.destination.name.vi} | Ninh Bình Journey`;
  const description = destination?.description.vi ?? landing!.destination.description.vi;
  const canonical = absoluteUrl(`/destination/${slug}`);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Ninh Bình Journey",
      locale: "vi_VN",
      type: "website",
      // Ảnh 1200×630 dựng sẵn bằng `scripts/generate-share-images.mjs`; ảnh gốc
      // nặng 2–3,5 MB, Zalo và Facebook thường bỏ khung xem trước.
      images: [
        { url: absoluteUrl(`/images/og/destination-${slug}.jpg`), width: 1200, height: 630 },
      ],
    },
  };
}

export default async function DestinationPage({
  params,
  searchParams,
}: DestinationPageProps) {
  const slug = (await params).slug;
  const destination = getDestinationBySlug(slug);
  if (!destination) {
    const landing = getLandingDestinationBySlug(slug);
    if (!landing) notFound();
    return <LandingDestinationPage destination={landing.destination} facts={landing.facts} />;
  }
  const query = await searchParams;
  const fromJourney = typeof query.journey === "string";
  const fit = typeof query.fit === "string" ? query.fit : null;
  const related = destination.relatedSlugs
    .map(getDestinationBySlug)
    .filter((item) => item !== undefined);

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#151a17]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 text-white sm:px-8">
          <Link
            href="/explore"
            className="rounded-full bg-black/25 px-4 py-2 text-sm font-bold backdrop-blur"
          >
            ← Khám phá
          </Link>
          <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold backdrop-blur">
            Thông tin tham khảo
          </span>
        </div>
      </header>
      <section data-customer-section="destination-hero" className="relative min-h-[68vh] overflow-hidden bg-[#183f34]">
        <Image
          src={destination.image}
          alt={destination.imageAlt.vi}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,23,.12),rgba(12,28,23,.84))]" />
        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end px-5 pb-12 text-white sm:px-8 sm:pb-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#e7c78d]">
            {destination.suggestedMinutes} phút ·{" "}
            {destination.mobilityLevel === "low"
              ? "đi bộ ít"
              : destination.mobilityLevel === "moderate"
                ? "đi bộ vừa"
                : "đi bộ nhiều"}
          </p>
          <h1 className="font-display mt-4 max-w-5xl text-6xl leading-[0.9] sm:text-8xl">
            {destination.name.vi}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-white/82">
            {destination.editorialLine.vi}
          </p>
        </div>
      </section>

      <section data-customer-section="destination-story" className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.58fr] lg:py-18">
        <article>
          {fit ? (
            <div className="mb-8 rounded-2xl border border-[#b8cfbf] bg-[#edf3f0] p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
                Vì sao phù hợp
              </p>
              <p className="mt-2 leading-7 text-[#365247]">{fit}</p>
            </div>
          ) : null}
          <h2 className="font-display text-4xl text-[#183f34]">
            Câu chuyện của điểm đến
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">
            {destination.description.vi}
          </p>
          <p className="mt-5 text-lg leading-8 text-[#4d5b55]">
            {destination.story.vi}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {destination.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-[#e9ede8] px-3 py-1 text-sm font-bold text-[#365247]"
              >
                {interest}
              </span>
            ))}
          </div>

          {destination.timeline?.length ? (
            <DestinationTimeline entries={destination.timeline} />
          ) : null}

          {destination.press?.length ? (
            <section className="mt-12 border-t border-[#dcd9d1] pt-8">
              <h2 className="font-display text-3xl text-[#183f34]">
                Người ta đã viết gì về nơi này
              </h2>
              <div className="mt-7 space-y-8">
                {destination.press.map((entry, index) =>
                  entry.verbatim ? (
                    <figure
                      key={entry.url + entry.year + index}
                      className="rounded-3xl bg-[#f4f0e7] px-6 py-8 sm:px-10 sm:py-10"
                    >
                      <span
                        aria-hidden="true"
                        className="font-display block text-6xl leading-none text-[#c9a15c] sm:text-7xl"
                      >
                        &ldquo;
                      </span>
                      <blockquote className="font-display -mt-3 max-w-2xl text-2xl leading-snug text-[#183f34] sm:text-3xl">
                        {entry.text.vi}
                      </blockquote>
                      <figcaption className="mt-6 text-sm">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-extrabold uppercase tracking-[0.08em] text-[#2c6350] underline underline-offset-4"
                        >
                          {entry.publisher}
                        </a>
                        <span className="text-[#6b7973]">, {entry.year}</span>
                        {entry.via ? (
                          <span className="text-[#6b7973]">
                            {" · dẫn lại theo "}
                            <a
                              href={entry.via.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4"
                            >
                              {entry.via.label}
                            </a>
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                  ) : (
                    <figure key={entry.url + entry.year + index}>
                      <blockquote className="border-l-2 border-[#b8cfbf] pl-5 text-base leading-7 text-[#3f4f48]">
                        {entry.text.vi}
                      </blockquote>
                      <figcaption className="mt-3 pl-5 text-xs text-[#6b7973]">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#2c6350] underline underline-offset-4"
                        >
                          {entry.publisher}
                        </a>
                        <span>, {entry.year}</span>
                        {entry.via ? (
                          <span>
                            {" · dẫn lại theo "}
                            <a
                              href={entry.via.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4"
                            >
                              {entry.via.label}
                            </a>
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                  ),
                )}
              </div>
            </section>
          ) : null}
        </article>
        <aside className="h-fit rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-[#183f34]">
            Thông tin vận hành
          </h2>
          {destination.realLimit ? (
            <div className="mt-4 rounded-2xl border border-[#c68f48]/35 bg-[#fff7e9] p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8a6b38]">
                Giới hạn thật
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6b5326]">
                {destination.realLimit.vi}
              </p>
            </div>
          ) : null}
          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="font-bold text-[#59654b]">Thời lượng đề xuất</dt>
              <dd className="mt-1 text-lg">{destination.suggestedMinutes} phút</dd>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">
                Khung giờ minh họa
              </dt>
              <dd className="mt-1 text-lg">
                {destination.demoOpeningWindow}
              </dd>
              <p className="mt-1 text-xs text-[#8a6b38]">
                Giờ minh hoạ, chưa phải giờ mở cửa chính thức.
              </p>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">Di chuyển</dt>
              <dd className="mt-1 leading-6">
                {destination.mobilityNote.vi}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">Vị trí</dt>
              <dd className="mt-2">
                <MiniRouteMap
                  points={[
                    {
                      id: destination.id,
                      label: destination.name.vi,
                      coordinates: destination.coordinates,
                    },
                  ]}
                  showLegend={false}
                  mapClassName="h-40"
                />
                <a
                  href={`https://www.google.com/maps?q=${destination.coordinates[0]},${destination.coordinates[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-[#356957] underline underline-offset-4"
                >
                  Mở trên Google Maps
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">Nguồn rà soát</dt>
              <dd className="mt-1 leading-6">
                <a
                  href={destination.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#356957] underline underline-offset-4"
                >
                  {destination.source.label}
                </a>
                <br />
                {destination.source.reviewedAt}
              </dd>
            </div>
          </dl>
          <div className="mt-7 grid gap-3">
            <Link
              data-customer-track="destination-add-to-plan"
              data-customer-content-id={destination.id}
              data-customer-content-type="destination"
              href={`/plan?add=${destination.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              Thêm vào hành trình
            </Link>
            {fromJourney ? (
              <>
                <Link
                  href={`/plan?replace=${destination.id}&journey=${query.journey}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
                >
                  Thay điểm hiện tại
                </Link>
                <Link
                  href={`/plan?remove=${destination.id}&journey=${query.journey}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-5 font-bold text-[#8f2f2c]"
                >
                  Xóa khỏi hành trình
                </Link>
              </>
            ) : null}
          </div>
        </aside>
      </section>

      <section data-customer-section="destination-related" className="bg-[#183f34] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
            Gần đó & lựa chọn tiếp theo
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/destination/${item.slug}`}
                className="rounded-2xl border border-white/15 bg-white/8 p-5 transition hover:bg-white/12"
              >
                <p className="font-display text-2xl">{item.name.vi}</p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {item.editorialLine.vi}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
