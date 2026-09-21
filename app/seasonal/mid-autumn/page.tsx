import { cookies } from "next/headers";
import { MidAutumnCampaign } from "@/components/discovery/mid-autumn-campaign";
import { MidAutumnSeasonBanner } from "@/components/discovery/mid-autumn-season-banner";
import { MoonDial } from "@/components/discovery/moon-dial";
import { WorldSwitcher } from "@/components/discovery/world-switcher";

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
      <WorldSwitcher hienTai="seasonal" lang={lang} source={source} tone="toi" />
      <MidAutumnSeasonBanner lang={lang} source={source} />
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
          <MoonDial
            lang={lang}
            dem={[
              { ngay: "2026-09-18", nhan: { vi: "18.09 · mở mùa", en: "18 Sep · opens" }, loi: { vi: "Đêm mở mùa, vừa tới thượng huyền — sáng chưa trọn nửa, đủ soi lối xuống bến.", en: "Opening night: just past first quarter — not yet full, enough to light the path to the pier." } },
              { ngay: "2026-09-25", nhan: { vi: "25.09 · rằm", en: "25 Sep · full moon" }, loi: { vi: "Rằm tháng tám. Trăng đầy nhất của mùa thật ra rơi vào đêm sau, 26.09 — lịch và bầu trời lệch nhau một ngày.", en: "The fifteenth of the eighth lunar month. The brightest moon actually falls the next night, 26 Sep — calendar and sky differ by a day." } },
              { ngay: "2026-09-27", nhan: { vi: "27.09 · khép mùa", en: "27 Sep · closes" }, loi: { vi: "Trăng đã qua đỉnh và bắt đầu xuống, khuyết dần về bên kia.", en: "Past the peak and waning now, thinning from the other side." } },
            ]}
          />
        </div>
      </section>
      <MidAutumnCampaign lang={lang} source={source} />
    </main>
  );
}
