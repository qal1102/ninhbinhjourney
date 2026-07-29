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

export function parseJourneyIntent(input: {
  text: string;
  locale: "vi" | "en";
}): JourneyIntentDraft {
  const rawText = input.text.trim();
  const text = normalizedText(rawText);
  const draft: JourneyIntentDraft = {
    locale: input.locale,
    rawText,
    fieldConfidence: {},
  };

  if (
    /\bmot ngay\b/.test(text) ||
    /\bone day\b/.test(text) ||
    /\b1 ngay\b/.test(text)
  ) {
    draft.durationMinutes = 600;
    draft.fieldConfidence.durationMinutes = 0.99;
  } else {
    const hours =
      numberBeforeKeyword(text, "gio") ?? numberBeforeKeyword(text, "hours?");
    if (hours) {
      draft.durationMinutes = hours * 60;
      draft.fieldConfidence.durationMinutes = 0.95;
    }
  }

  const adults =
    numberBeforeKeyword(text, "nguoi lon") ??
    numberBeforeKeyword(text, "adults?");
  const children =
    numberBeforeKeyword(text, "tre") ?? numberBeforeKeyword(text, "children?");
  const seniors =
    numberBeforeKeyword(text, "nguoi cao tuoi") ??
    numberBeforeKeyword(text, "seniors?");
  if (/\bbo me\b|\bparents?\b/.test(text)) {
    draft.party = { adults: adults ?? 3, children: children ?? 0, seniors: 0 };
    draft.partyContext = ["travelling-with-parents"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.82;
  } else if (adults || children || seniors) {
    draft.party = {
      adults: adults ?? 0,
      children: children ?? 0,
      seniors: seniors ?? 0,
    };
    draft.fieldConfidence.party = 0.95;
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
      reason:
        intent.walkingTolerance === "low"
          ? `${destination.name.vi} phù hợp giới hạn đi bộ ${destination.mobilityLevel}; khung giờ demo còn phù hợp.`
          : `${destination.name.vi} khớp nhịp ${intent.pace} và nằm trong khung giờ demo.`,
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
