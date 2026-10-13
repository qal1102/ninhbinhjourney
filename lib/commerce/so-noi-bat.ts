import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { docSoNoiBat, type SoNoiBat } from "@/domain/goi-y";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Số thật cho gợi ý (migration 127): khách qua cổng 7 ngày từng điểm, đơn 30
 * ngày từng gói, gói mà từng kiểu nhóm hay chọn. Chỉ số gộp. Kho chưa nối
 * hay lỗi thì `null` và trang không hiện câu gợi ý nào.
 */
export const docSoNoiBatKho = cache(async (): Promise<SoNoiBat | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  try {
    const db = createClient(url, secret, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { "X-Client-Info": "ninh-binh-journey-so-noi-bat" } },
    });
    const { data, error } = await db.rpc("customer_so_noi_bat", { p_tenant_id: TENANT_ID });
    return error ? null : docSoNoiBat(data);
  } catch {
    return null;
  }
});
