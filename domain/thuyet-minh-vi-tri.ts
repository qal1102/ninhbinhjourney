/**
 * Thuyết minh theo vị trí (`/nghe`): tìm nơi khách đang đứng gần nhất trong
 * mười lăm điểm đến. Chỉ tính trên máy khách, vị trí không gửi đi đâu.
 */

export type DiemNghe = {
  id: string;
  slug: string;
  ten: string;
  viTri: readonly [number, number];
  doan: readonly string[];
};

/**
 * Trong bán kính này thì coi là "đang ở" nơi ấy. Toạ độ mỗi nơi là một điểm
 * giữa khu (bến Tràng An, cổng Bái Đính…), mà một khu rộng cả cây số, nên
 * 1,5 km vừa đủ để khách đứng ở bãi xe hay bến thuyền vẫn được nhận ra.
 */
export const BAN_KINH_DANG_O_M = 1_500;

export function khoangCachMet(a: readonly [number, number], b: readonly [number, number]): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function xepTheoKhoangCach<T extends Pick<DiemNghe, "viTri">>(diem: readonly T[], viTri: readonly [number, number]) {
  return diem
    .map((d) => ({ diem: d, met: khoangCachMet(viTri, d.viTri) }))
    .sort((x, y) => x.met - y.met);
}

/** Nơi khách đang ở, nếu có nơi nào trong bán kính; không thì null. */
export function noiDangO<T extends Pick<DiemNghe, "viTri">>(diem: readonly T[], viTri: readonly [number, number]) {
  const gan = xepTheoKhoangCach(diem, viTri)[0];
  return gan && gan.met <= BAN_KINH_DANG_O_M ? gan : null;
}

export function docKhoangCach(met: number, lang: "vi" | "en") {
  if (met < 1_000) return `${Math.round(met / 10) * 10} m`;
  const km = met / 1_000;
  const so = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${lang === "vi" ? so.replace(".", ",") : so} km`;
}
