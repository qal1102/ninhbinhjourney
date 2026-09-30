"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId, type ErpSiteId } from "@/domain/erp";
import { benCuaCoSo } from "@/domain/hang-cho";
import { accountCanAccessModule, getCurrentErpUser } from "@/lib/erp/demo-session";
import { HangChoLoi, caiDatHangCho, danhDauLuot, goiTiep } from "@/lib/hang-cho-repository";

/**
 * Hàng chờ ảo bến đò, phía nhân viên (màn Sức chứa). Ai mở được màn Sức chứa
 * của cơ sở thì gọi lượt được; tạm dừng nhận số chỉ quản lý và giám đốc.
 */

export type HangChoActionState = { status: "idle" | "success" | "error"; message: string };

async function nguoiCoQuyen(siteIdTho: FormDataEntryValue | null, canQuanLy = false) {
  const siteId = String(siteIdTho ?? "");
  if (!isErpSiteId(siteId) || !benCuaCoSo(siteId)) throw new Error("Cơ sở này không có hàng chờ.");
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (!accountCanAccessModule(user, siteId, "suc-chua")) throw new Error("Bạn chưa được giao màn Sức chứa ở cơ sở này.");
  if (canQuanLy && user.role !== "director" && user.role !== "manager") {
    throw new Error("Chỉ quản lý hoặc giám đốc được tạm dừng hay mở lại hàng chờ.");
  }
  return { user, siteId: siteId as ErpSiteId };
}

function loi(error: unknown): HangChoActionState {
  if (error instanceof z.ZodError) return { status: "error", message: error.issues[0]?.message ?? "Dữ liệu chưa đúng." };
  if (error instanceof HangChoLoi || error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa làm được, xin thử lại." };
}

export async function goiLuotTiepAction(_truoc: HangChoActionState, formData: FormData): Promise<HangChoActionState> {
  try {
    const { user, siteId } = await nguoiCoQuyen(formData.get("siteId"));
    const soNhom = z.coerce.number().int().min(1).max(20).parse(formData.get("soNhom"));
    const da = await goiTiep(siteId, soNhom, user.id);
    revalidatePath(`/erp/${siteId}/suc-chua`);
    return da === 0
      ? { status: "success", message: "Không còn nhóm nào đang chờ." }
      : { status: "success", message: `Đã gọi ${da} nhóm. Máy của khách tự báo trong vòng 15 giây.` };
  } catch (error) {
    return loi(error);
  }
}

export async function danhDauLuotAction(_truoc: HangChoActionState, formData: FormData): Promise<HangChoActionState> {
  try {
    const { user, siteId } = await nguoiCoQuyen(formData.get("siteId"));
    const id = z.uuid().parse(formData.get("id"));
    const trangThai = z.enum(["da-len", "bo-luot", "da-goi", "khach-huy"]).parse(formData.get("trangThai"));
    const xong = await danhDauLuot(siteId, id, trangThai, user.id);
    revalidatePath(`/erp/${siteId}/suc-chua`);
    if (!xong) return { status: "error", message: "Lượt này đã được người khác xử lý. Màn hình vừa tải lại." };
    return {
      status: "success",
      message:
        trangThai === "da-len"
          ? "Đã ghi lên đò."
          : trangThai === "bo-luot"
            ? "Đã bỏ lượt, nhường nhóm sau."
            : trangThai === "khach-huy"
              ? "Đã huỷ hẳn lượt này."
              : "Đã gọi lại lượt này.",
    };
  } catch (error) {
    return loi(error);
  }
}

export async function caiDatHangChoAction(_truoc: HangChoActionState, formData: FormData): Promise<HangChoActionState> {
  try {
    const { user, siteId } = await nguoiCoQuyen(formData.get("siteId"), true);
    const dangNhan = formData.get("dangNhan") === "1";
    const loiTamDung = z.string().trim().max(200, "Lời nhắn tối đa 200 ký tự.").parse(formData.get("loiTamDung") ?? "");
    if (!dangNhan && loiTamDung.length < 5) {
      return { status: "error", message: "Ghi một lời nhắn cho khách (ít nhất 5 ký tự), ví dụ: “Nước lên, bến tạm nghỉ tới 14:00”." };
    }
    await caiDatHangCho(siteId, dangNhan, loiTamDung, user.id);
    revalidatePath(`/erp/${siteId}/suc-chua`);
    return {
      status: "success",
      message: dangNhan ? "Đã mở lại nhận số." : "Đã tạm dừng nhận số. Khách đang cầm số vẫn được gọi như thường.",
    };
  } catch (error) {
    return loi(error);
  }
}
