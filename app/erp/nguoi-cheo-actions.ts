"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { laCoSoThuyen, type CoSoThuyen } from "@/domain/thuyen-song";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { capMaGioiThieu, ghiNguoiCheo, ThuyenLoi, xoaNguoiCheo } from "@/lib/erp/thuyen-repository";

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
  queQuan: z.string().trim().max(80, "Quê tối đa 80 ký tự.").optional(),
  namVaoNghe: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= new Date().getFullYear()), "Năm vào nghề là năm bốn chữ số, không quá năm nay.")
    .optional(),
  ngonNgu: z.string().trim().max(120, "Tiếng chào khách tối đa 120 ký tự.").optional(),
  ghiChu: z.string().trim().max(300, "Ghi chú tối đa 300 ký tự.").optional(),
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
      queQuan: kiem.data.queQuan || null,
      namVaoNghe: kiem.data.namVaoNghe ? Number(kiem.data.namVaoNghe) : null,
      ngonNgu: kiem.data.ngonNgu || null,
      ghiChu: kiem.data.ghiChu || null,
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

/**
 * Cấp mã giới thiệu khách cho một người chèo (migration 116). Mã nằm trong sổ
 * đại lý: khách quét QR `/dl/<mã>` rồi đặt thì đơn ghi cho người ấy, hoa hồng
 * tính và chi ở màn Đại lý & hoa hồng như mọi đại lý khác.
 */
export async function capMaGioiThieuAction(coSo: string, id: string, tyLe: number): Promise<KetQua & { ma?: string }> {
  const quyen = await nguoiSuaDuoc(coSo);
  if ("loi" in quyen) return { ok: false, loi: quyen.loi };
  if (!z.uuid().safeParse(id).success) return { ok: false, loi: "Yêu cầu không hợp lệ." };
  if (!Number.isFinite(tyLe) || tyLe < 0 || tyLe > 30) return { ok: false, loi: "Tỷ lệ hoa hồng từ 0 tới 30%." };
  const user = await getCurrentErpUser();
  try {
    const ma = await capMaGioiThieu(quyen.coSo, id, Math.round(tyLe * 100) / 100, user?.username ?? user?.id ?? "erp");
    revalidatePath("/erp/thuyen");
    revalidatePath("/erp/dai-ly");
    return { ok: true, ma };
  } catch (error) {
    return { ok: false, loi: error instanceof ThuyenLoi ? error.message : "Chưa cấp được mã. Xin thử lại." };
  }
}
