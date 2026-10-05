"use client";

import dynamic from "next/dynamic";

/** Nạp bản đồ đường đò (MapLibre, nặng) chỉ ở trình duyệt. */
export const BanDoHoaSungTre = dynamic(() => import("./ban-do-hoa-sung"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#efe8e6]" />,
});
