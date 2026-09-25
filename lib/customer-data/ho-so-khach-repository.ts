import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PACKAGES } from "@/content/packages";
import { nhanCachTra } from "@/domain/customer-booking";
import { tinhHoSo, type DonTrongHoSo, type HoSoKhach, type LuotVao } from "@/domain/ho-so-khach";
import { protectCustomerContact } from "@/lib/customer-data/identity-repository";

/**
 * Đọc hồ sơ khách từ ba lối vào:
 *
 * - `hoSoTheoPhien`: máy đã đặt chỗ, nhận ra khách bằng cookie phiên.
 * - `hoSoTheoLienHe`: máy khác, khách gõ số điện thoại cùng một mã đặt chỗ —
 *   hai thứ phải khớp nhau, y như trang tra cứu vé.
 * - `hoSoTheoMaHoSo`: giám đốc xem "khách thấy gì" từ màn hình Khách hàng.
 *
 * Một khách có thể đặt từ nhiều máy; hệ thống gộp các phiên cùng một số điện
 * thoại về một hồ sơ gốc (`canonical_profile_id`). Hồ sơ ở đây đọc cả nhóm ấy.
 *
 * Chỉ đọc, không ghi gì. Không trả số điện thoại hay email ra ngoài.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class HoSoKhachError extends Error {
  constructor(message: string, readonly code: "CONFIGURATION_MISSING" | "NOT_FOUND" | "PERSISTENCE_FAILED") {
    super(message);
  }
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new HoSoKhachError("Kho hồ sơ khách chưa được cấu hình.", "CONFIGURATION_MISSING");
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-ho-so-khach" } },
  });
}

function loiKho() {
  return new HoSoKhachError("Chưa đọc được hồ sơ, mời bạn thử lại.", "PERSISTENCE_FAILED");
}

async function hoSoGoc(db: SupabaseClient, profileId: string): Promise<string | null> {
  const { data, error } = await db
    .from("customer_profiles")
    .select("id, canonical_profile_id")
    .eq("tenant_id", TENANT_ID)
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw loiKho();
  if (!data) return null;
  const row = data as { id: string; canonical_profile_id: string | null };
  return row.canonical_profile_id ?? row.id;
}

async function cacPhienCuaHoSo(db: SupabaseClient, goc: string): Promise<string[]> {
  const { data, error } = await db
    .from("customer_profiles")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .or(`id.eq.${goc},canonical_profile_id.eq.${goc}`);
  if (error) throw loiKho();
  return (data ?? []).map((row) => String((row as { id: string }).id));
}

async function dungHoSo(db: SupabaseClient, goc: string): Promise<HoSoKhach> {
  const phien = await cacPhienCuaHoSo(db, goc);
  const { data: orders, error: orderError } = await db
    .from("customer_orders")
    .select("id, product_id, order_code, visit_date, party_size, total_vnd, status, created_at")
    .eq("tenant_id", TENANT_ID)
    .in("profile_id", phien)
    .neq("status", "holding")
    .order("created_at", { ascending: false })
    .limit(50);
  if (orderError) throw loiKho();
  const donRows = (orders ?? []) as Array<Record<string, unknown>>;
  const orderIds = donRows.map((row) => String(row.id));
  if (orderIds.length === 0) return tinhHoSo({ khoaHoSo: goc, don: [], luotVao: [] });

  const [payments, bridges] = await Promise.all([
    db.from("customer_payment_attempts").select("order_id, mode, status").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
    db.from("customer_order_tickets").select("order_id, ticket_id").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
  ]);
  if (payments.error || bridges.error) throw loiKho();
  const ticketIds = (bridges.data ?? []).map((row) => String(row.ticket_id));
  const [tickets, scans] = ticketIds.length
    ? await Promise.all([
        db.from("erp_tickets").select("id, ticket_code, site_id, valid_on, entries_allowed, entries_used").eq("tenant_id", TENANT_ID).in("id", ticketIds),
        db.from("erp_gate_scan_events").select("site_id, scanned_at").eq("tenant_id", TENANT_ID).eq("result", "accepted").in("ticket_id", ticketIds).limit(500),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (tickets.error || scans.error) throw loiKho();

  const traTheoDon = new Map<string, { mode: string; status: string }>();
  for (const row of payments.data ?? []) traTheoDon.set(String(row.order_id), { mode: String(row.mode), status: String(row.status) });
  const veTheoId = new Map((tickets.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));
  const veTheoDon = new Map<string, DonTrongHoSo["tickets"]>();
  for (const cau of bridges.data ?? []) {
    const ve = veTheoId.get(String(cau.ticket_id));
    if (!ve) continue;
    const ds = veTheoDon.get(String(cau.order_id)) ?? [];
    ds.push({
      ticketCode: String(ve.ticket_code),
      siteId: String(ve.site_id),
      validOn: String(ve.valid_on),
      entriesAllowed: Number(ve.entries_allowed),
      entriesUsed: Number(ve.entries_used),
    });
    veTheoDon.set(String(cau.order_id), ds);
  }

  const don: DonTrongHoSo[] = donRows.map((row) => {
    const tra = traTheoDon.get(String(row.id));
    return {
      orderCode: String(row.order_code),
      productName: PACKAGES.find((item) => item.id === String(row.product_id))?.name ?? "Gói tham quan",
      visitDate: String(row.visit_date),
      partySize: Number(row.party_size),
      totalVnd: Number(row.total_vnd),
      paymentLabel: nhanCachTra((tra?.mode ?? null) as Parameters<typeof nhanCachTra>[0], tra?.status ?? null),
      tickets: veTheoDon.get(String(row.id)) ?? [],
    };
  });
  const luotVao: LuotVao[] = (scans.data ?? []).map((row) => ({
    siteId: String(row.site_id),
    scannedAt: String(row.scanned_at),
  }));
  return tinhHoSo({ khoaHoSo: goc, don, luotVao });
}

export async function hoSoTheoPhien(anonymousId: string): Promise<HoSoKhach | null> {
  const db = client();
  const { data, error } = await db
    .from("customer_profiles")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("anonymous_id", anonymousId)
    .maybeSingle();
  if (error) throw loiKho();
  if (!data) return null;
  const goc = await hoSoGoc(db, String((data as { id: string }).id));
  if (!goc) return null;
  const hoSo = await dungHoSo(db, goc);
  return hoSo.don.length > 0 ? hoSo : null;
}

export async function hoSoTheoLienHe(input: { contact: string; orderCode: string }): Promise<HoSoKhach> {
  const db = client();
  const lienHe = protectCustomerContact(input.contact);
  const { data, error } = await db
    .from("customer_identities")
    .select("profile_id")
    .eq("tenant_id", TENANT_ID)
    .eq("identity_type", lienHe.identityType)
    .eq("identity_digest", lienHe.digest)
    .maybeSingle();
  if (error) throw loiKho();
  const khongThay = new HoSoKhachError(
    "Chưa tìm thấy hồ sơ khớp mã đặt chỗ và số này. Bạn xem lại giúp em ạ.",
    "NOT_FOUND",
  );
  if (!data) throw khongThay;
  const goc = await hoSoGoc(db, String((data as { profile_id: string }).profile_id));
  if (!goc) throw khongThay;
  const hoSo = await dungHoSo(db, goc);
  const ma = input.orderCode.trim().toUpperCase();
  if (!hoSo.don.some((don) => don.orderCode.toUpperCase() === ma)) throw khongThay;
  return hoSo;
}

export async function hoSoTheoMaHoSo(profileId: string): Promise<HoSoKhach | null> {
  const db = client();
  const goc = await hoSoGoc(db, profileId);
  return goc ? dungHoSo(db, goc) : null;
}
