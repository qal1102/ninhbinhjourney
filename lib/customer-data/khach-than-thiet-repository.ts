import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  chuanSoDienThoai,
  docTomTat,
  docTongQuan,
  docVoucherQuay,
  type TomTatThanThiet,
  type TongQuanThanThiet,
  type VoucherQuay,
} from "@/domain/khach-than-thiet";
import { parseCounterSaleReceipt, type CounterSaleReceipt } from "@/domain/erp-counter-sale";
import { policyVersion, protectCustomerContact } from "@/lib/customer-data/identity-repository";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

/**
 * Khách thân thiết (migration 119). Số điện thoại chỉ đi qua máy chủ để mã hoá
 * và băm (`protectCustomerContact`); kho nhận mã băm, bản mã và ba số cuối để
 * hiện "•••123", không bao giờ thấy số thật.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class KhachThanThietError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION_MISSING" | "INPUT_INVALID" | "NOT_FOUND" | "REFUSED" | "PERSISTENCE_FAILED",
  ) {
    super(message);
    this.name = "KhachThanThietError";
  }
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new KhachThanThietError("Phần tích điểm chưa nối được kho dữ liệu ở bản này.", "CONFIGURATION_MISSING");
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-khach-than-thiet" } },
  });
}

function loi(error: unknown): KhachThanThietError {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (/function .*customer_loyalty|erp_.*loyalty.* does not exist|Could not find the function/i.test(message)) {
    return new KhachThanThietError("Kho chưa có phần tích điểm (migration 119 chưa áp).", "CONFIGURATION_MISSING");
  }
  const chu = findRpcBusinessMessage(error);
  if (chu) {
    const notFound = /LOYALTY_CODE_NOT_FOUND|LOYALTY_VOUCHER_NOT_FOUND/.test(message);
    return new KhachThanThietError(chu, notFound ? "NOT_FOUND" : "REFUSED");
  }
  return new KhachThanThietError("Chưa lưu được, xin thử lại sau ít phút.", "PERSISTENCE_FAILED");
}

function baoVeSo(raw: string) {
  const so = chuanSoDienThoai(raw);
  if (!so) throw new KhachThanThietError("Mời bạn nhập số điện thoại Việt Nam 10 số.", "INPUT_INVALID");
  try {
    const bv = protectCustomerContact(so);
    return { ...bv, hint: so.slice(-3) };
  } catch {
    throw new KhachThanThietError("Phần tích điểm chưa có khoá bảo vệ số điện thoại ở bản này.", "CONFIGURATION_MISSING");
  }
}

/** Cầm mã thì thấy tóm tắt (không mã voucher, không vé khác). */
export async function tomTatTheoMa(code: string): Promise<TomTatThanThiet> {
  const { data, error } = await client().rpc("customer_loyalty_by_code", {
    p_tenant_id: TENANT_ID,
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw loi(error);
  return docTomTat(data);
}

/** Mã + đúng số điện thoại: thấy voucher và mọi vé đã gắn. */
export async function xemDayDuBangSo(input: { code: string; phone: string }): Promise<TomTatThanThiet> {
  const bv = baoVeSo(input.phone);
  const { data, error } = await client().rpc("customer_loyalty_by_phone", {
    p_tenant_id: TENANT_ID,
    p_code: input.code.trim().toUpperCase(),
    p_identity_digest: bv.digest,
  });
  if (error) throw loi(error);
  return docTomTat(data);
}

/**
 * Gắn một hay nhiều mã vào số điện thoại. `kenh = "erp"` khi nhân viên quầy
 * gõ số hộ khách (ghi tên tài khoản vào liên kết).
 */
export async function ganMaVaoSo(input: {
  codes: string[];
  phone: string;
  marketing: boolean;
  kenh: "web" | "erp";
  actorAccountId?: string;
}): Promise<TomTatThanThiet> {
  const bv = baoVeSo(input.phone);
  const db = client();
  let ket: TomTatThanThiet = { linked: false };
  for (const code of input.codes) {
    const { data, error } = await db.rpc("customer_loyalty_link_code", {
      p_tenant_id: TENANT_ID,
      p_code: code.trim().toUpperCase(),
      p_identity_digest: bv.digest,
      p_identity_ciphertext: bv.ciphertext,
      p_encryption_key_version: bv.keyVersion,
      p_contact_hint: bv.hint,
      p_marketing_enabled: input.marketing,
      p_service_policy_version: policyVersion("service"),
      p_marketing_policy_version: policyVersion("marketing"),
      p_channel: input.kenh,
      p_actor_account_id: input.kenh === "erp" ? input.actorAccountId ?? null : null,
    });
    if (error) throw loi(error);
    ket = docTomTat(data);
  }
  return ket;
}

export async function traVoucher(code: string): Promise<VoucherQuay | null> {
  const { data, error } = await client().rpc("erp_lookup_loyalty_voucher", {
    p_tenant_id: TENANT_ID,
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw loi(error);
  return docVoucherQuay(data);
}

export async function doiVoucher(input: {
  siteUuid: string;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  code: string;
  requestKey: string;
}): Promise<{ voucher: VoucherQuay | null; receipt: CounterSaleReceipt | null }> {
  const { data, error } = await client().rpc("erp_redeem_loyalty_voucher", {
    p_tenant_id: TENANT_ID,
    p_site_id: input.siteUuid,
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_acting_director_account_id: input.actingDirectorAccountId,
    p_voucher_code: input.code.trim().toUpperCase(),
    p_request_key: input.requestKey,
  });
  if (error) throw loi(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    voucher: docVoucherQuay(r.voucher),
    receipt: r.receipt ? parseCounterSaleReceipt(r.receipt) : null,
  };
}

export async function tongQuanThanThiet(): Promise<TongQuanThanThiet | null> {
  let db: SupabaseClient;
  try {
    db = client();
  } catch {
    return null;
  }
  const { data, error } = await db.rpc("erp_loyalty_overview", { p_tenant_id: TENANT_ID });
  if (error) return null;
  return docTongQuan(data);
}
