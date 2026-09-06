import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerBookingSlot,
  CustomerBookingTicket,
  CustomerProductSlotRow,
  CustomerTicketLookupResult,
  CustomerTicketLookupTicket,
} from "@/domain/customer-booking";
import { PACKAGES } from "@/content/packages";
import {
  CustomerIdentityRepositoryError,
  protectCustomerContact,
} from "@/lib/customer-data/identity-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CustomerBookingRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "INPUT_INVALID"
      | "PROFILE_NOT_FOUND"
      | "PRODUCT_UNAVAILABLE"
      | "CAPACITY_SOURCE_MISSING"
      | "CAPACITY_UNAVAILABLE"
      | "SLOT_PAUSED"
      | "SLOT_PAST"
      | "SLOT_NOT_OFFERED"
      | "PARTY_MIX_INVALID"
      | "HOLD_NOT_FOUND"
      | "HOLD_EXPIRED"
      | "OWNERSHIP_REQUIRED"
      | "ID_COLLISION"
      | "CONTACT_REQUIRED"
      | "UNPAID_LIMIT"
      | "ORDER_CONFIRMED"
      | "RATE_LIMITED"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomerBookingRepositoryError";
  }
}

export function isCustomerBookingEnabled() {
  return process.env.CUSTOMER_BOOKING_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CustomerBookingRepositoryError(
      "Kho đặt chỗ chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-customer-booking-server" } },
  });
}

function mapRepositoryError(error: unknown): CustomerBookingRepositoryError {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  const mappings: Array<[
    string,
    CustomerBookingRepositoryError["code"],
    string,
  ]> = [
    ["CUSTOMER_BOOKING_INPUT_INVALID", "INPUT_INVALID", "Thông tin ngày đi hoặc số khách chưa hợp lệ."],
    ["CUSTOMER_PAYMENT_INPUT_INVALID", "INPUT_INVALID", "Yêu cầu xác nhận đặt chỗ chưa hợp lệ."],
    ["CUSTOMER_PROFILE_NOT_FOUND", "PROFILE_NOT_FOUND", "Phiên khách chưa có hồ sơ ẩn danh hợp lệ."],
    ["CUSTOMER_PRODUCT_UNAVAILABLE", "PRODUCT_UNAVAILABLE", "Gói này hiện chưa mở giữ chỗ."],
    ["CUSTOMER_CAPACITY_SOURCE_MISSING", "CAPACITY_SOURCE_MISSING", "Gói này chưa có nguồn sức chứa T11a cho khung bán."],
    ["CUSTOMER_CAPACITY_UNAVAILABLE", "CAPACITY_UNAVAILABLE", "Khung giờ vừa hết chỗ cho số khách đã chọn."],
    ["CUSTOMER_BOOKING_SLOT_PAUSED", "SLOT_PAUSED", "Khung giờ đang tạm dừng nhận đặt chỗ."],
    ["CUSTOMER_BOOKING_SLOT_PAST", "SLOT_PAST", "Khung giờ này đã qua hoặc quá gần giờ bắt đầu."],
    ["CUSTOMER_BOOKING_SLOT_NOT_OFFERED", "SLOT_NOT_OFFERED", "Khung giờ này không nằm trong lịch bán của gói."],
    ["CUSTOMER_BOOKING_PARTY_MIX_INVALID", "PARTY_MIX_INVALID", "Số người lớn cộng số trẻ em phải đúng bằng tổng số khách, và phải có ít nhất một người lớn."],
    ["CUSTOMER_BOOKING_HOLD_NOT_FOUND", "HOLD_NOT_FOUND", "Không tìm thấy lượt giữ chỗ này."],
    ["CUSTOMER_BOOKING_HOLD_EXPIRED", "HOLD_EXPIRED", "Lượt giữ chỗ đã hết hạn; hãy giữ lại khung giờ mới."],
    ["CUSTOMER_BOOKING_OWNERSHIP_REQUIRED", "OWNERSHIP_REQUIRED", "Lượt giữ chỗ không thuộc phiên khách hiện tại."],
    ["CUSTOMER_BOOKING_ID_COLLISION", "ID_COLLISION", "Mã giữ chỗ đã được dùng cho một yêu cầu khác."],
    ["CUSTOMER_PAYMENT_ID_COLLISION", "ID_COLLISION", "Mã xác nhận đã được dùng cho một thanh toán mô phỏng khác."],
    ["CUSTOMER_ORDER_ALREADY_CONFIRMED", "ORDER_CONFIRMED", "Đơn này đã được xác nhận bằng một yêu cầu khác."],
    ["CUSTOMER_ORDER_STATE_INVALID", "ORDER_CONFIRMED", "Đơn không còn ở trạng thái có thể xác nhận."],
    ["CUSTOMER_BOOKING_RATE_LIMITED", "RATE_LIMITED", "Đã tạo quá nhiều lượt giữ chỗ trong một giờ."],
    ["CUSTOMER_PAYMENT_MODE_INVALID", "INPUT_INVALID", "Cách trả tiền gửi lên chưa hợp lệ."],
    ["CUSTOMER_PAYMENT_CONTACT_REQUIRED", "CONTACT_REQUIRED", "Chọn trả tiền tại điểm thì cần để lại số điện thoại hoặc email, để đội ngũ liên lạc được khi có việc."],
    ["CUSTOMER_PAYMENT_UNPAID_LIMIT", "UNPAID_LIMIT", "Số điện thoại này đang có ba chỗ giữ chưa trả tiền. Bạn đi một chuyến rồi đặt tiếp giúp em ạ."],
    ["CUSTOMER_LOOKUP_INPUT_INVALID", "INPUT_INVALID", "Mã đặt chỗ hoặc liên hệ gõ chưa đúng khuôn ạ."],
  ];
  for (const [needle, code, safeMessage] of mappings) {
    if (message.includes(needle)) {
      return new CustomerBookingRepositoryError(safeMessage, code);
    }
  }
  return new CustomerBookingRepositoryError(
    "Kho đặt chỗ tạm thời chưa xử lý được yêu cầu.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

function slotsFromRow(value: unknown): CustomerBookingSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const source = String(row.capacity_source);
    if (source !== "estimate" && source !== "customer" && source !== "measured") return [];
    return [{
      slotId: String(row.slot_id),
      siteId: String(row.site_id),
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      capacitySource: source,
      thresholdVersion: Number(row.threshold_version),
    }];
  });
}

