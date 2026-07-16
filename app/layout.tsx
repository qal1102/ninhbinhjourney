import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ninh Binh AI Journey",
  description:
    "A premium mobile-first demo journey through Ninh Binh's mountains, water, and heritage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
