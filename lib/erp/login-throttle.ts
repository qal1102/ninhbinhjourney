import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LOGIN_THROTTLE_WINDOW_MS,
  decideLoginThrottle,
  normalizeLoginIdentifier,
  type LoginThrottleDecision,
  type LoginThrottleScope,
} from "@/domain/erp-login-throttle";

/**
 * QA-P2-09 (ERP) — lưu và đọc lượt đăng nhập sai.
 *
 * Kho chính là bảng `erp_login_failures` (migration `202609140071`), vì máy
 * chủ chạy nhiều bản song song. Không có kho (máy cục bộ, bản chạy thử) hoặc
 * kho lỗi thì dùng bộ đếm trong bộ nhớ của chính bản đang chạy: vẫn chặn được
 * một người ngồi dò ở một máy, chỉ yếu hơn.
 *
 * **Kho lỗi thì cho đăng nhập, không khoá.** Khoá cả ERP chỉ vì bảng đếm không
 * trả lời thì chính đội vận hành bị nhốt ngoài — hỏng nặng hơn thứ đang chặn.
 */

type Keys = Record<LoginThrottleScope, string>;

const boNho = new Map<string, number[]>();

function isSupabaseMode() {
  return process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase";
}

function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-login-throttle" } },
  });
}

async function diaChiMay(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || h.get("x-real-ip")?.trim() || "khong-ro";
  } catch {
    return "khong-ro";
  }
}

/** Băm có khoá bí mật: kho chỉ thấy mã băm, không dò ngược ra IP hay tên được. */
async function taoKhoa(identifier: string): Promise<Keys> {
  const biMat =
    process.env.ERP_LOGIN_THROTTLE_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || "ban-chay-cuc-bo";
  const bam = (giaTri: string) => createHmac("sha256", biMat).update(giaTri).digest("hex");
  const ten = normalizeLoginIdentifier(identifier);
  const ip = await diaChiMay();
  return {
    "account-ip": bam(`account-ip:${ten}|${ip}`),
    // Không đọc được địa chỉ máy thì không gộp mọi người vào chung một khoá
    // "máy lạ" — gộp vậy thì hai mươi lần sai của ai đó khoá chân cả công ty.
    ip: bam(ip === "khong-ro" ? `ip:khong-ro|${ten}` : `ip:${ip}`),
    account: bam(`account:${ten}`),
  };
}

function docBoNho(keys: Keys, now: number) {
  const ket: Partial<Record<LoginThrottleScope, number[]>> = {};
  for (const scope of Object.keys(keys) as LoginThrottleScope[]) {
    const moc = (boNho.get(keys[scope]) ?? []).filter((t) => t > now - LOGIN_THROTTLE_WINDOW_MS);
    boNho.set(keys[scope], moc);
    ket[scope] = moc;
  }
  return ket;
}

export async function checkLoginThrottle(identifier: string): Promise<LoginThrottleDecision> {
  const keys = await taoKhoa(identifier);
  const now = Date.now();
  const client = isSupabaseMode() ? createAdminClient() : null;
  if (client) {
    const { data, error } = await client.rpc("erp_login_recent_failures", {
      p_key_hashes: Object.values(keys),
      p_since: new Date(now - LOGIN_THROTTLE_WINDOW_MS).toISOString(),
      p_limit: 30,
    });
    if (!error && Array.isArray(data)) {
      const failures: Partial<Record<LoginThrottleScope, number[]>> = {};
      for (const row of data as Array<{ key_hash?: unknown; failed_at?: unknown }>) {
        const scope = (Object.keys(keys) as LoginThrottleScope[]).find((s) => keys[s] === row.key_hash);
        const moc = Date.parse(String(row.failed_at ?? ""));
        if (!scope || Number.isNaN(moc)) continue;
        (failures[scope] ??= []).push(moc);
      }
      return decideLoginThrottle(failures, now);
    }
    console.error("Login throttle read failed, falling back to in-memory counter", error);
  }
  return decideLoginThrottle(docBoNho(keys, now), now);
}

export async function recordLoginFailure(identifier: string): Promise<void> {
  const keys = await taoKhoa(identifier);
  const now = Date.now();
  // Luôn ghi cả bộ nhớ: lỡ kho lỗi giữa chừng thì bản này vẫn còn số để chặn.
  for (const key of Object.values(keys)) boNho.set(key, [...(boNho.get(key) ?? []), now].slice(-40));
  // Kẻ dò bằng hàng nghìn tên khác nhau không được làm phình bộ nhớ mãi.
  if (boNho.size > 5000) {
    for (const [key, moc] of boNho) {
      if ((moc.at(-1) ?? 0) <= now - LOGIN_THROTTLE_WINDOW_MS) boNho.delete(key);
    }
  }
  const client = isSupabaseMode() ? createAdminClient() : null;
  if (!client) return;
  const { error } = await client.rpc("erp_login_record_failure", {
    p_entries: (Object.keys(keys) as LoginThrottleScope[]).map((scope) => ({ key_hash: keys[scope], scope })),
  });
  if (error) console.error("Login throttle write failed", error);
}

export async function clearLoginFailures(identifier: string): Promise<void> {
  const keys = await taoKhoa(identifier);
  boNho.delete(keys["account-ip"]);
  boNho.delete(keys.account);
  const client = isSupabaseMode() ? createAdminClient() : null;
  if (!client) return;
  const { error } = await client.rpc("erp_login_clear_failures", {
    p_key_hashes: [keys["account-ip"], keys.account],
  });
  if (error) console.error("Login throttle clear failed", error);
}
