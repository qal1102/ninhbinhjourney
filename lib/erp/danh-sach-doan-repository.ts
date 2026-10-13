import "server-only";

import { createClient } from "@supabase/supabase-js";
import { docDanhSachDoan, type DoanErp } from "@/domain/danh-sach-doan";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** Đoàn web và đoàn quầy có ngày đi trong khoảng (migration 131). `null` khi chưa nối kho. */
export async function docDanhSachDoanErp(input: { actorAccountId: string; tu: string; den: string }): Promise<DoanErp[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  const db = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-erp-danh-sach-doan" } },
  });
  const { data, error } = await db.rpc("erp_danh_sach_doan", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_tu: input.tu,
    p_den: input.den,
  });
  if (error) throw new Error(findRpcBusinessMessage(error) ?? "Chưa đọc được danh sách đoàn, xin thử lại.");
  return docDanhSachDoan(data);
}
