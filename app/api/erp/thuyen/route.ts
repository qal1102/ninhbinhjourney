import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { laCoSoThuyen } from "@/domain/thuyen-song";
import { getCurrentErpUser, type CurrentErpUser } from "@/lib/erp/demo-session";
import { batDauChuyen, benThuyen, guiViTri, thuyenTrenSong, ThuyenLoi, veBen } from "@/lib/erp/thuyen-repository";

/**
 * Thuyền trên sông (migration 104).
 *
 * - GET `?coSo=trang-an|tam-coc`: các thuyền thật đang trên sông, kèm vệt 20
 *   phút. Vị trí nhân viên là dữ liệu cá nhân nên chỉ quản lý của cơ sở ấy và
 *   giám đốc xem được.
 * - GET `?coSo=…&phan=ben`: đội thuyền (ngưỡng bến ở màn Sức chứa) và giờ
 *   các lượt khách qua cổng trong ngày, để bản đồ ước số thuyền trên sông.
 *   Chỉ có giờ, không có mã vé hay người quét. Cùng luật xem như trên.
 * - POST `bat-dau` / `vi-tri` / `ve-ben`: trang người chèo (`/erp/thuyen`).
 *   Người gửi phải thuộc đúng cơ sở; kho còn kiểm chuyến có đúng của người ấy.
 */

const MAX_BODY_BYTES = 2_000;

function traVe(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function duocXemBanDo(user: CurrentErpUser, coSo: "trang-an" | "tam-coc") {
  if (user.role === "director") return true;
  return user.role === "manager" && user.siteIds.includes(coSo);
}

export async function GET(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return traVe({ ok: false, ma: "CHUA_DANG_NHAP" }, 401);
  const coSo = new URL(request.url).searchParams.get("coSo") ?? "";
  if (!laCoSoThuyen(coSo)) return traVe({ ok: false, ma: "KHONG_CO" }, 404);
  if (!duocXemBanDo(user, coSo)) return traVe({ ok: false, ma: "KHONG_DUOC_XEM" }, 403);
  try {
    const bayGio = Date.now();
    if (new URL(request.url).searchParams.get("phan") === "ben") {
      return traVe({ ok: true, bayGio: new Date(bayGio).toISOString(), ...(await benThuyen(coSo, bayGio)) });
    }
    return traVe({ ok: true, bayGio: new Date(bayGio).toISOString(), chuyen: await thuyenTrenSong(coSo) });
  } catch (error) {
    const ma = error instanceof ThuyenLoi ? error.ma : "LOI";
    return traVe({ ok: false, ma }, ma === "CHUA_NOI_KHO" ? 503 : 500);
  }
}

const YeuCau = z.discriminatedUnion("hanh_dong", [
  z.object({
    hanh_dong: z.literal("bat-dau"),
    co_so: z.string(),
    so_thuyen: z.string().trim().min(1).max(20),
    so_khach: z.coerce.number().int().min(0).max(12),
  }),
  z.object({
    hanh_dong: z.literal("vi-tri"),
    chuyen_id: z.uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    do_chinh_xac: z.number().min(0).nullable(),
    toc_do: z.number().nullable(),
    huong: z.number().nullable(),
  }),
  z.object({ hanh_dong: z.literal("ve-ben"), chuyen_id: z.uuid() }),
]);

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) return traVe({ ok: false, ma: "SAI_NGUON" }, 403);
  const user = await getCurrentErpUser();
  if (!user) return traVe({ ok: false, ma: "CHUA_DANG_NHAP" }, 401);
  try {
    const tho = await request.text();
    if (new TextEncoder().encode(tho).byteLength > MAX_BODY_BYTES) return traVe({ ok: false, ma: "QUA_DAI" }, 413);
    const yc = YeuCau.parse(JSON.parse(tho));
    if (yc.hanh_dong === "bat-dau") {
      if (!laCoSoThuyen(yc.co_so)) return traVe({ ok: false, ma: "KHONG_CO" }, 404);
      if (!user.siteIds.includes(yc.co_so)) return traVe({ ok: false, ma: "KHONG_THUOC_CO_SO" }, 403);
      const chuyen = await batDauChuyen(yc.co_so, user.id, yc.so_thuyen, yc.so_khach);
      return traVe({ ok: true, chuyen });
    }
    if (yc.hanh_dong === "vi-tri") {
      const daGhi = await guiViTri(yc.chuyen_id, user.id, {
        lat: yc.lat,
        lng: yc.lng,
        doChinhXac: yc.do_chinh_xac,
        tocDo: yc.toc_do,
        huong: yc.huong,
      });
      return traVe({ ok: true, da_ghi: daGhi });
    }
    await veBen(yc.chuyen_id, user.id);
    return traVe({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return traVe({ ok: false, ma: "SAI_DU_LIEU" }, 400);
    if (error instanceof ThuyenLoi) {
      const status = error.ma === "CHUA_NOI_KHO" ? 503 : error.ma === "KHONG_CO" ? 404 : error.ma === "DA_DONG" ? 409 : 500;
      return traVe({ ok: false, ma: error.ma, loi: error.message }, status);
    }
    console.error("Boat API failed", error);
    return traVe({ ok: false, ma: "LOI" }, 500);
  }
}
