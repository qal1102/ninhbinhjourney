import { NextResponse } from "next/server";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { dsPhong, tepTrongMay } from "@/lib/tro-chuyen/tro-chuyen-repository";

/** Chỉ bản chạy ở máy: tệp trò chuyện nằm trong bộ nhớ. Production dùng đường dẫn ký của kho. */
export async function GET(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const m = /^tc\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.[a-z]{3,4}$/.exec(path);
  if (!m) return NextResponse.json({ message: "Không hợp lệ." }, { status: 400 });
  if (!(await dsPhong(user.id)).some((p) => p.id === m[1])) return NextResponse.json({ message: "Không được xem tệp này." }, { status: 403 });
  const tep = tepTrongMay(path);
  if (!tep) return NextResponse.json({ message: "Không thấy tệp." }, { status: 404 });
  return new NextResponse(Buffer.from(tep.bytes), { headers: { "Content-Type": tep.kieu, "Cache-Control": "private, max-age=3600" } });
}
