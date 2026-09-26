import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import { congNgay, docSoLieuBaoCao, type SoLieuBaoCao } from "@/domain/bao-cao-co-so";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";
import { vietnamDateKey } from "@/lib/erp/workday-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export type BaoCaoCoSo =
  | { trangThai: "co-so-lieu"; homNay: string; soLieu: SoLieuBaoCao }
  | { trangThai: "chua-noi-kho" }
  | { trangThai: "loi"; loiNhan: string };

/**
 * Tám tuần đã khép (không tính hôm nay, vì hôm nay chưa hết ngày) và số khách
 * đã đặt trước cho bảy ngày kể từ hôm nay. Đọc hỏng thì nói thật là hỏng,
 * không dựng một biểu đồ rỗng trông như "không có khách".
 */
export async function docBaoCaoCoSo(siteId: ErpSiteId): Promise<BaoCaoCoSo> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) {
    return { trangThai: "chua-noi-kho" };
  }
  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-bao-cao" } },
  });
  const homNay = vietnamDateKey();
  const { data, error } = await client.rpc("erp_bao_cao_co_so", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
    p_tu: congNgay(homNay, -56),
    p_den: homNay,
  });
  if (error) {
    console.error("Report read failed", error);
    return {
      trangThai: "loi",
      loiNhan:
        error.code === "42883" || error.code === "PGRST202"
          ? "Kho dữ liệu chưa có hàm báo cáo (migration 093 chưa áp)."
          : "Chưa đọc được số liệu báo cáo. Xin tải lại trang.",
    };
  }
  return { trangThai: "co-so-lieu", homNay, soLieu: docSoLieuBaoCao(data) };
}
