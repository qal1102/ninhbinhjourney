import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { tienDoFrom, type TienDoVongDan } from "@/domain/huong-dan-vong-dau";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Mạch dẫn — nhớ hộ người dùng họ đang đi tới chặng nào.
 *
 * Kho này cố ý **nuốt mọi lỗi và trả về trạng thái "chưa từng đi"**. Vòng dẫn
 * là thứ phụ trợ; nếu kho hỏng mà kéo sập trang chủ giám đốc thì cái giá đắt
 * hơn nhiều lần lợi ích của nó — đúng bài học ngày 13/09, khi một nhịp đọc
 * chấm công hỏng làm sập nguyên màn soát vé.
 *
 * Hệ quả phải nói ra: kho hỏng thì vòng dẫn có thể chào lại từ đầu. Đó là hỏng
 * theo hướng vô hại, và là hướng duy nhất chấp nhận được.
 */

const CHUA_DI: TienDoVongDan = {
  changHienTai: 1,
  daXong: false,
  boQua: false,
  tungDi: false,
};

function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-huong-dan" } },
  });
}

export async function readTienDoVongDan(input: {
  accountId: string;
  vongId: string;
}): Promise<TienDoVongDan> {
  const client = createAdminClient();
  if (!client) return CHUA_DI;
  const { data, error } = await client.rpc("erp_doc_tien_do_huong_dan", {
    p_tenant_id: TENANT_ID,
    p_account_id: input.accountId,
    p_vong_id: input.vongId,
  });
  if (error) {
    console.error("Đọc tiến độ vòng dẫn không thành", error);
    return CHUA_DI;
  }
  return tienDoFrom(data);
}

export async function writeTienDoVongDan(input: {
  accountId: string;
  vongId: string;
  chang: number;
  xong?: boolean;
  boQua?: boolean;
  diLai?: boolean;
}): Promise<TienDoVongDan> {
  const client = createAdminClient();
  if (!client) return CHUA_DI;
  const { data, error } = await client.rpc("erp_ghi_tien_do_huong_dan", {
    p_tenant_id: TENANT_ID,
    p_account_id: input.accountId,
    p_vong_id: input.vongId,
    p_chang: input.chang,
    p_xong: input.xong ?? false,
    p_bo_qua: input.boQua ?? false,
    p_di_lai: input.diLai ?? false,
  });
  if (error) {
    console.error("Ghi tiến độ vòng dẫn không thành", error);
    return CHUA_DI;
  }
  return tienDoFrom(data);
}
