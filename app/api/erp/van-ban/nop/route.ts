import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { vaiDuyetDuoc, type NhanXetAi } from "@/domain/van-ban";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { soatTep } from "@/lib/van-ban/cong";
import { docPhieuSoat } from "@/lib/van-ban/ky-so";
import { bamTep } from "@/lib/van-ban/pdf-van-ban";
import { VanBanLoi, boTep, ghiNop, luuTep } from "@/lib/van-ban/van-ban-repository";

/**
 * Cổng nhận văn bản, bước 2: đưa vào hệ thống. Soát lại chữ ký, băm và luật
 * trên chính tệp gửi lên (không tin kết quả cũ ở trình duyệt); nhận xét AI
 * lấy từ phiếu soát đã ký. Người có vai nhận thì vào thẳng, AI giữ lại hoặc
 * người nộp không có vai thì thành "chờ duyệt".
 */

export const maxDuration = 60;
const TEP_TOI_DA = 3_500_000;

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const tep = form?.get("tep");
  const phieu = form?.get("phieu");
  if (!(tep instanceof File) || tep.size === 0 || tep.size > TEP_TOI_DA || typeof phieu !== "string") {
    return NextResponse.json({ message: "Thiếu tệp hoặc phiếu soát. Xin soát lại tệp rồi nộp." }, { status: 400 });
  }
  const bytes = new Uint8Array(await tep.arrayBuffer());
  const daSoat = docPhieuSoat(phieu, bamTep(bytes));
  if (!daSoat) return NextResponse.json({ message: "Phiếu soát đã hết hạn hoặc không khớp tệp. Xin soát lại." }, { status: 409 });

  const kq = await soatTep(bytes, tep.name.slice(0, 200), { aiSan: (daSoat.ai as NhanXetAi | null) ?? null });
  if (kq.quyet === "tra-lai" || !kq.phatHanh) {
    return NextResponse.json({ message: kq.lyDoTra || "Văn bản chưa qua cổng.", ketQua: kq }, { status: 422 });
  }
  const coVai = vaiDuyetDuoc(kq.phatHanh.loai, user.role);
  const ketQua = kq.quyet === "nhan-duoc" && coVai ? "nhan" : "cho-duyet";
  const lyDo =
    ketQua === "nhan"
      ? ""
      : kq.quyet === "cho-duyet"
        ? "AI thấy điều cần người xem lại trước khi nhận."
        : "Người nộp không có vai nhận loại văn bản này; chờ quản lý hoặc giám đốc duyệt.";

  let duong: string | null = null;
  try {
    duong = await luuTep(bytes);
    const ghi = await ghiNop({
      phatHanhId: kq.phatHanh.id,
      ketQua,
      lyDo,
      giaTri: kq.giaTri,
      phatHien: kq.khongAi,
      ai: kq.ai,
      maBamTep: kq.maBamTep,
      tenTep: kq.tenTep,
      tepPath: duong,
      nguoi: { id: user.id, ten: user.name },
    });
    revalidatePath("/erp/van-ban");
    if (ketQua === "nhan" && kq.phatHanh.loai === "hop-dong-nguoi-cheo") revalidatePath("/erp/thuyen");
    return NextResponse.json({ id: ghi.id, ketQua, soVanBan: ghi.soVanBan, apDung: ghi.apDung, lyDo });
  } catch (error) {
    if (duong) await boTep(duong).catch(() => undefined);
    if (error instanceof VanBanLoi) return NextResponse.json({ message: error.message }, { status: 409 });
    console.error("Van ban submit failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "Chưa nộp được. Xin thử lại." }, { status: 500 });
  }
}
