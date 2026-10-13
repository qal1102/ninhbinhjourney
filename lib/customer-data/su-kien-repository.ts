import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chuanSoDienThoai } from "@/domain/khach-than-thiet";
import {
  docDanhSachSuKien,
  docSuKien,
  docTraSuKien,
  type SuKienCongKhai,
  type SuKienTomTat,
  type TraSuKien,
} from "@/domain/su-kien";
import { policyVersion, protectCustomerContact } from "@/lib/customer-data/identity-repository";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

/**
 * Sự kiện gặp người nổi tiếng (migration 127). Số điện thoại chỉ qua máy chủ
 * để mã hoá và băm; kho giữ ba số cuối để hiện •••123.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class SuKienError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION_MISSING" | "INPUT_INVALID" | "NOT_FOUND" | "REFUSED" | "PERSISTENCE_FAILED",
  ) {
    super(message);
    this.name = "SuKienError";
  }
}

export function coKhoSuKien() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim());
}

function kho(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new SuKienError("Phần sự kiện chưa nối được kho dữ liệu ở bản này.", "CONFIGURATION_MISSING");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-su-kien" } },
  });
}

function loi(error: unknown): SuKienError {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const chu = findRpcBusinessMessage(error);
  if (chu) return new SuKienError(chu, /NOT_FOUND/.test(message) ? "NOT_FOUND" : "REFUSED");
  return new SuKienError("Chưa xử lý được, xin thử lại sau ít phút.", "PERSISTENCE_FAILED");
}

export function baoVeSoDienThoai(raw: string) {
  const so = chuanSoDienThoai(raw);
  if (!so) throw new SuKienError("Mời bạn nhập số điện thoại Việt Nam 10 số.", "INPUT_INVALID");
  try {
    return { ...protectCustomerContact(so), hint: so.slice(-3) };
  } catch {
    throw new SuKienError("Chưa có khoá bảo vệ số điện thoại ở bản này.", "CONFIGURATION_MISSING");
  }
}

export async function docSuKienCongKhai(slug: string): Promise<SuKienCongKhai | null> {
  if (!coKhoSuKien()) return null;
  const { data, error } = await kho().rpc("customer_su_kien_cong_khai", { p_tenant_id: TENANT_ID, p_slug: slug });
  if (error) return null;
  return docSuKien(data);
}

export async function suKienDangMo(): Promise<SuKienTomTat[]> {
  if (!coKhoSuKien()) return [];
  try {
    const { data, error } = await kho().rpc("customer_su_kien_dang_mo", { p_tenant_id: TENANT_ID });
    return error ? [] : docDanhSachSuKien(data);
  } catch {
    return [];
  }
}

export async function dangKySuKien(input: { slug: string; phone: string; marketing: boolean }) {
  const bv = baoVeSoDienThoai(input.phone);
  const { data, error } = await kho().rpc("customer_su_kien_dang_ky", {
    p_tenant_id: TENANT_ID,
    p_slug: input.slug,
    p_identity_digest: bv.digest,
    p_identity_ciphertext: bv.ciphertext,
    p_encryption_key_version: bv.keyVersion,
    p_contact_hint: bv.hint,
    p_marketing_enabled: input.marketing,
    p_service_policy_version: policyVersion("service"),
    p_marketing_policy_version: policyVersion("marketing"),
  });
  if (error) throw loi(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return { maThamGia: String(r.ma_tham_gia ?? ""), soLuot: Number(r.so_luot ?? 1), daCo: r.da_co === true, hint: bv.hint };
}

export async function traSuKien(input: { slug: string; phone: string }): Promise<TraSuKien> {
  const bv = baoVeSoDienThoai(input.phone);
  const { data, error } = await kho().rpc("customer_su_kien_tra", {
    p_tenant_id: TENANT_ID,
    p_slug: input.slug,
    p_identity_digest: bv.digest,
  });
  if (error) throw loi(error);
  return docTraSuKien(data);
}

export type SuKienErp = SuKienTomTat & {
  giaiThuong: string;
  soDangKyKhuyenMai: string | null;
  dongYTiepThi: number;
  nguoiTrung: { thuTu: number; so: string; maNhan: string; ma: string }[] | null;
};

export async function danhSachSuKienErp(): Promise<SuKienErp[] | null> {
  if (!coKhoSuKien()) return null;
  const { data, error } = await kho().rpc("erp_su_kien_danh_sach", { p_tenant_id: TENANT_ID });
  if (error || !Array.isArray(data)) return null;
  const tom = docDanhSachSuKien(data);
  return tom.map((t, i) => {
    const r = (data as Record<string, unknown>[])[i];
    return {
      ...t,
      giaiThuong: String(r.giai_thuong ?? ""),
      soDangKyKhuyenMai: typeof r.so_dang_ky_khuyen_mai === "string" ? r.so_dang_ky_khuyen_mai : null,
      dongYTiepThi: Number(r.dong_y_tiep_thi ?? 0),
      nguoiTrung: Array.isArray(r.nguoi_trung)
        ? (r.nguoi_trung as Record<string, unknown>[]).map((n) => ({
            thuTu: Number(n.thu_tu),
            so: String(n.so ?? ""),
            maNhan: String(n.ma_nhan ?? ""),
            ma: String(n.ma ?? ""),
          }))
        : null,
    };
  });
}

export async function taoSuKien(input: {
  actorAccountId: string;
  slug: string;
  ten: string;
  moTa: string;
  khachMoi: string;
  siteId: string | null;
  dienRaLuc: string;
  hanDangKy: string;
  soGiai: number;
  giaiThuong: string;
  soDangKyKhuyenMai: string | null;
}) {
  const { error } = await kho().rpc("erp_su_kien_tao", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_slug: input.slug,
    p_ten: input.ten,
    p_mo_ta: input.moTa,
    p_khach_moi: input.khachMoi,
    p_site_id: input.siteId,
    p_dien_ra_luc: input.dienRaLuc,
    p_han_dang_ky: input.hanDangKy,
    p_so_giai: input.soGiai,
    p_giai_thuong: input.giaiThuong,
    p_so_dang_ky_khuyen_mai: input.soDangKyKhuyenMai,
  });
  if (error) throw loi(error);
}

export async function rutThamSuKien(input: { slug: string; actorAccountId: string }) {
  const { data, error } = await kho().rpc("erp_su_kien_rut", {
    p_tenant_id: TENANT_ID,
    p_slug: input.slug,
    p_actor_account_id: input.actorAccountId,
  });
  if (error) throw loi(error);
  return docSuKien(data);
}
