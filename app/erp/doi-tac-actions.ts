"use server";

import { revalidatePath } from "next/cache";

import { ghiDoiTac, goDoiTac, SoDoiTacError } from "@/lib/erp/doi-tac-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

/**
 * Sổ liên hệ nhãn hàng đối tác — hai lệnh máy chủ.
 *
 * Chỉ giám đốc vào được, cùng hàng rào với phần còn lại của màn Marketing.
 * Ranh giới ấy không phải chuyện kỹ thuật: đây là danh sách những nhãn hàng
 * mình đang đi gặp, kèm người phụ trách bên họ — thứ không nên nằm trong tầm
 * mắt của mọi tài khoản.
 */

export type DoiTacActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const TRANG_THAI_DAU: DoiTacActionState = { status: "idle", message: "" };

function loiRa(error: unknown): DoiTacActionState {
  if (error instanceof SoDoiTacError) return { status: "error", message: error.message };
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa lưu được vào sổ. Xin thử lại." };
}

async function doiGiamDoc() {
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (user.mustChangePassword) throw new Error("Xin đổi mật khẩu trước đã.");
  if (user.role !== "director") throw new Error("Chỉ giám đốc xem được sổ đối tác.");
  return user;
}

function chuoi(formData: FormData, ten: string) {
  const gia = formData.get(ten);
  return typeof gia === "string" ? gia : "";
}

export async function ghiDoiTacAction(
  _truoc: DoiTacActionState,
  formData: FormData,
): Promise<DoiTacActionState> {
  try {
    await doiGiamDoc();
    const ten = chuoi(formData, "ten").trim();
    const so = await ghiDoiTac({
      id: chuoi(formData, "id"),
      ten,
      nganhHang: chuoi(formData, "nganhHang"),
      nguoiBenHo: chuoi(formData, "nguoiBenHo"),
      cachLienHe: chuoi(formData, "cachLienHe"),
      nguoiPhuTrach: chuoi(formData, "nguoiPhuTrach"),
      giaiDoan: chuoi(formData, "giaiDoan"),
      dipNhamToi: chuoi(formData, "dipNhamToi"),
      ghiChu: chuoi(formData, "ghiChu"),
      ghiTraoDoi: formData.get("ghiTraoDoi") === "co",
    });
    revalidatePath("/erp/marketing");
    // Nói rõ sổ còn bao nhiêu dòng: người dùng gõ lại một tên đã có thì dòng
    // cũ được sửa chứ không sinh dòng mới, và con số này là cách họ thấy điều
    // đó mà không phải đếm tay.
    return {
      status: "success",
      message: `Đã ghi “${ten}” vào sổ. Sổ đang có ${so.length} nhãn hàng.`,
    };
  } catch (error) {
    return loiRa(error);
  }
}

export async function goDoiTacAction(
  _truoc: DoiTacActionState,
  formData: FormData,
): Promise<DoiTacActionState> {
  try {
    await doiGiamDoc();
    const id = chuoi(formData, "id").trim();
    const ten = chuoi(formData, "ten").trim();
    if (!id) return { status: "error", message: "Không rõ gỡ dòng nào." };
    const so = await goDoiTac(id);
    revalidatePath("/erp/marketing");
    return {
      status: "success",
      message: `Đã gỡ “${ten}” khỏi sổ. Sổ còn ${so.length} nhãn hàng.`,
    };
  } catch (error) {
    return loiRa(error);
  }
}
