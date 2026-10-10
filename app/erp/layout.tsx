import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ninh Bình Điều hành",
  description: "Hệ thống quản trị và điều hành các điểm đến.",
  applicationName: "Ninh Bình Điều hành",
  // App riêng của ERP, phạm vi chỉ /erp (10/10/2026). Trước đây một manifest
  // chung `app/manifest.ts` gắn cho mọi trang, tên "NB Điều hành", phạm vi "/":
  // khách cài từ trang du lịch lại được app ERP, và trong app bấm liên kết là
  // nhảy qua lại giữa ERP và web khách.
  manifest: "/erp.webmanifest",
  icons: { apple: "/brand/erp-apple-180.png" },
  appleWebApp: {
    capable: true,
    title: "NB Điều hành",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export default function ErpLayout({ children }: { children: ReactNode }) {
  return children;
}
