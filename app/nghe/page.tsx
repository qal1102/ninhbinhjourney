import type { Metadata } from "next";
import { NgheTheoViTri } from "@/components/discovery/nghe-theo-vi-tri";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { DESTINATION_PAGE_SLUGS, destinationFacts, destinations } from "@/content/landing-destinations";
import type { DiemNghe } from "@/domain/thuyet-minh-vi-tri";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Nghe thuyết minh quanh bạn · Ninh Bình Journey",
  description: "Bật định vị, tới nơi nào máy đọc câu chuyện nơi ấy. Vị trí chỉ dùng trên máy bạn.",
};

export default async function NghePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await docNgonNgu(await searchParams);
  const diem: DiemNghe[] = destinations.map((d) => ({
    id: d.id,
    slug: DESTINATION_PAGE_SLUGS[d.id],
    ten: d.name[lang],
    viTri: d.position,
    doan: [d.description[lang], d.history[lang], destinationFacts[d.id].significance[lang]],
  }));
  return (
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-4 py-8 text-[#151a17] sm:px-8 lg:py-14">
      <div className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-3xl">
      </div>
      <NgheTheoViTri diem={diem} lang={lang}>
        <NutNgonNgu lang={lang} />
      </NgheTheoViTri>
    </main>
  );
}
