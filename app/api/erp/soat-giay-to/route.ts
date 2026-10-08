import { NextResponse } from "next/server";
import { z } from "zod";
import { HUONG_DAN_DOC, TrichXuat } from "@/domain/soat-giay-to";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

/**
 * Đọc một ảnh hay tệp PDF giấy tờ bằng AI cho màn Soát giấy tờ
 * (`/erp/soat-giay-to`). Chỉ trả các trường đọc được; kết luận đúng/thiếu do
 * `kiemGiayTo` quyết ở trình duyệt. Tệp không được lưu ở đâu: đọc xong là bỏ.
 * Gemini nhận PDF qua cùng ô `image_url` (data:application/pdf), đã thử 09/10/2026.
 */

export const maxDuration = 60;

// Vercel giới hạn thân yêu cầu ~4,5MB; base64 làm tệp to thêm 1/3, nên tệp gốc tối đa ~3MB.
const MAX_BODY_BYTES = 4_400_000;
const LUOT_MOI_NGAY = 40;
const luot = new Map<string, number[]>();

const YeuCau = z.object({
  anh: z
    .string()
    .max(MAX_BODY_BYTES)
    .regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/),
});

const KHUON: Record<string, unknown> = { ...z.toJSONSchema(TrichXuat) };
delete KHUON.$schema;

function conLuot(id: string, bayGio = Date.now()) {
  const cu = (luot.get(id) ?? []).filter((t) => bayGio - t < 86_400_000);
  if (cu.length >= LUOT_MOI_NGAY) return false;
  luot.set(id, [...cu, bayGio]);
  return true;
}

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  if (!coMoHinhAi()) {
    return NextResponse.json({ message: "AI chưa được bật cho hệ thống này, nên chưa đọc được giấy tờ." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Tệp quá lớn. Xin chụp lại hoặc chọn tệp nhỏ hơn 3MB." }, { status: 413 });
  }
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Chỉ nhận ảnh chụp hoặc tệp PDF, nhỏ hơn 3MB." }, { status: 400 });
  }
  if (!conLuot(user.id)) {
    return NextResponse.json({ message: `Hôm nay tài khoản này đã soát ${LUOT_MOI_NGAY} giấy tờ, mai thử lại.` }, { status: 429 });
  }

  try {
    const { noiDung, moHinh } = await hoiMoHinh({
      tinNhan: [
        { role: "system", content: HUONG_DAN_DOC },
        {
          role: "user",
          content: [
            { type: "text", text: "Trích giấy tờ trong tệp này. Tệp nhiều trang thì đọc trang có nội dung chính, danh sách đoàn thì đọc đủ mọi trang." },
            { type: "image_url", image_url: { url: parsed.data.anh } },
          ],
        },
      ],
      khuon: { ten: "giay_to", schema: KHUON },
      quyThoiGianMs: 45_000,
    });
    const trich = TrichXuat.safeParse(JSON.parse(noiDung));
    if (!trich.success) {
      return NextResponse.json({ message: "AI chưa đọc rõ giấy tờ này. Xin thử lại." }, { status: 502 });
    }
    return NextResponse.json({ trich: trich.data, moHinh }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Document check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "AI đang bận, chưa đọc được giấy tờ lúc này. Xin thử lại sau ít phút." }, { status: 502 });
  }
}
