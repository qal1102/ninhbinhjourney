import type { PackageCatalogItem } from "@/content/packages";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Chữ tiếng Anh của từng gói. Dữ liệu gốc (`content/packages.ts`) chỉ có
 * tiếng Việt và còn được máy chủ, ERP, bài kiểm dùng làm khoá; lớp này chỉ
 * phục vụ hiển thị khi khách chọn EN. Sửa chữ tiếng Việt một gói thì sửa luôn
 * dòng tương ứng ở đây.
 */

type ChuGoi = Pick<
  PackageCatalogItem,
  "name" | "audience" | "durationLabel" | "inclusions" | "exclusions" | "schedule" | "editorialDescription" | "priceLabel"
>;

const TIENG_ANH: Record<string, ChuGoi> = {
  "heritage-day": {
    name: "Heritage in a day",
    audience: "First time in Ninh Binh",
    durationLabel: "1 day",
    inclusions: ["Entry to the two sites on the route", "Suggested departure times", "QR ticket for the gates"],
    exclusions: ["Accommodation", "Personal spending", "Services outside the package"],
    schedule: ["08:00 · Trang An", "12:00 · Free time for lunch", "13:30 · Hoa Lu Ancient Capital"],
  },
  "slow-ninh-binh": {
    name: "Ninh Binh, slowly",
    audience: "Parents and older travellers, little walking",
    durationLabel: "1 day",
    inclusions: ["Sample Trang An boat route", "Evening in Hoa Lu Old Town", "QR ticket that shows whether you have entered"],
    exclusions: ["Accommodation", "Meals", "Electric carts and services outside the package"],
    schedule: ["08:00 · Trang An", "Long afternoon rest", "18:00 · Hoa Lu Old Town"],
  },
  "family-discovery": {
    name: "Family discovery",
    audience: "Families with children",
    durationLabel: "1 day",
    inclusions: ["Entry to two sites", "Times that suit small children", "One QR code for the whole booking"],
    exclusions: ["Accommodation", "Meals", "Childcare"],
    schedule: ["08:00 · Trang An", "13:30 · Bai Dinh", "Back before 17:00"],
  },
  "cinematic-sunset": {
    name: "Cinematic Ninh Binh",
    audience: "Photographers and couples",
    durationLabel: "Half day + evening",
    inclusions: ["Entry to two sites", "Times with the best light", "One QR code for the whole booking"],
    exclusions: ["Camera equipment", "Photographer", "Accommodation"],
    schedule: ["14:00 · Tam Coc – Bich Dong", "18:00 · Hoa Lu Old Town"],
  },
  "tam-chuc-chua-tren-ho": {
    name: "Tam Chuc: temples on the lake",
    audience: "Travellers after a calm, spiritual half day",
    durationLabel: "Half day",
    inclusions: ["Boat across Tam Chuc lake to Khanh Dien pier", "Walk up the three halls on That Tinh mountain", "One QR code for the whole booking"],
    exclusions: ["Electric cart inside the site", "Meals", "Offerings and donations"],
    schedule: ["Pick a boat at 07:30 · 09:00 · 10:30 · 13:30 · 15:00", "Cross the lake, climb to Khanh Dien", "Back at the pier after about four hours"],
  },
  "ban-trang-tam-coc-2026": {
    name: "Moon Table by the Ngo Dong",
    audience: "Two people who want a private dinner after Tam Coc",
    durationLabel: "19:00–21:30 · moon season 2026",
    inclusions: [
      "Seasonal tasting menu for two",
      "Tea and a mooncake at the table",
      "A two-cake Trang Non box to take home",
      "15-minute hold on the seats still free",
    ],
    exclusions: ["Extra drinks", "Transport and accommodation", "Real payment (this trial takes no money)"],
    schedule: ["19:00 · welcome at Tam Coc", "19:15 · seasonal menu", "20:45 · tea, mooncake and gift box"],
    editorialDescription:
      "After the Tam Coc boat ride, the two of you sit at a private table; the meal ends with tea and a box of mooncakes to take home.",
    priceLabel: "VND 2,480,000 · table for two",
  },
};

const NHIP: Record<PackageCatalogItem["pace"], { vi: string; en: string }> = {
  relaxed: { vi: "đi thong thả", en: "relaxed pace" },
  balanced: { vi: "đi vừa phải", en: "moderate pace" },
  active: { vi: "đi được nhiều", en: "active pace" },
};

export type GoiHienThi = ChuGoi & { nhip: string };

export function goiHienThi(item: PackageCatalogItem, lang: NgonNgu): GoiHienThi {
  const en = lang === "en" ? TIENG_ANH[item.slug] : undefined;
  return {
    name: en?.name ?? item.name,
    audience: en?.audience ?? item.audience,
    durationLabel: en?.durationLabel ?? item.durationLabel,
    inclusions: en?.inclusions ?? item.inclusions,
    exclusions: en?.exclusions ?? item.exclusions,
    schedule: en?.schedule ?? item.schedule,
    editorialDescription: en ? en.editorialDescription : item.editorialDescription,
    priceLabel: en ? en.priceLabel : item.priceLabel,
    nhip: NHIP[item.pace][lang],
  };
}

/**
 * Gói có hạn bán (Bàn Trăng mùa 2026) đã qua ngày bán cuối chưa, tính theo
 * ngày giờ Việt Nam. Hết hạn thì vẫn trưng bày, nhưng không mời giữ chỗ nữa:
 * trang đặt vé của gói ấy chẳng còn ngày nào chọn được.
 */
export function goiDaHetMua(item: PackageCatalogItem, bayGio: Date = new Date()): boolean {
  if (!item.bookingEndDate) return false;
  const homNay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(bayGio);
  return homNay > item.bookingEndDate;
}

export function giaGoi(item: PackageCatalogItem, lang: NgonNgu): string {
  const chu = goiHienThi(item, lang);
  if (chu.priceLabel) return chu.priceLabel;
  return lang === "en" ? `VND ${item.demoPriceVnd.toLocaleString("en-US")}` : `${item.demoPriceVnd.toLocaleString("vi-VN")} VND`;
}
