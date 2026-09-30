"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chonThang, goiYMa, laMaDaiLy, tien } from "@/domain/dai-ly";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { capKhoaMoi, DaiLyLoi, doiTrangThaiDaiLy, ghiDaChi, taoDaiLy } from "@/lib/dai-ly-repository";

/**
 * Sổ đại lý (`/erp/dai-ly`). Giám đốc thêm đại lý, cấp khoá cổng, tạm ngưng;
 * giám đốc và kế toán ghi đã chi hoa hồng tháng đã khép.
 */

export type DaiLyActionState = {
  status: "idle" | "success" | "error";
  message: string;
  /** Đường dẫn cổng kèm khoá: chỉ hiện đúng một lần, ngay sau khi cấp. */
  duongCong?: string;
};

async function giamDoc() {
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (user.role !== "director") throw new Error("Chỉ giám đốc được thêm đại lý hay đổi khoá cổng.");
  return user;
}

function loi(error: unknown): DaiLyActionState {
  if (error instanceof z.ZodError) return { status: "error", message: error.issues[0]?.message ?? "Dữ liệu chưa đúng." };
  if (error instanceof DaiLyLoi || error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa làm được, xin thử lại." };
}

const DaiLyMoi = z.object({
  ten: z.string().trim().min(2, "Tên đại lý ít nhất 2 ký tự.").max(120),
  ma: z.string().trim().toUpperCase().max(16),
  nguoiLienHe: z.string().trim().max(80),
  dienThoai: z
    .string()
    .trim()
    .max(20)
    .refine((x) => x === "" || /^[0-9 +.-]{6,20}$/.test(x), "Số điện thoại chỉ gồm số, dấu cách, + . -"),
  tyLe: z.coerce.number().min(0, "Tỷ lệ từ 0%.").max(30, "Tỷ lệ tối đa 30%."),
});

export async function taoDaiLyAction(_truoc: DaiLyActionState, formData: FormData): Promise<DaiLyActionState> {
  try {
    const user = await giamDoc();
    const input = DaiLyMoi.parse({
      ten: formData.get("ten"),
      ma: formData.get("ma") ?? "",
      nguoiLienHe: formData.get("nguoiLienHe") ?? "",
      dienThoai: formData.get("dienThoai") ?? "",
      tyLe: formData.get("tyLe"),
    });
    const ma = input.ma || goiYMa(input.ten);
    if (!laMaDaiLy(ma)) return { status: "error", message: "Mã đại lý gồm 4–16 chữ in hoa hoặc số, không dấu." };
    const { khoa } = await taoDaiLy({ ...input, ma, nguoi: user.id });
    revalidatePath("/erp/dai-ly");
    return {
      status: "success",
      message: `Đã thêm đại lý ${ma}. Gửi cho đại lý đường dẫn cổng dưới đây; nó chỉ hiện một lần.`,
      duongCong: `/dai-ly/${ma}?k=${khoa}`,
    };
  } catch (error) {
    return loi(error);
  }
}

export async function capKhoaCongAction(_truoc: DaiLyActionState, formData: FormData): Promise<DaiLyActionState> {
  try {
    await giamDoc();
    const id = z.uuid().parse(formData.get("id"));
    const ma = z.string().refine(laMaDaiLy).parse(formData.get("ma"));
    const { khoa } = await capKhoaMoi(id);
    revalidatePath("/erp/dai-ly");
    return {
      status: "success",
      message: "Đã cấp khoá mới; đường dẫn cũ thôi mở được. Đường dẫn mới chỉ hiện một lần:",
      duongCong: `/dai-ly/${ma}?k=${khoa}`,
    };
  } catch (error) {
    return loi(error);
  }
}

export async function doiTrangThaiDaiLyAction(_truoc: DaiLyActionState, formData: FormData): Promise<DaiLyActionState> {
  try {
    await giamDoc();
    const id = z.uuid().parse(formData.get("id"));
    const trangThai = z.enum(["hop-tac", "tam-ngung"]).parse(formData.get("trangThai"));
    await doiTrangThaiDaiLy(id, trangThai);
    revalidatePath("/erp/dai-ly");
    return {
      status: "success",
      message: trangThai === "tam-ngung" ? "Đã tạm ngưng: đường dẫn của đại lý thôi ghi đơn mới." : "Đã hợp tác lại.",
    };
  } catch (error) {
    return loi(error);
  }
}

export async function ghiDaChiAction(_truoc: DaiLyActionState, formData: FormData): Promise<DaiLyActionState> {
  try {
    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (user.role !== "director" && user.role !== "chief-accountant" && user.role !== "accountant") {
      throw new Error("Chỉ giám đốc hoặc kế toán được ghi đã chi hoa hồng.");
    }
    const id = z.uuid().parse(formData.get("id"));
    const thang = chonThang(formData.get("thang"));
    const ghiChu = z.string().trim().max(200).parse(formData.get("ghiChu") ?? "");
    const soTien = await ghiDaChi(id, thang, ghiChu, user.id);
    revalidatePath("/erp/dai-ly");
    return { status: "success", message: `Đã ghi chi ${tien(soTien)}, đúng số hoa hồng kho tính ra.` };
  } catch (error) {
    return loi(error);
  }
}
