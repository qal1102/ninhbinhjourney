import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  DIRECTOR_TICKET_CHANNELS,
  buildDirectorTicketOverview,
  directorTicketWindows,
  directorTicketWindowsForRpc,
  emptyDirectorTicketCounts,
  parseDirectorTicketOverviewRpc,
  type DirectorTicketCounts,
  type DirectorTicketOverview,
  type DirectorTicketWindows,
  type TicketTally,
} from "@/domain/erp-director-ticket-overview";
import type { TicketWindow } from "@/domain/ticket-window";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

export type {
  ChannelTicketCount,
  DirectorTicketOverview,
  SiteTicketCount,
  TicketMeasure,
  TicketWindowCount,
} from "@/domain/erp-director-ticket-overview";

/**
 * ERP-UX-06d — vé đã bán, đọc thẳng từ vé thật, gộp cả bốn cơ sở.
 *
 * Trang chủ giám đốc trước đây chỉ có ô "Vé trong hồ sơ ca": con số đó do
 * người trực **tự khai** trong biểu mẫu chốt ca, và chỉ tính đúng ngày có hồ
 * sơ ca gần nhất. Vé thật thì nằm ở `erp_tickets`, nhưng chỉ xem được sau khi
 * đã đi vào từng cơ sở rồi mở đúng một nghiệp vụ — nên chủ dự án đăng nhập
 * giám đốc, nhìn quanh, và không thấy hôm nay bán được bao nhiêu vé.
 *
 * A15-ERP-04 — đếm **lượt khách** trong kho bằng hàm chỉ đọc
 * `erp_director_ticket_overview` (migration `202609170075`): máy chủ cộng rồi
 * trả về vài con số, không kéo hàng nào về. Kéo hàng về rồi đếm trong
 * JavaScript thì tới ngày đông khách sẽ chạm trần `limit` và **âm thầm báo
 * thiếu**, đúng loại sai mà không ai phát hiện ra.
 *
 * Kho chưa có hàm ấy (migration chưa áp) thì lùi về lệnh đếm cũ
 * `count: "exact", head: true`. Lệnh ấy chỉ đếm được tấm vé, nên kết quả mang
 * `measure: "tickets"` và màn hình giữ nguyên chữ "tấm vé".
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

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

type SiteRef = { siteId: ErpSiteId; shortName: string; uuid: string };

/**
 * Đếm trong kho, cả lượt khách lẫn tấm vé. Trả `null` khi kho chưa có hàm
 * (`42883` / `PGRST202`) hoặc kết quả không đúng hình dạng — khi đó dùng lệnh
 * đếm cũ. Mọi lỗi khác vẫn ném ra: im lặng nuốt lỗi kho dữ liệu là cách để một
 * màn hình sai trông y như một màn hình đúng.
 */
async function readCountsFromRpc(
  client: SupabaseClient,
  sites: readonly SiteRef[],
  windows: DirectorTicketWindows,
): Promise<DirectorTicketCounts | null> {
  const { data, error } = await client.rpc("erp_director_ticket_overview", {
    p_tenant_id: TENANT_ID,
    p_site_ids: sites.map((site) => site.uuid),
    p_windows: directorTicketWindowsForRpc(windows),
  });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return null;
    throw new TicketOverviewError("Không đọc được số vé đã bán.", { cause: error });
  }
  return parseDirectorTicketOverviewRpc(data);
}

