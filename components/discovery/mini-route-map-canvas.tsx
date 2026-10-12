"use client";

import { useMemo } from "react";

import type { MiniRouteMapPoint } from "@/components/discovery/mini-route-map";
import {
  BrandMap,
  LOI_NHAN_HONG_TINH,
  type DuongNoi,
  type GhimBanDo,
} from "@/components/shared/brand-map";
import type { ToneBanDo } from "@/lib/map/brand-style";

/**
 * Bản đồ nhỏ ghim vị trí — ở trang chi tiết điểm đến (một ghim) và trang chi
 * tiết gói (các chặng nối thành một đường).
 *
 * Luôn được nạp qua `next/dynamic` từ `mini-route-map.tsx`, không import thẳng
 * ở đâu khác, để phần bản đồ chỉ tải khi khối này sắp vào khung nhìn.
 *
 * ## Đây là một tấm hình, không phải bản đồ để lái
 *
 * Khung này chỉ cao chừng 160px. Kéo và phóng trong một ô bé như thế chẳng ai
 * dùng, mà lại nuốt mất cú vuốt của khách đang cuộn trang trên điện thoại.
 * Nên nó khoá hẳn thao tác; muốn lái thì đã có bản đồ lớn ở trang khám phá.
 */

// Ghim tròn bán kính khoảng 20px, nút ⓘ ghi nguồn chiếm góc dưới phải. Lề 24px
// để ghim nằm sát mép và dưới nút ⓘ ở khung hẹp (iPhone SE, soát 11/10/2026).
const LE_OM_GHIM = { top: 40, bottom: 56, left: 40, right: 48 };

export default function MiniRouteMapCanvas({
  points,
  tone = "giay",
}: {
  points: readonly MiniRouteMapPoint[];
  tone?: ToneBanDo;
}) {
  const ghim = useMemo<GhimBanDo[]>(
    () =>
      points.map((point, index) => ({
        id: point.id,
        toaDo: point.coordinates,
        nhan: point.label,
        // Một điểm thì đánh số là thừa; nhiều điểm thì số chính là thứ tự đi.
        thuTu: points.length > 1 ? index + 1 : undefined,
        // Một điểm thì in tên cạnh ghim: quanh nhiều nơi bản đồ không có tên làng nào,
        // khách nhìn khung nhỏ không biết chấm vàng là gì.
        ...(points.length === 1 ? { nhanPhu: point.label, lopNhanPhu: "nb-ghim-ten" } : {}),
        khongBam: true,
      })),
    [points],
  );

  const duongNoi = useMemo<DuongNoi | null>(() => {
    if (points.length < 2) return null;
    return {
      diem: points.map((point) => point.coordinates),
      mau: tone === "dem" ? "#E7C78D" : "#183F34",
      beRong: 2.4,
      // Nét chấm chứ không phải gạch dài: đây là lối đi giữa các chặng, không
      // phải một con đường có thật trên mặt đất.
      netDut: [0.35, 2.4],
      doMo: 0.7,
    };
  }, [points, tone]);

  const nhanVung =
    points.length > 1
      ? `Bản đồ các chặng: ${points.map((p) => p.label).join(", ")}`
      : `Bản đồ vị trí ${points[0]?.label ?? "điểm đến"}`;

  return (
    <BrandMap
      ghim={ghim}
      duongNoi={duongNoi}
      nhanVung={nhanVung}
      tone={tone}
      tinh
      le={LE_OM_GHIM}
      // Một ghim thì KÉO RA chứ không vào gần. Đo trên trang điểm đến: khung
      // chỉ cao 158px, nên ở khổ 14 cả tấm bản đồ chỉ còn 1,5km bề dọc — vừa
      // đúng một mảng xanh phẳng, trong khi mặt nước Tràng An nằm ngay phía
      // trên mép. Lùi về 12.6 thì khung ôm khoảng 4km và khách thấy được điều
      // đáng thấy: nơi này nằm ở đâu giữa vùng núi và sông.
      // 12/10/2026: ở 12.6 khung vẫn không có một tên nào (ảnh 390 và 1440),
      // khách không biết ghim nằm gần đâu. Lùi về 11.2 thì hiện tên phường,
      // xã quanh đó mà vẫn thấy mặt nước, núi.
      zoomToiDa={points.length > 1 ? 13 : 11.2}
      className="h-full w-full"
      loiNhanHong={LOI_NHAN_HONG_TINH}
    />
  );
}
