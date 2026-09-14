"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId } from "@/domain/erp";
import { validateNoShowReason } from "@/domain/erp-on-site-due";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { OnSiteDueRepositoryError, closeOnSiteNoShow } from "@/lib/erp/on-site-due-repository";

/** QA-DON-DU-LIEU-10 — quản lý cơ sở hoặc giám đốc đóng khoản trả tại điểm vì khách không đến. */
export async function closeOnSiteNoShowAction(input: {
  siteId: string;
  orderCode: string;
  reason: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) return { ok: false, message: "Cơ sở không hợp lệ." };
  if (user.role !== "manager" && user.role !== "director") {
    return { ok: false, message: "Chỉ quản lý cơ sở hoặc giám đốc được đóng khoản này." };
  }
  const kiem = validateNoShowReason(String(input.reason ?? ""));
  if (!kiem.ok) return { ok: false, message: kiem.reason };
  const orderCode = String(input.orderCode ?? "").trim().toUpperCase();
  try {
    const ketQua = await closeOnSiteNoShow({
      siteId: input.siteId,
      orderCode,
      actorAccountId: user.id,
      reason: String(input.reason).trim(),
    });
    revalidatePath(`/erp/${input.siteId}/tai-chinh-doi-soat`);
    if (ketQua.alreadySettled) {
      return { ok: true, message: `Đơn ${orderCode} đã được thu hoặc đã đóng từ trước.` };
    }
    return {
      ok: true,
      message: `Đã đóng khoản của đơn ${orderCode}${ketQua.voidedTickets ? `, huỷ ${ketQua.voidedTickets} vé chưa dùng` : ""}.`,
    };
  } catch (error) {
    if (error instanceof OnSiteDueRepositoryError) return { ok: false, message: error.message };
    console.error("Close on-site no-show failed", error);
    return { ok: false, message: "Chưa đóng được khoản này. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật." };
  }
}
