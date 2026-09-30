import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import {
  BEN_CO_HANG_CHO,
  docDanhSachErp,
  docLuotCuaKhach,
  docTongQuan,
  type MaBen,
} from "@/domain/hang-cho";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class HangChoLoi extends Error {
  constructor(message: string, readonly ma: "CHUA_NOI_KHO" | "TAM_DUNG" | "DAY" | "KHONG_CO" | "LOI") {
    super(message);
  }
}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-hang-cho" } },
  });
}

function canKho(): SupabaseClient {
  const kho = khachKho();
  if (!kho) throw new HangChoLoi("Hàng chờ chưa nối kho dữ liệu.", "CHUA_NOI_KHO");
  return kho;
}

function bam(chuoi: string) {
  return createHash("sha256").update(chuoi).digest("hex");
}

function uuidCoSo(siteId: ErpSiteId) {
  return ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId];
}

function loiKho(error: { code?: string; message?: string }): never {
  const m = error.message ?? "";
  if (m.includes("HANG_CHO_TAM_DUNG")) throw new HangChoLoi("Bến đang tạm dừng nhận số.", "TAM_DUNG");
  if (m.includes("HANG_CHO_DAY")) throw new HangChoLoi("Hàng chờ đã đủ 400 nhóm.", "DAY");
  if (m.includes("HANG_CHO_KHONG_CO") || error.code === "PGRST202" || error.code === "42883") {
    throw new HangChoLoi("Nơi này chưa mở hàng chờ.", "KHONG_CO");
  }
  console.error("Queue store failed", error);
  throw new HangChoLoi("Chưa đọc được hàng chờ. Xin thử lại.", "LOI");
}

export async function docTongQuanBen(ben: MaBen) {
  const kho = canKho();
  const { data, error } = await kho.rpc("hang_cho_tong_quan", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(BEN_CO_HANG_CHO[ben].siteId),
  });
  if (error) loiKho(error);
  const tq = docTongQuan(data);
  if (!tq) throw new HangChoLoi("Nơi này chưa mở hàng chờ.", "KHONG_CO");
  return tq;
}

/**
 * Lấy số. `maMay` là chuỗi ngẫu nhiên trình duyệt tự giữ; kho chỉ lưu băm của
 * nó để một máy giữ một số một lúc. Trả về chuỗi bí mật của lượt, khách giữ
 * nó để xem hay huỷ lượt; kho cũng chỉ lưu băm.
 */
export async function laySo(input: { ben: MaBen; soKhach: number; ngonNgu: "vi" | "en"; maMay: string }) {
  const kho = canKho();
  const bimat = randomBytes(24).toString("base64url");
  const { data, error } = await kho.rpc("hang_cho_lay_so", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(BEN_CO_HANG_CHO[input.ben].siteId),
    p_so_khach: input.soKhach,
    p_ngon_ngu: input.ngonNgu,
    p_ma_bam: bam(`luot:${bimat}`),
    p_may_bam: bam(`may:${input.maMay}`),
  });
  if (error) loiKho(error);
  const r = (data ?? {}) as { so_thu_tu?: number; da_co?: boolean };
  // Máy đã giữ sẵn một số: kho không phát bí mật mới, trình duyệt dùng lại bí
  // mật nó đang giữ. Không có bí mật cũ (xoá bộ nhớ) thì báo để khách biết.
  return { bimat: r.da_co ? null : bimat, soThuTu: Number(r.so_thu_tu ?? 0), daCo: r.da_co === true };
}

export async function xemLuot(bimat: string) {
  const kho = canKho();
  const { data, error } = await kho.rpc("hang_cho_xem", { p_ma_bam: bam(`luot:${bimat}`) });
  if (error) loiKho(error);
  return docLuotCuaKhach(data);
}

export async function huyLuot(bimat: string) {
  const kho = canKho();
  const { data, error } = await kho.rpc("hang_cho_huy", { p_ma_bam: bam(`luot:${bimat}`) });
  if (error) loiKho(error);
  return data === true;
}

export type HangChoErp =
  | { trangThai: "co"; tongQuan: NonNullable<ReturnType<typeof docTongQuan>>; luot: NonNullable<ReturnType<typeof docDanhSachErp>>["luot"] }
  | { trangThai: "chua-noi-kho" }
  | { trangThai: "loi"; loiNhan: string };

export async function docHangChoErp(siteId: ErpSiteId): Promise<HangChoErp> {
  const kho = khachKho();
  if (!kho) return { trangThai: "chua-noi-kho" };
  const { data, error } = await kho.rpc("erp_hang_cho_danh_sach", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(siteId),
  });
  if (error) {
    console.error("Queue ERP read failed", error);
    return {
      trangThai: "loi",
      loiNhan:
        error.code === "PGRST202" || error.code === "42883"
          ? "Kho chưa có hàng chờ (migration 097 chưa áp)."
          : "Chưa đọc được hàng chờ. Xin tải lại trang.",
    };
  }
  const ds = docDanhSachErp(data);
  if (!ds) return { trangThai: "loi", loiNhan: "Cơ sở này chưa bật hàng chờ." };
  return { trangThai: "co", ...ds };
}

export async function goiTiep(siteId: ErpSiteId, soNhom: number, nguoi: string) {
  const { data, error } = await canKho().rpc("erp_hang_cho_goi", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(siteId),
    p_so_nhom: soNhom,
    p_nguoi: nguoi,
  });
  if (error) loiKho(error);
  return Number(data ?? 0);
}

export async function danhDauLuot(
  siteId: ErpSiteId,
  id: string,
  trangThai: "da-len" | "bo-luot" | "da-goi" | "khach-huy",
  nguoi: string,
) {
  const { data, error } = await canKho().rpc("erp_hang_cho_danh_dau", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(siteId),
    p_id: id,
    p_trang_thai: trangThai,
    p_nguoi: nguoi,
  });
  if (error) loiKho(error);
  return data === true;
}

export async function caiDatHangCho(siteId: ErpSiteId, dangNhan: boolean, loiTamDung: string, nguoi: string) {
  const { data, error } = await canKho().rpc("erp_hang_cho_cai_dat", {
    p_tenant_id: TENANT_ID,
    p_site_id: uuidCoSo(siteId),
    p_dang_nhan: dangNhan,
    p_loi_tam_dung: loiTamDung,
    p_nguoi: nguoi,
  });
  if (error) loiKho(error);
  return data === true;
}
