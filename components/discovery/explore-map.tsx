"use client";

import { BrandMap, type GhimBanDo } from "@/components/shared/brand-map";
import type { DestinationCatalogItem } from "@/content/destinations";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";

/**
 * Bản đồ của trang `/explore`.
 *
 * Toàn bộ phần cơ khí — nguồn dữ liệu, màu sắc, bay tới điểm, đo lại khung khi
 * khách lật qua lại giữa "Bản đồ" và "Danh sách" — nằm trong
 * `components/shared/brand-map.tsx`. Ở đây chỉ còn việc dịch danh mục điểm đến
 * thành bộ ghim và nối lại cú bấm.
 */

type ExploreMapProps = {
  destinations: readonly DestinationCatalogItem[];
  selectedSlug: string | null;
  onSelect: (destination: DestinationCatalogItem, trigger: HTMLElement) => void;
  lang?: NgonNgu;
};

export default function ExploreMap({
  destinations,
  selectedSlug,
  onSelect,
  lang = "vi",
}: ExploreMapProps) {
  if (destinations.length === 0) {
    return (
      <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-[#8da69c] bg-[#edf3f0] p-8 text-center">
        <div>
          <p className="font-display text-2xl text-[#183f34]">
            {ch(lang, "Không có điểm phù hợp", "Nothing matches")}
          </p>
          <p className="mt-2 text-sm text-[#59654b]">
            {ch(lang, "Nới một bộ lọc là các điểm hiện lại trên bản đồ.", "Loosen a filter and the places come back on the map.")}
          </p>
        </div>
      </div>
    );
  }

  const ghim: GhimBanDo[] = destinations.map((d, i) => ({
    id: d.slug,
    toaDo: d.coordinates as [number, number],
    nhan: ch(lang, `Mở ${d.name.vi} trên bản đồ`, `Open ${d.name.en} on the map`),
    thuTu: i + 1,
    khoa: d.slug,
  }));

  return (
    <BrandMap
      ghim={ghim}
      dangChon={selectedSlug}
      nhanVung={ch(lang, "Bản đồ các điểm đến Ninh Bình", "Map of Ninh Binh destinations")}
      className="min-h-[31rem] w-full rounded-3xl border border-[#b9cbc3]"
      onChonGhim={(id, phanTu) => {
        const chon = destinations.find((d) => d.slug === id);
        if (chon) onSelect(chon, phanTu);
      }}
    />
  );
}