function slotRowsFromRpc(value: unknown): CustomerProductSlotRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const source = String(row.capacity_source_kind);
    const status = String(row.slot_status);
    if (source !== "estimate" && source !== "customer" && source !== "measured") return [];
    if (status !== "open" && status !== "paused") return [];
    return [{
      siteId: String(row.site_id),
      departureStartsAt: String(row.departure_starts_at),
      localStartTime: String(row.local_start_time),
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      effectiveCapacity: Number(row.effective_capacity),
      reserved: Number(row.reserved),
      remaining: Number(row.remaining),
      capacitySourceKind: source,
      slotStatus: status,
    }];
  });
}

function guestGroupFrom(value: unknown): CustomerBookingTicket["guestGroup"] {
  const raw = String(value);
  return raw === "adult" || raw === "child" ? raw : "group";
}

function ticketsFromRow(value: unknown): CustomerBookingTicket[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{
      ticketId: String(row.ticket_id),
      ticketCode: String(row.ticket_code),
      siteId: String(row.site_id),
      validOn: String(row.valid_on),
      entriesAllowed: Number(row.entries_allowed),
      guestGroup: guestGroupFrom(row.guest_group),
      status: String(row.status) as CustomerBookingTicket["status"],
    }];
  });
}

/**
 * TC-02 — danh sách khung giờ của một sản phẩm trong một ngày, kèm số chỗ còn
 * lại. Chỉ đọc: gọi bao nhiêu lần cũng không tạo hay khoá một hàng nào.
 */
