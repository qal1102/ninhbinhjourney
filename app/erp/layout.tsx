import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ninh Bình Điều hành",
  description: "Hệ thống quản trị và điều hành các điểm đến.",
  applicationName: "Ninh Bình Điều hành",
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
