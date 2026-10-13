import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ANH_TOI_DA_BYTE, thangVN, type MaDiaDiemThiAnh } from "@/domain/thi-anh";
import { baoVeSoDienThoai, SuKienError } from "@/lib/customer-data/su-kien-repository";
import { policyVersion } from "@/lib/customer-data/identity-repository";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

/**
 * Thi ảnh hằng tháng (migration 127). Ảnh nằm trong kho riêng tư `thi-anh`;
 * trang công khai chỉ thấy ảnh đã duyệt, qua đường dẫn ký tạm một giờ.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const KHO_ANH = "thi-anh";
const LOAI_ANH: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type AnhTrungBay = { id: string; ten: string; chuThich: string; dauMa: string; url: string | null; giai: string | null };
export type AnhErp = AnhTrungBay & { so: string; trangThai: "cho-duyet" | "da-duyet" | "tu-choi"; maNhan: string | null; guiLuc: string };
export type AnhCuaToi = { thang: string; dauMa: string; chuThich: string; trangThai: string; giai: string | null; maNhan: string | null };

function kho(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new SuKienError("Phần thi ảnh chưa nối được kho dữ liệu ở bản này.", "CONFIGURATION_MISSING");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-thi-anh" } },
  });
}

function loi(error: unknown): SuKienError {
  const chu = findRpcBusinessMessage(error);
  return chu ? new SuKienError(chu, "REFUSED") : new SuKienError("Chưa gửi được, xin thử lại sau ít phút.", "PERSISTENCE_FAILED");
}

async function kyDuongDan(db: SupabaseClient, duong: string[]): Promise<Map<string, string>> {
  if (duong.length === 0) return new Map();
  const { data } = await db.storage.from(KHO_ANH).createSignedUrls(duong, 3600);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function guiAnhDuThi(input: {
  phone: string;
  marketing: boolean;
  ten: string;
  chuThich: string;
  dauMa: MaDiaDiemThiAnh;
  anh: File;
}) {
  const duoi = LOAI_ANH[input.anh.type];
  if (!duoi || input.anh.size <= 0 || input.anh.size > ANH_TOI_DA_BYTE) {
    throw new SuKienError("Ảnh phải là JPG, PNG hoặc WebP, dưới 5 MB.", "INPUT_INVALID");
  }
  const bv = baoVeSoDienThoai(input.phone);
  const db = kho();
  const duong = `thi-anh/${thangVN()}/${randomUUID()}.${duoi}`;
  const tai = await db.storage.from(KHO_ANH).upload(duong, Buffer.from(await input.anh.arrayBuffer()), {
    contentType: input.anh.type,
    upsert: false,
  });
  if (tai.error) throw new SuKienError("Chưa tải được ảnh lên, xin thử lại.", "PERSISTENCE_FAILED");
  const { data, error } = await db.rpc("customer_thi_anh_gui", {
    p_tenant_id: TENANT_ID,
    p_identity_digest: bv.digest,
    p_identity_ciphertext: bv.ciphertext,
    p_encryption_key_version: bv.keyVersion,
    p_contact_hint: bv.hint,
    p_marketing_enabled: input.marketing,
    p_service_policy_version: policyVersion("service"),
    p_marketing_policy_version: policyVersion("marketing"),
    p_ten_hien_thi: input.ten,
    p_chu_thich: input.chuThich,
    p_dau_ma: input.dauMa,
    p_anh_path: duong,
  });
  if (error) {
    await db.storage.from(KHO_ANH).remove([duong]);
    throw loi(error);
  }
  return { thang: String((data as Record<string, unknown>)?.thang ?? thangVN()) };
}

/** Ảnh đã duyệt của một tháng. Kho chưa nối hay lỗi thì rỗng. */
export async function anhTrungBay(thang: string): Promise<AnhTrungBay[]> {
  let db: SupabaseClient;
  try {
    db = kho();
  } catch {
    return [];
  }
  const { data, error } = await db.rpc("customer_thi_anh_trung_bay", { p_tenant_id: TENANT_ID, p_thang: thang });
  if (error || !Array.isArray(data)) return [];
  const dong = data as Record<string, unknown>[];
  const ky = await kyDuongDan(db, dong.map((d) => String(d.anh_path)));
  return dong.map((d) => ({
    id: String(d.id),
    ten: String(d.ten ?? ""),
    chuThich: String(d.chu_thich ?? ""),
    dauMa: String(d.dau_ma ?? ""),
    url: ky.get(String(d.anh_path)) ?? null,
    giai: typeof d.giai === "string" ? d.giai : null,
  }));
}

export async function anhCuaToi(phone: string): Promise<AnhCuaToi[]> {
  const bv = baoVeSoDienThoai(phone);
  const { data, error } = await kho().rpc("customer_thi_anh_cua_toi", { p_tenant_id: TENANT_ID, p_identity_digest: bv.digest });
  if (error) throw loi(error);
  return (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map((d) => ({
    thang: String(d.thang ?? ""),
    dauMa: String(d.dau_ma ?? ""),
    chuThich: String(d.chu_thich ?? ""),
    trangThai: String(d.trang_thai ?? ""),
    giai: typeof d.giai === "string" ? d.giai : null,
    maNhan: typeof d.ma_nhan === "string" ? d.ma_nhan : null,
  }));
}

export async function anhChoGiamDoc(thang: string): Promise<AnhErp[] | null> {
  let db: SupabaseClient;
  try {
    db = kho();
  } catch {
    return null;
  }
  const { data, error } = await db.rpc("erp_thi_anh_danh_sach", { p_tenant_id: TENANT_ID, p_thang: thang });
  if (error || !Array.isArray(data)) return null;
  const dong = data as Record<string, unknown>[];
  const ky = await kyDuongDan(db, dong.map((d) => String(d.anh_path)));
  return dong.map((d) => ({
    id: String(d.id),
    ten: String(d.ten ?? ""),
    so: String(d.so ?? ""),
    chuThich: String(d.chu_thich ?? ""),
    dauMa: String(d.dau_ma ?? ""),
    url: ky.get(String(d.anh_path)) ?? null,
    giai: typeof d.giai === "string" ? d.giai : null,
    trangThai: d.trang_thai === "da-duyet" ? "da-duyet" : d.trang_thai === "tu-choi" ? "tu-choi" : "cho-duyet",
    maNhan: typeof d.ma_nhan === "string" ? d.ma_nhan : null,
    guiLuc: String(d.gui_luc ?? ""),
  }));
}

export async function duyetAnh(input: { actorAccountId: string; id: string; trangThai: "da-duyet" | "tu-choi"; giai: string | null }) {
  const { error } = await kho().rpc("erp_thi_anh_duyet", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_id: input.id,
    p_trang_thai: input.trangThai,
    p_giai: input.giai,
  });
  if (error) throw loi(error);
}
