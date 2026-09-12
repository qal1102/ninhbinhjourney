import {
  DESTINATIONS,
  NINH_BINH_TOURISM_CORE,
  type DestinationCatalogItem,
  type MobilityLevel,
} from "@/content/destinations";
import type {
  Itinerary,
  ItineraryItem,
  JourneyIntent,
  JourneyIntentDraft,
} from "@/domain/models";
import { JourneyIntentSchema } from "@/domain/schemas";

export const REQUIRED_VIETNAMESE_SAMPLE =
  "Tôi có một ngày ở Ninh Bình, đi cùng bố mẹ, muốn lịch trình nhẹ nhàng, ít đi bộ và ngân sách khoảng 2 triệu.";

const mobilityRank: Record<MobilityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

const travelMinutes: Record<string, Record<string, number>> = {
  "trang-an": {
    "hoa-lu-ancient-capital": 20,
    "bai-dinh": 30,
    "hoa-lu-old-town": 25,
    "tam-coc-bich-dong": 30,
    "van-long": 50,
    "thung-nham": 40,
  },
  "hoa-lu-ancient-capital": {
    "trang-an": 20,
    "bai-dinh": 25,
    "hoa-lu-old-town": 25,
    "tam-coc-bich-dong": 30,
    "van-long": 40,
  },
  "bai-dinh": {
    "trang-an": 30,
    "hoa-lu-ancient-capital": 25,
    "van-long": 35,
  },
  "tam-coc-bich-dong": {
    "trang-an": 30,
    "hang-mua": 15,
    "thung-nham": 20,
    "hoa-lu-old-town": 25,
  },
  "hang-mua": {
    "tam-coc-bich-dong": 15,
    "thung-nham": 25,
    "hoa-lu-old-town": 20,
  },
  "thung-nham": {
    "tam-coc-bich-dong": 20,
    "hang-mua": 25,
    "trang-an": 40,
  },
  "van-long": {
    "bai-dinh": 35,
    "hoa-lu-ancient-capital": 40,
    "trang-an": 50,
  },
  "hoa-lu-old-town": {
    "trang-an": 25,
    "tam-coc-bich-dong": 25,
    "hang-mua": 20,
  },
};

// Nhãn tiếng Việt cho ba hằng số nhịp đi và ba mức đi bộ. Chúng đi vào câu
// giải thích hiện trên từng chặng, nên phải đọc lọt tai trong một câu tiếng
// Việt, không phải tên biến.
const PACE_REASON_LABEL: Record<JourneyIntent["pace"], string> = {
  relaxed: "nhịp thư thả bạn muốn",
  balanced: "nhịp cân bằng bạn muốn",
  active: "nhịp năng động bạn muốn",
};

const MOBILITY_REASON_LABEL: Record<MobilityLevel, string> = {
  low: "đi lại nhẹ chân",
  moderate: "đi bộ vừa phải",
  high: "cần đi bộ nhiều",
};

const packagePricePerAdult = {
  relaxed: 790_000,
  balanced: 890_000,
  active: 1_290_000,
} as const;

function normalizedText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN");
}

function numberBeforeKeyword(text: string, keyword: string) {
  const match = text.match(new RegExp(`(\\d+)\\s*${keyword}`));
  return match ? Number(match[1]) : undefined;
}

/**
 * Người Việt nói "hai ngày", "ba người lớn" nhiều hơn viết "2 ngày", "3 người
 * lớn". Chỉ đọc chữ số là bỏ sót đúng cách nói thường ngày.
 *
 * Bảng cố tình dừng ở mười, và cố tình **thiếu vài chữ đọc được thành số**:
 * "tư" thì đứng trong "ngày tư", "thứ tư" nhiều hơn là số bốn, còn "linh",
 * "lẻ" thì chỉ có nghĩa khi ghép. Thêm chúng vào là đổi một chỗ đoán trúng
 * lấy nhiều chỗ đoán sai.
 */
