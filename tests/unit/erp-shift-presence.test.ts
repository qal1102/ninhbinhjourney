import { describe, expect, it } from "vitest";
import { deriveShiftPresence } from "@/domain/erp-shift-presence";
import type { ErpSiteId } from "@/domain/erp";

const SITE: ErpSiteId = "trang-an";
const OTHER: ErpSiteId = "bai-dinh";

function person(accountId: string, displayName: string, extra?: Partial<{ siteIds: ErpSiteId[]; active: boolean }>) {
  return {
    accountId,
    displayName,
    jobTitle: "Nhân viên cổng vé",
    siteIds: extra?.siteIds ?? [SITE],
    active: extra?.active ?? true,
  };
}

function event(userId: string, type: "check-in" | "check-out", createdAt: string, siteId: ErpSiteId = SITE) {
  return { userId, siteId, type, createdAt, source: "gps" as const };
}

describe("deriveShiftPresence", () => {
  const at = new Date("2026-09-05T05:00:00.000Z"); // 12:00 giờ Việt Nam

  it("chia đúng ba trạng thái từ lượt chấm công gần nhất", () => {
    const { rows, summary } = deriveShiftPresence({
      directory: [person("u1", "An"), person("u2", "Bình"), person("u3", "Cường")],
      events: [
        event("u1", "check-in", "2026-09-05T01:00:00.000Z"),
        event("u2", "check-in", "2026-09-05T00:30:00.000Z"),
        event("u2", "check-out", "2026-09-05T04:00:00.000Z"),
      ],
      siteId: SITE,
      at,
    });

    expect(summary).toEqual({ assigned: 3, onShift: 1, finished: 1, notStarted: 1 });
    expect(rows.map((row) => [row.displayName, row.state])).toEqual([
      ["An", "on-shift"],
      ["Bình", "off-shift"],
      ["Cường", "not-started"],
    ]);
  });

  it("xếp người đang trong ca lên trước, cùng trạng thái thì theo tên", () => {
    const { rows } = deriveShiftPresence({
      directory: [person("u1", "Yến"), person("u2", "An"), person("u3", "Bình")],
      events: [event("u3", "check-in", "2026-09-05T01:00:00.000Z")],
      siteId: SITE,
      at,
    });

    expect(rows.map((row) => row.displayName)).toEqual(["Bình", "An", "Yến"]);
  });

  it("bỏ qua lượt chấm công của ca hôm trước", () => {
    // 2026-09-04T16:00Z là 23:00 ngày 04/09 giờ Việt Nam -- ca đêm hôm qua.
    // Nếu tính theo '24 giờ gần nhất' thì người này còn hiện 'đang trong ca'
    // lúc trưa hôm sau, và quản lý sẽ tưởng có người ở cổng.
    const { rows, summary } = deriveShiftPresence({
      directory: [person("u1", "An")],
      events: [event("u1", "check-in", "2026-09-04T16:00:00.000Z")],
      siteId: SITE,
      at,
    });

    expect(rows[0]!.state).toBe("not-started");
    expect(rows[0]!.latestAt).toBeNull();
    expect(summary.onShift).toBe(0);
  });

  it("không tính lượt chấm công ở cơ sở khác", () => {
    const { rows } = deriveShiftPresence({
      directory: [person("u1", "An", { siteIds: [SITE, OTHER] })],
      events: [event("u1", "check-in", "2026-09-05T01:00:00.000Z", OTHER)],
      siteId: SITE,
      at,
    });

    expect(rows[0]!.state).toBe("not-started");
  });

  it("bỏ tài khoản đã khoá và tài khoản không thuộc cơ sở này", () => {
    const { rows, summary } = deriveShiftPresence({
      directory: [
        person("u1", "An"),
        person("u2", "Bình", { active: false }),
        person("u3", "Cường", { siteIds: [OTHER] }),
      ],
      events: [],
      siteId: SITE,
      at,
    });

    expect(rows.map((row) => row.displayName)).toEqual(["An"]);
    expect(summary.assigned).toBe(1);
  });

  it("giữ lượt gần nhất khi sự kiện tới không đúng thứ tự", () => {
    const { rows } = deriveShiftPresence({
      directory: [person("u1", "An")],
      events: [
        event("u1", "check-out", "2026-09-05T04:00:00.000Z"),
        event("u1", "check-in", "2026-09-05T01:00:00.000Z"),
      ],
      siteId: SITE,
      at,
    });

    expect(rows[0]!.state).toBe("off-shift");
    expect(rows[0]!.latestAt).toBe("2026-09-05T04:00:00.000Z");
  });

  it("đánh dấu lượt chấm bằng vị trí mô phỏng", () => {
    const { rows } = deriveShiftPresence({
      directory: [person("u1", "An")],
      events: [
        { userId: "u1", siteId: SITE, type: "check-in", createdAt: "2026-09-05T01:00:00.000Z", source: "demo-location" },
      ],
      siteId: SITE,
      at,
    });

    expect(rows[0]!.demoLocation).toBe(true);
  });

  it("cơ sở chưa có ai được phân công thì trả về danh sách rỗng, không phải số bịa", () => {
    const { rows, summary } = deriveShiftPresence({
      directory: [],
      events: [],
      siteId: SITE,
      at,
    });

    expect(rows).toEqual([]);
    expect(summary).toEqual({ assigned: 0, onShift: 0, finished: 0, notStarted: 0 });
  });
});
