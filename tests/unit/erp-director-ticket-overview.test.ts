import { describe, expect, it } from "vitest";
import {
  DIRECTOR_TICKET_WINDOW_KEYS,
  buildDirectorTicketOverview,
  directorTicketWindows,
  directorTicketWindowsForRpc,
  emptyDirectorTicketCounts,
  parseDirectorTicketOverviewRpc,
  type DirectorTicketCounts,
} from "@/domain/erp-director-ticket-overview";

/*
 * A15-ERP-04 — bảng vé trang chủ giám đốc đếm tấm vé, nên vé đoàn 42 người
 * tính là 1. Các bài dưới đây dựng lại đúng trường hợp ấy trên kết quả
 * `erp_director_ticket_overview` (migration 202609170075).
 */

const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const TAM_COC = "10000000-0000-4000-8000-000000000005";

const SITES = [
  { siteId: "trang-an" as const, shortName: "Tràng An", uuid: TRANG_AN },
  { siteId: "tam-coc" as const, shortName: "Tam Cốc", uuid: TAM_COC },
];

const CONTEXT = {
  sites: SITES,
  webRevenue30dVnd: 1_200_000,
  webOrders30d: 3,
  generatedAt: "2026-09-17T03:00:00.000Z",
};

function khung(key: string, ticket_count: unknown, entry_count: unknown, demo_seed_ticket_count: unknown = 0) {
  return { key, ticket_count, entry_count, demo_seed_ticket_count };
}

/** Hôm nay: một vé đoàn 42 người ở Tràng An và một vé lẻ ở Tam Cốc. Hôm qua: hai vé lẻ. */
function ketQuaVeDoan() {
  return {
    windows: [
      khung("today", 2, 43),
      khung("yesterday", 2, 2),
      khung("week", 5, 48),
      khung("week_before", 0, 0),
      khung("month", 9, 60, 8),
      khung("month_before", 30, 30),
    ],
    by_site: [
      { key: "today", site_id: TRANG_AN, ticket_count: 1, entry_count: 42 },
      { key: "today", site_id: TAM_COC, ticket_count: 1, entry_count: 1 },
      { key: "month", site_id: TRANG_AN, ticket_count: 3, entry_count: 44 },
      { key: "month", site_id: TAM_COC, ticket_count: 6, entry_count: 16 },
      // Khung không dùng tới thì bỏ qua, không cộng lẫn vào hôm nay hay 30 ngày.
      { key: "week", site_id: TRANG_AN, ticket_count: 99, entry_count: 999 },
    ],
    by_channel: [
      { key: "month", channel: "doi-tac", ticket_count: 1, entry_count: 42 },
      { key: "month", channel: "quay-ve", ticket_count: 8, entry_count: 18 },
      { key: "today", channel: "website", ticket_count: 50, entry_count: 50 },
    ],
  };
}