/** Lệnh đếm cũ: chỉ đếm được tấm vé. Giữ nguyên để trang chủ không trắng khi kho chưa có hàm. */
async function readTicketCountsByHead(
  client: SupabaseClient,
  sites: readonly SiteRef[],
  windows: DirectorTicketWindows,
): Promise<DirectorTicketCounts> {
  const siteUuids = sites.map((site) => site.uuid);

  /**
   * Cột `data_origin` đã có chưa?
   *
   * Nó đến từ migration `202609060060`, và migration ấy chưa áp được lên
   * production. Nếu mã này cứ lọc theo cột chưa tồn tại thì PostgREST trả
   * `42703` và **cả bảng vé của giám đốc tắt ngóm** — đổi một con số hơi sai
   * lấy một màn hình trắng là lỗ vốn.
   *
   * Nên hỏi trước đúng một câu, rồi mới quyết. Chỉ nuốt đúng mã lỗi "không có
   * cột ấy"; mọi lỗi khác vẫn ném ra như thường, vì im lặng nuốt lỗi kho dữ
   * liệu là cách để một màn hình sai trông y như một màn hình đúng.
   */
  async function hasDataOriginColumn() {
    const { error } = await client
      .from("erp_tickets")
      .select("data_origin", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID);
    if (!error) return true;
    if (error.code === "42703") return false;
    throw new TicketOverviewError("Không đọc được số vé đã bán.", { cause: error });
  }

  const originReady = await hasDataOriginColumn();

  /**
   * `origin` mặc định là `"real"`: mọi con số giám đốc đọc đều **loại vé gieo
   * mẫu ra**. Truyền `"demo-seed"` chỉ để đếm riêng phần mẫu mà nói cho họ
   * biết, chứ không bao giờ cộng vào.
   */
  async function countTickets(
    range: TicketWindow,
    filter?: { siteUuid?: string; channel?: string; origin?: "real" | "demo-seed" },
  ) {
    // Chưa có cột thì không tách được mẫu với thật. Trả 0 cho câu đếm phần
    // mẫu, để màn hình im lặng bỏ dòng chú thích đi thay vì khai một con số
    // nó không biết.
    if (!originReady && filter?.origin === "demo-seed") return 0;

    let query = client
      .from("erp_tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .gte("issued_at", range.from.toISOString())
      .lt("issued_at", range.to.toISOString());
    if (originReady) query = query.eq("data_origin", filter?.origin ?? "real");
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

  const tam = (tickets: number): TicketTally => ({ tickets, entries: null });
  const theoKhoa = (keys: readonly string[], values: readonly number[]) =>
    Object.fromEntries(keys.map((key, index) => [key, tam(values[index] ?? 0)]));

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
    demoSeedTickets30d,
  ] = await Promise.all([
    countTickets(windows.today),
    countTickets(windows.yesterday),
    countTickets(windows.week),
    countTickets(windows.week_before),
    countTickets(windows.month),
    countTickets(windows.month_before),
    Promise.all(sites.map((site) => countTickets(windows.today, { siteUuid: site.uuid }))),
    Promise.all(sites.map((site) => countTickets(windows.month, { siteUuid: site.uuid }))),
    Promise.all(DIRECTOR_TICKET_CHANNELS.map((channel) => countTickets(windows.month, { channel }))),
    countTickets(windows.month, { origin: "demo-seed" }),
  ]);

  return {
    measure: "tickets",
    windows: {
      today: tam(todayCount),
      yesterday: tam(yesterdayCount),
      week: tam(weekCount),
      week_before: tam(weekBeforeCount),
      month: tam(monthCount),
      month_before: tam(monthBeforeCount),
    },
    siteToday: theoKhoa(siteUuids, siteTodayCounts),
    siteMonth: theoKhoa(siteUuids, siteMonthCounts),
    channelMonth: theoKhoa(DIRECTOR_TICKET_CHANNELS, channelCounts),
    demoSeedTickets30d,
  };
}

export async function getDirectorTicketOverview(
  siteIds: readonly ErpSiteId[],
): Promise<DirectorTicketOverview> {
  const generatedAt = new Date().toISOString();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase") {
    return {
      available: false,
      measure: "tickets",
      windows: [],
      bySite: [],
      byChannel: [],
      webRevenue30dVnd: 0,
      webOrders30d: 0,
      demoSeedTickets30d: 0,
      generatedAt,
    };
  }

  const sites: SiteRef[] = siteIds.map((siteId) => ({
    siteId,
    shortName: ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId,
    uuid: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  }));
  if (sites.length === 0) {
    return buildDirectorTicketOverview(emptyDirectorTicketCounts(), {
      sites,
      webRevenue30dVnd: 0,
      webOrders30d: 0,
      generatedAt,
    });
  }

  const client = createAdminClient();
  // Một mốc "bây giờ" duy nhất cho mọi khung đếm và cho tiền đơn web. Gọi
  // `new Date()` nhiều lần thì các cửa sổ lệch nhau vài mili giây, và một tấm
  // vé phát hành đúng lúc ấy có thể lọt vào hai cửa sổ hoặc rơi ra ngoài cả hai.
  const windows = directorTicketWindows(new Date());

  const [counts, webOrders] = await Promise.all([
    readCountsFromRpc(client, sites, windows).then(
      (fromRpc) => fromRpc ?? readTicketCountsByHead(client, sites, windows),
    ),
    readWebOrders(client, windows.month),
  ]);

  return buildDirectorTicketOverview(counts, {
    sites,
    webRevenue30dVnd: webOrders.revenueVnd,
    webOrders30d: webOrders.orderCount,
    generatedAt,
  });
}
