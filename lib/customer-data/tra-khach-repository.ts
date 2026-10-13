import "server-only";

import { createClient } from "@supabase/supabase-js";
import { docKetQuaTraKhach, laMaTraDuoc, laSoDienThoai, type KetQuaTraKhach } from "@/domain/tra-khach";
import { protectCustomerContact } from "@/lib/customer-data/identity-repository";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * ERP tra khách (migration 130). Số điện thoại chỉ đi qua máy chủ để băm; kho
 * tra theo mã băm. Mỗi lần tra ra một khách có số, kho ghi nhật ký truy cập.
 */
export async function traKhachErp(input: { actorAccountId: string; nhap: string }): Promise<KetQuaTraKhach> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error("Phần tra khách chưa nối được kho dữ liệu ở bản này.");
  const so = laSoDienThoai(input.nhap);
  const ma = so ? null : laMaTraDuoc(input.nhap);
  if (!so && !ma) throw new Error("Gõ số điện thoại 10 số, hoặc một mã: NBJ-, WEB-, QUAY-, TV-, PT-.");
  let digest: string | null = null;
  if (so) {
    try {
      digest = protectCustomerContact(so).digest;
    } catch {
      throw new Error("Chưa có khoá bảo vệ số điện thoại ở bản này.");
    }
  }
  const db = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-erp-tra-khach" } },
  });
  const { data, error } = await db.rpc("erp_tra_khach", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_identity_digest: digest,
    p_code: ma,
  });
  if (error) throw new Error(findRpcBusinessMessage(error) ?? "Chưa tra được, xin thử lại.");
  return docKetQuaTraKhach(data);
}
