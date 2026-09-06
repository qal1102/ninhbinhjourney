/**
 * TC-21 — đối soát cuối ca: ghép lượt quét cổng với hồ sơ chốt ca.
 *
 * Chỗ này chỉ **đọc và cộng**. Không hàm nào ở đây ghi ra bất cứ đâu, và cũng
 * không được phép ghi: đây là màn hình đối soát, không phải màn hình nhập
 * liệu.
 *
 * Vì sao phép tính nằm ở `domain/` chứ không nằm cạnh chỗ đọc cơ sở dữ liệu:
 * cắt ca sai một tiếng thì con số vẫn hiện ra bình thường, chỉ là sai — đúng
 * kiểu hỏng lặng lẽ mà `domain/ticket-window.ts` và `domain/erp-shift-presence.ts`
 * đã phải tách ra để kiểm được. Ca đêm 22 giờ sang 6 giờ sáng hôm sau là chỗ
 * dễ vấp nhất, nên có bài kiểm riêng cho nó.
 */

import { vietnamDayKey } from "@/domain/ticket-window";

/**
 * Đúng bằng danh sách trong ràng buộc `erp_gate_scan_events_result_check`
 * (migration `202608310057`). Có bài kiểm đọc thẳng file migration để so, nên
 * thêm một kết quả mới ở cơ sở dữ liệu mà quên chỗ này thì bài kiểm đỏ ngay,
 * chứ màn hình không lặng lẽ bỏ sót một nhóm lượt quét.
 */
export const SHIFT_SCAN_RESULT_KEYS = [
  "accepted",
  "not-found",
  "wrong-site",
  "wrong-day",
  "exhausted",
  "already-entered",
  "payment-due",
  "void",
  "legacy-uncheckable",
] as const;

export type ShiftScanResultKey = (typeof SHIFT_SCAN_RESULT_KEYS)[number];

/**
 * Chữ hiện trên bảng đối soát. Cố ý viết theo lối kể lại chuyện đã xảy ra ở
 * cổng, vì người đọc bảng này là quản lý ngồi sau ca chứ không phải nhân viên
 * đang đứng trước mặt khách.
 */
export const SHIFT_SCAN_RESULT_LABELS: Readonly<Record<ShiftScanResultKey, string>> =
  Object.freeze({
    accepted: "Mời khách vào",
    "not-found": "Không tìm thấy vé",
    "wrong-site": "Vé của cơ sở khác",
    "wrong-day": "Vé không dùng cho ngày ấy",
    exhausted: "Vé đã dùng hết lượt",
    "already-entered": "Khách này đã vào rồi",
    "payment-due": "Giữ lại vì chưa thu tiền",
    void: "Vé đã bị huỷ",
    "legacy-uncheckable": "Lượt quét cũ, chưa đối chiếu được vé",
  });

export type ShiftScanCounts = Readonly<Record<ShiftScanResultKey, number>>;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ShiftWindowSource = "declared-times" | "business-day-fallback";

export type ShiftWindow = {
  from: Date;
  to: Date;
  /** Ngày làm việc theo giờ Việt Nam mà ca này chạm tới. Ca đêm chạm hai ngày. */
  dayKeys: string[];
  crossesMidnight: boolean;
  source: ShiftWindowSource;
  /** Lý do phải lùi về nguyên ngày làm việc; rỗng khi mốc khai báo dùng được. */
  fallbackReason: string;
};

