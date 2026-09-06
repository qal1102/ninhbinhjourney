import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SHIFT_SCAN_RESULT_KEYS,
  SHIFT_SCAN_RESULT_LABELS,
  reconcileShift,
  resolveShiftWindow,
  type ShiftOnSiteCash,
  type ShiftScanCounts,
} from "@/domain/erp-shift-reconciliation";

function counts(overrides: Partial<ShiftScanCounts> = {}): ShiftScanCounts {
  const base = Object.fromEntries(
    SHIFT_SCAN_RESULT_KEYS.map((key) => [key, 0]),
  ) as Record<(typeof SHIFT_SCAN_RESULT_KEYS)[number], number>;
  return { ...base, ...overrides };
}

function cash(overrides: Partial<ShiftOnSiteCash> = {}): ShiftOnSiteCash {
  return {
    count: 0,
    totalVnd: 0,
    collectors: [],
    outstandingCount: 0,
    outstandingVnd: 0,
    ...overrides,
  };
}

const DAY_SHIFT = {
  businessDate: "2026-09-06",
  // 06:00 → 14:00 giờ Việt Nam
  shiftStartedAt: "2026-09-05T23:00:00.000Z",
  shiftEndedAt: "2026-09-06T07:00:00.000Z",
  ticketsSold: 40,
  cashVnd: 4_000_000,
};

describe("resolveShiftWindow", () => {
  it("dùng đúng hai mốc ca đã khai, không cắt theo ngày lịch", () => {
    const window = resolveShiftWindow(DAY_SHIFT);
    expect(window.source).toBe("declared-times");
    expect(window.from.toISOString()).toBe("2026-09-05T23:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-09-06T07:00:00.000Z");
    expect(window.dayKeys).toEqual(["2026-09-06"]);
    expect(window.crossesMidnight).toBe(false);
    expect(window.fallbackReason).toBe("");
  });

  /**
   * Đây là bài kiểm quan trọng nhất của file này. Ca đêm 22 giờ sang 6 giờ
   * sáng hôm sau phải giữ nguyên khung tám tiếng và phải nhận ra mình chạm
   * hai ngày làm việc. Cắt theo ngày lịch là mất trắng nửa ca.
   */
  it("ca vắt qua nửa đêm giữ nguyên khung và nhận ra hai ngày làm việc", () => {
    const window = resolveShiftWindow({
      businessDate: "2026-09-06",
      // 22:00 ngày 06 → 06:00 ngày 07, giờ Việt Nam
      shiftStartedAt: "2026-09-06T15:00:00.000Z",
      shiftEndedAt: "2026-09-06T23:00:00.000Z",
    });
    expect(window.source).toBe("declared-times");
    expect(window.crossesMidnight).toBe(true);
    expect(window.dayKeys).toEqual(["2026-09-06", "2026-09-07"]);
    expect(window.to.getTime() - window.from.getTime()).toBe(8 * 60 * 60 * 1000);
  });

  it("ca tan đúng nửa đêm không kéo thêm một ngày làm việc mới vào", () => {
    const window = resolveShiftWindow({
      businessDate: "2026-09-06",
      // 14:00 → 24:00 giờ Việt Nam
      shiftStartedAt: "2026-09-06T07:00:00.000Z",
      shiftEndedAt: "2026-09-06T17:00:00.000Z",
    });
    expect(window.dayKeys).toEqual(["2026-09-06"]);
    expect(window.crossesMidnight).toBe(false);
  });

  it("thiếu mốc thì lùi về nguyên ngày làm việc giờ Việt Nam và nói rõ lý do", () => {
    const window = resolveShiftWindow({
      businessDate: "2026-09-06",
      shiftStartedAt: null,
      shiftEndedAt: null,
    });
    expect(window.source).toBe("business-day-fallback");
    // Nửa đêm giờ Việt Nam là 17:00Z hôm trước, không phải 00:00Z.
    expect(window.from.toISOString()).toBe("2026-09-05T17:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-09-06T17:00:00.000Z");
    expect(window.fallbackReason).not.toBe("");
  });

  it("mốc kết thúc không muộn hơn mốc bắt đầu cũng phải lùi về ngày làm việc", () => {
    const window = resolveShiftWindow({
      businessDate: "2026-09-06",
      shiftStartedAt: "2026-09-06T07:00:00.000Z",
      shiftEndedAt: "2026-09-06T07:00:00.000Z",
    });
    expect(window.source).toBe("business-day-fallback");
    expect(window.fallbackReason).toContain("không muộn hơn");
  });

  it("hồ sơ không có ngày làm việc đọc được thì trả khung rỗng, không đoán bừa", () => {
    const window = resolveShiftWindow({
      businessDate: "khong-phai-ngay",
      shiftStartedAt: null,
      shiftEndedAt: null,
    });
    expect(window.dayKeys).toEqual([]);
    expect(window.from.getTime()).toBe(window.to.getTime());
  });
});

