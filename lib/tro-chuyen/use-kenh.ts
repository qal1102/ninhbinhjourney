"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Nghe các kênh "có tin mới" của Trò chuyện (xem `thoi-gian-thuc.ts`).
 *
 * `trangThai`:
 * - `song`: đã nối Realtime, tin tới tức thì;
 * - `hoi-lai`: không nối được (thiếu khoá, mạng chặn websocket, máy chạy thử),
 *   nơi gọi tự hỏi lại API theo nhịp ngắn.
 * Thư viện Supabase chỉ nạp khi cần, để các màn ERP khác không phải tải thêm.
 */

export type CauHinhRealtime = { url: string; khoa: string } | null;
export type SuKienKenh = { kenh: string; suKien: "tin" | "doc" | "go"; noiDung: Record<string, string> };

let khachChung: Promise<SupabaseClient> | null = null;
function khach(cauHinh: NonNullable<CauHinhRealtime>) {
  khachChung ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(cauHinh.url, cauHinh.khoa, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  );
  return khachChung;
}

export function useKenh(cauHinh: CauHinhRealtime, kenh: string[], khiCo: (e: SuKienKenh) => void) {
  const khiCoRef = useRef(khiCo);
  const kenhMo = useRef(new Map<string, RealtimeChannel>());
  useEffect(() => {
    khiCoRef.current = khiCo;
  });
  const khoa = kenh.slice().sort().join("|");
  // Trạng thái gắn với bộ kênh đang nghe: đổi kênh là về "đang nối" mà không cần đặt lại trong effect.
  const [ketQua, setKetQua] = useState<{ khoa: string; trangThai: "song" | "hoi-lai" } | null>(null);
  const trangThai: "dang-noi" | "song" | "hoi-lai" = !cauHinh || !khoa ? "hoi-lai" : ketQua?.khoa === khoa ? ketQua.trangThai : "dang-noi";

  useEffect(() => {
    if (!cauHinh || !khoa) return;
    let huy = false;
    const ds = khoa.split("|");
    const daNoi = new Set<string>();
    const setTrangThai = (t: "song" | "hoi-lai") => setKetQua({ khoa, trangThai: t });
    // Quá 7 giây chưa nối được thì chuyển sang hỏi lại, vẫn để kênh tự thử nối tiếp.
    const cho = window.setTimeout(() => {
      if (!huy && daNoi.size === 0) setTrangThai("hoi-lai");
    }, 7000);
    let client: SupabaseClient | null = null;
    void khach(cauHinh).then((c) => {
      if (huy) return;
      client = c;
      for (const ten of ds) {
        const ch = c.channel(ten, { config: { broadcast: { self: false, ack: false } } });
        for (const suKien of ["tin", "doc", "go"] as const) {
          ch.on("broadcast", { event: suKien }, (msg) => khiCoRef.current({ kenh: ten, suKien, noiDung: (msg.payload ?? {}) as Record<string, string> }));
        }
        ch.subscribe((status) => {
          if (huy) return;
          if (status === "SUBSCRIBED") {
            daNoi.add(ten);
            setTrangThai("song");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            daNoi.delete(ten);
            if (daNoi.size === 0) setTrangThai("hoi-lai");
          }
        });
        kenhMo.current.set(ten, ch);
      }
    });
    const mo = kenhMo.current;
    return () => {
      huy = true;
      window.clearTimeout(cho);
      for (const ten of ds) {
        const ch = mo.get(ten);
        if (ch && client) void client.removeChannel(ch);
        mo.delete(ten);
      }
    };
  }, [cauHinh, khoa]);

  /** Gửi tín hiệu từ trình duyệt (chỉ dùng cho "đang gõ…"; tin thật luôn đi qua API). */
  function gui(ten: string, suKien: "go", noiDung: Record<string, string>) {
    const ch = kenhMo.current.get(ten);
    if (ch && trangThai === "song") void ch.send({ type: "broadcast", event: suKien, payload: noiDung });
  }

  return { trangThai, gui };
}
