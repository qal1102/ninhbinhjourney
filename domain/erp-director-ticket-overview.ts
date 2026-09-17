import type { ErpSiteId } from "@/domain/erp";
import {
  changePercent,
  rollingWindow,
  vietnamTodayWindow,
  vietnamYesterdayWindow,
  type TicketWindow,
} from "@/domain/ticket-window";

/**
 * A15-ERP-04 — bảng vé ở trang chủ giám đốc.
 *
 * Bảng cũ đếm bằng `count: "exact", head: true` nên chỉ ra được **số tấm vé**:
 * vé đoàn 42 người tính là 1. Nay kho cộng lượt khách bằng hàm chỉ đọc
 * `erp_director_ticket_overview` (migration `202609170075`), cùng phép đếm với
 * màn hình Vé từng cơ sở: mỗi tấm vé tính `entries_allowed` lượt (tối thiểu 1),
 * vé đã huỷ không tính.
 *
 * Kho chưa có hàm ấy thì kho lùi về lệnh đếm cũ, và khi đó chỉ có tấm vé.
 * `measure` ghi rõ con số chính là loại nào, để màn hình không bao giờ gọi số
 * tấm vé là lượt khách.
 *
 * Mọi thứ ở đây thuần tuý (không đọc kho), để kiểm thử được.
 */

export type TicketMeasure = "entries" | "tickets";

export type TicketWindowCount = {
  label: string;
  /** Con số chính: lượt khách khi `measure` là `"entries"`, tấm vé khi là `"tickets"`. */
  current: number;
  previous: number;
  /** null khi kỳ trước bằng 0 — chia cho không thì phần trăm không có nghĩa. */
  changePercent: number | null;
  /** Số tấm vé trong kỳ. Chỉ có khi con số chính là lượt khách; null ở lệnh đếm cũ. */
  tickets: number | null;
};

export type SiteTicketCount = {
  siteId: ErpSiteId;
  shortName: string;
  today: number;
  month: number;
  todayTickets: number | null;
  monthTickets: number | null;
};

export type ChannelTicketCount = {
  channel: string;
  channelLabel: string;
  count: number;
  tickets: number | null;
  /** Tính trên con số chính (lượt khách khi có). */
  sharePercent: number;
};

export type DirectorTicketOverview = {
  /** false khi chạy chế độ demo cục bộ: không có bảng vé nào để hỏi. */
  available: boolean;
  /** Con số chính trên cả bảng là lượt khách hay tấm vé. */
  measure: TicketMeasure;
  windows: TicketWindowCount[];
  bySite: SiteTicketCount[];
  byChannel: ChannelTicketCount[];
  /** Doanh thu thật, chỉ của đơn đặt qua web đã xác nhận. Vé bán tại quầy chưa lưu giá ở đâu cả. */
  webRevenue30dVnd: number;
  webOrders30d: number;
  /**
   * Vé gieo mẫu trong ba mươi ngày, đã bị loại khỏi mọi con số phía trên.
   *
   * Không giấu đi: giám đốc mở màn hình thấy 0 vé mà kho lại có 8 tấm thì
   * chính sự vênh ấy làm người ta nghi màn hình hỏng. Nói thẳng có bao nhiêu
   * tấm mẫu và chúng không được tính, thì con số 0 kia mới đọc được.
   */
  demoSeedTickets30d: number;
  generatedAt: string;
};

export const DIRECTOR_TICKET_CHANNEL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "quay-ve": "Quầy vé",
  website: "Website",
  "doi-tac": "Đối tác",
  moi: "Khách mời",
});

export const DIRECTOR_TICKET_CHANNELS: readonly string[] = Object.keys(DIRECTOR_TICKET_CHANNEL_LABELS);

export const DIRECTOR_TICKET_WINDOW_KEYS = [
  "today",
  "yesterday",
  "week",
  "week_before",
  "month",
  "month_before",
] as const;

export type DirectorTicketWindowKey = (typeof DIRECTOR_TICKET_WINDOW_KEYS)[number];

export type DirectorTicketWindows = Readonly<Record<DirectorTicketWindowKey, TicketWindow>>;

