import "server-only";

import { createClient } from "@supabase/supabase-js";
import { docKhachThichGi, type KhachThichGi } from "@/domain/khach-thich-gi";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** Số ngày mặc định của màn Khách thích gì: tám tuần gần nhất, đủ hai tháng mùa vụ. */
export const SO_NGAY_KHACH_THICH_GI = 60;

/**
 * Số gộp "khách thích gì" (migration 126) trong `soNgay` ngày gần nhất tính
 * cả hôm nay. Chỉ đọc. Kho chưa nối hay lỗi thì `null`, màn hình báo chưa có số.
 */
export async function docSoKhachThichGi(soNgay = SO_NGAY_KHACH_THICH_GI): Promise<KhachThichGi | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  const homNay = new Date(Date.now() + 7 * 3_600_000);
  const den = homNay.toISOString().slice(0, 10);
  const tu = new Date(homNay.getTime() - (soNgay - 1) * 86_400_000).toISOString().slice(0, 10);
  try {
    const db = createClient(url, secret, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { "X-Client-Info": "ninh-binh-erp-khach-thich-gi" } },
    });
    const { data, error } = await db.rpc("erp_khach_thich_gi", { p_tenant_id: TENANT_ID, p_tu: tu, p_den: den });
    if (error || !data) return null;
    return docKhachThichGi(data);
  } catch {
    return null;
  }
}
