import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LOGIN_UNKNOWN_CLIENT, resolveLoginClientIp } from "@/domain/erp-login-throttle";
import type { NhomGioiHan } from "@/domain/bao-mat";

/**
 * Đếm lượt gọi API theo địa chỉ máy, dùng chung cho mọi bản máy chủ (bảng
 * `nbj_dem_luot`, migration 134). Gọi từ `proxy.ts` cho mỗi lệnh ghi vào `/api`.
 *
 * **Kho lỗi hay chậm thì đếm trong bộ nhớ, không khoá.** Khoá mọi lệnh ghi chỉ
 * vì bảng đếm không trả lời thì khách thật không đặt được chỗ: hỏng nặng hơn
 * thứ đang chặn. Bộ nhớ vẫn chặn được một máy gửi dồn vào cùng một bản.
 */

const CHO_KHO_MS = 1500;
const boNho = new Map<string, { soLuot: number; hetHan: number }>();
let khach: SupabaseClient | null | undefined;

function khachKho(): SupabaseClient | null {
  if (khach !== undefined) return khach;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const biMat = process.env.SUPABASE_SECRET_KEY?.trim();
  khach =
    process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase" && url && biMat
      ? createClient(url, biMat, {
          auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
          global: { headers: { "X-Client-Info": "ninh-binh-journey-gioi-han-api" } },
        })
      : null;
  return khach;
}

async function bamKhoa(giaTri: string): Promise<string> {
  const biMat = process.env.SUPABASE_SECRET_KEY?.trim() || "gioi-han-o-may";
  const khoa = await crypto.subtle.importKey("raw", new TextEncoder().encode(biMat), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const chu = await crypto.subtle.sign("HMAC", khoa, new TextEncoder().encode(giaTri));
  return Array.from(new Uint8Array(chu), (b) => b.toString(16).padStart(2, "0")).join("");
}

function demBoNho(khoa: string, nhom: NhomGioiHan, bayGio: number): boolean {
  const cu = boNho.get(khoa);
  const dem = !cu || cu.hetHan <= bayGio ? { soLuot: 1, hetHan: bayGio + nhom.cuaSoGiay * 1000 } : { ...cu, soLuot: cu.soLuot + 1 };
  boNho.set(khoa, dem);
  if (boNho.size > 5000) {
    for (const [k, v] of boNho) if (v.hetHan <= bayGio) boNho.delete(k);
  }
  return dem.soLuot <= nhom.toiDa;
}

export async function conLuotApi(headers: Headers, nhom: NhomGioiHan): Promise<boolean> {
  const ip = resolveLoginClientIp(headers, Boolean(process.env.VERCEL));
  // Ở máy (không sau proxy của Vercel) không biết địa chỉ thật: không chặn.
  if (ip === LOGIN_UNKNOWN_CLIENT) return true;
  const khoa = await bamKhoa(`${nhom.ten}|${ip}`);
  const db = khachKho();
  if (db) {
    try {
      const { data, error } = await db
        .rpc("nbj_lay_luot", { p_khoa: khoa, p_toi_da: nhom.toiDa, p_cua_so_giay: nhom.cuaSoGiay })
        .abortSignal(AbortSignal.timeout(CHO_KHO_MS));
      if (!error && typeof data === "boolean") {
        // Ghi cả bộ nhớ để lỡ kho lỗi giữa chừng vẫn còn số mà chặn.
        demBoNho(khoa, nhom, Date.now());
        return data;
      }
      console.error("[gioi-han-api] kho không trả lời, đếm trong bộ nhớ", error?.message);
    } catch (loi) {
      console.error("[gioi-han-api] kho không trả lời, đếm trong bộ nhớ", loi instanceof Error ? loi.message : loi);
    }
  }
  return demBoNho(khoa, nhom, Date.now());
}
