import { NextResponse } from "next/server";
import { z } from "zod";
import { HUONG_DAN_DOC, TrichXuat } from "@/domain/soat-giay-to";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

/**
 * Đọc một ảnh giấy tờ bằng AI cho màn Soát giấy tờ (`/erp/soat-giay-to`).
 * Chỉ trả các trường đọc được; kết luận đúng/thiếu do `kiemGiayTo` quyết ở
 * trình duyệt. Ảnh không được lưu ở đâu: đọc xong là bỏ.
 */

export const maxDuration = 60;

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const LUOT_MOI_NGAY = 40;
const luot = new Map<string, number[]>();

const YeuCau = z.object({
  anh: z
    .string()
    .max(MAX_BODY_BYTES)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
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
    return NextResponse.json({ message: "Máy chủ chưa bật AI (thiếu AI_API_KEY), nên chưa đọc được ảnh." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Ảnh quá lớn. Xin chụp lại hoặc chọn ảnh nhỏ hơn." }, { status: 413 });
  }
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Chỉ nhận ảnh JPEG, PNG hoặc WebP." }, { status: 400 });
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
            { type: "text", text: "Trích giấy tờ trong ảnh." },
            { type: "image_url", image_url: { url: parsed.data.anh } },
          ],
        },
      ],
      khuon: { ten: "giay_to", schema: KHUON },
      quyThoiGianMs: 40_000,
    });
    const trich = TrichXuat.safeParse(JSON.parse(noiDung));
    if (!trich.success) {
      return NextResponse.json({ message: "AI đọc ảnh nhưng trả về không đúng khuôn. Xin thử lại." }, { status: 502 });
    }
    return NextResponse.json({ trich: trich.data, moHinh }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Document check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "AI chưa đọc được ảnh lúc này (hết lượt hoặc quá tải). Xin thử lại sau ít phút." }, { status: 502 });
  }
}
