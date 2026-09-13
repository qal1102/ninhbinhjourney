import type { MetadataRoute } from "next";
import { DESTINATIONS } from "@/content/destinations";
import { DESTINATION_PAGE_SLUGS } from "@/content/landing-destinations";
import { PACKAGES } from "@/content/packages";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Sơ đồ trang cho máy tìm kiếm.
 *
 * Trước ngày 13/09/2026 `/sitemap.xml` trả 404. Chỉ liệt kê những trang khách
 * tự tìm tới: trang chủ, khám phá, lập hành trình, các gói và mười lăm điểm
 * đến. Không liệt kê trang thanh toán, tra cứu vé, trang vé hay phiếu đoàn —
 * đó là trang của từng khách, không phải trang để người lạ tìm thấy.
 *
 * Cố ý không ghi `lastModified`: mọi trang ở đây dựng từ nội dung trong mã,
 * nên ngày giờ lúc build không phải ngày nội dung đổi — ghi vào là nói dối máy
 * tìm kiếm.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const destinationSlugs = new Set([
    ...DESTINATIONS.map((destination) => destination.slug),
    ...Object.values(DESTINATION_PAGE_SLUGS),
  ]);

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/explore"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/packages"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/plan"), changeFrequency: "monthly", priority: 0.7 },
    ...[...destinationSlugs].map((slug) => ({
      url: absoluteUrl(`/destination/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...PACKAGES.map((item) => ({
      url: absoluteUrl(`/packages/${item.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/quyen-rieng-tu"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