describe("reconcileShift", () => {
  it("gom lượt quét thành cho vào / chưa thu tiền / từ chối", () => {
    const result = reconcileShift({
      shift: DAY_SHIFT,
      scanCounts: counts({
        accepted: 38,
        "payment-due": 3,
        "not-found": 2,
        "wrong-day": 1,
        "already-entered": 1,
        "legacy-uncheckable": 4,
      }),
      cash: cash({ count: 3, totalVnd: 900_000 }),
    });
    expect(result.scans).toEqual({
      admitted: 38,
      paymentDue: 3,
      refused: 4,
      legacyUncheckable: 4,
      total: 49,
    });
    expect(result.hasCountedData).toBe(true);
  });

  it("chênh lệch tiền lấy số hệ thống đếm trừ số nhân viên khai", () => {
    const result = reconcileShift({
      shift: { ...DAY_SHIFT, cashVnd: 4_000_000, ticketsSold: 40 },
      scanCounts: counts({ accepted: 36 }),
      cash: cash({ count: 5, totalVnd: 1_500_000 }),
    });
    const money = result.differences.find((row) => row.id === "cash");
    const entries = result.differences.find((row) => row.id === "entries");
    expect(money?.declared).toBe(4_000_000);
    expect(money?.counted).toBe(1_500_000);
    expect(money?.delta).toBe(-2_500_000);
    expect(entries?.delta).toBe(-4);
  });

  /**
   * Chiều nguy hiểm: tiền thu ở cổng nhiều hơn tiền mặt khai lúc chốt ca.
   * Tiền đã vào tay người trực thì buộc phải nằm trong tờ khai.
   */
  it("báo động khi tiền thu tại cổng nhiều hơn tiền mặt khai lúc chốt ca", () => {
    const result = reconcileShift({
      shift: { ...DAY_SHIFT, cashVnd: 500_000 },
      scanCounts: counts({ accepted: 10 }),
      cash: cash({ count: 4, totalVnd: 1_780_000 }),
    });
    const gap = result.gaps.find((item) => item.id === "cash-below-collected");
    expect(gap?.level).toBe("alert");
    expect(gap?.title).toContain("1.280.000");
    expect(result.gaps.some((item) => item.id === "cash-counter-remainder")).toBe(false);
  });

  it("phần tiền quầy chưa đối chiếu được thì chỉ là ghi chú, không phải báo động", () => {
    const result = reconcileShift({
      shift: { ...DAY_SHIFT, cashVnd: 4_000_000 },
      scanCounts: counts({ accepted: 10 }),
      cash: cash({ count: 2, totalVnd: 900_000 }),
    });
    const gap = result.gaps.find((item) => item.id === "cash-counter-remainder");
    expect(gap?.level).toBe("info");
    expect(result.gaps.every((item) => item.level !== "alert")).toBe(true);
  });

  it("báo động khi có lượt bị chặn vì chưa thu tiền mà cả ca không thu đồng nào", () => {
    const result = reconcileShift({
      shift: DAY_SHIFT,
      scanCounts: counts({ accepted: 5, "payment-due": 6 }),
      cash: cash({ count: 0, totalVnd: 0 }),
    });
    const gap = result.gaps.find(
      (item) => item.id === "payment-due-without-collection",
    );
    expect(gap?.level).toBe("alert");
  });

  it("nguồn chưa đọc được thì để null, tuyệt đối không hạ thành số 0", () => {
    const result = reconcileShift({
      shift: DAY_SHIFT,
      scanCounts: null,
      cash: null,
    });
    expect(result.scans).toBeNull();
    expect(result.cash).toBeNull();
    expect(result.hasCountedData).toBe(false);
    for (const row of result.differences) {
      expect(row.counted).toBeNull();
      expect(row.delta).toBeNull();
    }
    // Không nguồn nào đọc được thì cũng không được kết luận có chênh lệch.
    expect(result.gaps.some((item) => item.level === "alert")).toBe(false);
  });

  it("ca chưa có lượt quét nào không bị coi là đã có dữ liệu", () => {
    const result = reconcileShift({
      shift: DAY_SHIFT,
      scanCounts: counts(),
      cash: cash(),
    });
    expect(result.scans?.total).toBe(0);
    expect(result.hasCountedData).toBe(false);
  });

  it("nêu số đơn còn nợ tiền tại cơ sở và nói rõ nó tính cả ca trước", () => {
    const result = reconcileShift({
      shift: DAY_SHIFT,
      scanCounts: counts({ accepted: 4 }),
      cash: cash({ count: 1, totalVnd: 300_000, outstandingCount: 7, outstandingVnd: 2_100_000 }),
    });
    const gap = result.gaps.find((item) => item.id === "outstanding-on-site");
    expect(gap?.title).toContain("7 đơn");
    expect(gap?.detail).toContain("ca trước");
  });
});

/**
 * Danh sách kết quả quét phải khớp đúng ràng buộc trong cơ sở dữ liệu. Thêm
 * một kết quả mới ở migration mà quên chỗ này thì bảng đối soát sẽ lặng lẽ bỏ
 * sót cả một nhóm lượt quét — bài kiểm này bắt đúng chuyện đó.
 */
describe("danh sách kết quả quét bám sát cơ sở dữ liệu", () => {
  it("khớp từng giá trị trong erp_gate_scan_events_result_check", () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/202608310057_customer_pay_on_site.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const marker = "add constraint erp_gate_scan_events_result_check";
    const block = sql.slice(sql.indexOf(marker));
    const values = [...block.slice(0, block.indexOf(");")).matchAll(/'([a-z-]+)'/g)].map(
      (match) => match[1],
    );
    expect(values.length).toBeGreaterThan(0);
    expect([...values].sort()).toEqual([...SHIFT_SCAN_RESULT_KEYS].sort());
  });

  it("mỗi kết quả có đúng một câu tiếng Việt để hiện lên bảng", () => {
    for (const key of SHIFT_SCAN_RESULT_KEYS) {
      expect(SHIFT_SCAN_RESULT_LABELS[key]).toBeTruthy();
    }
  });
});
