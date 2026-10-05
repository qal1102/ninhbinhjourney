"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { laCoSoThuyen, type CoSoThuyen } from "@/domain/thuyen-song";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ghiNguoiCheo, ThuyenLoi, xoaNguoiCheo } from "@/lib/erp/thuyen-repository";

/**
 * Sổ người chèo (migration 111): giám đốc và quản lý của đúng bến sửa được,
 * cùng luật xem với bản đồ thuyền.
 */

type KetQua = { ok: true } | { ok: false; loi: string };

async function nguoiSuaDuoc(coSo: string): Promise<{ coSo: CoSoThuyen } | { loi: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { loi: "Phiên đăng nhập đã hết. Xin đăng nhập lại." };
  if (!laCoSoThuyen(coSo)) return { loi: "Bến không hợp lệ." };
  const duoc = user.role === "director" || (user.role === "manager" && user.siteIds.includes(coSo));
  if (!duoc) return { loi: "Chỉ giám đốc và quản lý của bến sửa được sổ người chèo." };
  return { coSo };
}

const NguoiCheoSchema = z.object({
  id: z.uuid().optional(),
  coSo: z.string(),
  soThuyen: z.string().trim().min(1, "Nhập số thuyền.").max(20, "Số thuyền tối đa 20 ký tự."),
  hoTen: z.string().trim().min(2, "Nhập họ tên người chèo.").max(120),
  soDienThoai: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^[0-9 +.]{8,20}$/.test(v), "Số điện thoại chỉ gồm chữ số, dấu cách, dấu chấm hay dấu +.")
    .optional(),
});

export async function luuNguoiCheoAction(duLieu: z.input<typeof NguoiCheoSchema>): Promise<KetQua> {
  const kiem = NguoiCheoSchema.safeParse(duLieu);
  if (!kiem.success) return { ok: false, loi: kiem.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const quyen = await nguoiSuaDuoc(kiem.data.coSo);
  if ("loi" in quyen) return { ok: false, loi: quyen.loi };
  try {
    await ghiNguoiCheo({
      id: kiem.data.id,
      coSo: quyen.coSo,
      soThuyen: kiem.data.soThuyen,
      hoTen: kiem.data.hoTen,
      soDienThoai: kiem.data.soDienThoai || null,
    });
    revalidatePath("/erp/thuyen");
    return { ok: true };
  } catch (error) {
    return { ok: false, loi: error instanceof ThuyenLoi ? error.message : "Chưa lưu được. Xin thử lại." };
  }
}

export async function xoaNguoiCheoAction(coSo: string, id: string): Promise<KetQua> {
  const quyen = await nguoiSuaDuoc(coSo);
  if ("loi" in quyen) return { ok: false, loi: quyen.loi };
  if (!z.uuid().safeParse(id).success) return { ok: false, loi: "Yêu cầu không hợp lệ." };
  try {
    await xoaNguoiCheo(quyen.coSo, id);
    revalidatePath("/erp/thuyen");
    return { ok: true };
  } catch (error) {
    return { ok: false, loi: error instanceof ThuyenLoi ? error.message : "Chưa xoá được. Xin thử lại." };
  }
}
