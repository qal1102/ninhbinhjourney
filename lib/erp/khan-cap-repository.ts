import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import { docBaoDong, type BaoDong, type LoaiKhanCap } from "@/domain/khan-cap";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * Báo khẩn cấp (migration 121). Ảnh hiện trường nằm cùng kho ảnh riêng tư
 * của báo cáo hiện trường (`erp-field-reports`), thư mục `khan-cap/`; ai xem
 * thì máy chủ ký đường dẫn có hạn 10 phút.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const KHO_ANH = "erp-field-reports";
const ANH_TOI_DA = 5 * 1024 * 1024;
const LOAI_ANH = new Set(["image/jpeg", "image/png", "image/webp"]);

export class KhanCapError extends Error {
  constructor(message: string, readonly code: "CHUA_NOI_KHO" | "TU_CHOI" | "LOI") {
    super(message);
    this.name = "KhanCapError";
  }
}

function kho(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new KhanCapError("Bản chạy này chưa nối kho dữ liệu nên chưa gửi được báo khẩn cấp.", "CHUA_NOI_KHO");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-khan-cap" } },
  });
}

export function coKhoKhanCap() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim());
}

function loi(error: unknown): KhanCapError {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (/erp_bao_khan_cap|erp_khan_cap|Could not find the function/i.test(message) && /not exist|Could not find/i.test(message)) {
    return new KhanCapError("Kho chưa có phần báo khẩn cấp (migration 121 chưa áp).", "CHUA_NOI_KHO");
  }
  const chu = findRpcBusinessMessage(error);
  return chu ? new KhanCapError(chu, "TU_CHOI") : new KhanCapError("Chưa gửi được, xin thử lại ngay.", "LOI");
}

async function kyAnh(db: SupabaseClient, ds: BaoDong[]): Promise<BaoDong[]> {
  const duong = ds.map((b) => b.anhPath).filter((p): p is string => Boolean(p));
  if (duong.length === 0) return ds;
  const { data } = await db.storage.from(KHO_ANH).createSignedUrls(duong, 600);
  const theoDuong = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return ds.map((b) => (b.anhPath ? { ...b, anhUrl: theoDuong.get(b.anhPath) ?? null } : b));
}

export async function baoKhanCap(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  loai: LoaiKhanCap;
  ghiChu: string;
  viDo: number | null;
  kinhDo: number | null;
  saiSoM: number | null;
  anh: File | null;
  requestKey: string;
}): Promise<BaoDong> {
  const db = kho();
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId];
  let anhPath: string | null = null;
  // Ảnh chỉ là phần phụ: tải hỏng thì vẫn báo, không để báo động chờ ảnh.
  if (input.anh && input.anh.size > 0 && input.anh.size <= ANH_TOI_DA && LOAI_ANH.has(input.anh.type)) {
    const duong = `khan-cap/${input.siteId}/${randomUUID()}.${input.anh.type === "image/png" ? "png" : input.anh.type === "image/webp" ? "webp" : "jpg"}`;
    const tai = await db.storage.from(KHO_ANH).upload(duong, Buffer.from(await input.anh.arrayBuffer()), {
      contentType: input.anh.type,
      upsert: false,
    });
    if (!tai.error) anhPath = duong;
  }
  const { data, error } = await db.rpc("erp_bao_khan_cap", {
    p_tenant_id: TENANT_ID,
    p_site_id: siteUuid,
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_loai: input.loai,
    p_ghi_chu: input.ghiChu,
    p_vi_do: input.viDo,
    p_kinh_do: input.kinhDo,
    p_sai_so_m: input.saiSoM === null ? null : Math.round(input.saiSoM),
    p_anh_path: anhPath,
    p_request_key: input.requestKey,
  });
  if (error) {
    if (anhPath) await db.storage.from(KHO_ANH).remove([anhPath]);
    throw loi(error);
  }
  const bd = docBaoDong(data);
  if (!bd) throw new KhanCapError("Kho trả lời không đúng khuôn.", "LOI");
  return bd;
}

/** Báo động đang chờ mà tài khoản này (cấp trên) phải thấy. Lỗi thì trả rỗng để không làm hỏng màn. */
export async function baoDongDangMo(accountId: string): Promise<BaoDong[]> {
  if (!coKhoKhanCap()) return [];
  const db = kho();
  const { data, error } = await db.rpc("erp_khan_cap_dang_mo", { p_tenant_id: TENANT_ID, p_actor_account_id: accountId });
  if (error || !Array.isArray(data)) return [];
  return kyAnh(db, data.map(docBaoDong).filter((b): b is BaoDong => b !== null));
}

export async function baoDongCuaToi(accountId: string, ma: string): Promise<BaoDong | null> {
  const db = kho();
  const { data, error } = await db.rpc("erp_khan_cap_cua_toi", { p_tenant_id: TENANT_ID, p_actor_account_id: accountId, p_ma: ma });
  if (error) throw loi(error);
  const bd = docBaoDong(data);
  return bd ? (await kyAnh(db, [bd]))[0] : null;
}

export async function nhanBaoDong(accountId: string, ten: string, ma: string): Promise<BaoDong> {
  const { data, error } = await kho().rpc("erp_nhan_khan_cap", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: accountId,
    p_actor_name: ten,
    p_ma: ma,
  });
  if (error) throw loi(error);
  const bd = docBaoDong(data);
  if (!bd) throw new KhanCapError("Kho trả lời không đúng khuôn.", "LOI");
  return bd;
}

export async function ghiDaGoi(accountId: string, ma: string, goiToiTen: string): Promise<void> {
  const { error } = await kho().rpc("erp_ghi_goi_khan_cap", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: accountId,
    p_ma: ma,
    p_goi_toi_ten: goiToiTen,
  });
  if (error) throw loi(error);
}

// --- Đăng ký thông báo đẩy --------------------------------------------------------------

export type DangKyDay = { endpoint: string; p256dh: string; auth: string };

export async function luuDangKyDay(accountId: string, dk: DangKyDay) {
  const db = kho();
  // Một máy một đăng ký: máy đổi tài khoản thì đăng ký theo tài khoản mới.
  await db.from("erp_push_dang_ky").delete().eq("endpoint", dk.endpoint);
  const { error } = await db.from("erp_push_dang_ky").insert({
    tenant_id: TENANT_ID,
    account_id: accountId,
    endpoint: dk.endpoint,
    p256dh: dk.p256dh,
    auth: dk.auth,
  });
  if (error) throw loi(error);
}

export async function xoaDangKyDay(endpoint: string) {
  if (!coKhoKhanCap()) return;
  await kho().from("erp_push_dang_ky").delete().eq("endpoint", endpoint);
}

export async function dangKyCuaTaiKhoan(accountIds: string[]): Promise<(DangKyDay & { accountId: string })[]> {
  if (accountIds.length === 0 || !coKhoKhanCap()) return [];
  const { data, error } = await kho()
    .from("erp_push_dang_ky")
    .select("account_id, endpoint, p256dh, auth")
    .eq("tenant_id", TENANT_ID)
    .in("account_id", accountIds)
    .limit(200);
  if (error || !data) return [];
  return data.map((d) => ({ accountId: String(d.account_id), endpoint: String(d.endpoint), p256dh: String(d.p256dh), auth: String(d.auth) }));
}
