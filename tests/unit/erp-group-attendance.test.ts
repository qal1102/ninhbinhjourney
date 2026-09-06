import { describe, expect, it } from "vitest";
import {
  GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES,
  deriveGroupAttendance,
  pickCurrentAttendanceSiteId,
} from "@/domain/erp-group-attendance";

const SITE_TRANG_AN = "10000000-0000-4000-8000-000000000001";
const SITE_TAM_COC = "10000000-0000-4000-8000-000000000002";

function member(
  memberIndex: number,
  displayName: string,
  entries: Array<{ siteId: string; scannedAt: string }> = [],
) {
  return { memberIndex, displayName, entries };
}

describe("deriveGroupAttendance", () => {
  const now = new Date("2026-09-06T08:00:00.000Z");

  it("đoàn chưa ai vào cổng thì chưa nói gì", () => {
    const result = deriveGroupAttendance({
      members: [member(1, "An"), member(2, "Bình")],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.status).toBe("not-started");
    expect(result.alertLevel).toBe("none");
    expect(result.enteredCount).toBe(0);
    expect(result.firstScanAt).toBeNull();
    expect(result.minutesSinceFirstScan).toBeNull();
    expect(result.pendingMembers.map((row) => row.memberIndex)).toEqual([1, 2]);
  });

  it("đoàn vào đủ thì báo hoàn tất, không cảnh báo dù đã lâu", () => {
    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:00:00.000Z" }]),
        member(2, "Bình", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:10:00.000Z" }]),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.status).toBe("complete");
    expect(result.alertLevel).toBe("none");
    expect(result.enteredCount).toBe(2);
    expect(result.pendingCount).toBe(0);
  });

  it("đoàn thiếu người nhưng chưa quá ngưỡng thì chưa báo", () => {
    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:50:00.000Z" }]), // 10 phút trước now
        member(2, "Bình", []),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.status).toBe("in-progress");
    expect(result.minutesSinceFirstScan).toBe(10);
    expect(result.alertLevel).toBe("none");
    expect(result.pendingMembers).toEqual([{ memberIndex: 2, displayName: "Bình", entered: false }]);
  });

  it("đoàn thiếu người và đã quá ngưỡng thì báo", () => {
    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:40:00.000Z" }]), // 20 phút trước now
        member(2, "Bình", []),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.status).toBe("in-progress");
    expect(result.minutesSinceFirstScan).toBe(20);
    expect(result.alertLevel).toBe("attention");
  });

  it("đúng mốc ngưỡng phút thì đã tính là báo (bao gồm biên)", () => {
    const scannedAt = new Date(
      now.getTime() - GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES * 60_000,
    ).toISOString();
    const result = deriveGroupAttendance({
      members: [member(1, "An", [{ siteId: SITE_TRANG_AN, scannedAt }]), member(2, "Bình", [])],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.minutesSinceFirstScan).toBe(GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES);
    expect(result.alertLevel).toBe("attention");
  });

  it("quét ở cơ sở khác thì không tính là đã vào cơ sở đang xét", () => {
    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [{ siteId: SITE_TAM_COC, scannedAt: "2026-09-06T07:00:00.000Z" }]),
        member(2, "Bình", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:00:00.000Z" }]),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.enteredCount).toBe(1);
    expect(result.pendingMembers.map((row) => row.memberIndex)).toEqual([1]);
  });

  it("entries rỗng thì coi như chưa quét, không ném lỗi", () => {
    const result = deriveGroupAttendance({
      members: [member(1, "An", []), member(2, "Bình", [])],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.status).toBe("not-started");
    expect(result.enteredCount).toBe(0);
  });

  it("scanned_at hỏng thì bỏ qua đúng lượt đó, không làm cả hàm sập", () => {
    expect(() =>
      deriveGroupAttendance({
        members: [
          member(1, "An", [
            { siteId: SITE_TRANG_AN, scannedAt: "không phải ngày giờ" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { siteId: SITE_TRANG_AN, scannedAt: undefined as any },
          ]),
          member(2, "Bình", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:30:00.000Z" }]),
        ],
        siteId: SITE_TRANG_AN,
        now,
      }),
    ).not.toThrow();

    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [{ siteId: SITE_TRANG_AN, scannedAt: "không phải ngày giờ" }]),
        member(2, "Bình", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:30:00.000Z" }]),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    // An chỉ có một lượt quét hỏng nên vẫn coi là chưa vào; Bình có lượt hợp
    // lệ nên được tính. Mốc quét đầu tiên phải lấy từ lượt hợp lệ của Bình.
    expect(result.pendingMembers.map((row) => row.memberIndex)).toEqual([1]);
    expect(result.firstScanAt).toBe("2026-09-06T07:30:00.000Z");
  });

  it("một người quét nhiều lần thì lấy mốc SỚM NHẤT làm lượt quét đầu tiên", () => {
    const result = deriveGroupAttendance({
      members: [
        member(1, "An", [
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:20:00.000Z" },
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T07:00:00.000Z" },
        ]),
        member(2, "Bình", []),
      ],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.firstScanAt).toBe("2026-09-06T07:00:00.000Z");
  });

  it("danh sách người chưa vào giữ đúng thứ tự memberIndex dù dữ liệu vào không theo thứ tự", () => {
    const result = deriveGroupAttendance({
      members: [member(3, "Cường", []), member(1, "An", []), member(2, "Bình", [])],
      siteId: SITE_TRANG_AN,
      now,
    });

    expect(result.pendingMembers.map((row) => row.memberIndex)).toEqual([1, 2, 3]);
  });
});

describe("pickCurrentAttendanceSiteId", () => {
  const now = new Date("2026-09-06T08:00:00.000Z");

  it("chưa có lượt quét nào thì trả về null", () => {
    expect(
      pickCurrentAttendanceSiteId({ members: [member(1, "An", []), member(2, "Bình", [])], now }),
    ).toBeNull();
  });

  it("ưu tiên cơ sở đang dở dang thay vì cơ sở đã xong trước đó", () => {
    const siteId = pickCurrentAttendanceSiteId({
      members: [
        member(1, "An", [
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:00:00.000Z" },
          { siteId: SITE_TAM_COC, scannedAt: "2026-09-06T07:00:00.000Z" },
        ]),
        member(2, "Bình", [{ siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:05:00.000Z" }]),
        // Bình chưa quét ở Tam Cốc -> Tam Cốc đang dở dang, Tràng An đã xong.
      ],
      now,
    });

    expect(siteId).toBe(SITE_TAM_COC);
  });

  it("không có cơ sở nào dở dang thì lấy cơ sở có lượt quét đầu tiên gần đây nhất", () => {
    const siteId = pickCurrentAttendanceSiteId({
      members: [
        member(1, "An", [
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:00:00.000Z" },
          { siteId: SITE_TAM_COC, scannedAt: "2026-09-06T07:00:00.000Z" },
        ]),
      ],
      now,
    });

    expect(siteId).toBe(SITE_TAM_COC);
  });

  it("cơ sở mà mọi lượt quét đều hỏng giờ thì không được chọn, dù nó đứng trước", () => {
    // Lỗi thật đã đo được ở bản đầu: mã cơ sở gom thẳng từ `entries` mà không
    // xét `scannedAt`, nên cơ sở hỏng vẫn vào danh sách; `firstScanAt` là
    // `null` làm phép so ra `NaN`, và thứ tự sắp xếp thành thứ trình duyệt tự
    // quyết. Để cơ sở hỏng đứng TRƯỚC là hàm trả về đúng nó — trang trưởng
    // đoàn sẽ báo "chưa ai qua cổng" ở một nơi cả đoàn chưa từng tới.
    const siteId = pickCurrentAttendanceSiteId({
      members: [
        member(1, "An", [
          { siteId: SITE_TAM_COC, scannedAt: "khong-phai-gio" },
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:00:00.000Z" },
        ]),
        member(2, "Bình", [
          { siteId: SITE_TRANG_AN, scannedAt: "2026-09-06T06:05:00.000Z" },
        ]),
      ],
      now,
    });

    expect(siteId).toBe(SITE_TRANG_AN);
  });

  it("mọi lượt quét ở mọi cơ sở đều hỏng giờ thì trả về null", () => {
    const siteId = pickCurrentAttendanceSiteId({
      members: [
        member(1, "An", [{ siteId: SITE_TAM_COC, scannedAt: "khong-phai-gio" }]),
      ],
      now,
    });

    expect(siteId).toBeNull();
  });
});
