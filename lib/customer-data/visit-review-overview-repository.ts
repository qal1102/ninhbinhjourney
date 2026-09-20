import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  siteReviewOverviewsFrom,
  type SiteReviewOverview,
} from "@/domain/visit-review-overview";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * TC-12 mục 2 — bảng điểm cho người điều hành.
 *
 * Đọc một lượt, trả cả điểm lẫn lượt vào trong cùng kỳ. Hỏng thì trả rỗng chứ
 * không ném lên: màn hình Khách hàng còn ba khối khác phải sống, không thể vì
 * một khối phụ mà cả trang trắng.
 */
export async function listSiteReviewOverview(input: {
  siteIds: string[];
  from: string;
  to: string;
}): Promise<SiteReviewOverview[]> {
  if (input.siteIds.length === 0) return [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return [];
  const client: SupabaseClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-review-overview-server" } },
  });
  const { data, error } = await client.rpc("erp_site_review_overview", {
    p_tenant_id: TENANT_ID,
    p_site_ids: input.siteIds,
    p_from: input.from,
    p_to: input.to,
  });
  if (error) {
    // Gồm cả trường hợp migration chưa được áp (`PGRST202`/`42883`).
    console.error("Đọc bảng điểm cho điều hành không thành", error);
    return [];
  }
  return siteReviewOverviewsFrom(data);
}