export async function listCustomerProductSlots(input: {
  productId: string;
  visitDate: string;
}): Promise<CustomerProductSlotRow[]> {
  const { data, error } = await createAdminClient().rpc("customer_list_product_slots", {
    p_tenant_id: TENANT_ID,
    p_product_id: input.productId,
    p_visit_date: input.visitDate,
  });
  if (error) throw mapRepositoryError(error);
  return slotRowsFromRpc(data);
}

export async function createCustomerBookingHold(input: {
  requestId: string;
  anonymousId: string;
  productId: string;
  visitDate: string;
  partySize: number;
  // TC-03 — bỏ trống thì máy chủ tính mọi khách là người lớn, đúng như trước.
  adults?: number;
  children?: number;
  slotStartsAt: string;
}) {
  const { data, error } = await createAdminClient().rpc("customer_create_booking_hold", {
    p_tenant_id: TENANT_ID,
    p_request_id: input.requestId,
    p_anonymous_id: input.anonymousId,
    p_product_id: input.productId,
    p_visit_date: input.visitDate,
    p_party_size: input.partySize,
    p_occurred_at: new Date().toISOString(),
    p_slot_starts_at: input.slotStartsAt,
    p_adults: input.adults ?? null,
    p_children: input.children ?? null,
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);
  return {
    orderId: String(row.order_id),
    orderCode: String(row.order_code),
    holdId: String(row.hold_id),
    holdStatus: String(row.hold_status) as "active" | "converted" | "expired" | "cancelled",
    expiresAt: String(row.expires_at),
    totalVnd: Number(row.total_vnd),
    currency: String(row.currency) as "VND",
    slots: slotsFromRow(row.slots),
    duplicate: row.inserted !== true,
  };
}

/**
 * TC-22 — hai lối trả tiền, một đường mã.
 *
 * `simulation` giữ nguyên hành vi cũ từng chữ: xác nhận ngay, không nợ đồng
 * nào. `pay-on-site` giữ chỗ và phát vé, nhưng ghi lại một khoản chờ thu; cổng
 * sẽ chặn cho tới khi nhân viên thu đủ.
 *
 * Số điện thoại hoặc email **không đi ra khỏi máy chủ dưới dạng thô**:
 * `protectCustomerContact` băm và mã hoá tại đây, cơ sở dữ liệu chỉ nhận bản
 * đã bảo vệ. Chính vì vậy chỗ này không nhận `contact` cho lối mô phỏng — thu
 * một dữ liệu cá nhân không dùng tới là một khoản nợ, không phải một tính năng.
 */
export async function confirmCustomerBooking(input: {
  paymentRequestId: string;
  holdId: string;
  anonymousId: string;
  paymentMode: "simulation" | "pay-on-site";
  /** Bắt buộc khi `paymentMode` là `pay-on-site`; bỏ qua ở lối mô phỏng. */
  contact?: string;
}) {
  const protectedContact =
    input.paymentMode === "pay-on-site" && input.contact
      ? protectCustomerContact(input.contact)
      : null;
  if (input.paymentMode === "pay-on-site" && !protectedContact) {
    throw new CustomerBookingRepositoryError(
      "Chọn trả tiền tại điểm thì cần để lại số điện thoại hoặc email.",
      "INPUT_INVALID",
    );
  }
  const { data, error } = await createAdminClient().rpc("customer_confirm_booking", {
    p_tenant_id: TENANT_ID,
    p_payment_request_id: input.paymentRequestId,
    p_hold_id: input.holdId,
    p_anonymous_id: input.anonymousId,
    p_occurred_at: new Date().toISOString(),
    p_payment_mode: input.paymentMode,
    p_identity_type: protectedContact?.identityType ?? null,
    p_identity_digest: protectedContact?.digest ?? null,
    p_identity_ciphertext: protectedContact?.ciphertext ?? null,
    p_encryption_key_version: protectedContact?.keyVersion ?? null,
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);
  return {
    orderId: String(row.order_id),
    orderCode: String(row.order_code),
    orderStatus: String(row.order_status) as "confirmed",
    paymentAttemptId: String(row.payment_attempt_id),
    paymentStatus: String(row.payment_status) as "succeeded" | "pending",
    paymentMode: String(row.payment_mode) as "simulation" | "pay-on-site",
    amountDueVnd: Number(row.amount_due_vnd ?? 0),
    tickets: ticketsFromRow(row.tickets),
    duplicate: row.inserted !== true,
  };
}

export type Customer360BookingOrder = {
  orderId: string;
  profileId: string;
  orderCode: string;
  productName: string;
  visitDate: string;
  partySize: number;
  totalVnd: number;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
  tickets: Array<{ ticketCode: string; siteId: string; entriesAllowed: number; status: string }>;
};

export async function listCustomer360BookingOrders(limit = 100): Promise<Customer360BookingOrder[]> {
  const client = createAdminClient();
  const { data: orders, error: orderError } = await client
    .from("customer_orders")
    .select("id, profile_id, product_id, order_code, visit_date, party_size, total_vnd, status, created_at")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (orderError) throw mapRepositoryError(orderError);

  const orderRows = (orders ?? []) as Array<Record<string, unknown>>;
  const orderIds = orderRows.map((row) => String(row.id));
  if (orderIds.length === 0) return [];

  const [paymentResult, bridgeResult] = await Promise.all([
    client.from("customer_payment_attempts").select("order_id, status").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
    client.from("customer_order_tickets").select("order_id, ticket_id, entries_allowed").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
  ]);
  if (paymentResult.error) throw mapRepositoryError(paymentResult.error);
  if (bridgeResult.error) throw mapRepositoryError(bridgeResult.error);

  const paymentByOrder = new Map<string, string>();
  for (const row of (paymentResult.data ?? []) as Array<Record<string, unknown>>) {
    paymentByOrder.set(String(row.order_id), String(row.status));
  }
  const bridgesByOrder = new Map<string, Array<{ ticketId: string; entriesAllowed: number }>>();
  const ticketIds: string[] = [];
  for (const row of (bridgeResult.data ?? []) as Array<Record<string, unknown>>) {
    const orderId = String(row.order_id);
    const ticketId = String(row.ticket_id);
    const current = bridgesByOrder.get(orderId) ?? [];
    current.push({ ticketId, entriesAllowed: Number(row.entries_allowed) });
    bridgesByOrder.set(orderId, current);
    ticketIds.push(ticketId);
  }

  const ticketsById = new Map<string, Record<string, unknown>>();
  if (ticketIds.length > 0) {
    const { data: tickets, error: ticketError } = await client
      .from("erp_tickets")
      .select("id, ticket_code, site_id, status")
      .eq("tenant_id", TENANT_ID)
      .in("id", [...new Set(ticketIds)]);
    if (ticketError) throw mapRepositoryError(ticketError);
    for (const ticket of (tickets ?? []) as Array<Record<string, unknown>>) {
      ticketsById.set(String(ticket.id), ticket);
    }
  }

  return orderRows.map((row) => {
    const orderId = String(row.id);
    const product = PACKAGES.find((item) => item.id === String(row.product_id));
    return {
      orderId,
      profileId: String(row.profile_id),
      orderCode: String(row.order_code),
      productName: product?.name ?? "Gói dịch vụ",
      visitDate: String(row.visit_date),
      partySize: Number(row.party_size),
      totalVnd: Number(row.total_vnd),
      status: String(row.status),
      paymentStatus: paymentByOrder.get(orderId) ?? null,
      createdAt: String(row.created_at),
      tickets: (bridgesByOrder.get(orderId) ?? []).flatMap((bridge) => {
        const ticket = ticketsById.get(bridge.ticketId);
        return ticket ? [{
          ticketCode: String(ticket.ticket_code),
          siteId: String(ticket.site_id),
          entriesAllowed: bridge.entriesAllowed,
          status: String(ticket.status),
        }] : [];
      }),
    };
  });
}

/**
 * TC-23 — trả lại vé cho khách đã đặt, khi màn hình cũ không còn nữa.
 *
 * Hệ thống KHÔNG gửi được tin nhắn hay email xác nhận: phần gửi ra ngoài mới
 * có hàng đợi mô phỏng, chưa đấu nhà cung cấp nào. Nên khách đóng tab là mất
 * mã QR, và tới cổng không có gì đưa cho nhân viên quét. Lối tự tra cứu này là
 * cách lấp chỗ đó mà không tốn một đồng dịch vụ nào.
 *
 * Ba điều phải giữ đúng, đọc kỹ trước khi sửa:
 *
 * 1. **Liên hệ đi qua đúng `protectCustomerContact`** — cùng hàm băm HMAC mà
 *    lúc đặt chỗ đã dùng, nên hai bên sinh ra cùng một chuỗi. So chuỗi với
 *    chuỗi, không bao giờ giải mã bản mã ra để đối chiếu.
 * 2. **Sai mã và sai liên hệ trả về CÙNG một thứ** — `{ found: false }`. Chỗ
 *    gọi tuyệt đối không được tách hai nhánh ấy ra thành hai câu khác nhau.
 * 3. **Thời gian trả lời được kê cho bằng nhau** — tìm thấy hay không cũng
 *    chờ đủ `LOOKUP_FLOOR_MS`. Không có nó thì một lần trả lời nhanh bất
 *    thường tự khai rằng mã ấy chưa từng tồn tại.
 */
const LOOKUP_FLOOR_MS = 450;

function lookupTicketsFromRow(value: unknown): CustomerTicketLookupTicket[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{
      ticketId: String(row.ticket_id),
      ticketCode: String(row.ticket_code),
      siteId: String(row.site_id),
      validOn: String(row.valid_on),
      entriesAllowed: Number(row.entries_allowed),
      entriesUsed: Number(row.entries_used ?? 0),
      guestGroup: guestGroupFrom(row.guest_group),
      status: String(row.status) as CustomerTicketLookupTicket["status"],
    }];
  });
}

