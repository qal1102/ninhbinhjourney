"use client";

import { useCallback, useMemo, useState } from "react";

import {
  BrandMap,
  type DuongNoi,
  type GhimBanDo,
} from "@/components/shared/brand-map";
import { DESTINATIONS } from "@/content/destinations";

/**
 * Bản đồ hành trình trong màn dựng lịch trình.
 *
 * Các chặng nối thành một đường nét đứt theo đúng thứ tự khách xếp, mỗi chặng
 * một ghim đánh số. Bấm vào ghim thì mở một tấm thiệp nhỏ ở góc — thay cho
 * popup dựng sẵn của thư viện bản đồ, vốn mang phông chữ và bóng đổ của riêng
 * nó và không bao giờ trông giống phần còn lại của trang.
 */

export type RouteStop = {
  id: string;
  siteId: string;
  label: string;
};

type ResolvedStop = RouteStop & {
  order: number;
  position: readonly [number, number];
  name: string;
};

export default function ItineraryRouteMap({ stops }: { stops: RouteStop[] }) {
  const [dangChon, setDangChon] = useState<string | null>(null);

  const resolved = useMemo<ResolvedStop[]>(
    () =>
      stops.flatMap((stop, index) => {
        const destination = DESTINATIONS.find(
          (candidate) => candidate.id === stop.siteId,
        );
        if (!destination) return [];
        return [
          {
            ...stop,
            order: index + 1,
            position: destination.coordinates,
            name: destination.name.vi,
          },
        ];
      }),
    [stops],
  );

  const ghim = useMemo<GhimBanDo[]>(
    () =>
      resolved.map((stop) => ({
        id: stop.id,
        toaDo: stop.position,
        nhan: `Điểm ${stop.order}: ${stop.name}`,
        thuTu: stop.order,
        goc: "nb-route-pin",
        lop: stop.id === dangChon ? "is-open" : undefined,
      })),
    [resolved, dangChon],
  );

  const duongNoi = useMemo<DuongNoi | null>(() => {
    if (resolved.length < 2) return null;
    return {
      diem: resolved.map((stop) => stop.position),
      mau: "#E7C78D",
      beRong: 3,
      netDut: [2, 1.6],
      doMo: 0.85,
    };
  }, [resolved]);

  const chon = useCallback((id: string) => {
    setDangChon((truoc) => (truoc === id ? null : id));
  }, []);

  const dangXem = resolved.find((stop) => stop.id === dangChon) ?? null;

  if (resolved.length === 0) {
    return (
      <div className="grid min-h-[24rem] place-items-center rounded-2xl bg-[#12211c] p-6 text-center text-sm leading-6 text-white/70">
        Chưa có điểm nào trong hành trình để hiển thị trên bản đồ.
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <BrandMap
        ghim={ghim}
        duongNoi={duongNoi}
        dangChon={dangChon}
        onChonGhim={chon}
        nhanVung={`Bản đồ hành trình, ${resolved.length} điểm`}
        className="min-h-[24rem] w-full rounded-2xl"
        le={{ top: 48, bottom: 96, left: 48, right: 48 }}
        zoomToiDa={12.5}
        // Tấm thiệp nằm ở mép dưới bên trái, nên đẩy điểm vừa chọn lên trên:
        // bấm một ghim rồi không còn thấy chính cái ghim ấy là lỗi khó chịu.
        doiTamKhiChon={[0, -70]}
      />
      {dangXem ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[3] sm:inset-x-auto sm:left-4 sm:max-w-xs">
          <div className="pointer-events-auto rounded-2xl border border-[#d9e4de] bg-[#fbfaf6] p-4 shadow-[0_18px_40px_rgba(24,63,52,0.24)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3f7568]">
              Điểm {dangXem.order}
            </p>
            <h3 className="font-display mt-1 text-xl text-[#183f34]">{dangXem.name}</h3>
            <p className="mt-1 text-sm leading-6 text-[#6d756f]">{dangXem.label}</p>
            <button
              type="button"
              onClick={() => setDangChon(null)}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#3f7568] underline underline-offset-4"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
