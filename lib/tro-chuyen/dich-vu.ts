import "server-only";

import type { ErpRole, ErpSiteId } from "@/domain/erp";
import type { ViecTrongTin } from "@/domain/tro-chuyen";
import type { ViecGhi } from "@/domain/tro-ly-ghi";
import { giaoDuocCho } from "@/domain/tro-ly-ghi";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
import { danhSachVanBan } from "@/lib/van-ban/van-ban-repository";

/** Phần dùng chung của các API trò chuyện. */

export type NguoiDanhBa = { id: string; ten: string; vai: ErpRole; coSo: ErpSiteId[]; chucDanh: string };

export async function danhBa(): Promise<NguoiDanhBa[]> {
  return (await listStaffDirectory())
    .filter((p) => p.active)
    .map((p) => ({ id: p.accountId, ten: p.displayName, vai: p.role, coSo: p.siteIds, chucDanh: p.jobTitle }));
}

/** Ai trong danh sách mà người này giao việc được (luật của Việc & ghi chú). */
export function giaoDuocTrong(user: CurrentErpUser, ds: NguoiDanhBa[]) {
  const nguoiGiao = { id: user.id, vai: user.role, coSo: user.siteIds };
  return new Set(ds.filter((p) => p.id !== user.id && giaoDuocCho(nguoiGiao, p)).map((p) => p.id));
}

/** Bản chạy ở máy: đọc việc thẳng từ kho tạm của Việc & ghi chú (production thì hàm SQL tự ghép). */
export async function docViecMay(id: string): Promise<ViecTrongTin | null> {
  const v = (globalThis as { __nbjViecGhi?: Map<string, ViecGhi> }).__nbjViecGhi?.get(id);
  return v ? { id: v.id, nguoiNhan: v.nguoiNhan, nguoiTao: v.nguoiTao, han: v.han, trangThai: v.trangThai, noiDung: v.noiDung } : null;
}

export async function maVanBanDaNhan() {
  const ds = await danhSachVanBan().catch(() => ({ nop: [] as { phatHanhId: string | null; ketQua: string; soVanBan: string | null; loai: string | null }[] }));
  return ds.nop.filter((n) => n.ketQua === "nhan" && n.phatHanhId).map((n) => ({ id: n.phatHanhId as string, soVanBan: n.soVanBan ?? "", loai: n.loai }));
}

const luot = new Map<string, number[]>();
/** Chặn mềm theo tài khoản (bộ nhớ từng máy chủ): đủ để một vòng lặp lỗi ở trình duyệt không xả tin. */
export function conLuot(khoa: string, toiDa: number, trongMs: number, bayGio = Date.now()) {
  const cu = (luot.get(khoa) ?? []).filter((t) => bayGio - t < trongMs);
  if (cu.length >= toiDa) return false;
  luot.set(khoa, [...cu, bayGio]);
  return true;
}
