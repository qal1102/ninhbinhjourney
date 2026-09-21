"use client";

import { BrandMap, type GhimBanDo } from "@/components/shared/brand-map";
import type { DestinationCatalogItem } from "@/content/destinations";

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
};

export default function ExploreMap({
  destinations,
  selectedSlug,
  onSelect,
}: ExploreMapProps) {
  if (destinations.length === 0) {
    return (
      <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-[#8da69c] bg-[#edf3f0] p-8 text-center">
        <div>
          <p className="font-display text-2xl text-[#183f34]">
            Không có điểm phù hợp
          </p>
          <p className="mt-2 text-sm text-[#59654b]">
            Danh sách vẫn hoạt động; hãy nới một bộ lọc để xem lại điểm đến.
          </p>
        </div>
      </div>
    );
  }

  const ghim: GhimBanDo[] = destinations.map((d, i) => ({
    id: d.slug,
    toaDo: d.coordinates as [number, number],
    nhan: `Mở ${d.name.vi} trên bản đồ`,
    thuTu: i + 1,
    khoa: d.slug,
  }));

  return (
    <BrandMap
      ghim={ghim}
      dangChon={selectedSlug}
      nhanVung="Bản đồ các điểm đến Ninh Bình"
      className="min-h-[31rem] w-full rounded-3xl border border-[#b9cbc3]"
      onChonGhim={(id, phanTu) => {
        const chon = destinations.find((d) => d.slug === id);
        if (chon) onSelect(chon, phanTu);
      }}
    />
  );
}
