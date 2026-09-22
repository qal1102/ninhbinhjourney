"use client";

import { useMemo } from "react";

import {
  BrandMap,
  LOI_NHAN_HONG_TINH,
  type GhimBanDo,
} from "@/components/shared/brand-map";
import type { TripPassportLanguage, TripPassportStop } from "@/domain/trip-passport";

/**
 * TC-10 — tấm bản đồ "Những nơi bạn đã đi qua".
 *
 * Chỉ được nạp qua `next/dynamic` ở `trip-passport.tsx`, phía trình duyệt.
 *
 * Đây là một tấm hình để xem, không phải bản đồ để lái: tắt kéo, tắt phóng,
 * tắt cuộn. Trên điện thoại, một ngón tay vuốt qua bản đồ phải cuộn trang chứ
 * không bị bản đồ nuốt mất.
 */

/**
 * Tên đặt bên trái điểm thay vì bên phải, để hai điểm gần nhau không đè chữ
 * lên nhau. Bái Đính nằm ngay tây bắc Tràng An.
 */
const LABEL_ON_LEFT = new Set(["10000000-0000-4000-8000-000000000003"]);

/**
 * Lề khi đưa các điểm vào khung. Mép dưới chừa rộng hơn: đó là chỗ dòng ghi
 * nguồn bản đồ, và là chỗ dải nhắn "bản đồ chưa về kịp" hiện lên khi mất dữ
 * liệu — dải ấy không được đè lên điểm nào ở phía nam.
 */
const LE_OM_GHIM = { top: 36, bottom: 92, left: 44, right: 44 };

export default function TripPassportMapCanvas({
  stops,
  freshIds,
  lang,
}: {
  stops: readonly TripPassportStop[];
  freshIds: readonly string[];
  lang: TripPassportLanguage;
}) {
  const freshKey = freshIds.join("|");

  const ghim = useMemo<GhimBanDo[]>(() => {
    const vuaSang = new Set(freshKey ? freshKey.split("|") : []);
    return stops.map((stop) => ({
      id: stop.id,
      toaDo: stop.coordinates,
      nhan: stop.shortName[lang],
      thuTu: stop.lit ? (stop.visitOrder ?? undefined) : undefined,
      goc: "nb-passport-pin",
      lop: [stop.lit ? "is-lit" : "", vuaSang.has(stop.id) ? "is-fresh" : ""]
        .filter(Boolean)
        .join(" "),
      nhanPhu: stop.shortName[lang],
      lopNhanPhu: `nb-passport-label${LABEL_ON_LEFT.has(stop.id) ? " is-left" : ""}`,
      thuocTinh: {
        "data-place-id": stop.id,
        "data-lit": stop.lit ? "true" : "false",
      },
      khongBam: true,
      // Nơi đã sáng nằm trên nơi còn mờ khi hai điểm sát nhau.
      noiBat: stop.lit,
    }));
  }, [stops, freshKey, lang]);

  return (
    <BrandMap
      ghim={ghim}
      nhanVung={
        lang === "en" ? "Map of the places you visited" : "Bản đồ những nơi bạn đã đi qua"
      }
      tinh
      le={LE_OM_GHIM}
      zoomToiDa={12}
      className="nb-passport-map h-full w-full bg-[#F4EFE3]"
      loiNhanHong={LOI_NHAN_HONG_TINH}
    />
  );
}