/**
 * Sáu khung đếm, tính từ **một** mốc "bây giờ". Khung giờ chỉ tính ở đây rồi
 * truyền nguyên vào kho: viết lại phép tính ngày Việt Nam bằng SQL là thành
 * hai nơi cùng tính một mốc, lệch nhau lúc nào không ai hay.
 */
export function directorTicketWindows(at: Date): DirectorTicketWindows {
  return {
    today: vietnamTodayWindow(at),
    yesterday: vietnamYesterdayWindow(at),
    week: rollingWindow(at, 7),
    week_before: rollingWindow(at, 7, 1),
    month: rollingWindow(at, 30),
    month_before: rollingWindow(at, 30, 1),
  };
}

/** Tham số `p_windows` của `erp_director_ticket_overview`: khoảng nửa mở `[from, to)`. */
export function directorTicketWindowsForRpc(
  windows: DirectorTicketWindows,
): Array<{ key: DirectorTicketWindowKey; from: string; to: string }> {
  return DIRECTOR_TICKET_WINDOW_KEYS.map((key) => ({
    key,
    from: windows[key].from.toISOString(),
    to: windows[key].to.toISOString(),
  }));
}

/** Một phép đếm. `entries` là null khi chỉ đếm được tấm vé (lệnh đếm cũ). */
export type TicketTally = { tickets: number; entries: number | null };

export type DirectorTicketCounts = {
  measure: TicketMeasure;
  windows: Record<DirectorTicketWindowKey, TicketTally>;
  /** Theo mã uuid cơ sở trong kho. Cơ sở không có vé thì không có mặt ở đây. */
  siteToday: Record<string, TicketTally>;
  siteMonth: Record<string, TicketTally>;
  /** Theo kênh bán, khung 30 ngày. */
  channelMonth: Record<string, TicketTally>;
  demoSeedTickets30d: number;
};

/** Số đếm từ kho: hỏng, âm hay không phải số thì là 0. */
function soDem(value: unknown): number {
  if (value === null || value === undefined || typeof value === "boolean") return 0;
  const so = Number(value);
  if (!Number.isFinite(so) || so < 0) return 0;
  return Math.trunc(so);
}

/**
 * Tấm vé nào cũng cho ít nhất một người vào, nên lượt khách không bao giờ ít
 * hơn số tấm vé. Kho trả thiếu `entry_count` thì thà báo bằng số tấm vé còn
 * hơn báo "0 lượt khách" cạnh "5 tấm vé".
 */
function dem(item: Record<string, unknown>): { tickets: number; entries: number } {
  const tickets = soDem(item.ticket_count);
  return { tickets, entries: Math.max(soDem(item.entry_count), tickets) };
}