describe("A15-ERP-04 — đọc kết quả đếm trong kho", () => {
  it("vé đoàn 42 người đếm 42 lượt khách, số tấm vé giữ làm số phụ", () => {
    const counts = parseDirectorTicketOverviewRpc(ketQuaVeDoan());
    expect(counts?.measure).toBe("entries");
    expect(counts?.windows.today).toEqual({ tickets: 2, entries: 43 });
    expect(counts?.siteToday[TRANG_AN]).toEqual({ tickets: 1, entries: 42 });
    expect(counts?.siteMonth[TAM_COC]).toEqual({ tickets: 6, entries: 16 });
    expect(counts?.channelMonth["doi-tac"]).toEqual({ tickets: 1, entries: 42 });
    expect(counts?.channelMonth.website).toBeUndefined();
    expect(counts?.demoSeedTickets30d).toBe(8);
    // Kho cũ chưa trả phần lịch sử mẫu thì là 0, không phải lỗi.
    expect(counts?.demoHistoryEntries30d).toBe(0);
  });

  it("đọc phần lịch sử mẫu của khung tháng để màn hình ghi 'gồm số liệu mẫu'", () => {
    const ketQua = ketQuaVeDoan();
    const thang = (ketQua.windows as Array<Record<string, unknown>>).find((w) => w.key === "month")!;
    thang.demo_history_entry_count = 1234;
    expect(parseDirectorTicketOverviewRpc(ketQua)?.demoHistoryEntries30d).toBe(1234);
    thang.demo_history_entry_count = "hong";
    expect(parseDirectorTicketOverviewRpc(ketQua)?.demoHistoryEntries30d).toBe(0);
  });

  it("kết quả hỏng hoặc sai hình dạng thì trả null để kho lùi về lệnh đếm cũ", () => {
    for (const hong of [null, undefined, "", "abc", 42, [], [ketQuaVeDoan()], { windows: "khong" }, { windows: null }, {}]) {
      expect(parseDirectorTicketOverviewRpc(hong), JSON.stringify(hong) ?? String(hong)).toBeNull();
    }
  });

  it("thiếu một khung đã hỏi thì trả null, không bịa số 0 cho khung ấy", () => {
    const ketQua = ketQuaVeDoan();
    ketQua.windows = ketQua.windows.filter((item) => item.key !== "month_before");
    expect(parseDirectorTicketOverviewRpc(ketQua)).toBeNull();
  });

  it("số hỏng, âm hay không phải số tính 0; lượt khách không bao giờ ít hơn số tấm vé", () => {
    const counts = parseDirectorTicketOverviewRpc({
      windows: [
        khung("today", "abc", null),
        khung("yesterday", -4, -9),
        khung("week", true, "12"),
        khung("week_before", Number.NaN, Infinity),
        // Kho trả thiếu entry_count: báo bằng số tấm vé, không báo "0 lượt khách".
        { key: "month", ticket_count: 5, demo_seed_ticket_count: "x" },
        khung("month_before", "7", "7.9"),
        "khong phai khung",
      ],
      by_site: "khong",
      by_channel: [null, 7, { key: "month", channel: "", ticket_count: 3, entry_count: 3 }, { key: "month", ticket_count: 2 }],
    });
    expect(counts).not.toBeNull();
    expect(counts?.windows.today).toEqual({ tickets: 0, entries: 0 });
    expect(counts?.windows.yesterday).toEqual({ tickets: 0, entries: 0 });
    expect(counts?.windows.week).toEqual({ tickets: 0, entries: 12 });
    expect(counts?.windows.week_before).toEqual({ tickets: 0, entries: 0 });
    expect(counts?.windows.month).toEqual({ tickets: 5, entries: 5 });
    expect(counts?.windows.month_before).toEqual({ tickets: 7, entries: 7 });
    expect(counts?.demoSeedTickets30d).toBe(0);
    expect(counts?.siteToday).toEqual({});
    expect(counts?.siteMonth).toEqual({});
    expect(counts?.channelMonth).toEqual({});
  });
});

