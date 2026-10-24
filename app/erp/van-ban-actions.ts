"use server";

import { revalidatePath } from "next/cache";
import { vaiDuyetDuoc } from "@/domain/van-ban";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { VanBanLoi, duyetNop } from "@/lib/van-ban/van-ban-repository";

/** Duyệt văn bản đang chờ: nhận vào hệ thống (áp dụng luôn) hoặc trả lại kèm lý do. */
export async function duyetVanBanAction(id: string, quyet: "nhan" | "tra-lai", ghiChu: string): Promise<{ ok: true; apDung: string | null } | { ok: false; loi: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, loi: "Phiên đăng nhập đã hết. Xin đăng nhập lại." };
  if (!/^[0-9a-f-]{36}$/.test(String(id)) || (quyet !== "nhan" && quyet !== "tra-lai")) return { ok: false, loi: "Yêu cầu không hợp lệ." };
  try {
    const { apDung } = await duyetNop({
      id,
      quyet,
      ghiChu: String(ghiChu ?? "").slice(0, 300),
      nguoi: { id: user.id, ten: user.name },
      vaiDuoc: (loai) => vaiDuyetDuoc(loai, user.role),
    });
    revalidatePath("/erp/van-ban");
    revalidatePath("/erp/thuyen");
    return { ok: true, apDung };
  } catch (error) {
    return { ok: false, loi: error instanceof VanBanLoi ? error.message : "Chưa duyệt được. Xin thử lại." };
  }
}
