import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { BangGia } from "@/content/packages";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Giá hiện hành của mọi gói và vé lẻ, đọc từ kho (migration 124): vé lẻ bằng
 * giá quầy người lớn của điểm, gói bằng tổng giá vé các điểm trong gói. Giám
 * đốc đổi giá ở màn Giá vé quầy thì web đổi theo ở lượt tải trang kế tiếp.
 *
 * Kho chưa nối hay chưa có migration 124 thì trả `null`, và các trang dùng
 * giá dự phòng trong `content/packages.ts` (khớp bảng giá quầy lúc viết).
 * Mỗi lượt dựng trang chỉ đọc một lần (`cache`).
 */
export const docBangGia = cache(async (): Promise<BangGia | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  try {
    const db = createClient(url, secret, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { "X-Client-Info": "ninh-binh-journey-bang-gia" } },
    });
    const { data, error } = await db.rpc("customer_product_prices", { p_tenant_id: TENANT_ID });
    if (error || !Array.isArray(data)) return null;
    const bang: Record<string, number> = {};
    for (const dong of data as Array<{ slug?: unknown; price_vnd?: unknown }>) {
      const gia = Number(dong.price_vnd);
      if (typeof dong.slug === "string" && Number.isInteger(gia) && gia >= 0) bang[dong.slug] = gia;
    }
    return bang;
  } catch {
    return null;
  }
});