export async function lookupCustomerOrderTickets(input: {
  orderCode: string;
  contact: string;
}): Promise<CustomerTicketLookupResult> {
  const startedAt = Date.now();
  const settle = async <T,>(result: T): Promise<T> => {
    const remaining = LOOKUP_FLOOR_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    return result;
  };

  let protectedContact: ReturnType<typeof protectCustomerContact>;
  try {
    protectedContact = protectCustomerContact(input.contact);
  } catch (error) {
    // Liên hệ gõ sai khuôn là chuyện của ô nhập, không phải chuyện của đơn nào
    // cả — câu này không hé lộ một mã đặt chỗ nào có thật hay không.
    if (error instanceof CustomerIdentityRepositoryError && error.code === "INPUT_INVALID") {
      throw new CustomerBookingRepositoryError(error.message, "INPUT_INVALID");
    }
    throw error instanceof CustomerIdentityRepositoryError
      ? new CustomerBookingRepositoryError(error.message, "CONFIGURATION_MISSING")
      : new CustomerBookingRepositoryError(
          "Bạn nhập giúp em số điện thoại hoặc email đã dùng lúc đặt ạ.",
          "INPUT_INVALID",
        );
  }

  const { data, error } = await createAdminClient().rpc("customer_lookup_order_tickets", {
    p_tenant_id: TENANT_ID,
    p_order_code: input.orderCode,
    p_identity_type: protectedContact.identityType,
    p_identity_digest: protectedContact.digest,
    p_occurred_at: new Date().toISOString(),
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);

  if (row.found !== true) {
    return settle({ found: false, throttled: row.throttled === true });
  }
  return settle({
    found: true,
    throttled: false,
    orderCode: String(row.order_code),
    productId: String(row.product_id),
    visitDate: String(row.visit_date),
    partySize: Number(row.party_size),
    adults: row.adults === null || row.adults === undefined ? null : Number(row.adults),
    children: row.children === null || row.children === undefined ? null : Number(row.children),
    totalVnd: Number(row.total_vnd),
    currency: "VND",
    paymentMode: (row.payment_mode ?? null) as "simulation" | "pay-on-site" | null,
    paymentStatus: (row.payment_status ?? null) as "succeeded" | "pending" | null,
    amountDueVnd: Number(row.amount_due_vnd ?? 0),
    tickets: lookupTicketsFromRow(row.tickets),
  });
}
