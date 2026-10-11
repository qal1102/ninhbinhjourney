import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
/** Giờ thuyền và cổng chạy: các ô từ 6:00 tới 17:00. */
export const GIO_HOM_NAY = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
const TRAN = 20_000;

export type LuotTheoGio = {
  /** Số lượt qua cổng được nhận trong từng ô giờ của `GIO_HOM_NAY`. */
  theoGio: number[];
  tong: number;
  /** Chạm trần số hàng đọc về: số có thể thiếu, trang phải nói vậy. */
  chamTran: boolean;
};

/**
 * Lượt qua cổng hôm nay theo giờ ở một cơ sở (F1 "Hôm nay ở Ninh Bình",
 * 11/10/2026). Chỉ đếm lượt cổng nhận (`result = accepted`), theo giờ Việt
 * Nam. Kho chưa nối (máy cục bộ) thì trả `null`: trang nói chưa có số, không
 * vẽ số đoán.
 */
export async function luotQuaCongHomNay(siteId: ErpSiteId, bayGio = new Date()): Promise<LuotTheoGio | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  const vn = new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  const tu = new Date(`${vn}T00:00:00+07:00`).toISOString();
  const den = new Date(Date.parse(tu) + 86_400_000).toISOString();
  const kho = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-hom-nay" } },
  });
  const { data, error } = await kho
    .from("erp_gate_scan_events")
    .select("scanned_at")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .eq("result", "accepted")
    .gte("scanned_at", tu)
    .lt("scanned_at", den)
    .limit(TRAN);
  if (error || !data) return null;
  const theoGio = GIO_HOM_NAY.map(() => 0);
  for (const dong of data as Array<{ scanned_at: string }>) {
    const gio = new Date(Date.parse(dong.scanned_at) + 7 * 3_600_000).getUTCHours();
    const o = GIO_HOM_NAY.indexOf(gio as (typeof GIO_HOM_NAY)[number]);
    if (o >= 0) theoGio[o] += 1;
  }
  return { theoGio, tong: data.length, chamTran: data.length >= TRAN };
}
