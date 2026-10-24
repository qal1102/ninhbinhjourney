import { NextResponse } from "next/server";
import { KIEU_TEP_NHAN, TEP_TOI_DA_BYTE } from "@/domain/tro-chuyen";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { conLuot } from "@/lib/tro-chuyen/dich-vu";
import { TroChuyenLoi, cauTep, dsPhong } from "@/lib/tro-chuyen/tro-chuyen-repository";

/**
 * Tải một tệp lên trước khi gửi tin (nút + → Ảnh / Tệp). Ảnh đã được thu nhỏ ở
 * trình duyệt. Chỉ nhận kiểu tệp văn phòng và ảnh thường gặp, tối đa 4MB.
 * Kiểu tệp xét theo vài byte đầu, không tin phần đuôi tên tệp.
 */

export const maxDuration = 30;

function dauTep(b: Uint8Array): string | null {
  const hex = Buffer.from(b.subarray(0, 8)).toString("hex");
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("47494638")) return "image/gif";
  if (hex.startsWith("52494646") && Buffer.from(b.subarray(8, 12)).toString("latin1") === "WEBP") return "image/webp";
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("504b0304")) return "zip";
  return null;
}

export async function POST(request: Request, ctx: { params: Promise<{ phong: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const { phong: phongId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(phongId)) return NextResponse.json({ message: "Mã không hợp lệ." }, { status: 400 });
  if (!conLuot(`tep:${user.id}`, 40, 600_000)) return NextResponse.json({ message: "Bạn tải nhiều tệp quá, xin thử lại sau ít phút." }, { status: 429 });
  const phong = (await dsPhong(user.id).catch(() => [])).find((p) => p.id === phongId);
  if (!phong) return NextResponse.json({ message: "Bạn không ở trong cuộc trò chuyện này." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const tep = form?.get("tep");
  if (!(tep instanceof File) || tep.size === 0) return NextResponse.json({ message: "Chưa chọn tệp." }, { status: 400 });
  if (tep.size > TEP_TOI_DA_BYTE) return NextResponse.json({ message: "Tệp lớn quá 4MB." }, { status: 413 });
  const kieu = tep.type in KIEU_TEP_NHAN ? tep.type : null;
  if (!kieu) return NextResponse.json({ message: "Chỉ gửi được ảnh, PDF, Word, Excel, PowerPoint, TXT hay CSV." }, { status: 415 });
  const bytes = new Uint8Array(await tep.arrayBuffer());
  const dau = dauTep(bytes);
  // Ảnh, PDF phải đúng chữ ký tệp; Word/Excel/PowerPoint là tệp zip; TXT, CSV thì không được là loại nào ở trên.
  const hop = kieu.startsWith("image/") || kieu === "application/pdf" ? dau === kieu : kieu.includes("openxmlformats") ? dau === "zip" : dau === null;
  if (!hop) return NextResponse.json({ message: "Nội dung tệp không khớp kiểu tệp." }, { status: 415 });
  try {
    const path = await cauTep(phongId, bytes, kieu, KIEU_TEP_NHAN[kieu]);
    return NextResponse.json({ path, ten: tep.name.slice(0, 120), co: tep.size, kieu });
  } catch (error) {
    return NextResponse.json({ message: error instanceof TroChuyenLoi ? error.message : "Chưa tải được tệp." }, { status: 500 });
  }
}