describe("A15-ERP-04 — dựng bảng cho giám đốc", () => {
  it("con số chính là lượt khách, so kỳ trước bằng lượt khách, tấm vé đi kèm", () => {
    const counts = parseDirectorTicketOverviewRpc(ketQuaVeDoan());
    if (!counts) throw new Error("không đọc được kết quả mẫu");
    const overview = buildDirectorTicketOverview(counts, CONTEXT);

    expect(overview.measure).toBe("entries");
    const [homNay, bayNgay, baMuoiNgay] = overview.windows;
    // Hôm qua 2 lượt, hôm nay 43 lượt. Đếm theo tấm thì 2 so với 2, tưởng đứng yên.
    expect(homNay).toEqual({ label: "Hôm nay", current: 43, previous: 2, changePercent: 2050, tickets: 2 });
    expect(bayNgay).toMatchObject({ current: 48, previous: 0, changePercent: null, tickets: 5 });
    expect(baMuoiNgay).toMatchObject({ current: 60, previous: 30, changePercent: 100, tickets: 9 });

    // Tràng An chỉ 3 tấm vé nhưng 44 lượt: đứng trên Tam Cốc 6 tấm, 16 lượt.
    expect(overview.bySite).toEqual([
      { siteId: "trang-an", shortName: "Tràng An", today: 42, month: 44, todayTickets: 1, monthTickets: 3 },
      { siteId: "tam-coc", shortName: "Tam Cốc", today: 1, month: 16, todayTickets: 1, monthTickets: 6 },
    ]);

    // Tỉ lệ kênh tính trên 60 lượt khách của 30 ngày, không trên 9 tấm vé.
    expect(overview.byChannel).toEqual([
      { channel: "doi-tac", channelLabel: "Đối tác", count: 42, tickets: 1, sharePercent: 70 },
      { channel: "quay-ve", channelLabel: "Quầy vé", count: 18, tickets: 8, sharePercent: 30 },
    ]);

    expect(overview).toMatchObject({
      available: true,
      webRevenue30dVnd: 1_200_000,
      webOrders30d: 3,
      demoSeedTickets30d: 8,
      generatedAt: "2026-09-17T03:00:00.000Z",
    });
  });

  it("lệnh đếm cũ chỉ có tấm vé: con số chính là tấm vé và không có dòng tấm vé phụ", () => {
    const tam = (tickets: number) => ({ tickets, entries: null });
    const counts: DirectorTicketCounts = {
      measure: "tickets",
      windows: {
        today: tam(2),
        yesterday: tam(4),
        week: tam(5),
        week_before: tam(5),
        month: tam(9),
        month_before: tam(0),
      },
      siteToday: { [TRANG_AN]: tam(1), [TAM_COC]: tam(1) },
      siteMonth: { [TRANG_AN]: tam(3), [TAM_COC]: tam(6) },
      channelMonth: { "quay-ve": tam(9), website: tam(0) },
      demoSeedTickets30d: 0,
      demoHistoryEntries30d: 0,
    };
    const overview = buildDirectorTicketOverview(counts, CONTEXT);
    expect(overview.measure).toBe("tickets");
    expect(overview.windows.map((w) => [w.current, w.previous, w.changePercent, w.tickets])).toEqual([
      [2, 4, -50, null],
      [5, 5, 0, null],
      [9, 0, null, null],
    ]);
    expect(overview.bySite.map((s) => [s.siteId, s.month, s.monthTickets])).toEqual([
      ["tam-coc", 6, null],
      ["trang-an", 3, null],
    ]);
    expect(overview.byChannel).toEqual([
      { channel: "quay-ve", channelLabel: "Quầy vé", count: 9, tickets: null, sharePercent: 100 },
    ]);
  });

  it("chưa được phân công cơ sở nào vẫn đủ ba khung, tất cả bằng 0", () => {
    const overview = buildDirectorTicketOverview(emptyDirectorTicketCounts(), { ...CONTEXT, sites: [] });
    expect(overview.measure).toBe("tickets");
    expect(overview.windows.map((w) => w.label)).toEqual(["Hôm nay", "7 ngày", "30 ngày"]);
    expect(overview.windows.every((w) => w.current === 0 && w.changePercent === null)).toBe(true);
    expect(overview.bySite).toEqual([]);
    expect(overview.byChannel).toEqual([]);
  });
});

describe("A15-ERP-04 — khung giờ chỉ tính một nơi rồi truyền vào kho", () => {
  it("gửi đủ sáu khung, khoảng nửa mở nối liền nhau, hôm nay theo ngày Việt Nam", () => {
    const at = new Date("2026-09-17T03:00:00.000Z");
    const payload = directorTicketWindowsForRpc(directorTicketWindows(at));
    expect(payload.map((item) => item.key)).toEqual([...DIRECTOR_TICKET_WINDOW_KEYS]);
    const theoKhoa = Object.fromEntries(payload.map((item) => [item.key, item]));

    expect(theoKhoa.today).toEqual({ key: "today", from: "2026-09-16T17:00:00.000Z", to: "2026-09-17T03:00:00.000Z" });
    expect(theoKhoa.yesterday).toEqual({ key: "yesterday", from: "2026-09-15T17:00:00.000Z", to: "2026-09-16T17:00:00.000Z" });
    expect(theoKhoa.week.to).toBe(at.toISOString());
    expect(theoKhoa.week_before.to).toBe(theoKhoa.week.from);
    expect(theoKhoa.month.from).toBe("2026-08-18T03:00:00.000Z");
    expect(theoKhoa.month_before.to).toBe(theoKhoa.month.from);
  });
});
