"use server";

import { moPhieuQuay } from "@/lib/erp/phieu-quay";
import { timPhieuCuaMa } from "../ve-quay/tim-phieu";

/**
 * Màn hướng ra khách hỏi: mã này đã được quét và trả chưa? Chỉ đọc, không ghi
 * gì. Ai cầm được mã (đã niêm bằng khoá máy chủ) mới hỏi được.
 */
export async function trangThaiManKhachAction(ma: string): Promise<{ daTra: boolean; saleCode: string | null }> {
  try {
    const phieu = moPhieuQuay(String(ma ?? ""), undefined, undefined, { choPhepHetHan: true });
    const receipt = await timPhieuCuaMa(phieu);
    return receipt && receipt.status === "completed"
      ? { daTra: true, saleCode: receipt.saleCode }
      : { daTra: false, saleCode: null };
  } catch {
    return { daTra: false, saleCode: null };
  }
}
