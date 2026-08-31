import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  changePercent,
  rollingWindow,
  vietnamTodayWindow,
  vietnamYesterdayWindow,
  type TicketWindow,
} from "@/domain/ticket-window";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * ERP-UX-06d — vé đã bán, đọc thẳng từ vé thật, gộp cả bốn cơ sở.
 *
 * Trang chủ giám đốc trước đây chỉ có ô "Vé trong hồ sơ ca": con số đó do
 * người trực **tự khai** trong biểu mẫu chốt ca, và chỉ tính đúng ngày có hồ
 * sơ ca gần nhất. Vé thật thì nằm ở `erp_tickets`, nhưng chỉ xem được sau khi
 * đã đi vào từng cơ sở rồi mở đúng một nghiệp vụ — nên chủ dự án đăng nhập
 * giám đốc, nhìn quanh, và không thấy hôm nay bán được bao nhiêu vé.
 *
 * Ở đây đếm bằng `count: "exact", head: true`: máy chủ đếm rồi trả về một con
 * số, không kéo hàng nào về. Cách này đúng ở mọi khối lượng — kéo hàng về rồi
 * đếm trong JavaScript thì tới ngày đông khách sẽ chạm trần `limit` và **âm
 * thầm báo thiếu**, đúng loại sai mà không ai phát hiện ra.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const CHANNEL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "quay-ve": "Quầy vé",
  website: "Website",
  "doi-tac": "Đối tác",
  moi: "Khách mời",
});

const CHANNELS = Object.keys(CHANNEL_LABELS);

export type TicketWindowCount = {
  label: string;
  current: number;
  previous: number;
  /** null khi kỳ trước bằng 0 — chia cho không thì phần trăm không có nghĩa. */
  changePercent: number | null;
};

export type SiteTicketCount = {
  siteId: ErpSiteId;
  shortName: string;
  today: number;
  month: number;
};

export type ChannelTicketCount = {
  channel: string;
  channelLabel: string;
  count: number;
  sharePercent: number;
};

export type DirectorTicketOverview = {
  /** false khi chạy chế độ demo cục bộ: không có bảng vé nào để hỏi. */
  available: boolean;
  windows: TicketWindowCount[];
  bySite: SiteTicketCount[];
  byChannel: ChannelTicketCount[];
  /** Doanh thu thật, chỉ của đơn đặt qua web đã xác nhận. Vé bán tại quầy chưa lưu giá ở đâu cả. */
  webRevenue30dVnd: number;
  webOrders30d: number;
  generatedAt: string;
};

export class TicketOverviewError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TicketOverviewError";
  }
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new TicketOverviewError("Kho vé chưa được cấu hình đủ ở phía máy chủ.");
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-ticket-overview" } },
  });
}


/**
 * Doanh thu ở đây **chỉ** là đơn đặt qua web đã xác nhận, và nhãn trên màn
 * hình phải nói đúng như vậy. `erp_tickets` không có cột giá, nên một con số
 * "doanh thu vé" gộp cả quầy lẫn web sẽ là con số bịa.
 */
async function readWebOrders(client: SupabaseClient, range: TicketWindow) {
  const { data, error } = await client
    .from("customer_orders")
    .select("total_vnd")
    .eq("tenant_id", TENANT_ID)
    .eq("status", "confirmed")
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .limit(10000);
  if (error) {
    throw new TicketOverviewError("Không đọc được đơn đặt qua web.", { cause: error });
  }
  const rows = data ?? [];
  return {
    orderCount: rows.length,
    revenueVnd: rows.reduce((total, row) => total + Number(row.total_vnd ?? 0), 0),
  };
}

