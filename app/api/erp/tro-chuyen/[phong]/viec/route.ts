import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ViecGhiLoi, doiTrangThaiViecGhi } from "@/lib/erp/viec-ghi-repository";
import { kenhHopThu, kenhPhong, phatTinHieu } from "@/lib/tro-chuyen/thoi-gian-thuc";
import { dsPhong, guiTin } from "@/lib/tro-chuyen/tro-chuyen-repository";

/**
 * Người nhận bấm "Đã làm xong" (hay người giao bấm "Huỷ") ngay trên thẻ việc
 * trong trò chuyện. Việc đổi trạng thái ở Việc & ghi chú, rồi cả phòng thấy
 * một dòng báo.
 */

const YeuCau = z.object({ viecId: z.string().regex(/^[0-9a-f-]{36}$/), trangThai: z.enum(["xong", "huy", "mo"]), noiDung: z.string().max(200).default("") });

export async function POST(request: Request, ctx: { params: Promise<{ phong: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const { phong: phongId } = await ctx.params;
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!/^[0-9a-f-]{36}$/.test(phongId) || !parsed.success) return NextResponse.json({ message: "Yêu cầu không hợp lệ." }, { status: 400 });
  const phong = (await dsPhong(user.id).catch(() => [])).find((p) => p.id === phongId);
  if (!phong) return NextResponse.json({ message: "Bạn không ở trong cuộc trò chuyện này." }, { status: 403 });
  try {
    await doiTrangThaiViecGhi(parsed.data.viecId, user.id, parsed.data.trangThai);
  } catch (error) {
    return NextResponse.json({ message: error instanceof ViecGhiLoi ? error.message : "Chưa đổi được việc." }, { status: 400 });
  }
  const viec = parsed.data.noiDung ? `“${parsed.data.noiDung}”` : "việc được giao";
  const cau =
    parsed.data.trangThai === "xong" ? `${user.name} đã làm xong ${viec}.` : parsed.data.trangThai === "huy" ? `${user.name} huỷ ${viec}.` : `${user.name} mở lại ${viec}.`;
  await guiTin({ phongId, nguoi: { id: user.id, ten: user.name }, loai: "he-thong", noiDung: cau, tep: [], gan: [], viecId: null }).catch(() => null);
  await phatTinHieu([kenhPhong(phong.kenh), ...phong.thanhVien.filter((t) => t.id !== user.id).map((t) => kenhHopThu(t.id))], "tin", { phong: phongId, tin: "" });
  return NextResponse.json({ ok: true });
}
