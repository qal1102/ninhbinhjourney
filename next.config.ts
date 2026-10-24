import type { NextConfig } from "next";
import { DAU_TRANG_BAO_MAT } from "./domain/bao-mat";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIST_DIR ?? ".next",
  poweredByHeader: false,
  // Phông chữ tiếng Việt cho PDF văn bản đọc bằng fs lúc chạy, nên phải kèm vào gói hàm.
  outputFileTracingIncludes: {
    "/api/erp/van-ban/**": ["./lib/van-ban/phong-chu/*.ttf"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      // CSP có nonce đặt theo từng lượt tải ở `proxy.ts`; đây là phần cố định.
      { source: "/:path*", headers: [...DAU_TRANG_BAO_MAT] },
    ];
  },
};

export default nextConfig;