const VIETNAMESE_NUMBER_WORDS: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

/**
 * Đếm số đứng trước một từ khoá, nhận cả chữ số lẫn chữ viết.
 *
 * Bắt buộc số phải **dính liền** từ khoá. Chữ "năm" còn nghĩa là năm tháng,
 * "tám" nằm sẵn trong "Tam Cốc", "ba" là bố — nên chỉ khi nó đứng ngay trước
 * "ngày"/"người" thì mới chắc chắn nó là một con số.
 */
function countBeforeKeyword(text: string, keyword: string) {
  const digits = numberBeforeKeyword(text, keyword);
  if (digits !== undefined) return digits;
  const words = Object.keys(VIETNAMESE_NUMBER_WORDS).join("|");
  const match = text.match(new RegExp(`\\b(${words})\\s+${keyword}`));
  return match ? VIETNAMESE_NUMBER_WORDS[match[1]] : undefined;
}

/** Ngày hôm nay theo giờ Việt Nam, tách riêng để chỗ nào cũng đếm giống nhau. */
function todayInVietnam(now: Date) {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 31 tháng 2 là ngày không có thật; nhận vào là dựng lịch trình cho hư không. */
function isRealDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Đọc ngày khách hẹn tới, khi họ nói thẳng ra một ngày cụ thể.
 *
 * "Ngày 12 tháng 10 tôi tới" trước đây rơi sạch. Bộ đọc chỉ dò SỐ NGÀY ĐI, mà
 * ở câu ấy con số đứng SAU chữ "ngày" nên không khớp vào đâu cả — khách nêu
 * đúng ngày mình tới, rồi màn hình lặng lẽ chọn hộ một ngày cách hôm nay bảy
 * hôm. Màn hình vẫn luôn chờ sẵn `draft.visitDate`; chỉ là chưa ai điền.
 *
 * Chỉ nhận ba lối viết chắc chắn là ngày tháng: "ngày 12 tháng 10", "12 tháng
 * 10", "12/10". Cả ba đều đòi con số đứng SAU chữ "ngày", hoặc kẹp giữa dấu
 * gạch chéo — nên "đi 3 ngày" và "2 ngày 1 đêm" không lọt vào đây được, và
 * hàng rào cũ (số đứng TRƯỚC từ khoá mới là số đếm) vẫn nguyên vẹn.
 *
 * Lối gạch chéo còn một cái bẫy riêng: "tôi có 1/2 ngày" là nửa ngày, không
 * phải mùng một tháng hai. Nên ngay sau nó mà là một chữ đơn vị thì bỏ qua.
 *
 * Thiếu năm thì lấy lần tới gần nhất. Gõ "12 tháng 10" vào tháng mười một là
 * khách hẹn tháng mười SANG NĂM; ô "Ngày đi" trên màn hình chặn mọi ngày trước
 * hôm nay, nên trả về một ngày đã qua là đẩy khách vào một ô không bấm tiếp
 * được.
 */
const DATE_UNIT_GUARD = "(?!\\s*(?:ngay|gio|tieng|nguoi|tuan|thang|nam|dem)\\b)";

function parseVisitDate(text: string, now: Date) {
  const match =
    text.match(/\bngay\s*(\d{1,2})\s*(?:thang|\/)\s*(\d{1,2})(?:\s*(?:nam|\/)\s*(\d{4}))?/) ??
    text.match(/\b(\d{1,2})\s*thang\s*(\d{1,2})(?:\s*(?:nam|\/)\s*(\d{4}))?/) ??
    text.match(
      new RegExp(`\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?${DATE_UNIT_GUARD}`),
    );
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const spokenYear = match[3] ? Number(match[3]) : undefined;
  if (spokenYear !== undefined) {
    if (spokenYear < 2000 || spokenYear > 2100) return undefined;
    return isRealDate(spokenYear, month, day)
      ? { date: isoDate(spokenYear, month, day), confidence: 0.97 }
      : undefined;
  }

  const today = todayInVietnam(now);
  const todayIso = isoDate(today.year, today.month, today.day);
  for (const year of [today.year, today.year + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const candidate = isoDate(year, month, day);
    if (candidate >= todayIso) return { date: candidate, confidence: 0.9 };
  }
  return undefined;
}

export function parseJourneyIntent(input: {
  text: string;
  locale: "vi" | "en";
  /** Mốc "hôm nay" cho phép bài kiểm ghim một ngày cố định. */
  today?: Date;
}): JourneyIntentDraft {
  const rawText = input.text.trim();
  const text = normalizedText(rawText);
  const draft: JourneyIntentDraft = {
    locale: input.locale,
    rawText,
    fieldConfidence: {},
  };

  // Nửa ngày phải xét trước mọi phép đếm ngày: "nửa" không phải một con số,
  // mà nếu để lọt xuống dưới thì chữ "ngày" trong câu lại kéo về trọn một ngày.
  //
  // "1/2 ngày" cũng là nửa ngày, và nó còn tệ hơn nếu để lọt: phép đếm bên
  // dưới đọc số DÍNH LIỀN chữ "ngày", tức đọc trúng số 2 của mẫu số, rồi trả
  // về HAI ngày. Khách viết nửa ngày mà trang đáp "Bạn nói chuyến này đi 2
  // ngày ạ" — đúng kiểu trang không nghe mình nói.
  if (
    /\bnua ngay\b/.test(text) ||
    /\b1\s*\/\s*2\s*ngay\b/.test(text) ||
    /\bhalf[- ]?day\b/.test(text)
  ) {
    draft.durationMinutes = 300;
    draft.tripDays = 1;
    draft.fieldConfidence.durationMinutes = 0.97;
  } else {
    const days =
      countBeforeKeyword(text, "ngay") ?? countBeforeKeyword(text, "days?");
    const weekend = /\bcuoi tuan\b/.test(text) || /\bweekend\b/.test(text);
    if (days && days >= 1) {
      // Máy dựng được đúng một ngày, nên thời lượng luôn là một ngày. Con số
      // ngày khách nói giữ riêng ở `tripDays` để màn hình nói thật, chứ nhân
      // nó lên thành 1.200 phút thì ra một "ngày" hai mươi tiếng không có thật.
      draft.durationMinutes = 600;
      draft.tripDays = days;
      draft.fieldConfidence.durationMinutes = days === 1 ? 0.99 : 0.7;
    } else if (weekend) {
      // Cuối tuần ở đây hiểu là hai ngày. Đây là suy đoán, không phải điều
      // khách nói thẳng, nên độ chắc để thấp và màn hình vẫn cho sửa lại.
      draft.durationMinutes = 600;
      draft.tripDays = 2;
      draft.fieldConfidence.durationMinutes = 0.6;
    } else if (/\bone day\b/.test(text)) {
      draft.durationMinutes = 600;
      draft.tripDays = 1;
      draft.fieldConfidence.durationMinutes = 0.99;
    } else {
      const hours =
        numberBeforeKeyword(text, "gio") ?? numberBeforeKeyword(text, "hours?");
      if (hours) {
        draft.durationMinutes = hours * 60;
        draft.fieldConfidence.durationMinutes = 0.95;
      }
    }
  }

  const adults =
    countBeforeKeyword(text, "nguoi lon") ?? countBeforeKeyword(text, "adults?");
  const children =
    countBeforeKeyword(text, "tre") ?? countBeforeKeyword(text, "children?");
  const seniors =
    countBeforeKeyword(text, "nguoi cao tuoi") ??
    countBeforeKeyword(text, "seniors?");
  // "Cặp đôi" và "đi một mình" là hai cách nói phổ biến nhất mà máy vẫn chưa
  // hiểu. Số khách nói thẳng ra vẫn được ưu tiên hơn con số suy từ cách nói.
  const couple =
    /\bcap doi\b|\bvo chong\b|\bnguoi yeu\b|\bban gai\b|\bban trai\b/.test(
      text,
    ) || /\bcouple\b|\bhoneymoon\b/.test(text);
  const solo = /\bmot minh\b/.test(text) || /\bsolo\b|\balone\b/.test(text);
  if (/\bbo me\b|\bparents?\b/.test(text)) {
    draft.party = { adults: adults ?? 3, children: children ?? 0, seniors: 0 };
    draft.partyContext = ["travelling-with-parents"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.82;
  } else if (couple) {
    draft.party = { adults: adults ?? 2, children: children ?? 0, seniors: 0 };
    draft.partyContext = ["couple"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.88;
  } else if (solo) {
    draft.party = { adults: adults ?? 1, children: children ?? 0, seniors: 0 };
    draft.partyContext = ["solo"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.9;
  } else if (adults || children || seniors) {
    draft.party = {
      adults: adults ?? 0,
      children: children ?? 0,
      seniors: seniors ?? 0,
    };
    draft.fieldConfidence.party = 0.95;
  } else {
    // "Nhà tôi 4 người có trẻ nhỏ" là cách người Việt đếm đoàn thường ngày, và
    // trước đây máy bỏ qua sạch: không có "người lớn", không có "cặp đôi",
    // không có "một mình" — nên đoàn bốn người rơi về mặc định MỘT khách, rồi
    // trang gợi ý gói với lý do "Đi một mình cũng thoải mái".
    //
    // Nhánh này chỉ chạy khi không đọc được bất kỳ con số cụ thể nào ở trên,
    // nên "hai người cao tuổi" hay "3 người lớn" vẫn đi đường cũ và không bị
    // đếm hai lần. Máy chưa biết trong bốn người ấy mấy trẻ nhỏ, nên không tự
    // bịa ra; độ chắc để vừa phải, và ô "Chỉnh lại cho đúng" vẫn cho khách sửa.
    const people = countBeforeKeyword(text, "nguoi") ?? countBeforeKeyword(text, "people");
    if (people && people >= 1) {
      draft.party = { adults: people, children: 0, seniors: 0 };
      draft.fieldConfidence.party = 0.8;
    }
  }

  if (/\bit di bo\b|\blow walking\b|\bless walking\b/.test(text)) {
    draft.walkingTolerance = "low";
    draft.fieldConfidence.walkingTolerance = 0.99;
  } else if (/\bdi bo nhieu\b|\bactive walking\b/.test(text)) {
    draft.walkingTolerance = "high";
    draft.fieldConfidence.walkingTolerance = 0.9;
  }

  if (/\bnhe nhang\b|\bthu tha\b|\brelaxed\b|\bslow pace\b/.test(text)) {
    draft.pace = "relaxed";
    draft.fieldConfidence.pace = 0.97;
  } else if (/\bnang dong\b|\bactive pace\b/.test(text)) {
    draft.pace = "active";
    draft.fieldConfidence.pace = 0.92;
  }

  const million = text.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|million)/);
  const explicitVnd = text.match(/(\d[\d.,]{3,})\s*(?:vnd|dong)/);
  if (million) {
    draft.budgetVnd = {
      target: Math.round(Number(million[1].replace(",", ".")) * 1_000_000),
      tolerancePercent: 20,
    };
    draft.fieldConfidence.budgetVnd = 0.97;
  } else if (explicitVnd) {
    draft.budgetVnd = {
      target: Number(explicitVnd[1].replace(/[.,]/g, "")),
      tolerancePercent: 20,
    };
    draft.fieldConfidence.budgetVnd = 0.95;
  }

  const interests: string[] = [];
  if (/\bdi san\b|\bheritage\b|\blich su\b/.test(text)) {
    interests.push("heritage");
  }
  if (/\bthien nhien\b|\bnature\b/.test(text)) interests.push("nature");
  if (/\bnhiếp ảnh\b|\bnhiep anh\b|\bphotograph/.test(text)) {
    interests.push("photography");
  }
  if (/\bam thuc\b|\bfood\b/.test(text)) interests.push("food");
  if (/\btam linh\b|\bspiritual/.test(text)) interests.push("spirituality");
  if (interests.length > 0) {
    draft.interests = interests;
    draft.fieldConfidence.interests = 0.9;
  }

  const visitDate = parseVisitDate(text, input.today ?? new Date());
  if (visitDate) {
    draft.visitDate = visitDate.date;
    draft.fieldConfidence.visitDate = visitDate.confidence;
  }

  // Age/family wording must never fabricate disability or medical needs.
  draft.accessibilityNeeds = [];
  return draft;
}

export function confirmJourneyIntent(input: {
  draft: JourneyIntentDraft;
  demoRunId: string;
  id: string;
  durationMinutes: number;
  party: JourneyIntent["party"];
  partyContext: string[];
  pace: JourneyIntent["pace"];
  walkingTolerance: JourneyIntent["walkingTolerance"];
  budgetVnd?: JourneyIntent["budgetVnd"];
  visitDate?: string;
}) {
  return JourneyIntentSchema.parse({
    id: input.id,
    demoRunId: input.demoRunId,
    locale: input.draft.locale,
    rawText: input.draft.rawText,
    durationMinutes: input.durationMinutes,
    party: input.party,
    partyContext: input.partyContext,
    interests: input.draft.interests ?? [],
    pace: input.pace,
    walkingTolerance: input.walkingTolerance,
    budgetVnd: input.budgetVnd,
    accessibilityNeeds: input.draft.accessibilityNeeds ?? [],
    startSiteId: input.draft.startSiteId,
    visitDate: input.visitDate ?? input.draft.visitDate,
    fieldConfidence: input.draft.fieldConfidence,
  });
}

function timeParts(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function openingWindow(destination: DestinationCatalogItem) {
  const [start, end] = destination.demoOpeningWindow
    .split("–")
    .map(timeParts);
  return { start, end };
}

function isoAt(date: string, minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, "0");
  const minutes = (minuteOfDay % 60).toString().padStart(2, "0");
  return `${date}T${hours}:${minutes}:00+07:00`;
}

function getTravelMinutes(previousSlug: string | undefined, slug: string) {
  if (!previousSlug) return 0;
  return travelMinutes[previousSlug]?.[slug] ?? 45;
}

export type ItineraryGenerationOptions = {
  idFactory?: () => string;
  unavailableSiteIds?: ReadonlySet<string>;
  visitDate?: string;
};

export function generateItinerary(
  intent: JourneyIntent,
  options: ItineraryGenerationOptions = {},
): Itinerary {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const unavailable = options.unavailableSiteIds ?? new Set<string>();
  const visitDate = options.visitDate ?? intent.visitDate ?? "2026-08-15";
  const maxMobility = mobilityRank[intent.walkingTolerance];
  const priorities =
    intent.walkingTolerance === "low"
      ? [
          "trang-an",
          "hoa-lu-ancient-capital",
          "van-long",
          "hoa-lu-old-town",
        ]
      : intent.pace === "active"
        ? ["tam-coc-bich-dong", "hang-mua", "thung-nham", "hoa-lu-old-town"]
        : ["trang-an", "hoa-lu-ancient-capital", "bai-dinh", "hoa-lu-old-town"];
  const candidates = priorities
    .map((slug) => DESTINATIONS.find((destination) => destination.slug === slug))
    .filter((destination): destination is DestinationCatalogItem =>
      Boolean(destination),
    )
    .filter(
      (destination) =>
        mobilityRank[destination.mobilityLevel] <= maxMobility &&
        !unavailable.has(destination.id),
    );

  let cursor = 8 * 60;
  let previousSlug: string | undefined;
  const items: ItineraryItem[] = [];

  for (const destination of candidates) {
    const travel = getTravelMinutes(previousSlug, destination.slug);
    const window = openingWindow(destination);
    const startMinute = Math.max(cursor + travel, window.start);
    const endMinute = startMinute + destination.suggestedMinutes;
    const elapsed = endMinute - 8 * 60;
    if (endMinute > window.end || elapsed > intent.durationMinutes) continue;

    items.push({
      id: idFactory(),
      siteId: destination.id,
      startAt: isoAt(visitDate, startMinute),
      endAt: isoAt(visitDate, endMinute),
      travelMinutesFromPrevious: travel,
      // Câu này hiện nguyên văn trên từng chặng của lịch trình. Trước đây nó
      // ghép thẳng tên hằng số tiếng Anh vào giữa một câu tiếng Việt — khách
      // đọc được "khớp nhịp balanced" và "giới hạn đi bộ low". Chữ "nhịp
      // balanced" là ví dụ cấm được nêu đích danh trong
      // .claude/skills/viet-tieng-viet/SKILL.md.
      reason:
        intent.walkingTolerance === "low"
          ? `${destination.name.vi} ${MOBILITY_REASON_LABEL[destination.mobilityLevel]}, hợp với mức đi bộ bạn nêu; khung giờ mở cửa vẫn còn kịp.`
          : `${destination.name.vi} khớp ${PACE_REASON_LABEL[intent.pace]} và nằm trong khung giờ mở cửa.`,
    });
    cursor = endMinute;
    previousSlug = destination.slug;
    if (items.length >= 3) break;
  }

  const partyAdults = intent.party.adults + intent.party.seniors;
  const estimatedPriceVnd =
    packagePricePerAdult[intent.pace] * Math.max(1, partyAdults);
  const itinerary: Itinerary = {
    id: idFactory(),
    demoRunId: intent.demoRunId,
    tenantId: "00000000-0000-4000-8000-000000000001",
    regionId: NINH_BINH_TOURISM_CORE.id,
    intentId: intent.id,
    items,
    totalMinutes: items.length > 0 ? cursor - 8 * 60 : 0,
    estimatedPriceVnd,
    validation: { valid: true, issues: [] },
    explanation:
      "Lịch trình ưu tiên giờ mở cửa minh họa, tổng thời gian, mức đi bộ, quãng di chuyển rồi mới cân nhắc ngân sách và sở thích.",
  };
  itinerary.validation = validateItinerary({ itinerary, intent, unavailable });
  return itinerary;
}

export function validateItinerary(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  unavailable?: ReadonlySet<string>;
}): Itinerary["validation"] {
  const issues: Itinerary["validation"]["issues"] = [];
  const configuredIds = new Set(DESTINATIONS.map((destination) => destination.id));
  const unavailable = input.unavailable ?? new Set<string>();
  let previousEnd = 0;
  let lastEnd = 0;
  let firstStart = Number.POSITIVE_INFINITY;

  for (const item of input.itinerary.items) {
    const destination = DESTINATIONS.find(
      (candidate) => candidate.id === item.siteId,
    );
    if (!configuredIds.has(item.siteId) || !destination) {
      issues.push({
        code: "UNKNOWN_SITE",
        message: "Lịch trình chứa một điểm ngoài catalog Ninh Bình đã cấu hình.",
        itemId: item.id,
      });
      continue;
    }
    if (unavailable.has(item.siteId)) {
      issues.push({
        code: "SITE_UNAVAILABLE",
        message: `${destination.name.vi} đang đóng hoặc hết khả dụng trong khung demo đã chọn.`,
        itemId: item.id,
      });
    }
    if (
      mobilityRank[destination.mobilityLevel] >
      mobilityRank[input.intent.walkingTolerance]
    ) {
      issues.push({
        code: "MOBILITY_CONFLICT",
        message: `${destination.name.vi} cần mức đi bộ cao hơn lựa chọn đã xác nhận.`,
        itemId: item.id,
      });
    }
    const start = Date.parse(item.startAt);
    const end = Date.parse(item.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      issues.push({
        code: "INVALID_TIME",
        message: `${destination.name.vi} có thời gian bắt đầu/kết thúc không hợp lệ.`,
        itemId: item.id,
      });
    }
    if (previousEnd > 0 && start < previousEnd) {
      issues.push({
        code: "OVERLAP",
        message: `${destination.name.vi} bị chồng thời gian với điểm trước.`,
        itemId: item.id,
      });
    }
    const window = openingWindow(destination);
    const startMinute = timeParts(item.startAt.slice(11, 16));
    const endMinute = timeParts(item.endAt.slice(11, 16));
    if (startMinute < window.start || endMinute > window.end) {
      issues.push({
        code: "OUTSIDE_DEMO_WINDOW",
        message: `${destination.name.vi} nằm ngoài khung giờ demo ${destination.demoOpeningWindow}.`,
        itemId: item.id,
      });
    }
    previousEnd = end;
    lastEnd = Math.max(lastEnd, end);
    firstStart = Math.min(firstStart, start);
  }

  if (input.itinerary.items.length === 0) {
    issues.push({
      code: "NO_FEASIBLE_STOPS",
      message:
        "Chưa có điểm nào đáp ứng đồng thời thời lượng, giờ mở cửa và mức đi bộ.",
    });
  } else {
    const elapsedMinutes = Math.round((lastEnd - firstStart) / 60_000);
    if (elapsedMinutes > input.intent.durationMinutes) {
      issues.push({
        code: "DURATION_EXCEEDED",
        message: `Lịch trình vượt quá ${input.intent.durationMinutes} phút đã xác nhận.`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function revalidateEditedItinerary(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  unavailableSiteIds?: ReadonlySet<string>;
}) {
  const validation = validateItinerary({
    itinerary: input.itinerary,
    intent: input.intent,
    unavailable: input.unavailableSiteIds,
  });
  return { ...input.itinerary, validation };
}

export function rebuildItineraryWithSites(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  siteIds: string[];
  idFactory?: () => string;
}): Itinerary {
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const visitDate =
    input.intent.visitDate ?? input.itinerary.items[0]?.startAt.slice(0, 10) ?? "2026-08-15";
  let cursor = 8 * 60;
  let previousSlug: string | undefined;
  const items: ItineraryItem[] = [];

  for (const siteId of input.siteIds) {
    const destination = DESTINATIONS.find((item) => item.id === siteId);
    if (!destination) {
      items.push({
        id: idFactory(),
        siteId,
        startAt: isoAt(visitDate, cursor),
        endAt: isoAt(visitDate, cursor + 1),
        travelMinutesFromPrevious: 0,
        reason: "Điểm chưa được cấu hình.",
      });
      cursor += 1;
      continue;
    }
    const travel = getTravelMinutes(previousSlug, destination.slug);
    const window = openingWindow(destination);
    const startMinute = Math.max(cursor + travel, window.start);
    const endMinute = startMinute + destination.suggestedMinutes;
    items.push({
      id: idFactory(),
      siteId,
      startAt: isoAt(visitDate, startMinute),
      endAt: isoAt(visitDate, endMinute),
      travelMinutesFromPrevious: travel,
      reason: `${destination.name.vi} được giữ trong thứ tự đã chỉnh; hệ thống đã chạy lại giờ mở cửa, di chuyển và mức đi bộ.`,
    });
    cursor = endMinute;
    previousSlug = destination.slug;
  }

  const rebuilt: Itinerary = {
    ...input.itinerary,
    items,
    totalMinutes: items.length > 0 ? cursor - 8 * 60 : 0,
    explanation:
      "Lịch trình đã được tính lại sau chỉnh sửa. Mọi xung đột còn lại được hiển thị trước khi có thể dùng hành trình.",
  };
  return revalidateEditedItinerary({
    itinerary: rebuilt,
    intent: input.intent,
  });
}
