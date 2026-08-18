import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope/index.css";
import "./globals.css";
import { PageTransition } from "@/components/shared/page-transition";
import { ScrollProgress } from "@/components/shared/scroll-progress";
import { ScrollType } from "@/components/shared/scroll-type";
import { CustomerBehaviorTracker } from "@/components/customer-data/customer-behavior-tracker";
import { CustomerConsentCenter } from "@/components/customer-data/customer-consent-center";

export const metadata: Metadata = {
  title: "Ninh Bình Journey",
  description: "Hành trình giữa núi, nước và di sản vượt thời gian.",
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
        <ScrollType />
        <Suspense fallback={null}>
          <CustomerBehaviorTracker />
        </Suspense>
        {process.env.CUSTOMER_CONSENT_MANAGEMENT_ENABLED === "true" ? (
          <CustomerConsentCenter />
        ) : null}
        <PageTransition>{children}</PageTransition>
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
