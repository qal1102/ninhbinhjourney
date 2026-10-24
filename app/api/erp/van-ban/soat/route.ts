import { NextResponse } from "next/server";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { soatTep } from "@/lib/van-ban/cong";
import { kyPhieuSoat } from "@/lib/van-ban/ky-so";
import { ghiNop } from "@/lib/van-ban/van-ban-repository";

/**
 * Cổng nhận văn bản, bước 1: soát tệp, chưa ghi gì vào hệ thống (trừ dòng
 * "cổng đã chặn" khi tệp bị trả). Trả kết quả kèm phiếu soát để bước Nộp dùng
 * lại nhận xét AI.
 */

export const maxDuration = 60;

// Vercel nhận thân yêu cầu tới ~4,5MB.
const TEP_TOI_DA = 3_500_000;
const LUOT_MOI_NGAY = 60;
const luot = new Map<string, number[]>();

function conLuot(id: string, bayGio = Date.now()) {
  const cu = (luot.get(id) ?? []).filter((t) => bayGio - t < 86_400_000);
  if (cu.length >= LUOT_MOI_NGAY) return false;
  luot.set(id, [...cu, bayGio]);
  return true;
}

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? "0") > TEP_TOI_DA + 50_000) {
    return NextResponse.json({ message: "Tệp lớn quá 3,5MB. Văn bản hệ thống phát hành chỉ khoảng 300KB." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const tep = form?.get("tep");
  if (!(tep instanceof File) || tep.size === 0) return NextResponse.json({ message: "Chọn một tệp để soát." }, { status: 400 });
  if (tep.size > TEP_TOI_DA) return NextResponse.json({ message: "Tệp lớn quá 3,5MB." }, { status: 413 });
  if (!conLuot(user.id)) return NextResponse.json({ message: `Hôm nay tài khoản này đã soát ${LUOT_MOI_NGAY} tệp, mai thử lại.` }, { status: 429 });

  try {
    const kq = await soatTep(new Uint8Array(await tep.arrayBuffer()), tep.name.slice(0, 200));
    if (kq.quyet === "tra-lai") {
      await ghiNop({
        phatHanhId: kq.phatHanh?.id ?? null,
        ketQua: "tra-lai",
        lyDo: kq.lyDoTra,
        giaTri: kq.giaTri,
        phatHien: kq.khongAi.filter((p) => p.mucDo !== "dat"),
        ai: kq.ai,
        maBamTep: kq.maBamTep,
        tenTep: kq.tenTep,
        tepPath: null,
        nguoi: { id: user.id, ten: user.name },
      }).catch((error) => console.error("Van ban reject log failed", error instanceof Error ? error.message : error));
    }
    const phieu = kq.quyet === "tra-lai" ? null : kyPhieuSoat({ maBamTep: kq.maBamTep, ai: kq.ai, heThan: Date.now() + 30 * 60_000 });
    return NextResponse.json({ ketQua: kq, phieu }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Van ban check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "Cổng chưa soát được tệp này. Xin thử lại." }, { status: 500 });
  }
}
