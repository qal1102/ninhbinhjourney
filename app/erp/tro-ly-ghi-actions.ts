"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ErpSiteId } from "@/domain/erp";
import {
  coQuyenGiaoViec,
  giaoDuocCho,
  type BanNhap,
  type LoaiGhi,
  type NguoiTrongDanhBa,
  type ViecGhi,
} from "@/domain/tro-ly-ghi";
import { getCurrentErpUser, type CurrentErpUser } from "@/lib/erp/demo-session";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
import { hieuCauNoi, type BoHieu } from "@/lib/erp/tro-ly-hieu";
import { doiTrangThaiViecGhi, taoViecGhi, ViecGhiLoi } from "@/lib/erp/viec-ghi-repository";

/**
 * Trợ lý ghi việc bằng giọng nói: hiểu câu thành bản nháp, rồi lưu khi người
 * nói bấm Lưu. Luật vai (ai giao được cho ai) kiểm ở đây, trước kho.
 */

export type NguoiNhanChon = { id: string; ten: string; vai: string };

export type KetQuaHieu =
  | { ok: true; banNhap: BanNhap; boHieu: BoHieu; nguoiNhanCo: NguoiNhanChon[]; giaoDuoc: boolean }
  | { ok: false; loi: string };

const TEN_VAI: Record<string, string> = {
  director: "Giám đốc",
  manager: "Quản lý",
  accountant: "Kế toán",
  "chief-accountant": "Kế toán trưởng",
  employee: "Nhân viên",
};

async function danhBaCho(user: CurrentErpUser) {
  const tatCa: NguoiTrongDanhBa[] = (await listStaffDirectory())
    .filter((p) => p.active)
    .map((p) => ({ id: p.accountId, ten: p.displayName, vai: p.role, coSo: p.siteIds }));
  const nguoiGiao = { id: user.id, vai: user.role, coSo: user.siteIds };
  return tatCa.filter((p) => giaoDuocCho(nguoiGiao, p));
}

export async function hieuCauNoiAction(cau: string, loaiEp?: LoaiGhi): Promise<KetQuaHieu> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, loi: "Phiên đăng nhập đã hết. Xin đăng nhập lại." };
  const chu = String(cau ?? "").trim().slice(0, 600);
  if (!chu) return { ok: false, loi: "Chưa nghe thấy gì." };

  const giaoDuoc = coQuyenGiaoViec(user.role);
  const danhBa = giaoDuoc ? await danhBaCho(user) : [];
  const { banNhap, boHieu } = await hieuCauNoi(chu, { bayGio: new Date(), danhBa, loaiEp });
  if (banNhap.loai === "viec" && !giaoDuoc) {
    // Nhân viên nói "giao cho…" thì vẫn giữ lại thành ghi chú của mình.
    banNhap.loai = "ghi-chu";
    banNhap.nguoiNhanId = null;
    banNhap.ungVien = [];
    banNhap.canXemLai = ["Tài khoản của bạn không giao việc cho người khác, câu này lưu thành ghi chú."];
  }
  const nguoiNhanCo = danhBa
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, ten: p.ten, vai: TEN_VAI[p.vai] ?? p.vai }));
  return { ok: true, banNhap, boHieu, nguoiNhanCo, giaoDuoc };
}

const LuuSchema = z.object({
  loai: z.enum(["viec", "ghi-chu", "nhat-ky"]),
  noiDung: z.string().trim().min(1, "Chưa có nội dung.").max(1000, "Nội dung dài quá 1.000 ký tự."),
  nguoiNhanId: z.string().nullable(),
  han: z.string().nullable(),
  ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  coSo: z.enum(["trang-an", "tam-coc", "bai-dinh", "tam-chuc"]).nullable(),
  khan: z.boolean(),
  nguon: z.enum(["giong-noi", "go-tay"]),
  cauGoc: z.string().max(1000).nullable(),
  boHieu: z.enum(["luat", "claude", "ai"]).nullable(),
});

export type DuLieuLuu = z.input<typeof LuuSchema>;

export type KetQuaLuu = { ok: true; ban: ViecGhi; loiNhan: string } | { ok: false; loi: string };

function ngayVn(ms = Date.now()) {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
}

export async function luuViecGhiAction(duLieu: DuLieuLuu): Promise<KetQuaLuu> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, loi: "Phiên đăng nhập đã hết. Xin đăng nhập lại." };
  const kiem = LuuSchema.safeParse(duLieu);
  if (!kiem.success) return { ok: false, loi: kiem.error.issues[0]?.message ?? "Bản nháp chưa hợp lệ." };
  const d = kiem.data;

  let han = d.han && !Number.isNaN(Date.parse(d.han)) ? new Date(d.han).toISOString() : null;
  let tenNguoiNhan = "";
  if (d.loai === "viec") {
    if (!coQuyenGiaoViec(user.role)) return { ok: false, loi: "Tài khoản của bạn không giao việc cho người khác." };
    if (!d.nguoiNhanId) return { ok: false, loi: "Chọn người nhận việc." };
    const nguoi = (await danhBaCho(user)).find((p) => p.id === d.nguoiNhanId);
    if (!nguoi) return { ok: false, loi: "Người này nằm ngoài phạm vi bạn giao việc được." };
    tenNguoiNhan = nguoi.ten;
    // Không nói hạn thì cuối giờ làm hôm nay; đã quá 17:00 thì sáng mai 9:00.
    if (!han) {
      const homNay17 = Date.parse(`${ngayVn()}T17:00:00+07:00`);
      han = new Date(homNay17 > Date.now() ? homNay17 : Date.parse(`${ngayVn(Date.now() + 86_400_000)}T09:00:00+07:00`)).toISOString();
    }
    if (Date.parse(han) <= Date.now()) return { ok: false, loi: "Hạn đã qua, chọn hạn muộn hơn." };
  }

  try {
    const ban = await taoViecGhi({
      nguoiTao: user.id,
      loai: d.loai,
      nguoiNhan: d.loai === "viec" ? d.nguoiNhanId : null,
      coSo: d.coSo as ErpSiteId | null,
      noiDung: d.noiDung,
      han: d.loai === "nhat-ky" ? null : han,
      ngay: d.ngay,
      khan: d.khan,
      nguon: d.nguon,
      cauGoc: d.cauGoc,
      boHieu: d.boHieu,
    });
    revalidatePath("/erp/viec");
    const loiNhan =
      d.loai === "viec" ? `Đã giao cho ${tenNguoiNhan}.` : d.loai === "ghi-chu" ? "Đã lưu ghi chú." : "Đã lưu ghi chép ngày.";
    return { ok: true, ban, loiNhan };
  } catch (error) {
    return { ok: false, loi: error instanceof ViecGhiLoi ? error.message : "Chưa lưu được. Xin thử lại." };
  }
}

export async function doiTrangThaiViecGhiAction(id: string, trangThai: "mo" | "xong" | "huy"): Promise<{ ok: boolean; loi?: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, loi: "Phiên đăng nhập đã hết. Xin đăng nhập lại." };
  if (!["mo", "xong", "huy"].includes(trangThai) || typeof id !== "string" || id.length < 8) {
    return { ok: false, loi: "Yêu cầu không hợp lệ." };
  }
  try {
    await doiTrangThaiViecGhi(id, user.id, trangThai);
    revalidatePath("/erp/viec");
    return { ok: true };
  } catch (error) {
    return { ok: false, loi: error instanceof ViecGhiLoi ? error.message : "Chưa đổi được. Xin thử lại." };
  }
}