export async function getDirectorTicketOverview(
  siteIds: readonly ErpSiteId[],
): Promise<DirectorTicketOverview> {
  const generatedAt = new Date().toISOString();
  const empty: DirectorTicketOverview = {
    available: false,
    windows: [],
    bySite: [],
    byChannel: [],
    webRevenue30dVnd: 0,
    webOrders30d: 0,
    generatedAt,
  };
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase") return empty;
  if (siteIds.length === 0) return { ...empty, available: true };

  const client = createAdminClient();
  const siteUuids = siteIds.map((id) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[id]);

  async function countTickets(
    range: TicketWindow,
    filter?: { siteUuid?: string; channel?: string },
  ) {
    let query = client
      .from("erp_tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .gte("issued_at", range.from.toISOString())
      .lt("issued_at", range.to.toISOString());
    query = filter?.siteUuid
      ? query.eq("site_id", filter.siteUuid)
      : query.in("site_id", siteUuids);
    if (filter?.channel) query = query.eq("channel", filter.channel);
    const { count, error } = await query;
    if (error) {
      throw new TicketOverviewError("Không đọc được số vé đã bán.", { cause: error });
    }
    return count ?? 0;
  }

  // Một mốc "bây giờ" duy nhất cho cả mười lăm câu đếm. Gọi `new Date()`
  // nhiều lần thì các cửa sổ lệch nhau vài mili giây, và một tấm vé phát
  // hành đúng lúc ấy có thể lọt vào hai cửa sổ hoặc rơi ra ngoài cả hai.
  const at = new Date();
  const today = vietnamTodayWindow(at);
  const yesterday = vietnamYesterdayWindow(at);
  const week = rollingWindow(at, 7);
  const weekBefore = rollingWindow(at, 7, 1);
  const month = rollingWindow(at, 30);
  const monthBefore = rollingWindow(at, 30, 1);

  const [
    todayCount,
    yesterdayCount,
    weekCount,
    weekBeforeCount,
    monthCount,
    monthBeforeCount,
    siteTodayCounts,
    siteMonthCounts,
    channelCounts,
    webOrders,
  ] = await Promise.all([
    countTickets(today),
    countTickets(yesterday),
    countTickets(week),
    countTickets(weekBefore),
    countTickets(month),
    countTickets(monthBefore),
    Promise.all(
      siteIds.map((id) =>
        countTickets(today, { siteUuid: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[id] }),
      ),
    ),
    Promise.all(
      siteIds.map((id) =>
        countTickets(month, { siteUuid: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[id] }),
      ),
    ),
    Promise.all(CHANNELS.map((channel) => countTickets(month, { channel }))),
    readWebOrders(client, month),
  ]);

  const windows: TicketWindowCount[] = [
    {
      label: "Hôm nay",
      current: todayCount,
      previous: yesterdayCount,
      changePercent: changePercent(todayCount, yesterdayCount),
    },
    {
      label: "7 ngày",
      current: weekCount,
      previous: weekBeforeCount,
      changePercent: changePercent(weekCount, weekBeforeCount),
    },
    {
      label: "30 ngày",
      current: monthCount,
      previous: monthBeforeCount,
      changePercent: changePercent(monthCount, monthBeforeCount),
    },
  ];

  const bySite: SiteTicketCount[] = siteIds
    .map((siteId, index) => ({
      siteId,
      shortName: ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId,
      today: siteTodayCounts[index] ?? 0,
      month: siteMonthCounts[index] ?? 0,
    }))
    .sort((a, b) => b.month - a.month);

  const byChannel: ChannelTicketCount[] = CHANNELS.map((channel, index) => ({
    channel,
    channelLabel: CHANNEL_LABELS[channel] ?? channel,
    count: channelCounts[index] ?? 0,
    sharePercent:
      monthCount === 0
        ? 0
        : Math.round(((channelCounts[index] ?? 0) / monthCount) * 1000) / 10,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    available: true,
    windows,
    bySite,
    byChannel,
    webRevenue30dVnd: webOrders.revenueVnd,
    webOrders30d: webOrders.orderCount,
    generatedAt,
  };
}
