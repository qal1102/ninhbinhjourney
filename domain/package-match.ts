import {
  PACKAGES,
  type PackageCatalogItem,
  type PackageCompanionGroup,
} from "@/content/packages";
import type { JourneyIntent } from "@/domain/models";

/**
 * Ghép điều khách vừa kể ở `/plan` với năm gói trong `content/packages.ts`.
 *
 * Ba tiêu chí ghép, chốt ngày 05/09/2026: **nhịp đi, thời lượng, người đi
 * cùng**. Cả ba đều có thật ở hai đầu — `parseJourneyIntent` bắt được chúng
 * từ câu khách viết, còn mỗi gói khai `pace`, `durationMinutes`,
 * `companionFit`.
 *
 * KHÔNG ghép theo tiền. `demoPriceVnd` là giá minh hoạ, chính trang
 * `/packages` đã nói thẳng với khách rằng "không phải giá thị trường hiện
 * hành". Lấy một con số như vậy ra xếp hạng là để khách tin vào thứ không
 * có thật.
 *
 * Hàm thuần, tất định, không gọi mạng: cùng một `PackageMatchIntent` thì
 * luôn cho cùng một thứ tự. Ngày đi chỉ dùng để loại gói theo mùa nằm ngoài
 * cửa đặt chỗ, không dùng để chấm điểm.
 *
 * Đây là phép so khớp từ khoá có luật rõ ràng, không phải trí tuệ nhân tạo.
 * Chữ hiển thị cho khách phải giữ đúng mức khiêm tốn đó.
 */

export type PackageMatchText = { vi: string; en: string };

/**
 * Đúng những trường phép ghép cần. Một `JourneyIntent` đầy đủ gán vào được,
 * mà màn hình `/plan` cũng dựng tay được ngay sau bước "hiểu yêu cầu" — lúc
 * đó khách mới có bản nháp, chưa có intent đã xác nhận.
 */
export type PackageMatchIntent = Pick<
  JourneyIntent,
  "pace" | "durationMinutes" | "party" | "visitDate"
> & {
  partyContext?: readonly string[];
};

export type PackageMatchReasonCode =
  | "pace-exact"
  | "pace-near"
  | "duration-fits"
  | "duration-shorter"
  | "companions-children"
  | "companions-seniors"
  | "companions-couple"
  | "companions-solo"
  | "companions-adults";

/** Vì sao một gói bị loại. Dùng để nói thật khi không gói nào hợp. */
export type PackageSkipCode =
  | "pace-opposite"
  | "duration-exceeds"
  | "party-size-fixed"
  | "outside-booking-window"
  | "below-threshold";

export type PackageMatch = {
  slug: string;
  name: string;
  audience: string;
  score: number;
  /**
   * Thang điểm tối đa 7: nhịp đi 3, thời lượng 2, người đi cùng 2.
   * "strong" từ 6 điểm trở lên — gần như phải khớp cả ba tiêu chí.
   * "partial" là còn hụt một chỗ, và chữ trên màn hình nói thẳng như vậy.
   */
  strength: "strong" | "partial";
  reasons: PackageMatchReasonCode[];
  item: PackageCatalogItem;
};

export type PackageMatchResult = {
  matches: PackageMatch[];
  skipped: Array<{ slug: string; code: PackageSkipCode }>;
  /** Lý do đáng nói nhất khi `matches` rỗng. */
  noMatchReason?: PackageSkipCode;
};

const PACE_ORDER: Record<PackageCatalogItem["pace"], number> = {
  relaxed: 0,
  balanced: 1,
  active: 2,
};

/**
 * Gói dài hơn quỹ thời gian của khách quá 10% thì loại. Nới rộng hơn nữa là
 * mời khách vào một ngày họ không có đủ giờ để đi.
 */
const DURATION_OVERRUN_TOLERANCE = 1.1;
const DURATION_CLOSE_RATIO = 0.7;
const DURATION_LOOSE_RATIO = 0.4;

const MATCH_THRESHOLD = 4;
const STRONG_THRESHOLD = 6;

/** Thứ tự ưu tiên khi phải chọn MỘT lý do để giải thích lần không khớp. */
const SKIP_PRIORITY: readonly PackageSkipCode[] = [
  "duration-exceeds",
  "pace-opposite",
  "party-size-fixed",
  "outside-booking-window",
  "below-threshold",
];

/** Thứ tự này quyết định lý do "người đi cùng" nào được nêu ra trước. */
const COMPANION_PRIORITY: readonly PackageCompanionGroup[] = [
  "children",
  "seniors",
  "couple",
  "solo",
  "adults",
];

const COMPANION_REASON: Record<PackageCompanionGroup, PackageMatchReasonCode> = {
  children: "companions-children",
  seniors: "companions-seniors",
  couple: "companions-couple",
  solo: "companions-solo",
  adults: "companions-adults",
};

