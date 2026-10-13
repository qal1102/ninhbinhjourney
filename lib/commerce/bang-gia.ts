import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { BangGia, GiaGoi } from "@/content/packages";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

function soNguyen(value: unknown): number | null {
  const so = Number(value);
  return Number.isInteger(so) && so >= 0 ? so : null;
}

/**
 * Giá hiện hành của mọi gói và vé lẻ, đọc từ kho (migration 124, 125): vé lẻ
 * bằng giá quầy của điểm, gói bằng tổng giá vé các điểm trong gói rồi giảm
 * 10% (2 điểm bán vé) hay 15% (từ 3 điểm); kèm giá trẻ 1m–1m3. Giám đốc đổi
 * giá ở màn Bảng giá thì web đổi theo ở lượt tải trang kế tiếp.
 *
 * Kho chưa nối hay chưa có migration thì trả `null`, và các trang tính giá từ
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
    const bang: Record<string, GiaGoi> = {};
    for (const dong of data as Array<Record<string, unknown>>) {
      const nguoiLon = soNguyen(dong.price_vnd);
      if (typeof dong.slug !== "string" || nguoiLon === null) continue;
      bang[dong.slug] = {
        nguoiLon,
        treEm: soNguyen(dong.child_price_vnd) ?? 0,
        giaLe: soNguyen(dong.full_price_vnd) ?? nguoiLon,
        giam: soNguyen(dong.discount_pct) ?? 0,
      };
    }
    return bang;
  } catch {
    return null;
  }
});
