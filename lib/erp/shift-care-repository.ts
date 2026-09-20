import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { shiftCareGroupsFrom, type ShiftCareGroup } from "@/domain/shift-care-brief";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * TC-13 — đọc bản giao ca "hôm nay ai cần để ý" cho một cơ sở.
 *
 * Kho này không quyết gì: mọi phép lọc nằm trong `erp_ca_truc_can_de_y`, mọi
 * cách đọc nằm trong `domain/shift-care-brief.ts`. Đọc hỏng thì trả rỗng —
 * màn hình cổng không được chết vì một khối thông tin phụ trợ, đúng bài học
 * ngày 13/09 khi một nhịp đọc chấm công làm sập cả màn soát vé.
 */
export async function readShiftCareBrief(input: {
  siteId: string;
  visitDate: string;
}): Promise<ShiftCareGroup[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return [];
  const client: SupabaseClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-shift-care" } },
  });
  const { data, error } = await client.rpc("erp_ca_truc_can_de_y", {
    p_tenant_id: TENANT_ID,
    p_site_id: input.siteId,
    p_visit_date: input.visitDate,
  });
  if (error) {
    console.error("Đọc bản giao ca chăm sóc không thành", error);
    return [];
  }
  return shiftCareGroupsFrom(data);
}
