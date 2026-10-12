import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { baoDongDangMo } from "@/lib/erp/khan-cap-repository";

/**
 * Cảnh báo khẩn cấp đang chờ mà tài khoản đăng nhập (cấp trên) phải thấy.
 * Màn ERP hỏi mỗi vài giây; trả kèm giờ máy chủ để đồng hồ đếm khớp nhau.
 */
export async function GET() {
  const user = await getCurrentErpUser();
  if (!user) return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const ds = await baoDongDangMo(user.id);
  return Response.json({ ok: true, baoDong: ds, bayGio: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
