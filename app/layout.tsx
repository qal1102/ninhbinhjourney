import type { Metadata } from "next";
import "@fontsource-variable/fraunces/full.css";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
