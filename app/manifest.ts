import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ninh Bình Điều hành",
    short_name: "NB Điều hành",
    description: "Hệ thống quản trị và điều hành các điểm đến.",
    start_url: "/erp",
    scope: "/",
    display: "standalone",
    background_color: "#f2f4f1",
    theme_color: "#173f34",
    orientation: "portrait-primary",
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