function laDoiTuong(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cong(bang: Record<string, TicketTally>, khoa: string, them: { tickets: number; entries: number }) {
  const hienCo = bang[khoa] ?? { tickets: 0, entries: 0 };
  bang[khoa] = { tickets: hienCo.tickets + them.tickets, entries: (hienCo.entries ?? 0) + them.entries };
}

/**
 * Đọc kết quả `erp_director_ticket_overview`.
 *
 * Trả `null` — để kho lùi về lệnh đếm cũ — khi kết quả không đúng hình dạng,
 * hoặc thiếu một trong sáu khung đã hỏi: thiếu khung nghĩa là hàm trong kho
 * không khớp với mã này, và bịa số 0 cho khung ấy thì tệ hơn đếm tấm vé.
 * Từng dòng cơ sở hay kênh bán hỏng thì bỏ qua; số hỏng tính 0.
 */
export function parseDirectorTicketOverviewRpc(value: unknown): DirectorTicketCounts | null {
  if (!laDoiTuong(value) || !Array.isArray(value.windows)) return null;
  const cacKhung = value.windows.filter(laDoiTuong);

  const windows = {} as Record<DirectorTicketWindowKey, TicketTally>;
  let demoSeedTickets30d = 0;
  for (const key of DIRECTOR_TICKET_WINDOW_KEYS) {
    const found = cacKhung.find((item) => item.key === key);
    if (!found) return null;
    windows[key] = dem(found);
    if (key === "month") demoSeedTickets30d = soDem(found.demo_seed_ticket_count);
  }

  const siteToday: Record<string, TicketTally> = {};
  const siteMonth: Record<string, TicketTally> = {};
  for (const item of Array.isArray(value.by_site) ? value.by_site : []) {
    if (!laDoiTuong(item) || typeof item.site_id !== "string" || !item.site_id) continue;
    if (item.key === "today") cong(siteToday, item.site_id, dem(item));
    if (item.key === "month") cong(siteMonth, item.site_id, dem(item));
  }

  const channelMonth: Record<string, TicketTally> = {};
  for (const item of Array.isArray(value.by_channel) ? value.by_channel : []) {
    if (!laDoiTuong(item) || typeof item.channel !== "string" || !item.channel) continue;
    if (item.key === "month") cong(channelMonth, item.channel, dem(item));
  }

  return { measure: "entries", windows, siteToday, siteMonth, channelMonth, demoSeedTickets30d };
}

/**
 * Chưa được phân công cơ sở nào thì không có gì để hỏi kho: mọi khung bằng 0,
 * đếm theo tấm vé. Vẫn đủ ba khung, vì màn hình đọc thẳng ba khung ấy.
 */
export function emptyDirectorTicketCounts(): DirectorTicketCounts {
  const windows = Object.fromEntries(
    DIRECTOR_TICKET_WINDOW_KEYS.map((key) => [key, { tickets: 0, entries: null }]),
  ) as Record<DirectorTicketWindowKey, TicketTally>;
  return { measure: "tickets", windows, siteToday: {}, siteMonth: {}, channelMonth: {}, demoSeedTickets30d: 0 };
}

export function buildDirectorTicketOverview(
  counts: DirectorTicketCounts,
  context: {
    sites: ReadonlyArray<{ siteId: ErpSiteId; shortName: string; uuid: string }>;
    webRevenue30dVnd: number;
    webOrders30d: number;
    generatedAt: string;
  },
): DirectorTicketOverview {
  const theoLuot = counts.measure === "entries";
  const chinh = (tally: TicketTally | undefined) =>
    theoLuot ? (tally?.entries ?? tally?.tickets ?? 0) : (tally?.tickets ?? 0);
  const phu = (tally: TicketTally | undefined) => (theoLuot ? (tally?.tickets ?? 0) : null);

  const cap = (label: string, key: DirectorTicketWindowKey, previousKey: DirectorTicketWindowKey) => {
    const current = chinh(counts.windows[key]);
    const previous = chinh(counts.windows[previousKey]);
    return {
      label,
      current,
      previous,
      changePercent: changePercent(current, previous),
      tickets: phu(counts.windows[key]),
    };
  };

  const windows: TicketWindowCount[] = [
    cap("Hôm nay", "today", "yesterday"),
    cap("7 ngày", "week", "week_before"),
    cap("30 ngày", "month", "month_before"),
  ];

  const bySite: SiteTicketCount[] = context.sites
    .map(({ siteId, shortName, uuid }) => ({
      siteId,
      shortName,
      today: chinh(counts.siteToday[uuid]),
      month: chinh(counts.siteMonth[uuid]),
      todayTickets: phu(counts.siteToday[uuid]),
      monthTickets: phu(counts.siteMonth[uuid]),
    }))
    .sort((a, b) => b.month - a.month);

  const tongThang = chinh(counts.windows.month);
  const byChannel: ChannelTicketCount[] = DIRECTOR_TICKET_CHANNELS.map((channel) => {
    const count = chinh(counts.channelMonth[channel]);
    return {
      channel,
      channelLabel: DIRECTOR_TICKET_CHANNEL_LABELS[channel] ?? channel,
      count,
      tickets: phu(counts.channelMonth[channel]),
      sharePercent: tongThang === 0 ? 0 : Math.round((count / tongThang) * 1000) / 10,
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    available: true,
    measure: counts.measure,
    windows,
    bySite,
    byChannel,
    webRevenue30dVnd: context.webRevenue30dVnd,
    webOrders30d: context.webOrders30d,
    demoSeedTickets30d: counts.demoSeedTickets30d,
    generatedAt: context.generatedAt,
  };
}