export const PACKAGE_MATCH_REASON_LABEL: Record<
  PackageMatchReasonCode,
  PackageMatchText
> = {
  "pace-exact": {
    vi: "Đúng kiểu đi bạn muốn.",
    en: "It keeps the pace you asked for.",
  },
  "pace-near": {
    vi: "Hơi khác kiểu đi bạn kể, nhưng vẫn gần.",
    en: "The pace sits a step away from what you described, but close.",
  },
  "duration-fits": {
    vi: "Vừa vặn quỹ thời gian bạn có.",
    en: "It fits the time you have.",
  },
  "duration-shorter": {
    vi: "Ngắn hơn thời gian bạn có, còn chỗ để thong thả.",
    en: "Shorter than your day, leaving room to linger.",
  },
  "companions-children": {
    vi: "Xếp riêng cho nhà có trẻ nhỏ, giờ giấc hợp với trẻ.",
    en: "Laid out for families with young children, right down to the hours it keeps.",
  },
  "companions-seniors": {
    vi: "Đường đi nhẹ chân, hợp bố mẹ và người lớn tuổi.",
    en: "Gentle underfoot, made for parents and older travelers.",
  },
  "companions-couple": {
    vi: "Vừa cho hai người.",
    en: "Sized for two.",
  },
  "companions-solo": {
    vi: "Đi một mình cũng thoải mái.",
    en: "Comfortable to take on your own.",
  },
  "companions-adults": {
    vi: "Hợp nhóm người lớn đi cùng nhau.",
    en: "Suits a group of adults travelling together.",
  },
};

export const PACKAGE_NO_MATCH_LABEL: Record<PackageSkipCode, PackageMatchText> =
  {
    "duration-exceeds": {
      vi: "Những gói còn lại đều dài hơn khoảng thời gian bạn nêu.",
      en: "The remaining packages all run longer than the time you set aside.",
    },
    "pace-opposite": {
      vi: "Kiểu đi bạn muốn khác hẳn các gói còn lại.",
      en: "The pace you want runs opposite to the packages left on the shelf.",
    },
    "party-size-fixed": {
      vi: "Gói còn lại chỉ nhận đúng số khách đã ấn định, không vừa đoàn của bạn.",
      en: "The package that is left seats a fixed number of guests, which does not match your party.",
    },
    "outside-booking-window": {
      vi: "Gói hợp với bạn lại đang ngoài mùa đặt chỗ.",
      en: "The package that fits your rhythm sits outside its booking season.",
    },
    "below-threshold": {
      vi: "Có gói gần đúng, nhưng chưa đủ hợp để chúng tôi dám mời bạn.",
      en: "One came close, but not close enough for us to put it forward.",
    },
  };

/**
 * Người đi cùng, suy ra từ đúng những gì bộ phân tích và biểu mẫu nắm được:
 * số người lớn, trẻ em, người cao tuổi, cùng ngữ cảnh "đi với bố mẹ".
 * Không suy đoán thêm bất cứ điều gì về sức khoẻ hay khả năng đi lại.
 *
 * "couple", "solo" và "adults" chỉ dành cho đoàn toàn người lớn. Nhà có trẻ
 * nhỏ hay có bố mẹ đi cùng vẫn gồm người lớn, nhưng gọi họ là "nhóm người
 * lớn đi cùng nhau" thì sai — và câu lý do hiện cho khách đọc cũng sai theo.
 */
export function describeCompanions(
  intent: PackageMatchIntent,
): PackageCompanionGroup[] {
  const adults = Math.max(0, intent.party.adults);
  const children = Math.max(0, intent.party.children);
  const seniors = Math.max(0, intent.party.seniors);
  const total = adults + children + seniors;
  const withParents = (intent.partyContext ?? []).includes(
    "travelling-with-parents",
  );
  const adultsOnly = children === 0 && seniors === 0 && !withParents;

  const groups: PackageCompanionGroup[] = [];
  if (children > 0) groups.push("children");
  if (seniors > 0 || withParents) groups.push("seniors");
  if (adultsOnly && total === 2) groups.push("couple");
  if (adultsOnly && total === 1) groups.push("solo");
  if (adultsOnly && adults >= 2) groups.push("adults");
  return groups;
}

type CriterionScore = {
  points: number;
  reason?: PackageMatchReasonCode;
  skip?: PackageSkipCode;
};

function paceScore(
  intent: PackageMatchIntent,
  item: PackageCatalogItem,
): CriterionScore {
  const distance = Math.abs(PACE_ORDER[item.pace] - PACE_ORDER[intent.pace]);
  if (distance === 0) return { points: 3, reason: "pace-exact" };
  if (distance === 1) return { points: 1, reason: "pace-near" };
  return { points: 0, skip: "pace-opposite" };
}

