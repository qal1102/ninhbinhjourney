import { NextResponse } from "next/server";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { moTep } from "@/lib/van-ban/van-ban-repository";

/** Tải lại tệp PDF đã nộp (vẫn là bản mã hoá của hệ thống), qua đường dẫn ký 2 phút. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ message: "Mã không hợp lệ." }, { status: 400 });
  const tep = await moTep(id).catch(() => null);
  if (!tep) return NextResponse.json({ message: "Văn bản này không có tệp đính kèm." }, { status: 404 });
  if ("url" in tep) return NextResponse.redirect(tep.url, 302);
  return new NextResponse(Buffer.from(tep.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="van-ban-${id.slice(0, 8)}.pdf"`, "Cache-Control": "no-store" },
  });
}
