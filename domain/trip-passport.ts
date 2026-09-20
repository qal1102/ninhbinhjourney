import { DESTINATIONS } from "@/content/destinations";

/**
 * TC-10 — Căn cước hành trình: tấm bản đồ Ninh Bình của riêng một người,
 * sáng dần theo những nơi họ đã thật sự vào.
 *
 * Hàm thuần, không gọi mạng, không ghi gì. Nguồn duy nhất là `entries[]` mà
 * `erp_visitor_group_member_journey` (một người) hoặc `erp_visitor_group_status`
 * (cả đoàn) đã trả sẵn từ nhật ký quét. Trang không tự suy thêm một nơi nào.
 */

/**
 * Những nơi CÓ THỂ sáng lên — khai đúng một lần.
 *
 * Một nơi chỉ sáng được khi hệ thống có cổng ghi nhận lượt vào ở đó. Đó đúng
 * là bốn cơ sở ERP (`ERP_SITES` trong `domain/erp.ts`; ánh xạ sang mã cơ sở ở
 * `ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG`): nơi có vé bán ra và có nhân viên cổng.
 *
 * Năm nơi còn lại trong `DESTINATIONS` không có cổng nào của hệ thống: Cố đô
 * Hoa Lư và Phố cổ Hoa Lư không bán vé tại đây; Hang Múa, Thung Nham, Đầm Vân
 * Long chưa có cổng ghi nhận lượt vào. Vẽ chúng lên tấm bản đồ này là hứa một
 * điểm sáng không bao giờ bật.
 *
 * Thứ tự ở đây là thứ tự hiện những nơi chưa ghé.
 */
export const TRIP_PASSPORT_PLACE_IDS = [
  "10000000-0000-4000-8000-000000000001", // Tràng An
  "10000000-0000-4000-8000-000000000003", // Chùa Bái Đính
  "10000000-0000-4000-8000-000000000005", // Tam Cốc – Bích Động
  "10000000-0000-4000-8000-000000000009", // Khu du lịch Tam Chúc
] as const;

export type TripPassportLanguage = "vi" | "en";

type Localized = { vi: string; en: string };

/**
 * Tên ngắn để ghi ngay cạnh điểm trên bản đồ — tên đầy đủ như "Khu du lịch
 * Tam Chúc" dài quá khổ một bản đồ điện thoại. Danh sách bên dưới bản đồ vẫn
 * dùng tên đầy đủ.
 */
const SHORT_NAMES: Record<(typeof TRIP_PASSPORT_PLACE_IDS)[number], Localized> = {
  "10000000-0000-4000-8000-000000000001": { vi: "Tràng An", en: "Trang An" },
  "10000000-0000-4000-8000-000000000003": { vi: "Bái Đính", en: "Bai Dinh" },
  "10000000-0000-4000-8000-000000000005": { vi: "Tam Cốc", en: "Tam Coc" },
  "10000000-0000-4000-8000-000000000009": { vi: "Tam Chúc", en: "Tam Chuc" },
};

export type TripPassportPlace = {
  id: string;
  slug: string;
  name: Localized;
  shortName: Localized;
  coordinates: readonly [number, number];
  image: string;
};

export type TripPassportEntry = {
  siteId: string;
  scannedAt: string;
  /**
   * Ai vào. Chỉ dùng để đếm số người khác nhau ở một nơi trên trang trưởng
   * đoàn; trang của một người để trống.
   */
  visitorKey?: string;
};

export type TripPassportStop = TripPassportPlace & {
  lit: boolean;
  /** Lượt vào sớm nhất ở nơi này, nguyên văn chuỗi giờ máy chủ trả về. */
  firstVisitAt: string | null;
  /** Thứ tự đã tới, tính từ 1, chỉ cho nơi đã sáng. */
  visitOrder: number | null;
  /** Số người khác nhau đã vào nơi này. */
  visitorCount: number;
};

export type TripPassport = {
  /** Nơi đã sáng trước, theo giờ tới; rồi tới nơi chưa ghé, theo thứ tự khai. */
  stops: TripPassportStop[];
  litCount: number;
  totalCount: number;
};

/** Bốn nơi ở `TRIP_PASSPORT_PLACE_IDS`, lấy tên, toạ độ, ảnh từ kho nội dung. */
export function tripPassportPlaces(): TripPassportPlace[] {
  return TRIP_PASSPORT_PLACE_IDS.flatMap((id) => {
    const destination = DESTINATIONS.find((item) => item.id === id);
    if (!destination) return [];
    return [{
      id: destination.id,
      slug: destination.slug,
      name: destination.name,
      shortName: SHORT_NAMES[id],
      coordinates: destination.coordinates,
      image: destination.image,
    }];
  });
}

