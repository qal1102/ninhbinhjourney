import Link from "next/link";
import { ExploreExperience } from "@/components/discovery/explore-experience";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { NuiSuong } from "@/components/shared/nui-suong";
import { readPublicEnvironment } from "@/config/experience";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import {
  readContinuityContext,
  withContinuityContext,
} from "@/lib/page-continuity";

export const metadata = {
  title: "Khám phá Ninh Bình | Ninh Bình Journey",
  description:
    "Bản đồ và danh sách đi cùng nhau: lọc theo thời gian, mức đi bộ và nhóm khách.",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const navigationContext = readContinuityContext(params);
  const lang = await docNgonNgu(params);
  const environment = readPublicEnvironment();
  const clientDemo =
    environment.status === "ready" &&
    environment.config.mode === "client-demo";
  return (
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] text-[#151a17]">
      <header className="border-b border-[#d7d5cd] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href={withContinuityContext("/", navigationContext, {
              from: undefined,
              package: undefined,
              parent: undefined,
            })}
            className="font-display text-lg tracking-[0.12em] text-[#183f34]"
          >
            NINH BÌNH
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link
              href={withContinuityContext("/plan", navigationContext, {
                from: undefined,
                package: undefined,
                parent: undefined,
              })}
              className="rounded-full px-4 py-2"
            >
              {ch(lang, "Lập hành trình", "Plan my day")}
            </Link>
            {clientDemo ? (
              <span className="hidden rounded-full bg-[#e8dfcf] px-3 py-1 text-xs text-[#5f593f] sm:inline-flex">
                {ch(lang, "Bản trình diễn", "Demo")}
              </span>
            ) : null}
            <NutNgonNgu lang={lang} />
          </nav>
        </div>
      </header>
      <NuiSuong hat="kham-pha" />
      <section data-customer-section="explore-discovery" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {ch(lang, "Khám phá Ninh Bình", "Explore Ninh Binh")}
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <h1 className="font-display text-5xl leading-[0.98] text-[#183f34] sm:text-7xl">
            {ch(lang, "Chọn cách đi trước,", "Choose how you travel,")}
            <br />
            {ch(lang, "rồi mới chọn điểm.", "then where to go.")}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[#59654b]">
            {ch(
              lang,
              "Có người muốn đi thật chậm, có người muốn thấy thật nhiều. Lọc theo thời gian bạn có, mức đi bộ chịu được và người đi cùng, bản đồ chỉ giữ lại những nơi hợp với bạn.",
              "Some want to go slowly, some want to see a lot. Filter by the time you have, how much you can walk and who comes along; the map keeps only the places that suit you.",
            )}
          </p>
        </div>
        <div className="mt-10">
          <ExploreExperience navigationContext={navigationContext} lang={lang} />
        </div>
      </section>
    </main>
  );
}
