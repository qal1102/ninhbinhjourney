import Link from "next/link";
import { cookies } from "next/headers";
import { MidAutumnCampaign } from "@/components/discovery/mid-autumn-campaign";

export const metadata = {
  title: "Trung thu | Ninh Bình Journey",
  description: "Một chương riêng cho mùa trăng ở Ninh Bình.",
  alternates: { canonical: "/seasonal/mid-autumn" },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MidAutumnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const savedLang = (await cookies()).get("ninh-binh-lang")?.value;
  const requestedLang = firstParam(params.lang);
  const lang = requestedLang === "en" || (!requestedLang && savedLang === "en") ? "en" : "vi";
  const source = firstParam(params.source) ?? "";
  const homeParams = new URLSearchParams({ lang });
  if (source) homeParams.set("source", source);

  return (
    <main className="min-h-screen bg-[#17231f]">
      <header className="border-b border-white/15 bg-[#13251f] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link href={`/?${homeParams.toString()}`} className="font-display text-lg tracking-[0.1em]">NINH BÌNH</Link>
          <nav aria-label={lang === "vi" ? "Điều hướng mùa" : "Season navigation"} className="flex gap-5 text-sm font-bold text-white/82">
            <Link href={`/collaborations?${homeParams.toString()}`} className="hidden underline underline-offset-4 sm:inline">{lang === "vi" ? "Hợp tác thương hiệu" : "Brand collaborations"}</Link>
            <Link href={`/packages?${homeParams.toString()}`} className="underline underline-offset-4">{lang === "vi" ? "Đặt chỗ" : "Reserve"}</Link>
          </nav>
        </div>
      </header>
      <section className="overflow-hidden border-b border-white/12 bg-[#0d1915] px-5 py-14 text-[#fbf7ee] sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.3em] text-[#e7b96a]">{lang === "vi" ? "Lịch trăng · 2026" : "Moon calendar · 2026"}</p>
            <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[.9] sm:text-7xl">{lang === "vi" ? "Ba đêm, một dòng Ngô Đồng." : "Three nights, one Ngo Dong River."}</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/68 sm:text-lg">{lang === "vi" ? "Một chương theo mùa có nhịp riêng: chọn ngày, chọn số người, rồi để bàn tối, quà và đường đi gặp nhau dưới trăng." : "A seasonal chapter with its own rhythm: choose the date and party, then let the table, gifts and journey meet beneath the moon."}</p>
            <ol className="mt-9 grid max-w-xl grid-cols-3 border-y border-white/18 text-sm">
              {[lang === "vi" ? "18.09 · mở mùa" : "18 Sep · opens", lang === "vi" ? "25.09 · rằm" : "25 Sep · full moon", lang === "vi" ? "27.09 · khép mùa" : "27 Sep · closes"].map((date) => <li key={date} className="border-r border-white/18 px-3 py-4 last:border-r-0 first:pl-0">{date}</li>)}
            </ol>
          </div>
          <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[34rem]">
            <svg viewBox="0 0 520 520" className="h-full w-full overflow-visible" fill="none">
              <circle cx="260" cy="260" r="202" stroke="rgba(231,185,106,.42)" strokeWidth="1" strokeDasharray="3 10" />
              <circle cx="260" cy="260" r="128" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
              <path d="M50 315C132 214 213 178 318 201C388 216 438 264 486 332" stroke="rgba(231,185,106,.75)" strokeWidth="1.5" />
              <circle cx="260" cy="260" r="72" fill="#ead49b" />
              <circle cx="260" cy="260" r="61" fill="#f8eecf" />
              <g className="origin-center animate-[spin_18s_linear_infinite] motion-reduce:animate-none"><circle cx="260" cy="58" r="9" fill="#e7b96a" /><circle cx="438" cy="356" r="6" fill="#fff7e6" /></g>
            </svg>
            <span className="absolute inset-0 grid place-items-center pt-[12.5rem] text-center text-[0.58rem] font-extrabold uppercase tracking-[.3em] text-[#315447]">Ngo Dong<br />Moon orbit</span>
          </div>
        </div>
      </section>
      <MidAutumnCampaign lang={lang} source={source} />
    </main>
  );
}
