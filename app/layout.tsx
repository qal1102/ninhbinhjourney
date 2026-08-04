import type { Metadata } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope/index.css";
import "./globals.css";
import { PageTransition } from "@/components/shared/page-transition";
import { ScrollProgress } from "@/components/shared/scroll-progress";

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
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
