import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Trước ngày 13/09/2026 `/robots.txt` trả 404.
 *
 * Chặn máy tìm kiếm khỏi hệ thống điều hành và mọi trang gắn với một khách cụ
 * thể (thanh toán, vé, tra cứu vé, phiếu đoàn, hành trình đã lưu). Đây không
 * phải lớp bảo mật — các trang ấy tự kiểm quyền — mà là để chúng không lọt vào
 * kết quả tìm kiếm.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/erp",
        "/api",
        "/checkout",
        "/booking",
        "/pass",
        "/doan",
        "/journey",
        "/tra-cuu-ve",
        "/ops",
        "/demo",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
