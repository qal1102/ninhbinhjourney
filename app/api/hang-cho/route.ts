import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { laMaBen, trongGioNhanSo } from "@/domain/hang-cho";
import { HangChoLoi, docTongQuanBen, huyLuot, laySo, xemLuot } from "@/lib/hang-cho-repository";

/**
 * Hàng chờ ảo bến đò cho khách: xem hàng (GET), lấy số, xem lượt của mình,
 * huỷ lượt (POST). Không cần đăng nhập; lượt của khách nhận ra bằng chuỗi bí
 * mật máy chủ phát lúc lấy số, gửi trong thân yêu cầu chứ không trên đường
 * dẫn để khỏi nằm trong nhật ký truy cập.
 */

const MAX_BODY_BYTES = 2 * 1024;
const BiMat = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

const YeuCau = z.discriminatedUnion("hanh_dong", [
  z.object({
    hanh_dong: z.literal("lay-so"),
    ben: z.string(),
    so_khach: z.number().int().min(1).max(6),
    ngon_ngu: z.enum(["vi", "en"]),
    ma_may: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  }),
  z.object({ hanh_dong: z.literal("xem"), bi_mat: BiMat }),
  z.object({ hanh_dong: z.literal("huy"), bi_mat: BiMat }),
]);

function traVe(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function traLoi(error: unknown) {
  if (error instanceof HangChoLoi) {
    const status = error.ma === "CHUA_NOI_KHO" ? 503 : error.ma === "KHONG_CO" ? 404 : error.ma === "LOI" ? 502 : 409;
    return traVe({ ok: false, ma: error.ma }, status);
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) return traVe({ ok: false, ma: "SAI_YEU_CAU" }, 400);
  console.error("Queue route failed", error);
  return traVe({ ok: false, ma: "LOI" }, 500);
}

export async function GET(request: Request) {
  const ben = new URL(request.url).searchParams.get("ben") ?? "";
  if (!laMaBen(ben)) return traVe({ ok: false, ma: "KHONG_CO" }, 404);
  try {
    const tongQuan = await docTongQuanBen(ben);
    return traVe({ ok: true, tong_quan: { ...tongQuan, ngoaiGio: !trongGioNhanSo() } });
  } catch (error) {
    return traLoi(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) return traVe({ ok: false, ma: "SAI_NGUON" }, 403);
  try {
    const tho = await request.text();
    if (new TextEncoder().encode(tho).byteLength > MAX_BODY_BYTES) return traVe({ ok: false, ma: "QUA_DAI" }, 413);
    const yc = YeuCau.parse(JSON.parse(tho));
    if (yc.hanh_dong === "lay-so") {
      if (!laMaBen(yc.ben)) return traVe({ ok: false, ma: "KHONG_CO" }, 404);
      if (!trongGioNhanSo()) return traVe({ ok: false, ma: "NGOAI_GIO" }, 409);
      const kq = await laySo({ ben: yc.ben, soKhach: yc.so_khach, ngonNgu: yc.ngon_ngu, maMay: yc.ma_may });
      return traVe({ ok: true, bi_mat: kq.bimat, so_thu_tu: kq.soThuTu, da_co: kq.daCo });
    }
    if (yc.hanh_dong === "xem") {
      const luot = await xemLuot(yc.bi_mat);
      return luot ? traVe({ ok: true, luot }) : traVe({ ok: false, ma: "KHONG_THAY" }, 404);
    }
    return traVe({ ok: true, da_huy: await huyLuot(yc.bi_mat) });
  } catch (error) {
    return traLoi(error);
  }
}
