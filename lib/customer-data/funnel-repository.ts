import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CustomerFunnelReport, CustomerFunnelSourceRow, CustomerFunnelTotals, KyPhieu } from "@/domain/customer-funnel";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const MAX_ROWS = 1000;

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

function so(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type KetQuaHam = Record<string, unknown>;

/**
 * Mọi phép đếm nằm trong `erp_phieu_khach` (migration 094). Trước đó tệp này
 * đọc thô 13 bảng rồi đếm ở đây, và PostgREST chỉ trả 1.000 dòng mỗi lượt:
 * bảy ngày có khoảng sáu nghìn lượt qua cổng, nên ô "Qua cổng" bị cắt mà
 * trông vẫn như đúng.
 */
async function goiHam(db: SupabaseClient, ky: KyPhieu): Promise<KetQuaHam> {
  const { data, error } = await db.rpc("erp_phieu_khach", {
    p_tenant_id: TENANT_ID,
    p_tu: ky.tu.toISOString(),
    p_den: ky.den.toISOString(),
  });
  if (error) {
    throw new CustomerFunnelRepositoryError(
      error.code === "42883" || error.code === "PGRST202"
        ? "Kho chưa có hàm đếm phễu khách."
        : "Kho phễu chưa đếm được các nguồn để đối soát.",
      { cause: new Error(error.message) },
    );
  }
  return (data ?? {}) as KetQuaHam;
}

function tongCua(ketQua: KetQuaHam): CustomerFunnelTotals {
  const tong = (ketQua.tong ?? {}) as Record<string, unknown>;
  return {
    qrScans: so(tong.qr),
    pageViews: so(tong.xem),
    holds: so(tong.giu),
    payments: so(tong.tra),
    acceptedGateScans: so(tong.cong),
  };
}

export async function getCustomerFunnelReport(
  ky: KyPhieu,
  kySoSanh?: KyPhieu,
): Promise<CustomerFunnelReport> {
  const db = client();
  const [chinh, soSanh, campaigns, sources] = await Promise.all([
    goiHam(db, ky),
    kySoSanh ? goiHam(db, kySoSanh) : Promise.resolve(null),
    // Hai bảng nhãn này chỉ có vài chục dòng; 1.000 là trần của PostgREST.
    db.from("marketing_campaigns").select("id, name, dip_id").eq("tenant_id", TENANT_ID).limit(MAX_ROWS),
    db.from("marketing_qr_sources").select("id, code, placement_label, campaign_id").eq("tenant_id", TENANT_ID).limit(MAX_ROWS),
  ]);
  const failed = [campaigns, sources].find((result) => result.error);
  if (failed?.error) throw new CustomerFunnelRepositoryError("Kho phễu chưa đọc được nhãn chiến dịch.", { cause: new Error(failed.error.message) });

  const campaignById = new Map((campaigns.data ?? []).map((row) => [String(row.id), { name: String(row.name), dipId: typeof row.dip_id === "string" ? row.dip_id : "" }]));
  const sourceById = new Map((sources.data ?? []).map((row) => [String(row.id), row]));

  const sourceRows: CustomerFunnelSourceRow[] = ((chinh.nguon ?? []) as Record<string, unknown>[]).map((dong) => {
    const id = String(dong.nguon);
    const source = sourceById.get(id);
    const campaign = source ? campaignById.get(String(source.campaign_id)) : undefined;
    return {
      sourceId: id,
      sourceLabel: id === "unattributed" ? "Chưa gắn QR nguồn" : source ? `${String(source.code)} · ${String(source.placement_label)}` : id,
      campaignLabel: id === "unattributed" ? "Trực tiếp / nguồn chưa khớp" : campaign?.name ?? "Chiến dịch chưa khớp",
      dipId: campaign?.dipId ?? "",
      qrScans: so(dong.qr),
      pageViews: so(dong.xem),
      holds: so(dong.giu),
      payments: so(dong.tra),
      acceptedGateScans: so(dong.cong),
    };
  })
    .filter((row) => row.qrScans + row.pageViews + row.holds + row.payments + row.acceptedGateScans > 0)
    .sort((left, right) => right.qrScans - left.qrScans || left.sourceLabel.localeCompare(right.sourceLabel, "vi"));

  const hoSoCoGiu = so(chinh.ho_so_co_giu);
  const hoSoRoNguon = Math.min(so(chinh.ho_so_ro_nguon), hoSoCoGiu);

  return {
    windowStart: ky.tu.toISOString(),
    windowEnd: ky.den.toISOString(),
    totals: tongCua(chinh),
    comparisonTotals: soSanh ? tongCua(soSanh) : null,
    sources: sourceRows,
    slots: ((chinh.khung ?? []) as Record<string, unknown>[]).map((slot) => ({
      slotId: String(slot.id), siteId: String(slot.site_id), startsAt: String(slot.starts_at),
      capacitySnapshot: so(slot.capacity_snapshot),
      capacitySourceKind: String(slot.capacity_source_kind) as "estimate" | "customer" | "measured",
      thresholdVersion: so(slot.threshold_version),
      reservedEntries: so(slot.dang_giu),
      soldEntries: so(slot.da_ban),
      checkedInEntries: so(slot.da_toi),
    })),
    slotCount: so(chinh.so_khung),
    counterGateScans: so(chinh.cong_quay),
    hasDemoData: chinh.co_mau === true,
    reconciliation: {
      attributedProfiles: hoSoRoNguon,
      unattributedProfiles: hoSoCoGiu - hoSoRoNguon,
      offlineSyncedItems: so(chinh.ngoai_tuyen),
      offlineDivergedItems: so(chinh.ngoai_tuyen_lech),
    },
  };
}
