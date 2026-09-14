import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpSiteId } from "@/domain/erp";
import {
  summariseProductShares,
  parseTicketSalesRpc,
  summariseTicketPeriods,
  type TicketSalesPeriodStat,
  type TicketSalesProductShare,
} from "@/domain/erp-ticket-sales";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";
import { vietnamDateKey } from "@/lib/erp/workday-repository";

const SCAN_COOKIE = "nbj-erp-demo-gate-scans";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const READ_LIMIT = 8;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type GateScanEvent = {
  id: string;
  siteId: ErpSiteId;
  code: string;
  scannedByName: string;
  scannedAt: string;
};

export type RecordGateScanInput = {
  siteId: ErpSiteId;
  code: string;
  actorId: string;
  actorName: string;
};

/**
 * T8. Until migration 028 the gate had nothing to check against: the scan
 * table held `code text` and no foreign key, so any six characters recorded a
 * visitor and one real ticket scanned ten times recorded ten. These are the
 * outcomes a gate can now reach, and each is logged -- a gate that records
 * only successes cannot answer "how many people were turned away and why",
 * which is the first question after a bad day at the entrance.
 */
export type GateScanResult =
  | "accepted"
  | "not-found"
  | "wrong-site"
  | "wrong-day"
  | "exhausted"
  // TC-06: dung ma cua chinh nguoi nay, dung ve, nhung ho da vao roi. Co y
  // tach khoi "het luot": ve doan van con thua luot trong khi nguoi nay thi
  // khong, va bao nham se day nhan vien di tim mot van de khong ton tai.
  | "already-entered"
  // TC-22: ve that, dung ngay, dung cua, con luot — chi la chua tra tien.
  // Tach hAn khoi "void" va "exhausted": bao nham hai cai do la day nhan
  // vien di tim mot van de khong ton tai.
  | "payment-due"
  | "void"
  | "legacy-uncheckable";

export const GATE_SCAN_RESULT_LABELS: Readonly<Record<GateScanResult, string>> =
  Object.freeze({
    accepted: "Hợp lệ, mời khách vào",
    "not-found": "Không tìm thấy vé",
    "wrong-site": "Vé của cơ sở khác",
    "wrong-day": "Vé không dùng cho hôm nay",
    exhausted: "Vé đã dùng hết lượt",
    "already-entered": "Khách này đã vào rồi",
    "payment-due": "Chưa thu tiền — thu xong mới cho vào",
    void: "Vé đã bị huỷ",
    "legacy-uncheckable": "Lượt quét cũ, chưa đối chiếu được vé",
  });

export type GroupMemberSummary = {
  memberIndex: number;
  guestGroup: "adult" | "child";
  /** Rỗng là bình thường: phần lớn khách không bao giờ tự khai tên. */
  displayName: string;
};

export type TicketSummary = {
  ticketCode: string;
  product: string;
  guestName: string;
  guestPhone: string;
  bookingReference: string;
  channel: string;
  validOn: string;
  entriesAllowed: number;
  entriesUsed: number;
  status: string;
};

export type GateScanDecision = {
  result: GateScanResult;
  code: string;
  scannedAt: string;
  /** True when an idempotency key matched an earlier scan; nobody was admitted twice. */
  replayed: boolean;
  ticket: TicketSummary | null;
  /** TC-06: có giá trị khi mã vừa quét là mã riêng của một người trong đoàn. */
  member: GroupMemberSummary | null;
  /** TC-22: số tiền còn phải thu, chỉ khác 0 khi `result` là `payment-due`. */
  paymentDueVnd: number;
};

export type ValidateGateScanInput = RecordGateScanInput & {
  /** Same key on a retry returns the first outcome instead of admitting again. */
  idempotencyKey?: string;
};

