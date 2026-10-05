import { KeMua } from "@/components/discovery/ke-mua";
import { WorldSwitcher } from "@/components/discovery/world-switcher";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

/**
 * Mọi sự kiện theo mùa, cả mùa đang mở lẫn mùa đã khép (chủ dự án 06/10/2026:
 * mùa đã qua để lại cho khách xem, ghi rõ đã khép). Trước đó `/seasonal` 404.
 */

export const metadata = {
  title: "Sự kiện theo mùa | Ninh Bình Journey",
  description: "Các mùa ở Ninh Bình: mùa hoa súng Tam Cốc, Trung thu trên sông Ngô Đồng.",
  alternates: { canonical: "/seasonal" },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SeasonalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = await docNgonNgu(params);
  const source = firstParam(params.source) ?? "";
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);

  return (
    <main lang={lang} className="min-h-screen bg-[#f7f2ee] text-[#183f34]" data-testid="trang-cac-mua">
      <WorldSwitcher hienTai="seasonal" lang={lang} source={source} tone="sang" />
      <section className="px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Ninh Bình theo mùa", "Ninh Binh by season")}</p>
            <NutNgonNgu lang={lang} />
          </div>
          <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">{t("Sự kiện theo mùa", "Seasonal occasions")}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[#4d5b55] sm:text-lg">
            {t(
              "Mỗi mùa một trang riêng. Mùa đã khép vẫn ở đây để xem lại, mùa sắp tới đặt được ngay.",
              "Each season has its own page. Past seasons stay here to look back on; the next one is open to book.",
            )}
          </p>
          <div className="mt-12">
            <KeMua lang={lang} source={source} />
          </div>
        </div>
      </section>
    </main>
  );
}
