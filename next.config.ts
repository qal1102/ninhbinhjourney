import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIST_DIR ?? ".next",
  experimental: {
    viewTransition: true,
  },
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
      {
        source: "/erp/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