export class GateScanRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GateScanRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new GateScanRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new GateScanRepositoryError(
      "Kho dữ liệu quét QR chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-gate-scan-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new GateScanRepositoryError(
    `Kho dữ liệu quét QR chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

// --- demo-cookie mode -------------------------------------------------

function sign(payload: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function encodeSigned(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSigned<T>(input: string | undefined): T | null {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge,
  };
}

type CookieState = { version: 1; scansBySite: Partial<Record<ErpSiteId, GateScanEvent[]>> };

async function readCookieState(): Promise<CookieState> {
  const store = await cookies();
  const decoded = decodeSigned<CookieState>(store.get(SCAN_COOKIE)?.value);
  if (!decoded || decoded.version !== 1 || typeof decoded.scansBySite !== "object") {
    return { version: 1, scansBySite: {} };
  }
  return decoded;
}

async function writeCookieState(state: CookieState) {
  const store = await cookies();
  store.set(SCAN_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function readCookieScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  const state = await readCookieState();
  return (state.scansBySite[siteId] ?? []).slice(0, READ_LIMIT);
}

async function recordInCookie(input: RecordGateScanInput): Promise<GateScanEvent> {
  const state = await readCookieState();
  const code = input.code.trim().toUpperCase();
  const current = state.scansBySite[input.siteId] ?? [];
  const recent = current.find(
    (item) =>
      item.code === code &&
      Date.now() - new Date(item.scannedAt).getTime() < 2 * 60 * 1000,
  );
  if (recent) return recent;
  const event: GateScanEvent = {
    id: crypto.randomUUID(),
    siteId: input.siteId,
    code,
    scannedByName: input.actorName,
    scannedAt: new Date().toISOString(),
  };
  state.scansBySite[input.siteId] = [event, ...current].slice(0, 40);
  await writeCookieState(state);
  return event;
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

function eventFromRow(row: Record<string, unknown>): GateScanEvent | null {
  const siteId = siteSlugFromUuid(row.site_id);
  if (!siteId) return null;
  return {
    id: row.id as string,
    siteId,
    code: row.code as string,
    scannedByName: row.scanned_by_name as string,
    scannedAt: row.scanned_at as string,
  };
}

function todayBoundsVietnam() {
  const startOfDay = new Date(`${vietnamDateKey()}T00:00:00+07:00`);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

async function countGateScansTodayInCookie(siteId: ErpSiteId): Promise<number> {
  const state = await readCookieState();
  const { startOfDay, endOfDay } = todayBoundsVietnam();
  return (state.scansBySite[siteId] ?? []).filter((event) => {
    const scannedAt = new Date(event.scannedAt).getTime();
    return scannedAt >= startOfDay.getTime() && scannedAt < endOfDay.getTime();
  }).length;
}

async function countGateScansTodayInSupabase(siteId: ErpSiteId): Promise<number> {
  const client = createAdminClient();
  const { startOfDay, endOfDay } = todayBoundsVietnam();
  const result = await client
    .from("erp_gate_scan_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .gte("scanned_at", startOfDay.toISOString())
    .lt("scanned_at", endOfDay.toISOString());
  if (result.error) {
    throw repositoryError("đếm lượt quét QR", result.error);
  }
  return result.count ?? 0;
}

async function readSupabaseScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  const client = createAdminClient();
  const result = await client
    .from("erp_gate_scan_events")
    .select("id, site_id, code, scanned_by_name, scanned_at")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .order("scanned_at", { ascending: false })
    .limit(READ_LIMIT);
  if (result.error) {
    throw repositoryError("đọc nhật ký quét QR", result.error);
  }
  return (result.data ?? [])
    .map(eventFromRow)
    .filter((event): event is GateScanEvent => event !== null);
}

async function recordInSupabase(input: RecordGateScanInput): Promise<GateScanEvent> {
  const client = createAdminClient();
  const result = await client.rpc("erp_record_gate_scan", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_code: input.code,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
  });
  if (result.error) {
    if (/GATE_SCAN_CODE_INVALID/.test(result.error.message)) {
      throw new GateScanRepositoryError("Mã QR không hợp lệ.");
    }
    throw repositoryError("ghi nhận quét QR", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  const event = eventFromRow(row);
  if (!event) {
    throw new GateScanRepositoryError("Cơ sở trong lượt quét QR không hợp lệ.");
  }
  return event;
}

function ticketFromRow(value: unknown): TicketSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    ticketCode: String(row.ticket_code ?? ""),
    product: String(row.product ?? ""),
    guestName: String(row.guest_name ?? ""),
    guestPhone: String(row.guest_phone ?? ""),
    bookingReference: String(row.booking_reference ?? ""),
    channel: String(row.channel ?? ""),
    validOn: String(row.valid_on ?? ""),
    entriesAllowed: Number(row.entries_allowed ?? 0),
    entriesUsed: Number(row.entries_used ?? 0),
    status: String(row.status ?? ""),
  };
}

function memberFromRow(value: unknown): GroupMemberSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const nhom = String(row.guest_group);
  if (nhom !== "adult" && nhom !== "child") return null;
  return {
    memberIndex: Number(row.member_index ?? 0),
    guestGroup: nhom,
    displayName: String(row.display_name ?? ""),
  };
}

async function validateInSupabase(
  input: ValidateGateScanInput,
): Promise<GateScanDecision> {
  const client = createAdminClient();
  const result = await client.rpc("erp_gate_scan_ticket", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_code: input.code,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (result.error) {
    if (/GATE_SCAN_CODE_INVALID/.test(result.error.message ?? "")) {
      throw new GateScanRepositoryError("Mã vé không hợp lệ.");
    }
    throw repositoryError("đối chiếu vé tại cổng", result.error);
  }
  const data = (result.data ?? {}) as Record<string, unknown>;
  return {
    result: String(data.result ?? "not-found") as GateScanResult,
    code: String(data.code ?? input.code).toUpperCase(),
    scannedAt: String(data.scanned_at ?? new Date().toISOString()),
    replayed: Boolean(data.replayed),
    ticket: ticketFromRow(data.ticket),
    member: memberFromRow(data.member),
    paymentDueVnd: Number(data.payment_due_vnd ?? 0),
  };
}

/**
 * Demo-cookie mode has no ticket table. Rather than pretend every code is
 * valid -- which is the behaviour T8 exists to remove -- it accepts only codes
 * shaped like a real one and reports the rest as not found, so the refusal
 * path is reachable in local development too.
 */
async function validateInCookie(
  input: ValidateGateScanInput,
): Promise<GateScanDecision> {
  const event = await recordInCookie(input);
  const looksIssued = /^[A-Z]{2,4}-\d{4}-\d{6}$/.test(event.code);
  return {
    result: looksIssued ? "accepted" : "not-found",
    code: event.code,
    scannedAt: event.scannedAt,
    replayed: false,
    ticket: null,
    member: null,
    // Che do demo cuc bo khong co kho don hang de hoi, nen khong bao gio no tien.
    paymentDueVnd: 0,
  };
}

async function searchTicketsInSupabase(
  siteId: ErpSiteId,
  query: string,
): Promise<TicketSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const client = createAdminClient();
  const digits = trimmed.replace(/[^0-9]/g, "");
  // A guest at the counter has lost their phone, not their identity: code,
  // name or phone all have to find the booking.
  const filters = [
    `ticket_code.ilike.%${trimmed}%`,
    `guest_name.ilike.%${trimmed}%`,
    `booking_reference.ilike.%${trimmed}%`,
  ];
  if (digits.length >= 3) {
    filters.push(`guest_phone_normalized.ilike.%${digits}%`);
  }
  const result = await client
    .from("erp_tickets")
    .select(
      "ticket_code, product, guest_name, guest_phone, booking_reference, channel, valid_on, entries_allowed, entries_used, status",
    )
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .or(filters.join(","))
    .order("valid_on", { ascending: false })
    .limit(10);
  if (result.error) throw repositoryError("tra cứu vé", result.error);
  return (result.data ?? [])
    .map(ticketFromRow)
    .filter((ticket): ticket is TicketSummary => ticket !== null);
}

// --- T13: real ticket sales summary (replaces fabricated revenue) ---------

const PRODUCT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  adult: "Vé người lớn",
  child: "Vé trẻ em",
  combo: "Combo vé + thuyền/xe",
  group: "Vé đoàn",
  guest: "Vé khách mời",
});

const CHANNEL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "quay-ve": "Quầy vé",
  website: "Website",
  "doi-tac": "Đối tác",
  moi: "Khách mời",
});

export type RecentTicketSale = {
  ticketCode: string;
  product: string;
  productLabel: string;
  channel: string;
  channelLabel: string;
  guestName: string;
  status: string;
  issuedAt: string;
  /** Thành tiền của tấm vé bán tại quầy; `null` khi vé không có giá (web theo gói, gieo mẫu). */
  priceVnd?: number | null;
};

export type TicketPeriodStat = TicketSalesPeriodStat;

export type ProductShare = TicketSalesProductShare & {
  productLabel: string;
};

export type TicketSalesSummary = {
  periods: TicketPeriodStat[];
  productShares: ProductShare[];
  recentSales: RecentTicketSale[];
  /**
   * Đọc chạm trần số hàng, tức là danh sách đã bị cắt và mọi con số trên
   * màn hình đang **thấp hơn** thực tế. Màn hình phải nói ra, không được im.
   */
  truncated: boolean;
};

/** Trần số tấm vé kéo về một lần. Chạm trần thì `truncated` bật lên. */
const TICKET_SALES_ROW_LIMIT = 2000;

const EMPTY_TICKET_SALES_SUMMARY: TicketSalesSummary = {
  periods: summariseTicketPeriods([], 0),
  productShares: [],
  recentSales: [],
  truncated: false,
};

/**
 * T13: this used to be a hard-coded VND figure (`baseRevenue * 6.4` etc, one
 * constant per site invented once and never updated) with "+5,2% so với
 * cùng thứ tuần trước" as a literal string, not a computed value. There is
 * no price column on `erp_tickets` yet -- ERP ticket sales have no billed
 * amount recorded anywhere in this system -- so a VND figure here would
 * only trade one fabricated number for a differently-shaped one. What this
 * function reports instead is real: how many tickets were actually issued,
 * counted from `erp_tickets.issued_at`, compared against the immediately
 * preceding window of the same length (rolling, not calendar-aligned --
 * simpler, and just as honest for "so với kỳ liền trước").
 */
async function getTicketSalesSummaryFromSupabase(
  siteId: ErpSiteId,
): Promise<TicketSalesSummary> {
  const client = createAdminClient();
  const since = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const result = await client
    .from("erp_tickets")
    .select("ticket_code, product, channel, guest_name, status, issued_at, entries_allowed")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .gte("issued_at", since)
    .order("issued_at", { ascending: false })
    .limit(TICKET_SALES_ROW_LIMIT);
  if (result.error) throw repositoryError("đọc số vé đã bán", result.error);
  const rows = result.data ?? [];

  const now = Date.now();
  const salesRows = rows.map((row) => ({
    issuedAt: String(row.issued_at),
    entriesAllowed: row.entries_allowed,
    product: String(row.product),
  }));
  const periods = summariseTicketPeriods(salesRows, now);
  const productShares: ProductShare[] = summariseProductShares(salesRows, now).map((share) => ({
    ...share,
    productLabel: PRODUCT_LABELS[share.product] ?? share.product,
  }));

  const recentSales: RecentTicketSale[] = rows.slice(0, 8).map((row) => ({
    ticketCode: String(row.ticket_code),
    product: String(row.product),
    productLabel: PRODUCT_LABELS[String(row.product)] ?? String(row.product),
    channel: String(row.channel),
    channelLabel: CHANNEL_LABELS[String(row.channel)] ?? String(row.channel),
    guestName: String(row.guest_name ?? ""),
    status: String(row.status),
    issuedAt: String(row.issued_at),
  }));

  return {
    periods,
    productShares,
    recentSales,
    truncated: rows.length >= TICKET_SALES_ROW_LIMIT,
  };
}

/**
 * QA-ERP-TICKET-05 — đếm trong kho bằng `erp_ticket_sales_summary`: không còn
 * trần 2.000 tấm vé, có thêm tiền bán tại quầy. Kho chưa có hàm (migration
 * `202609140074` chưa áp) thì lùi về đường đếm cũ, không để màn hình trống.
 */
async function getTicketSalesSummaryFromRpc(siteId: ErpSiteId): Promise<TicketSalesSummary | null> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_ticket_sales_summary", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return null;
    throw repositoryError("đọc số vé đã bán", error);
  }
  const parsed = parseTicketSalesRpc(data);
  if (!parsed) return null;
  return {
    periods: parsed.periods,
    productShares: parsed.productShares.map((share) => ({
      ...share,
      productLabel: PRODUCT_LABELS[share.product] ?? share.product,
    })),
    recentSales: parsed.recent.map((row) => ({
      ticketCode: row.ticketCode,
      product: row.product,
      productLabel: PRODUCT_LABELS[row.product] ?? row.product,
      channel: row.channel,
      channelLabel: CHANNEL_LABELS[row.channel] ?? row.channel,
      guestName: row.guestName,
      status: row.status,
      issuedAt: row.issuedAt,
      priceVnd: row.priceVnd,
    })),
    truncated: false,
  };
}

export async function getTicketSalesSummary(
  siteId: ErpSiteId,
): Promise<TicketSalesSummary> {
  if (readMode() === "supabase") {
    return (await getTicketSalesSummaryFromRpc(siteId)) ?? getTicketSalesSummaryFromSupabase(siteId);
  }
  // Demo-cookie mode has no queryable ticket table -- the caller renders
  // the zero state, which is honest (there is nothing sold to report),
  // rather than a plausible-looking number invented for the occasion.
  return EMPTY_TICKET_SALES_SUMMARY;
}

// --- public API -----------------------------------------------------------

export async function validateGateScan(
  input: ValidateGateScanInput,
): Promise<GateScanDecision> {
  if (readMode() === "supabase") return validateInSupabase(input);
  return validateInCookie(input);
}

/**
 * Vé còn quét được ở cơ sở này, hôm nay.
 *
 * Có hàm này vì một lý do rất cụ thể: chủ dự án mở ERP để thử soát vé và
 * không có gì để quét — production chỉ có 8 vé mẫu, tất cả đã quá hạn bốn
 * tuần. Ô tra cứu thì đòi gõ trước ít nhất ba ký tự, mà không ai biết gõ gì.
 *
 * Danh sách này trả lời đúng câu "giờ tôi quét cái gì".
 */
export async function listScannableTicketsToday(siteId: ErpSiteId): Promise<TicketSummary[]> {
  if (readMode() !== "supabase") return [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const result = await createAdminClient()
    .from("erp_tickets")
    .select(
      "ticket_code, product, guest_name, guest_phone, booking_reference, channel, valid_on, entries_allowed, entries_used, status",
    )
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .eq("valid_on", today)
    .in("status", ["issued", "partially-used"])
    .order("ticket_code")
    .limit(20);
  if (result.error) throw repositoryError("đọc vé còn hiệu lực hôm nay", result.error);
  return (result.data ?? [])
    .map((row) => ticketFromRow(row))
    .flatMap((ticket) => (ticket ? [ticket] : []));
}

/**
 * Kéo 8 vé mẫu về hôm nay để còn thử được cổng.
 *
 * Chỉ chạm đúng những mã có dạng `TA-2026-000101`. Vé bán qua web mang mã
 * `WEB-` cộng 12 ký tự nên không bao giờ khớp — hàng rào nằm ở PostgreSQL,
 * không ở đây.
 */
export async function refreshDemoTickets(actorAccountId: string): Promise<{ validOn: string; ticketCodes: string[] }> {
  const { data, error } = await createAdminClient().rpc("erp_refresh_demo_tickets", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: actorAccountId,
  });
  if (error) throw repositoryError("làm mới vé mẫu", error);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    validOn: String(row.valid_on ?? ""),
    ticketCodes: Array.isArray(row.ticket_codes) ? row.ticket_codes.map(String) : [],
  };
}

export async function searchTickets(
  siteId: ErpSiteId,
  query: string,
): Promise<TicketSummary[]> {
  if (readMode() === "supabase") return searchTicketsInSupabase(siteId, query);
  return [];
}

export async function getRecentGateScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  if (readMode() === "supabase") return readSupabaseScans(siteId);
  return readCookieScans(siteId);
}

export async function countGateScansToday(siteId: ErpSiteId): Promise<number> {
  if (readMode() === "supabase") return countGateScansTodayInSupabase(siteId);
  return countGateScansTodayInCookie(siteId);
}

export async function recordGateScan(input: RecordGateScanInput): Promise<GateScanEvent> {
  if (readMode() === "supabase") return recordInSupabase(input);
  return recordInCookie(input);
}

export type OnSitePaymentCollection = {
  collected: boolean;
  alreadyCollected: boolean;
  amountVnd: number;
  orderCode: string;
  collectedBy: string;
  collectedAt: string;
};

/**
 * TC-22 — nhân viên ở cổng thu tiền cho một tấm vé khách chọn trả tại điểm.
 *
 * Tách hẳn khỏi việc cho khách vào, dù trên màn hình chỉ là một cú chạm: thu
 * tiền là một sự kiện tiền bạc, cho vào là một sự kiện cổng. Ghi chung một
 * dòng thì tới lúc đối soát không ai tách lại được.
 *
 * Quyền dùng lại đúng luật gác cổng đã có (`erp_gate_actor_can_scan`), không
 * dựng luật quyền thứ hai. Bấm hai lần không ghi hai khoản — cơ sở dữ liệu
 * chặn bằng khoá duy nhất, và trả về `alreadyCollected` để màn hình nói thật.
 */
export async function collectOnSitePayment(input: {
  siteId: ErpSiteId;
  code: string;
  actorId: string;
}): Promise<OnSitePaymentCollection> {
  if (readMode() !== "supabase") {
    throw new GateScanRepositoryError(
      "Chế độ chạy thử cục bộ không có kho đơn hàng để thu tiền.",
    );
  }
  const result = await createAdminClient().rpc("erp_collect_on_site_payment", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_code: input.code,
    p_actor_account_id: input.actorId,
    p_occurred_at: new Date().toISOString(),
  });
  if (result.error) throw repositoryError("ghi nhận khoản thu tại cổng", result.error);
  const row = (result.data ?? {}) as Record<string, unknown>;
  return {
    collected: row.collected === true,
    alreadyCollected: row.already_collected === true,
    amountVnd: Number(row.amount_vnd ?? 0),
    orderCode: String(row.order_code ?? ""),
    collectedBy: String(row.collected_by ?? ""),
    collectedAt: String(row.collected_at ?? ""),
  };
}
