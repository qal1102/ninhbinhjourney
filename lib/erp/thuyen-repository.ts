import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { docChuyenTrenSong, type CoSoThuyen } from "@/domain/thuyen-song";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/** Thuyền trên sông (migration 104): chuyến của người chèo và bản đồ sống. */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class ThuyenLoi extends Error {
  constructor(message: string, readonly ma: "CHUA_NOI_KHO" | "KHONG_CO" | "DA_DONG" | "LOI") {
    super(message);
  }
}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-thuyen" } },
  });
}

export function thuyenCoKho(): boolean {
  return khachKho() !== null;
}

function canKho(): SupabaseClient {
  const kho = khachKho();
  if (!kho) throw new ThuyenLoi("Bản đồ thuyền chưa nối kho dữ liệu.", "CHUA_NOI_KHO");
  return kho;
}

function loiKho(error: { code?: string; message?: string }): never {
  const m = error.message ?? "";
  if (m.includes("THUYEN_KHONG_CO_CHUYEN")) throw new ThuyenLoi("Không thấy chuyến này của bạn.", "KHONG_CO");
  if (m.includes("THUYEN_CHUYEN_DA_DONG")) throw new ThuyenLoi("Chuyến đã về bến. Bắt đầu chuyến mới nhé.", "DA_DONG");
  console.error("Boat store failed", error);
  throw new ThuyenLoi("Chưa ghi được vị trí thuyền. Xin thử lại.", "LOI");
}

export type ChuyenCuaToi = { id: string; coSo: CoSoThuyen; soThuyen: string; soKhach: number; batDau: string };

function docChuyen(row: unknown): ChuyenCuaToi | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return null;
  const coSo = (Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).find(([, uuid]) => uuid === r.site_id)?.[0] ?? "") as CoSoThuyen;
  if (coSo !== "trang-an" && coSo !== "tam-coc") return null;
  return {
    id: r.id,
    coSo,
    soThuyen: String(r.so_thuyen ?? ""),
    soKhach: Number(r.so_khach ?? 0),
    batDau: String(r.bat_dau ?? ""),
  };
}

export async function chuyenCuaToi(accountId: string): Promise<ChuyenCuaToi | null> {
  const kho = khachKho();
  if (!kho) return null;
  const { data, error } = await kho.rpc("erp_thuyen_chuyen_cua_toi", { p_tenant_id: TENANT_ID, p_account_id: accountId });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    loiKho(error);
  }
  return docChuyen(data);
}

export async function batDauChuyen(coSo: CoSoThuyen, accountId: string, soThuyen: string, soKhach: number) {
  const { data, error } = await canKho().rpc("erp_thuyen_bat_dau", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo],
    p_account_id: accountId,
    p_so_thuyen: soThuyen,
    p_so_khach: soKhach,
  });
  if (error) loiKho(error);
  const chuyen = docChuyen(data);
  if (!chuyen) throw new ThuyenLoi("Chưa mở được chuyến. Xin thử lại.", "LOI");
  return chuyen;
}

export async function guiViTri(
  chuyenId: string,
  accountId: string,
  viTri: { lat: number; lng: number; doChinhXac: number | null; tocDo: number | null; huong: number | null },
) {
  const { data, error } = await canKho().rpc("erp_thuyen_gui_vi_tri", {
    p_tenant_id: TENANT_ID,
    p_chuyen_id: chuyenId,
    p_account_id: accountId,
    p_lat: viTri.lat,
    p_lng: viTri.lng,
    p_do_chinh_xac: viTri.doChinhXac,
    p_toc_do: viTri.tocDo,
    p_huong: viTri.huong,
  });
  if (error) loiKho(error);
  return data === true;
}

export async function veBen(chuyenId: string, accountId: string) {
  const { error } = await canKho().rpc("erp_thuyen_ve_ben", {
    p_tenant_id: TENANT_ID,
    p_chuyen_id: chuyenId,
    p_account_id: accountId,
  });
  if (error) loiKho(error);
}

export async function thuyenTrenSong(coSo: CoSoThuyen) {
  const { data, error } = await canKho().rpc("erp_thuyen_tren_song", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo],
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return [];
    loiKho(error);
  }
  return docChuyenTrenSong(data);
}
