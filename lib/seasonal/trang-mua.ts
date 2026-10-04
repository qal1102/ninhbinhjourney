import { isMidAutumnSeasonOpen } from "./mid-autumn-season";

/**
 * Trang mùa nào đang là "sự kiện theo mùa" của web: Trung thu khi Bàn Trăng
 * còn bán, hết mùa ấy thì mùa hoa súng Tam Cốc. Trang hoa súng tự tính mùa
 * đang tới cho mọi năm (`domain/mua-hoa-sung.ts`), nên lối "Sự kiện theo mùa"
 * không bao giờ dẫn khách tới một mùa đã khép.
 */
export type TrangMua = "mid-autumn" | "hoa-sung";

export function trangMuaHienTai(now: Date | number = Date.now()): TrangMua {
  return isMidAutumnSeasonOpen(now) ? "mid-autumn" : "hoa-sung";
}

export const DUONG_DAN_MUA: Record<TrangMua, "/seasonal/mid-autumn" | "/seasonal/hoa-sung"> = {
  "mid-autumn": "/seasonal/mid-autumn",
  "hoa-sung": "/seasonal/hoa-sung",
};

export const NHAN_MUA_NGAN: Record<TrangMua, { vi: string; en: string }> = {
  "mid-autumn": { vi: "Trung thu", en: "Mid-Autumn" },
  "hoa-sung": { vi: "Hoa súng", en: "Lilies" },
};
