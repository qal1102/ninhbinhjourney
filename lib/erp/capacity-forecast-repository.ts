import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  duBaoChamTran,
  noThanh,
  type CapacityForecast,
  type ForecastSample,
} from "@/domain/capacity-forecast";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * TC-11 — đọc mốc đo rồi để `domain/capacity-forecast.ts` suy ra giờ kín.
 *
 * Trục đo là **giờ khách đặt**, cửa sổ 72 giờ gần nhất
 * (`erp_capacity_fill_samples`). Khách đặt trước nhiều ngày nên cửa sổ tính
 * tốc độ để **12 giờ**: hai giờ như mặc định chỉ hợp với thứ bán ngay trong
 * ngày, ở đây sẽ gần như lúc nào cũng "chưa nhúc nhích".
 */
const CUA_SO_DO_PHUT = 12 * 60;

export type SiteCapacityForecast = {
  siteId: string;
  capacity: number;
  taken: number;
  forecast: CapacityForecast;
  /** Câu tiếng Việt đã ghép sẵn, đúng luật cấm của TC-11. */
  cau: string;
};

function samplesFrom(value: unknown): ForecastSample[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      const at = Number(hang.at_minutes);
      const taken = Number(hang.taken);
      if (!Number.isFinite(at) || !Number.isFinite(taken)) return null;
      return { atMinutes: at, taken };
    })
    .filter((s): s is ForecastSample => s !== null);
}

export async function forecastSiteCapacity(input: {
  siteIds: string[];
  visitDate: string;
  siteNames: Record<string, string>;
}): Promise<SiteCapacityForecast[]> {
  if (input.siteIds.length === 0) return [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return [];
  const client: SupabaseClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-capacity-forecast" } },
  });
  const { data, error } = await client.rpc("erp_capacity_fill_samples", {
    p_tenant_id: TENANT_ID,
    p_site_ids: input.siteIds,
    p_date: input.visitDate,
  });
  if (error) {
    console.error("Đọc mốc đo tốc độ giữ chỗ không thành", error);
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      const siteId = String(hang.site_id ?? "");
      if (!siteId) return null;
      const capacity = Number(hang.suc_chua) || 0;
      const taken = Number(hang.da_giu) || 0;
      const asOf = Number(hang.bay_gio_phut) || 0;
      const samples = samplesFrom(hang.mau_do);
      const forecast = duBaoChamTran({
        capacity,
        samples,
        asOfMinutes: asOf,
        windowMinutes: CUA_SO_DO_PHUT,
        // Tầm nhìn: hết cửa sổ 72 giờ. Xa hơn thì con số chỉ là phép chia, không
        // còn là dự báo.
        horizonMinutes: 72 * 60,
      });
      const ten = input.siteNames[siteId] ?? "Cơ sở này";
      const nhanGio =
        forecast.kind === "du-doan"
          ? new Date(Date.now() + (forecast.hitAtMinutes - asOf) * 60_000).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })
          : undefined;
      return { siteId, capacity, taken, forecast, cau: noThanh(forecast, ten, nhanGio) };
    })
    .filter((row): row is SiteCapacityForecast => row !== null);
}
