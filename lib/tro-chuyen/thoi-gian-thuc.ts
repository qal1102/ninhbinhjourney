import "server-only";

import { createHmac } from "node:crypto";

/**
 * Báo "có tin mới" tức thì qua Supabase Realtime Broadcast.
 *
 * ERP không dùng đăng nhập Supabase cho trình duyệt (phiên ERP là cookie riêng),
 * nên trình duyệt chỉ nghe kênh công khai bằng khoá công khai. Vì thế:
 * - tên kênh là mã ngẫu nhiên 32 ký tự của phòng, hay mã HMAC của tài khoản
 *   (hộp thư), chỉ người trong phòng mới được máy chủ đưa cho;
 * - tín hiệu không chở nội dung tin, chỉ mã phòng; trình duyệt nghe xong tự hỏi
 *   lại API, nơi kiểm đăng nhập và kiểm thành viên.
 * Realtime không chạy (thiếu khoá, mạng chặn websocket) thì trình duyệt tự hỏi
 * lại theo nhịp vài giây: chậm hơn nhưng không mất tin.
 */

export function kenhPhong(kenh: string) {
  return `nbj-tc-${kenh}`;
}

export function kenhHopThu(accountId: string) {
  const goc = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.ERP_DEMO_SESSION_SECRET?.trim() || "nbj-tro-chuyen-o-may";
  return `nbj-tc-u-${createHmac("sha256", goc).update(`hop-thu:${accountId}`).digest("hex").slice(0, 32)}`;
}

/** Khoá công khai cho trình duyệt nghe kênh; thiếu thì trình duyệt chỉ hỏi lại theo nhịp. */
export function cauHinhRealtime(): { url: string; khoa: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const khoa = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !khoa) return null;
  return { url, khoa };
}

export async function phatTinHieu(kenh: string[], suKien: string, noiDung: Record<string, string>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret || kenh.length === 0) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: secret, "content-type": "application/json" },
      body: JSON.stringify({ messages: kenh.map((topic) => ({ topic, event: suKien, payload: noiDung, private: false })) }),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) console.error("Tro chuyen broadcast failed", res.status, (await res.text()).slice(0, 160));
  } catch (error) {
    console.error("Tro chuyen broadcast failed", error instanceof Error ? error.message : error);
  }
}
