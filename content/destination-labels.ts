import type { DestinationInterest, MobilityLevel } from "@/content/destinations";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Nhãn hiển thị của sở thích và mức đi bộ, dùng chung cho Khám phá và trang
 * điểm đến. Trước 30/09/2026 trang điểm đến in thẳng mã ("heritage",
 * "nature") ra mặt khách, kể cả ở bản tiếng Việt.
 */

export const NHAN_SO_THICH: Record<DestinationInterest, { vi: string; en: string }> = {
  heritage: { vi: "Di sản", en: "Heritage" },
  nature: { vi: "Thiên nhiên", en: "Nature" },
  spirituality: { vi: "Tâm linh", en: "Spiritual" },
  photography: { vi: "Nhiếp ảnh", en: "Photography" },
  food: { vi: "Ẩm thực", en: "Food" },
  family: { vi: "Gia đình", en: "Family" },
};

export const NHAN_DI_BO: Record<MobilityLevel, { vi: string; en: string }> = {
  low: { vi: "đi bộ ít", en: "little walking" },
  moderate: { vi: "đi bộ vừa", en: "some walking" },
  high: { vi: "đi bộ nhiều", en: "lots of walking" },
};

/** Dòng phụ "180 phút · đi bộ ít" của một điểm. */
export function nhanThoiLuong(minutes: number, level: MobilityLevel, lang: NgonNgu) {
  return `${minutes} ${lang === "en" ? "min" : "phút"} · ${NHAN_DI_BO[level][lang]}`;
}
