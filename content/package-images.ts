import { DESTINATIONS } from "@/content/destinations";
import type { PackageCatalogItem } from "@/content/packages";

/*
 * WEB-BOOK-02 (31/08/2026): nguồn DUY NHẤT ánh xạ mỗi gói trong
 * `content/packages.ts` với một điểm đến thật trong `content/destinations.ts`
 * -- dùng chung cho trang chủ (`components/discovery/package-showcase.tsx`)
 * và hai trang gói (`app/packages/page.tsx`, `app/packages/[slug]/page.tsx`).
 * Trước đây bảng này chỉ nằm trong `package-showcase.tsx`; chuyển ra đây để
 * không dựng bảng thứ hai, và `package-showcase.tsx` import ngược lại từ
 * đây (không đổi ảnh nào đang hiển thị trên trang chủ).
 *
 * Mỗi dòng dưới đây căn cứ đúng một mốc có thật trong `schedule` của gói đó:
 * - heritage-day: mở đầu bằng "08:00 · Tràng An".
 * - slow-ninh-binh: khép lại bằng "18:00 · Phố cổ Hoa Lư" (chương buổi tối
 *   trong lịch, cũng là điểm gói này khác heritage-day).
 * - family-discovery: ghé "13:30 · Bái Đính".
 * - cinematic-sunset: mở đầu bằng "14:00 · Tam Cốc – Bích Động".
 * - ban-trang-tam-coc-2026: chặng "19:00 · đón khách tại không gian trải
 *   nghiệm Tam Cốc".
 */
export const PACKAGE_IMAGE_SITE_ID: Record<string, string> = {
  "heritage-day": "10000000-0000-4000-8000-000000000001",
  "slow-ninh-binh": "10000000-0000-4000-8000-000000000004",
  "family-discovery": "10000000-0000-4000-8000-000000000003",
  "cinematic-sunset": "10000000-0000-4000-8000-000000000005",
  "ban-trang-tam-coc-2026": "10000000-0000-4000-8000-000000000005",
};

export type PackageImage = { src: string; alt: string };

/*
 * Bàn Trăng bên Ngô Đồng là gói duy nhất được phép dùng ảnh trong
 * `public/images/campaigns/mid-autumn-2026/**`. Ảnh này chụp đúng bàn tiệc
 * của gói này (đã dùng cho cùng một gói ở `components/discovery/
 * mid-autumn-campaign.tsx`), sát với gói hơn ảnh Tam Cốc ban ngày ở bảng
 * trên -- nên dùng riêng làm ảnh mở đầu cho trang chi tiết và thẻ danh sách
 * của gói này. Bảng `PACKAGE_IMAGE_SITE_ID` ở trên vẫn giữ Tam Cốc cho gói
 * này vì nó còn dùng để chọn điểm đến hiển thị trong lịch trình.
 */
const BAN_TRANG_HERO_IMAGE: PackageImage = {
  src: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp",
  alt: "Bàn tối riêng được bày bên sông Ngô Đồng dưới ánh trăng.",
};

const FALLBACK_IMAGE: PackageImage = {
  src: "/images/destinations/trang-an.jpg",
  alt: DESTINATIONS[0].imageAlt.vi,
};

/** Ảnh đại diện của một gói, dùng cho danh sách gói và ảnh mở đầu trang chi tiết. */
export function getPackageHeroImage(
  item: Pick<PackageCatalogItem, "slug">,
): PackageImage {
  if (item.slug === "ban-trang-tam-coc-2026") return BAN_TRANG_HERO_IMAGE;
  const destination = DESTINATIONS.find(
    (candidate) => candidate.id === PACKAGE_IMAGE_SITE_ID[item.slug],
  );
  return destination
    ? { src: destination.image, alt: destination.imageAlt.vi }
    : FALLBACK_IMAGE;
}
