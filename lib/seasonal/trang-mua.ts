/**
 * Trang mùa nào đang là "sự kiện theo mùa" của web: Trung thu khi Bàn Trăng
 * còn bán, hết mùa ấy thì mùa hoa súng Tam Cốc. Trang hoa súng tự tính mùa
 * đang tới cho mọi năm (`domain/mua-hoa-sung.ts`), nên lối "Sự kiện theo mùa"
 * không bao giờ dẫn khách tới một mùa đã khép.
 */
export type TrangMua = "mid-autumn" | "hoa-sung";

export const DUONG_DAN_MUA: Record<TrangMua, "/seasonal/mid-autumn" | "/seasonal/hoa-sung"> = {
  "mid-autumn": "/seasonal/mid-autumn",
  "hoa-sung": "/seasonal/hoa-sung",
};

export const NHAN_MUA_NGAN: Record<TrangMua, { vi: string; en: string }> = {
  "mid-autumn": { vi: "Trung thu", en: "Mid-Autumn" },
  "hoa-sung": { vi: "Hoa súng", en: "Lilies" },
};

/** Trang kệ mùa: mọi mùa, cả mùa đang tới lẫn mùa đã khép. */
export const DUONG_DAN_KE_MUA = "/seasonal";

/**
 * Lối "Sự kiện theo mùa" ở cổng trang chủ, thanh chuyển và hộp trợ lý hành
 * trình. Trung thu còn bán thì vào thẳng trang Trung thu; hết mùa thì vào kệ
 * mùa, để Trung thu đã khép vẫn hiện ngay cạnh mùa hoa súng (chủ dự án
 * 06/10/2026: mùa đã qua vẫn phải được trưng ra).
 */
export function loiVaoMua(trungThuMo: boolean): "/seasonal/mid-autumn" | "/seasonal" {
  return trungThuMo ? "/seasonal/mid-autumn" : DUONG_DAN_KE_MUA;
}
