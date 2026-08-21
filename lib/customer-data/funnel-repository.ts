import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CustomerFunnelReport, CustomerFunnelSourceRow } from "@/domain/customer-funnel";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const MAX_ROWS = 5000;

export class CustomerFunnelRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CustomerFunnelRepositoryError";
  }
}

export function isCustomerFunnelDashboardEnabled() {
  return process.env.CUSTOMER_FUNNEL_DASHBOARD_ENABLED?.trim() === "true";
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new CustomerFunnelRepositoryError("Kho phễu khách hàng chưa được cấu hình đủ.");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-customer-funnel-server" } },
  });
}

function sourceId(value: unknown) {
  if (!value || typeof value !== "object") return "unattributed";
  const source = value as Record<string, unknown>;
  return typeof source.qr_source_id === "string" && source.qr_source_id ? source.qr_source_id : "unattributed";
}

/**
 * Hold chỉ còn giữ chỗ khi 'converted', hoặc 'active' mà chưa quá hạn — đúng luật
 * RPC tính sức chứa ở migration 202608200043 (`hold.status = 'converted' or
 * (hold.status = 'active' and hold.expires_at > now())`). Hết hạn ở đây là LƯỜI:
 * status chỉ đổi sang 'expired' khi chính hold đó bị chạm lại, không có cron quét,
 * nên đọc mỗi status là sai. Mốc mất hiệu lực không đọc được thì coi như hết hạn,
 * giống `null > now()` trong SQL trả về false.
 */
