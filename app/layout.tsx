import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope/index.css";
import "./globals.css";
import { PageTransition } from "@/components/shared/page-transition";
import { ScrollProgress } from "@/components/shared/scroll-progress";
import { DongBoNgonNgu } from "@/components/shared/dong-bo-ngon-ngu";
import { CustomerBehaviorTracker } from "@/components/customer-data/customer-behavior-tracker";
import { CustomerConsentCenter } from "@/components/customer-data/customer-consent-center";
import { HoiDapNoi } from "@/components/shared/hoi-dap-noi";
import { SITE_URL } from "@/lib/site-url";

// Không đặt `alternates.canonical` ở đây: bố cục gốc bọc mọi trang, nên một
// canonical ở tầng này sẽ khai mọi trang là bản sao của trang chủ.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ninh Bình Journey",
  description: "Núi đá vôi, sông nước và cố đô Hoa Lư.",
  // App của web khách. ERP có app riêng (`app/erp/layout.tsx`), ghi đè trường này.
  manifest: "/manifest.webmanifest",
  applicationName: "Ninh Bình Journey",
  icons: { apple: "/brand/pwa-apple-180.png" },
  appleWebApp: { capable: true, title: "Ninh Bình", statusBarStyle: "default" },
  openGraph: {
    siteName: "Ninh Bình Journey",
    locale: "vi_VN",
    type: "website",
    title: "Ninh Bình Journey",
    description: "Núi đá vôi, sông nước và cố đô Hoa Lư.",
    images: [{ url: "/images/og/ninh-binh-journey.jpg", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col">
        <ScrollProgress />
        <Suspense fallback={null}>
          <CustomerBehaviorTracker />
          <DongBoNgonNgu />
        </Suspense>
        {process.env.CUSTOMER_CONSENT_MANAGEMENT_ENABLED === "true" ? (
          <CustomerConsentCenter />
        ) : null}
        <PageTransition>{children}</PageTransition>
        {/* Khung hỏi đáp nổi của web khách; tự ẩn ở ERP và màn quầy. */}
        <Suspense fallback={null}>
          <HoiDapNoi />
        </Suspense>
        {/*
          Lop hat phim + rua mau am, dat NGOAI <PageTransition> giong
          <ScrollProgress>: bat cu thu gi `position: fixed` ma nam ben
          trong `.page-enter` deu tung bi hong vi lop boc do tao containing
          block (xem chu thich o .page-enter trong globals.css).
        */}
        <div className="film-grade" aria-hidden="true" />
      </body>
    </html>
  );
}
