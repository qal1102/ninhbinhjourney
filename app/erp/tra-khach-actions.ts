"use server";

import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { traKhachErp } from "@/lib/customer-data/tra-khach-repository";
import { ganMaVaoSo } from "@/lib/customer-data/khach-than-thiet-repository";
import type { KetQuaTraKhach } from "@/domain/tra-khach";

/**
 * Tra khách trong ERP (migration 130): giám đốc và quản lý cơ sở gõ số điện
 * thoại hay mã. Số điện thoại đi bằng biểu mẫu POST, không nằm trên đường dẫn
 * (đường dẫn vào nhật ký máy chủ và lịch sử trình duyệt).
 */

export type TraKhachState = {
  status: "idle" | "ok" | "error";
  message: string;
  nhap: string;
  ketQua: KetQuaTraKhach | null;
  /** Lúc trả lời: hai biểu mẫu (tra, gắn số) cùng đổ về một khung, cái mới hơn thắng. */
  luc: number;
};

async function nguoiTra() {
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (user.role !== "director" && user.role !== "manager") throw new Error("Chỉ giám đốc và quản lý cơ sở tra được hồ sơ khách.");
  return user;
}

export async function traKhachAction(_truoc: TraKhachState, formData: FormData): Promise<TraKhachState> {
  const nhap = String(formData.get("nhap") ?? "").trim();
  try {
    const user = await nguoiTra();
    const ketQua = await traKhachErp({ actorAccountId: user.id, nhap });
    return { status: "ok", message: ketQua.timThay ? "" : "Không tìm thấy khách hay vé nào khớp.", nhap, ketQua, luc: Date.now() };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Chưa tra được.", nhap, ketQua: null, luc: Date.now() };
  }
}

/** Nhân viên gắn số điện thoại vào vé quầy hộ khách (khách đồng ý tại quầy). */
export async function ganSoChoVeAction(_truoc: TraKhachState, formData: FormData): Promise<TraKhachState> {
  const ma = String(formData.get("ma") ?? "").trim().toUpperCase();
  const so = String(formData.get("so") ?? "").trim();
  try {
    const user = await nguoiTra();
    if (formData.get("dong_y") !== "co") throw new Error("Hỏi khách và tích ô: khách đồng ý dùng số để giữ vé và tích lượt.");
    await ganMaVaoSo({ codes: [ma], phone: so, marketing: formData.get("tiep_thi") === "co", kenh: "erp", actorAccountId: user.id });
    const ketQua = await traKhachErp({ actorAccountId: user.id, nhap: ma });
    return { status: "ok", message: "Đã gắn số vào vé.", nhap: ma, ketQua, luc: Date.now() };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Chưa gắn được.", nhap: ma, ketQua: null, luc: Date.now() };
  }
}

export async function traKhachTheoMa(ma: string): Promise<KetQuaTraKhach | null> {
  try {
    const user = await nguoiTra();
    return await traKhachErp({ actorAccountId: user.id, nhap: ma });
  } catch {
    return null;
  }
}