/**
 * Dựng tấm bản đồ từ danh sách lượt vào.
 *
 * - Lượt vào ở nơi không có trên bản đồ (kể cả mã cơ sở lạ) bị bỏ qua.
 * - Lượt vào có giờ hỏng bị bỏ qua: một nơi không thể "sáng" mà không biết
 *   sáng lúc nào (bài học TC-19, `pickCurrentAttendanceSiteId`).
 * - Vào nhiều lần một nơi thì lấy lần sớm nhất.
 */
export function buildTripPassport(
  entries: readonly TripPassportEntry[],
  places: readonly TripPassportPlace[] = tripPassportPlaces(),
): TripPassport {
  const earliest = new Map<string, { millis: number; raw: string }>();
  const visitors = new Map<string, Set<string>>();
  const known = new Set(places.map((place) => place.id));

  for (const entry of entries) {
    if (!known.has(entry.siteId)) continue;
    const millis = Date.parse(entry.scannedAt);
    if (Number.isNaN(millis)) continue;
    const current = earliest.get(entry.siteId);
    if (!current || millis < current.millis) {
      earliest.set(entry.siteId, { millis, raw: entry.scannedAt });
    }
    const people = visitors.get(entry.siteId) ?? new Set<string>();
    people.add(entry.visitorKey ?? "");
    visitors.set(entry.siteId, people);
  }

  const lit = places
    .map((place, index) => ({ place, index, first: earliest.get(place.id) }))
    .filter((item): item is { place: TripPassportPlace; index: number; first: { millis: number; raw: string } } =>
      item.first !== undefined)
    .sort((a, b) => a.first.millis - b.first.millis || a.index - b.index)
    .map((item, order): TripPassportStop => ({
      ...item.place,
      lit: true,
      firstVisitAt: item.first.raw,
      visitOrder: order + 1,
      visitorCount: visitors.get(item.place.id)?.size ?? 0,
    }));

  const dim = places
    .filter((place) => !earliest.has(place.id))
    .map((place): TripPassportStop => ({
      ...place,
      lit: false,
      firstVisitAt: null,
      visitOrder: null,
      visitorCount: 0,
    }));

  return { stops: [...lit, ...dim], litCount: lit.length, totalCount: places.length };
}

/** Lượt vào của cả đoàn, mỗi lượt gắn mã người vào để đếm người khác nhau. */
export function groupTripPassportEntries(
  members: readonly { memberCode: string; entries: readonly { siteId: string; scannedAt: string }[] }[],
): TripPassportEntry[] {
  return members.flatMap((member) =>
    member.entries.map((entry) => ({ ...entry, visitorKey: member.memberCode })),
  );
}

/**
 * Nơi vừa sáng lên kể từ lần xem trước — để chỉ nơi ấy mới có hiệu ứng.
 * Lần xem đầu (`previousLitIds` là `null`) thì không nơi nào là "vừa sáng":
 * mở trang ra thấy bản đồ đứng yên, không nhấp nháy cả loạt.
 */
export function newlyLitPlaceIds(
  previousLitIds: ReadonlySet<string> | null,
  passport: TripPassport,
): string[] {
  if (!previousLitIds) return [];
  return passport.stops
    .filter((stop) => stop.lit && !previousLitIds.has(stop.id))
    .map((stop) => stop.id);
}

export function litPlaceIds(passport: TripPassport): Set<string> {
  return new Set(passport.stops.filter((stop) => stop.lit).map((stop) => stop.id));
}

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Giờ vào theo giờ Việt Nam, dù điện thoại khách đang đặt múi giờ nào:
 * `09:42 · 18/09` (vi) hoặc `09:42 · 18 Sep` (en). Giờ hỏng thì trả chuỗi rỗng.
 */
export function formatVisitMoment(value: string, lang: TripPassportLanguage): string {
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return "";
  // `en-US`, không phải `en-GB`: bản ICU mới viết tắt tháng Chín của en-GB là
  // "Sept", bản cũ là "Sep" — cùng một mã, hai máy ra hai chữ.
  const parts = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    day: "2-digit",
    month: lang === "vi" ? "2-digit" : "short",
  }).formatToParts(new Date(millis));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const clock = `${part("hour")}:${part("minute")}`;
  return lang === "vi"
    ? `${clock} · ${part("day")}/${part("month")}`
    : `${clock} · ${part("day")} ${part("month")}`;
}

/**
 * Ngày đi của đoàn (`YYYY-MM-DD`, ngày lịch, không giờ) — đọc thẳng, không
 * qua `Date` để khỏi lệch một ngày theo múi giờ máy khách.
 */
export function formatVisitDate(value: string, lang: TripPassportLanguage): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return "";
  const [, year, month, day] = match;
  if (lang === "vi") return `${day}/${month}/${year}`;
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1)),
  );
  return `${Number(day)} ${monthName} ${year}`;
}
