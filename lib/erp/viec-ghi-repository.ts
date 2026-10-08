import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import type { LoaiGhi, TrangThaiViecGhi, ViecGhi } from "@/domain/tro-ly-ghi";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * Kho việc, ghi chú và nhật ký ngày (migration 110).
 *
 * Production (`ERP_PERSISTENCE_MODE=supabase`) đi thẳng các hàm SQL; bản chạy
 * thử ở máy không có kho nên giữ trong bộ nhớ máy chủ (khởi động lại là mất),
 * cùng cách các kho khác trong ERP đang làm. Màn hình nói rõ đang ở chế độ nào.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SLUG_THEO_UUID = new Map<string, ErpSiteId>(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [uuid, slug as ErpSiteId]),
);

export class ViecGhiLoi extends Error {}

export type LuuTruViecGhi = "supabase" | "memory";

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-viec-ghi" } },
  });
}

export function luuTruViecGhi(): LuuTruViecGhi {
  return khachKho() ? "supabase" : "memory";
}

function loiKho(error: { code?: string; message?: string }): never {
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") {
    throw new ViecGhiLoi("Kho chưa có bảng việc và ghi chú (migration 110 chưa áp).");
  }
  const cau = findRpcBusinessMessage(error);
  if (cau) throw new ViecGhiLoi(cau);
  console.error("Viec ghi store failed", error);
  throw new ViecGhiLoi("Chưa lưu được. Xin thử lại.");
}

function docDong(row: unknown): ViecGhi | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  return {
    id: r.id,
    loai: r.loai as LoaiGhi,
    nguoiTao: String(r.nguoi_tao ?? ""),
    nguoiNhan: typeof r.nguoi_nhan === "string" ? r.nguoi_nhan : null,
    coSo: typeof r.site_id === "string" ? (SLUG_THEO_UUID.get(r.site_id) ?? null) : null,
    noiDung: String(r.noi_dung ?? ""),
    han: typeof r.han === "string" ? new Date(r.han).toISOString() : null,
    ngay: String(r.ngay ?? ""),
    khan: r.khan === true,
    trangThai: (r.trang_thai as TrangThaiViecGhi) ?? "mo",
    nguon: r.nguon === "giong-noi" ? "giong-noi" : "go-tay",
    cauGoc: typeof r.cau_goc === "string" ? r.cau_goc : null,
    boHieu: r.bo_hieu === "claude" || r.bo_hieu === "ai" || r.bo_hieu === "luat" ? r.bo_hieu : null,
    taoLuc: typeof r.tao_luc === "string" ? new Date(r.tao_luc).toISOString() : new Date().toISOString(),
    xongLuc: typeof r.xong_luc === "string" ? new Date(r.xong_luc).toISOString() : null,
  };
}

// ---------- Kho tạm khi chạy ở máy ----------

const khoTam = ((globalThis as { __nbjViecGhi?: Map<string, ViecGhi> }).__nbjViecGhi ??= new Map<string, ViecGhi>());

export type TaoViecGhi = {
  nguoiTao: string;
  loai: LoaiGhi;
  nguoiNhan: string | null;
  coSo: ErpSiteId | null;
  noiDung: string;
  han: string | null;
  ngay: string;
  khan: boolean;
  nguon: "giong-noi" | "go-tay";
  cauGoc: string | null;
  boHieu: "luat" | "claude" | "ai" | null;
};

export async function taoViecGhi(input: TaoViecGhi): Promise<ViecGhi> {
  const kho = khachKho();
  if (!kho) {
    const dong: ViecGhi = {
      id: crypto.randomUUID(),
      ...input,
      nguoiNhan: input.loai === "viec" ? input.nguoiNhan : null,
      trangThai: "mo",
      taoLuc: new Date().toISOString(),
      xongLuc: null,
    };
    khoTam.set(dong.id, dong);
    return dong;
  }
  const { data, error } = await kho.rpc("erp_viec_ghi_tao", {
    p_tenant_id: TENANT_ID,
    p_nguoi_tao: input.nguoiTao,
    p_loai: input.loai,
    p_nguoi_nhan: input.loai === "viec" ? input.nguoiNhan : null,
    p_site_id: input.coSo ? ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.coSo] : null,
    p_noi_dung: input.noiDung,
    p_han: input.han,
    p_ngay: input.ngay,
    p_khan: input.khan,
    p_nguon: input.nguon,
    p_cau_goc: input.cauGoc,
    p_bo_hieu: input.boHieu,
  });
  if (error) loiKho(error);
  const dong = docDong(data);
  if (!dong) throw new ViecGhiLoi("Máy chủ trả về bản ghi không đọc được.");
  return dong;
}

export async function doiTrangThaiViecGhi(id: string, accountId: string, trangThai: TrangThaiViecGhi): Promise<ViecGhi> {
  const kho = khachKho();
  if (!kho) {
    const dong = khoTam.get(id);
    if (!dong || (dong.nguoiTao !== accountId && dong.nguoiNhan !== accountId)) throw new ViecGhiLoi("Không thấy việc này trong danh sách của bạn.");
    if (trangThai === "huy" && dong.nguoiTao !== accountId) throw new ViecGhiLoi("Chỉ người giao mới huỷ được việc.");
    if (dong.trangThai === "huy") throw new ViecGhiLoi("Việc này đã huỷ.");
    const moi = { ...dong, trangThai, xongLuc: trangThai === "xong" ? new Date().toISOString() : null };
    khoTam.set(id, moi);
    return moi;
  }
  const { data, error } = await kho.rpc("erp_viec_ghi_doi_trang_thai", {
    p_tenant_id: TENANT_ID,
    p_id: id,
    p_account_id: accountId,
    p_trang_thai: trangThai,
  });
  if (error) loiKho(error);
  const dong = docDong(data);
  if (!dong) throw new ViecGhiLoi("Máy chủ trả về bản ghi không đọc được.");
  return dong;
}

export async function viecGhiCuaToi(accountId: string): Promise<{ dong: ViecGhi[]; loi: string | null }> {
  const kho = khachKho();
  if (!kho) {
    const dong = [...khoTam.values()]
      .filter((v) => v.nguoiTao === accountId || v.nguoiNhan === accountId)
      .sort((a, b) => Number(b.trangThai === "mo") - Number(a.trangThai === "mo") || (a.han ?? a.taoLuc).localeCompare(b.han ?? b.taoLuc));
    return { dong, loi: null };
  }
  const { data, error } = await kho.rpc("erp_viec_ghi_cua_toi", { p_tenant_id: TENANT_ID, p_account_id: accountId });
  if (error) {
    try {
      loiKho(error);
    } catch (e) {
      return { dong: [], loi: e instanceof Error ? e.message : "Chưa đọc được danh sách." };
    }
  }
  return { dong: (Array.isArray(data) ? data : []).map(docDong).filter((v): v is ViecGhi => v !== null), loi: null };
}