function durationScore(
  intent: PackageMatchIntent,
  item: PackageCatalogItem,
): CriterionScore {
  if (intent.durationMinutes <= 0) return { points: 0 };
  if (
    item.durationMinutes >
    intent.durationMinutes * DURATION_OVERRUN_TOLERANCE
  ) {
    return { points: 0, skip: "duration-exceeds" };
  }
  const ratio = item.durationMinutes / intent.durationMinutes;
  if (ratio >= DURATION_CLOSE_RATIO) return { points: 2, reason: "duration-fits" };
  if (ratio >= DURATION_LOOSE_RATIO) {
    return { points: 1, reason: "duration-shorter" };
  }
  return { points: 0 };
}

function companionScore(
  companions: readonly PackageCompanionGroup[],
  item: PackageCatalogItem,
): CriterionScore {
  const shared = COMPANION_PRIORITY.find(
    (group) => companions.includes(group) && item.companionFit.includes(group),
  );
  if (!shared) return { points: 0 };
  return { points: 2, reason: COMPANION_REASON[shared] };
}

/** Gói theo mùa chỉ được mời khi ngày đi nằm trong cửa đặt chỗ của nó. */
function withinBookingWindow(
  intent: PackageMatchIntent,
  item: PackageCatalogItem,
) {
  if (!item.bookingStartDate && !item.bookingEndDate) return true;
  const visitDate = intent.visitDate;
  if (!visitDate) return false;
  if (item.bookingStartDate && visitDate < item.bookingStartDate) return false;
  if (item.bookingEndDate && visitDate > item.bookingEndDate) return false;
  return true;
}

export function matchPackagesToIntent(
  intent: PackageMatchIntent,
  catalog: readonly PackageCatalogItem[] = PACKAGES,
): PackageMatchResult {
  const companions = describeCompanions(intent);
  const partySize =
    Math.max(0, intent.party.adults) +
    Math.max(0, intent.party.children) +
    Math.max(0, intent.party.seniors);

  const ranked: Array<{
    match: PackageMatch;
    order: number;
    paceRank: number;
    audienceWidth: number;
  }> = [];
  const skipped: PackageMatchResult["skipped"] = [];

  catalog.forEach((item, order) => {
    if (!withinBookingWindow(intent, item)) {
      skipped.push({ slug: item.slug, code: "outside-booking-window" });
      return;
    }
    if (item.fixedPartySize !== undefined && partySize !== item.fixedPartySize) {
      skipped.push({ slug: item.slug, code: "party-size-fixed" });
      return;
    }

    const pace = paceScore(intent, item);
    if (pace.skip) {
      skipped.push({ slug: item.slug, code: pace.skip });
      return;
    }
    const duration = durationScore(intent, item);
    if (duration.skip) {
      skipped.push({ slug: item.slug, code: duration.skip });
      return;
    }
    const companion = companionScore(companions, item);

    const score = pace.points + duration.points + companion.points;
    if (score < MATCH_THRESHOLD) {
      skipped.push({ slug: item.slug, code: "below-threshold" });
      return;
    }

    const reasons = [pace.reason, duration.reason, companion.reason].filter(
      (reason): reason is PackageMatchReasonCode => reason !== undefined,
    );

    ranked.push({
      match: {
        slug: item.slug,
        name: item.name,
        audience: item.audience,
        score,
        strength: score >= STRONG_THRESHOLD ? "strong" : "partial",
        reasons,
        item,
      },
      order,
      paceRank: pace.points,
      audienceWidth: item.companionFit.length,
    });
  });

  // Điểm cao lên trước. Bằng điểm thì gói đúng nhịp hơn lên trước. Vẫn bằng
  // thì gói khai đối tượng hẹp hơn lên trước — nó nói đúng về khách này hơn
  // là một gói nhận gần như ai cũng hợp. Hết cách phân định thì giữ nguyên
  // thứ tự catalog. Không có chỗ nào cho ngẫu nhiên.
  ranked.sort((left, right) => {
    if (right.match.score !== left.match.score) {
      return right.match.score - left.match.score;
    }
    if (right.paceRank !== left.paceRank) return right.paceRank - left.paceRank;
    if (left.audienceWidth !== right.audienceWidth) {
      return left.audienceWidth - right.audienceWidth;
    }
    return left.order - right.order;
  });

  const matches = ranked.map((entry) => entry.match);
  return {
    matches,
    skipped,
    noMatchReason: matches.length > 0 ? undefined : dominantSkipReason(skipped),
  };
}

function dominantSkipReason(
  skipped: PackageMatchResult["skipped"],
): PackageSkipCode | undefined {
  if (skipped.length === 0) return undefined;
  const counts = new Map<PackageSkipCode, number>();
  for (const entry of skipped) {
    counts.set(entry.code, (counts.get(entry.code) ?? 0) + 1);
  }
  let best: PackageSkipCode | undefined;
  let bestCount = 0;
  for (const code of SKIP_PRIORITY) {
    const count = counts.get(code) ?? 0;
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}