function parseMoment(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Nửa đêm giờ Việt Nam của một ngày lịch, ví dụ `2026-09-06` → 17:00Z hôm trước. */
function vietnamMidnight(dayKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const parsed = new Date(`${dayKey}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  // Mốc kết thúc đúng nửa đêm thuộc về ngày hôm trước: ca tan lúc 00:00 không
  // kéo cả một ngày làm việc mới vào bảng đối soát.
  const last = new Date(to.getTime() - 1);
  let cursor = from;
  while (cursor.getTime() <= last.getTime()) {
    const key = vietnamDayKey(cursor);
    if (keys[keys.length - 1] !== key) keys.push(key);
    const nextMidnight = vietnamMidnight(key);
    if (!nextMidnight) break;
    cursor = new Date(nextMidnight.getTime() + DAY_MS);
    if (keys.length > 3) break;
  }
  if (keys.length === 0) keys.push(vietnamDayKey(from));
  return keys;
}

/**
 * Khung thời gian để đếm lượt quét của một ca.
 *
 * Ưu tiên đúng hai mốc nhân viên khai lúc chốt ca, vì đó mới là ca thật. Chỉ
 * khi hai mốc ấy không dùng được mới lùi về nguyên ngày làm việc — và lúc đó
 * phải **nói ra**, vì với ca đêm thì nguyên-ngày-làm-việc là một khung khác
 * hẳn và con số đếm được sẽ không còn là con số của ca ấy.
 */
export function resolveShiftWindow(input: {
  businessDate: string;
  shiftStartedAt?: string | null;
  shiftEndedAt?: string | null;
}): ShiftWindow {
  const started = parseMoment(input.shiftStartedAt);
  const ended = parseMoment(input.shiftEndedAt);

  if (started && ended && ended.getTime() > started.getTime()) {
    const dayKeys = dayKeysBetween(started, ended);
    return {
      from: started,
      to: ended,
      dayKeys,
      crossesMidnight: dayKeys.length > 1,
      source: "declared-times",
      fallbackReason: "",
    };
  }

  const midnight = vietnamMidnight(input.businessDate);
  const fallbackReason =
    !started || !ended
      ? "Hồ sơ ca thiếu mốc bắt đầu hoặc mốc kết thúc."
      : "Mốc kết thúc ca không muộn hơn mốc bắt đầu.";

  if (!midnight) {
    // Không còn gì để bám. Trả một khung rỗng để chỗ gọi biết là không đếm
    // được, thay vì bịa ra một ngày nào đó rồi đếm nhầm sang ca khác.
    const now = new Date(0);
    return {
      from: now,
      to: now,
      dayKeys: [],
      crossesMidnight: false,
      source: "business-day-fallback",
      fallbackReason: "Hồ sơ ca không có ngày làm việc đọc được.",
    };
  }

  return {
    from: midnight,
    to: new Date(midnight.getTime() + DAY_MS),
    dayKeys: [input.businessDate],
    crossesMidnight: false,
    source: "business-day-fallback",
    fallbackReason,
  };
}

export type ShiftScanTotals = {
  /** Lượt được cho vào. */
  admitted: number;
  /** Lượt bị chặn vì chưa thu tiền — TC-22, không trừ lượt vào. */
  paymentDue: number;
  /** Mọi lượt bị từ chối vì lý do khác. */
  refused: number;
  /** Lượt quét từ trước T8, khi cổng chưa đối chiếu được vé nào. */
  legacyUncheckable: number;
  total: number;
};

export type OnSiteCollector = {
  accountId: string;
  displayName: string;
  count: number;
  totalVnd: number;
};

export type ShiftOnSiteCash = {
  count: number;
  totalVnd: number;
  collectors: readonly OnSiteCollector[];
  /** Khoản khách chọn trả tại điểm mà tới giờ vẫn chưa ai thu, tính cả ca trước. */
  outstandingCount: number;
  outstandingVnd: number;
};

export type ShiftGapLevel = "alert" | "watch" | "info";

export type ShiftGap = {
  id: string;
  level: ShiftGapLevel;
  title: string;
  detail: string;
};

export type ShiftDifference = {
  id: "cash" | "entries";
  label: string;
  declared: number | null;
  counted: number | null;
  /** `counted - declared`; null khi một trong hai vế chưa đọc được. */
  delta: number | null;
  unit: "vnd" | "count";
  /** Câu nói thẳng con số này chứng minh được gì và không chứng minh được gì. */
  caveat: string;
};

export type ShiftReconciliation = {
  window: ShiftWindow;
  scans: ShiftScanTotals | null;
  scanBreakdown: ShiftScanCounts | null;
  cash: ShiftOnSiteCash | null;
  differences: ShiftDifference[];
  gaps: ShiftGap[];
  /** false khi cả hai nguồn đều chưa trả về gì — màn hình phải nói thật, không hiện số 0. */
  hasCountedData: boolean;
};

export type ShiftDeclaration = {
  businessDate: string;
  shiftStartedAt?: string | null;
  shiftEndedAt?: string | null;
  /** Số vé nhân viên khai đã bán trong ca. */
  ticketsSold: number;
  /** Tiền mặt nhân viên khai lúc chốt ca. */
  cashVnd: number;
};

function totalsFrom(counts: ShiftScanCounts): ShiftScanTotals {
  const refused =
    counts["not-found"] +
    counts["wrong-site"] +
    counts["wrong-day"] +
    counts.exhausted +
    counts["already-entered"] +
    counts.void;
  return {
    admitted: counts.accepted,
    paymentDue: counts["payment-due"],
    refused,
    legacyUncheckable: counts["legacy-uncheckable"],
    total:
      counts.accepted + counts["payment-due"] + refused + counts["legacy-uncheckable"],
  };
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.abs(value))} đ`;
}

/**
 * Ghép ba nguồn thành một bảng đối soát.
 *
 * Nguồn nào chưa đọc được thì truyền `null`, đừng truyền số 0. Số 0 và "chưa
 * đọc được" là hai chuyện khác hẳn nhau, và trộn hai chuyện ấy vào một ô đúng
 * là cách dựng ra một con số bịa (bài học `ERP-FAKE-01`/`ERP-FAKE-02`).
 */
export function reconcileShift(input: {
  shift: ShiftDeclaration;
  scanCounts: ShiftScanCounts | null;
  cash: ShiftOnSiteCash | null;
}): ShiftReconciliation {
  const window = resolveShiftWindow(input.shift);
  const scans = input.scanCounts ? totalsFrom(input.scanCounts) : null;
  const cash = input.cash;
  const gaps: ShiftGap[] = [];

  if (window.source === "business-day-fallback" && window.dayKeys.length === 0) {
    gaps.push({
      id: "window-unusable",
      level: "alert",
      title: "Chưa xác định được khung giờ của ca",
      detail:
        `${window.fallbackReason} Không có khung giờ thì mọi con số dưới đây đều` +
        " không thuộc về ca nào cả, nên hệ thống xin phép không đếm.",
    });
  } else if (window.source === "business-day-fallback") {
    gaps.push({
      id: "window-fallback",
      level: "watch",
      title: "Đang tạm đếm theo nguyên ngày làm việc",
      detail:
        `${window.fallbackReason} Hệ thống lấy trọn ngày ${window.dayKeys[0]} theo giờ` +
        " Việt Nam để còn có số mà xem. Với ca đêm thì khung này rộng hơn ca thật," +
        " xin bạn đọc con số với đúng mức tin cậy ấy.",
    });
  }

  if (window.crossesMidnight) {
    gaps.push({
      id: "window-crosses-midnight",
      level: "info",
      title: "Ca này vắt qua nửa đêm",
      detail:
        `Ca chạm hai ngày làm việc: ${window.dayKeys.join(" và ")}. Hệ thống đếm theo` +
        " đúng hai mốc bắt đầu và kết thúc ca, không cắt theo ngày lịch.",
    });
  }

  if (scans && scans.paymentDue > 0) {
    const collected = cash?.count ?? null;
    if (collected === 0) {
      gaps.push({
        id: "payment-due-without-collection",
        level: "alert",
        title: `${scans.paymentDue} lượt bị chặn vì chưa thu tiền, mà ca này chưa ghi khoản thu nào`,
        detail:
          "Khách tới cổng, mã hợp lệ, chỉ còn thiếu tiền — nhưng suốt ca không có" +
          " một khoản thu tại điểm nào vào sổ. Xin bạn hỏi lại người trực cổng xem" +
          " khách đã trả tiền chưa, và tiền ấy hiện đang ở đâu.",
      });
    } else {
      gaps.push({
        id: "payment-due",
        level: "watch",
        title: `${scans.paymentDue} lượt quét bị chặn vì chưa thu tiền`,
        detail:
          "Đây là lượt cổng giữ khách lại để thu tiền, chưa trừ lượt vào. Khách trả" +
          " tiền rồi quét lại thì mới thành lượt được cho vào.",
      });
    }
  }

  if (cash) {
    const delta = input.shift.cashVnd - cash.totalVnd;
    if (cash.totalVnd > input.shift.cashVnd) {
      gaps.push({
        id: "cash-below-collected",
        level: "alert",
        title: `Thiếu ${formatVnd(delta)} trong tờ khai tiền mặt cuối ca`,
        detail:
          `Nhân viên thu tại cổng ${formatVnd(cash.totalVnd)}, nhưng tờ chốt ca chỉ` +
          ` khai ${formatVnd(input.shift.cashVnd)} tiền mặt. Tiền đã vào tay người` +
          " trực thì buộc phải nằm trong tờ khai. Xin bạn đối chiếu lại trước khi" +
          " duyệt ca này.",
      });
    } else if (cash.totalVnd > 0) {
      gaps.push({
        id: "cash-counter-remainder",
        level: "info",
        title: `Còn ${formatVnd(delta)} tiền mặt hệ thống chưa đối chiếu được`,
        detail:
          `Trong ${formatVnd(input.shift.cashVnd)} tiền mặt khai lúc chốt ca,` +
          ` ${formatVnd(cash.totalVnd)} là khoản thu tại cổng có sổ. Phần còn lại là` +
          " tiền bán tại quầy, mà quầy thì chưa ghi từng khoản vào hệ thống nên" +
          " chưa có gì để đối chiếu.",
      });
    }

    if (cash.outstandingCount > 0) {
      gaps.push({
        id: "outstanding-on-site",
        level: "watch",
        title: `${cash.outstandingCount} đơn còn nợ tiền tại cơ sở này, tổng ${formatVnd(cash.outstandingVnd)}`,
        detail:
          "Khách đã đặt chỗ và chọn trả tiền tại điểm, tới giờ vẫn chưa ai thu. Con" +
          " số này tính cả những ca trước, không riêng ca đang xem.",
      });
    }
  }

  const differences: ShiftDifference[] = [
    {
      id: "cash",
      label: "Tiền mặt",
      declared: input.shift.cashVnd,
      counted: cash ? cash.totalVnd : null,
      delta: cash ? cash.totalVnd - input.shift.cashVnd : null,
      unit: "vnd",
      caveat:
        "Hệ thống mới đếm được khoản thu tại cổng. Tiền bán ở quầy chưa vào sổ" +
        " từng khoản, nên phần khai nhiều hơn phần đếm là chuyện bình thường —" +
        " phần đếm nhiều hơn phần khai mới là chuyện phải hỏi.",
    },
    {
      id: "entries",
      label: "Lượt khách",
      declared: input.shift.ticketsSold,
      counted: scans ? scans.admitted : null,
      delta: scans ? scans.admitted - input.shift.ticketsSold : null,
      unit: "count",
      caveat:
        "Vé bán trong ca và lượt quét được cho vào là hai con số khác nhau: khách" +
        " mua hôm nay đi ngày mai, hoặc mua chỗ khác rồi vào cổng này. Lệch nhau" +
        " không có nghĩa là sai, nhưng lệch nhiều thì đáng hỏi.",
    },
  ];

  return {
    window,
    scans,
    scanBreakdown: input.scanCounts,
    cash: cash ?? null,
    differences,
    gaps,
    hasCountedData: Boolean(scans && scans.total > 0) || Boolean(cash && cash.count > 0),
  };
}
