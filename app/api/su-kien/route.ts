import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { conLuot } from "@/lib/gioi-han-luot";
import { dangKySuKien, SuKienError, traSuKien } from "@/lib/customer-data/su-kien-repository";

/**
 * Sự kiện (migration 127). POST `dang-ky`: số điện thoại + đồng ý liên hệ khi
 * trúng (bắt buộc) + đồng ý nhận tin (ô riêng). POST `tra`: đã đăng ký chưa,
 * mấy lượt, trúng không, mã nhận giải. Mỗi IP 10 lượt trong 10 phút.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;
const Slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,59}$/);
const So = z.string().trim().min(9).max(20);

const YeuCau = z.discriminatedUnion("hanh_dong", [
  z.object({ hanh_dong: z.literal("dang-ky"), slug: Slug, so_dien_thoai: So, dong_y_lien_he: z.literal(true), dong_y_tiep_thi: z.boolean() }).strict(),
  z.object({ hanh_dong: z.literal("tra"), slug: Slug, so_dien_thoai: So }).strict(),
]);

function traLoi(error: unknown) {
  const loi = error instanceof SuKienError ? error : null;
  const status = loi?.code === "NOT_FOUND" ? 404 : loi?.code === "CONFIGURATION_MISSING" ? 503 : loi?.code === "INPUT_INVALID" ? 400 : loi?.code === "REFUSED" ? 409 : 500;
  return Response.json({ accepted: false, error: { message: loi?.message ?? "Chưa xử lý được, xin thử lại." } }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json({ accepted: false, error: { message: "Yêu cầu không đến từ trang Ninh Bình Journey." } }, { status: 403, headers: NO_STORE });
  }
  if (!conLuot(request, "su-kien", 10, 10 * 60_000)) {
    return Response.json({ accepted: false, error: { message: "Bạn thử nhiều lần quá. Mời bạn quay lại sau 10 phút." } }, { status: 429, headers: NO_STORE });
  }
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ accepted: false, error: { message: "Mời bạn nhập số điện thoại và tích ô đồng ý liên hệ." } }, { status: 400, headers: NO_STORE });
  }
  try {
    if (parsed.data.hanh_dong === "dang-ky") {
      const ket = await dangKySuKien({ slug: parsed.data.slug, phone: parsed.data.so_dien_thoai, marketing: parsed.data.dong_y_tiep_thi });
      return Response.json({ accepted: true, dangKy: ket }, { headers: NO_STORE });
    }
    const ket = await traSuKien({ slug: parsed.data.slug, phone: parsed.data.so_dien_thoai });
    return Response.json({ accepted: true, tra: ket }, { headers: NO_STORE });
  } catch (error) {
    return traLoi(error);
  }
}
