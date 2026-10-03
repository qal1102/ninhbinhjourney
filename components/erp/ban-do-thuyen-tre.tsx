"use client";

import dynamic from "next/dynamic";

/**
 * Nạp bản đồ thuyền (MapLibre, nặng) chỉ khi màn Sức chứa Tràng An / Tam Cốc
 * thật sự hiện nó, để mười hai module khác dùng chung route không phải tải theo.
 */
export const BanDoThuyenTre = dynamic(() => import("./ban-do-thuyen").then((m) => m.BanDoThuyen), {
  ssr: false,
  loading: () => <div className="h-[min(68vh,560px)] w-full animate-pulse rounded-2xl bg-[#eef2ef]" />,
});
