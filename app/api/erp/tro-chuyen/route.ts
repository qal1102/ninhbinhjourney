import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { conLuot, danhBa } from "@/lib/tro-chuyen/dich-vu";
import { cauHinhRealtime, kenhHopThu } from "@/lib/tro-chuyen/thoi-gian-thuc";
import { TroChuyenLoi, dsPhong, moPhongRieng, taoNhom } from "@/lib/tro-chuyen/tro-chuyen-repository";

/**
 * Trò chuyện: danh sách phòng của tôi (GET) và mở phòng mới (POST: nhắn riêng
 * một người, hoặc lập nhóm). Kèm kênh hộp thư và khoá công khai để trình duyệt
 * nghe tín hiệu "có tin mới".
 */

export async function GET() {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  try {
    const phong = await dsPhong(user.id);
    return NextResponse.json(
      {
        phong,
        chuaDoc: phong.reduce((t, p) => t + p.chuaDoc, 0),
        hopThu: kenhHopThu(user.id),
        realtime: cauHinhRealtime(),
        toi: { id: user.id, ten: user.name },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ message: error instanceof TroChuyenLoi ? error.message : "Chưa đọc được trò chuyện." }, { status: 500 });
  }
}

const YeuCau = z.discriminatedUnion("kieu", [
  z.object({ kieu: z.literal("rieng"), voi: z.string().min(1).max(80) }),
  z.object({ kieu: z.literal("nhom"), ten: z.string().trim().min(1).max(80), thanhVien: z.array(z.string().min(1).max(80)).min(1).max(40) }),
]);

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Chọn người để nhắn." }, { status: 400 });
  if (!conLuot(`phong:${user.id}`, 30, 3_600_000)) return NextResponse.json({ message: "Bạn mở nhiều cuộc trò chuyện quá, xin thử lại sau." }, { status: 429 });
  const ds = await danhBa();
  const theoId = new Map(ds.map((p) => [p.id, p]));
  try {
    if (parsed.data.kieu === "rieng") {
      const nguoi = theoId.get(parsed.data.voi);
      if (!nguoi || nguoi.id === user.id) return NextResponse.json({ message: "Không thấy người này trong danh bạ." }, { status: 404 });
      const id = await moPhongRieng({ id: user.id, ten: user.name }, { id: nguoi.id, ten: nguoi.ten });
      return NextResponse.json({ id });
    }
    const thanhVien = [...new Set(parsed.data.thanhVien)].filter((id) => id !== user.id).map((id) => theoId.get(id));
    if (thanhVien.some((p) => !p) || thanhVien.length === 0) return NextResponse.json({ message: "Có người không còn trong danh bạ." }, { status: 400 });
    const id = await taoNhom({ id: user.id, ten: user.name }, parsed.data.ten, thanhVien.map((p) => ({ id: p!.id, ten: p!.ten })));
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ message: error instanceof TroChuyenLoi ? error.message : "Chưa mở được cuộc trò chuyện." }, { status: 400 });
  }
}
