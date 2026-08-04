import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DESTINATIONS,
  getDestinationBySlug,
} from "@/content/destinations";
import { DestinationTimeline } from "@/components/discovery/destination-timeline";

type DestinationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return DESTINATIONS.map((destination) => ({ slug: destination.slug }));
}

export async function generateMetadata({
  params,
}: DestinationPageProps): Promise<Metadata> {
  const destination = getDestinationBySlug((await params).slug);
  if (!destination) return {};
  return {
    title: `${destination.name.vi} | Ninh Bình Journey`,
    description: destination.description.vi,
  };
}

export default async function DestinationPage({
  params,
  searchParams,
}: DestinationPageProps) {
  const destination = getDestinationBySlug((await params).slug);
  if (!destination) notFound();
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
            Demo information
          </span>
        </div>
      </header>
      <section className="relative min-h-[68vh] overflow-hidden bg-[#183f34]">
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

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.58fr] lg:py-18">
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
              <div className="mt-6 space-y-7">
                {destination.press.map((entry) => (
                  <figure key={entry.url + entry.year}>
                    <blockquote className="border-l-2 border-[#b8cfbf] pl-5 text-lg leading-8 text-[#3f4f48]">
                      {entry.verbatim
                        ? `“${entry.text.vi}”`
                        : entry.text.vi}
                    </blockquote>
                    <figcaption className="mt-3 pl-5 text-sm text-[#6b7973]">
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
                ))}
              </div>
            </section>
          ) : null}
        </article>
        <aside className="h-fit rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-[#183f34]">
            Thông tin vận hành
          </h2>
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
                Demo information — không phải giờ mở cửa trực tiếp.
              </p>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">Di chuyển</dt>
              <dd className="mt-1 leading-6">
                {destination.mobilityNote.vi}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#59654b]">Tọa độ WGS 84</dt>
              <dd className="mt-1">
                {destination.coordinates[0]}, {destination.coordinates[1]}
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

      <section className="bg-[#183f34] px-5 py-12 text-white sm:px-8">
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