function isHoldingSeat(hold: { status: string; expiresAt: string }, nowMs: number) {
  if (hold.status === "converted") return true;
  if (hold.status !== "active") return false;
  const expiresAtMs = Date.parse(hold.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

function increment(rows: Map<string, CustomerFunnelSourceRow>, id: string, field: keyof Pick<CustomerFunnelSourceRow, "qrScans" | "pageViews" | "holds" | "payments" | "acceptedGateScans">) {
  const row = rows.get(id) ?? {
    sourceId: id,
    sourceLabel: id === "unattributed" ? "Chưa gắn QR nguồn" : id,
    campaignLabel: id === "unattributed" ? "Trực tiếp / nguồn chưa khớp" : "Campaign chưa khớp",
    qrScans: 0, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 0,
  };
  row[field] += 1;
  rows.set(id, row);
}

export async function getCustomerFunnelReport(days = 7): Promise<CustomerFunnelReport> {
  const db = client();
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - Math.min(Math.max(days, 1), 31) * 86_400_000);
  const start = windowStart.toISOString();
  const end = windowEnd.toISOString();
  const journeySince = new Date(windowStart.getTime() - 90 * 86_400_000).toISOString();

  // Bảng đếm sự kiện lọc đúng cửa sổ báo cáo. Bảng tra cứu (holds, orders và hai
  // bảng cầu nối) CỐ Ý lấy rộng hơn cửa sổ: một hold đã 'converted' từ hai tháng
  // trước vẫn đang bán chỗ cho slot trong tuần này, và một order cũ vẫn được soát
  // vé trong tuần này. Lọc chúng theo created_at sẽ thổi bay đúng ca đặt trước.
  // Bù lại, mọi truy vấn tra cứu phải có order by để trần MAX_ROWS cắt vào hàng cũ
  // nhất thay vì cắt vào hàng ngẫu nhiên.
  const [campaigns, sources, qrScans, pageViews, journeys, holds, payments, orders, bridges, gateScans, slots, holdSlots, offlineItems] = await Promise.all([
    db.from("marketing_campaigns").select("id, name").eq("tenant_id", TENANT_ID).limit(MAX_ROWS),
    db.from("marketing_qr_sources").select("id, code, placement_label, campaign_id").eq("tenant_id", TENANT_ID).limit(MAX_ROWS),
    db.from("marketing_qr_scans").select("qr_source_id, occurred_at").eq("tenant_id", TENANT_ID).gte("occurred_at", start).lt("occurred_at", end).limit(MAX_ROWS),
    db.from("customer_events").select("profile_id, source_context, occurred_at").eq("tenant_id", TENANT_ID).eq("event_name", "page_viewed").gte("occurred_at", start).lt("occurred_at", end).limit(MAX_ROWS),
    db.from("customer_journeys").select("profile_id, source_context, created_at").eq("tenant_id", TENANT_ID).gte("created_at", journeySince).order("created_at", { ascending: false }).limit(MAX_ROWS),
    db.from("customer_booking_holds").select("id, profile_id, status, expires_at, created_at").eq("tenant_id", TENANT_ID).order("created_at", { ascending: false }).limit(MAX_ROWS),
    db.from("customer_payment_attempts").select("hold_id, status, occurred_at").eq("tenant_id", TENANT_ID).gte("occurred_at", start).lt("occurred_at", end).limit(MAX_ROWS),
    db.from("customer_orders").select("id, profile_id, created_at").eq("tenant_id", TENANT_ID).order("created_at", { ascending: false }).limit(MAX_ROWS),
    db.from("customer_order_tickets").select("order_id, ticket_id, slot_id, created_at").eq("tenant_id", TENANT_ID).order("created_at", { ascending: false }).limit(MAX_ROWS),
    db.from("erp_gate_scan_events").select("ticket_id, result, scanned_at").eq("tenant_id", TENANT_ID).eq("result", "accepted").gte("scanned_at", start).lt("scanned_at", end).limit(MAX_ROWS),
    db.from("customer_booking_slots").select("id, site_id, starts_at, capacity_snapshot, capacity_source_kind, threshold_version").eq("tenant_id", TENANT_ID).gte("starts_at", start).lt("starts_at", end).order("starts_at").limit(MAX_ROWS),
    db.from("customer_booking_hold_slots").select("hold_id, slot_id, quantity, created_at").eq("tenant_id", TENANT_ID).order("created_at", { ascending: false }).limit(MAX_ROWS),
    db.from("erp_gate_offline_sync_items").select("reconciliation_status, client_scanned_at").eq("tenant_id", TENANT_ID).gte("client_scanned_at", start).lt("client_scanned_at", end).limit(MAX_ROWS),
  ]);
  const reads: [string, { data: unknown[] | null; error: { message: string } | null }][] = [
    ["marketing_campaigns", campaigns], ["marketing_qr_sources", sources], ["marketing_qr_scans", qrScans],
    ["customer_events", pageViews], ["customer_journeys", journeys], ["customer_booking_holds", holds],
    ["customer_payment_attempts", payments], ["customer_orders", orders], ["customer_order_tickets", bridges],
    ["erp_gate_scan_events", gateScans], ["customer_booking_slots", slots],
    ["customer_booking_hold_slots", holdSlots], ["erp_gate_offline_sync_items", offlineItems],
  ];
  const failed = reads.find(([, result]) => result.error);
  if (failed?.[1].error) throw new CustomerFunnelRepositoryError("Kho phễu chưa đọc đủ các nguồn để đối soát.", { cause: new Error(failed[1].error.message) });
  // Chạm đúng trần nghĩa là gần như chắc chắn còn hàng bị bỏ lại: phải nói ra,
  // không được hiển thị như thể đã đếm đủ.
  const truncatedSources = reads.filter(([, result]) => (result.data?.length ?? 0) >= MAX_ROWS).map(([table]) => table);

  const campaignById = new Map((campaigns.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const rows = new Map<string, CustomerFunnelSourceRow>();
  for (const source of sources.data ?? []) {
    rows.set(String(source.id), {
      sourceId: String(source.id),
      sourceLabel: `${String(source.code)} · ${String(source.placement_label)}`,
      campaignLabel: campaignById.get(String(source.campaign_id)) ?? "Campaign chưa khớp",
      qrScans: 0, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 0,
    });
  }
  for (const scan of qrScans.data ?? []) increment(rows, String(scan.qr_source_id), "qrScans");
  for (const view of pageViews.data ?? []) increment(rows, sourceId(view.source_context), "pageViews");

  const sourceByProfile = new Map<string, string>();
  for (const journey of journeys.data ?? []) {
    const profileId = String(journey.profile_id);
    if (!sourceByProfile.has(profileId)) sourceByProfile.set(profileId, sourceId(journey.source_context));
  }
  const holdById = new Map<string, { profileId: string; status: string; expiresAt: string }>();
  let holdsInWindow = 0;
  for (const hold of holds.data ?? []) {
    const profileId = String(hold.profile_id);
    holdById.set(String(hold.id), { profileId, status: String(hold.status), expiresAt: String(hold.expires_at) });
    const createdAt = String(hold.created_at);
    if (createdAt >= start && createdAt < end) {
      holdsInWindow += 1;
      increment(rows, sourceByProfile.get(profileId) ?? "unattributed", "holds");
    }
  }
  for (const payment of payments.data ?? []) {
    if (String(payment.status) !== "succeeded") continue;
    const hold = holdById.get(String(payment.hold_id));
    increment(rows, hold ? sourceByProfile.get(hold.profileId) ?? "unattributed" : "unattributed", "payments");
  }

  const profileByOrder = new Map((orders.data ?? []).map((row) => [String(row.id), String(row.profile_id)]));
  const bridgeByTicket = new Map<string, { orderId: string; slotId: string }>();
  for (const bridge of bridges.data ?? []) bridgeByTicket.set(String(bridge.ticket_id), { orderId: String(bridge.order_id), slotId: String(bridge.slot_id) });
  const checkinsBySlot = new Map<string, number>();
  for (const scan of gateScans.data ?? []) {
    const bridge = bridgeByTicket.get(String(scan.ticket_id));
    const profileId = bridge ? profileByOrder.get(bridge.orderId) : undefined;
    increment(rows, profileId ? sourceByProfile.get(profileId) ?? "unattributed" : "unattributed", "acceptedGateScans");
    if (bridge) checkinsBySlot.set(bridge.slotId, (checkinsBySlot.get(bridge.slotId) ?? 0) + 1);
  }

  const nowMs = windowEnd.getTime();
  const activeHoldIds = new Set([...holdById].filter(([, hold]) => isHoldingSeat(hold, nowMs)).map(([id]) => id));
  const convertedHoldIds = new Set([...holdById].filter(([, hold]) => hold.status === "converted").map(([id]) => id));
  const reservedBySlot = new Map<string, number>();
  const soldBySlot = new Map<string, number>();
  for (const bridge of holdSlots.data ?? []) {
    const holdId = String(bridge.hold_id);
    const slotId = String(bridge.slot_id);
    const quantity = Number(bridge.quantity);
    if (activeHoldIds.has(holdId)) reservedBySlot.set(slotId, (reservedBySlot.get(slotId) ?? 0) + quantity);
    if (convertedHoldIds.has(holdId)) soldBySlot.set(slotId, (soldBySlot.get(slotId) ?? 0) + quantity);
  }

  const sourceRows = [...rows.values()].filter((row) => row.qrScans + row.pageViews + row.holds + row.payments + row.acceptedGateScans > 0)
    .sort((left, right) => right.qrScans - left.qrScans || left.sourceLabel.localeCompare(right.sourceLabel, "vi"));
  const profileIds = new Set([...holdById.values()].map((hold) => hold.profileId));
  const attributedProfiles = [...profileIds].filter((id) => (sourceByProfile.get(id) ?? "unattributed") !== "unattributed").length;

  return {
    windowStart: start,
    windowEnd: end,
    totals: {
      qrScans: qrScans.data?.length ?? 0,
      pageViews: pageViews.data?.length ?? 0,
      holds: holdsInWindow,
      payments: (payments.data ?? []).filter((row) => String(row.status) === "succeeded").length,
      acceptedGateScans: gateScans.data?.length ?? 0,
    },
    sources: sourceRows,
    slots: (slots.data ?? []).map((slot) => ({
      slotId: String(slot.id), siteId: String(slot.site_id), startsAt: String(slot.starts_at),
      capacitySnapshot: Number(slot.capacity_snapshot),
      capacitySourceKind: String(slot.capacity_source_kind) as "estimate" | "customer" | "measured",
      thresholdVersion: Number(slot.threshold_version),
      reservedEntries: reservedBySlot.get(String(slot.id)) ?? 0,
      soldEntries: soldBySlot.get(String(slot.id)) ?? 0,
      checkedInEntries: checkinsBySlot.get(String(slot.id)) ?? 0,
    })),
    reconciliation: {
      attributedProfiles,
      unattributedProfiles: profileIds.size - attributedProfiles,
      offlineSyncedItems: offlineItems.data?.length ?? 0,
      offlineDivergedItems: (offlineItems.data ?? []).filter((item) => item.reconciliation_status === "diverged").length,
    },
    truncation: {
      capped: truncatedSources.length > 0,
      rowLimit: MAX_ROWS,
      sources: truncatedSources,
    },
  };
}
