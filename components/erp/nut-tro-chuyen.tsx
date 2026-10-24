"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useKenh, type CauHinhRealtime } from "@/lib/tro-chuyen/use-kenh";

/**
 * Nút Trò chuyện trên thanh đầu trang, mọi cỡ màn: số tin chưa đọc, nhảy lên
 * ngay khi có tin (nghe kênh hộp thư), không nối được thì hỏi lại mỗi 45 giây.
 */
export function NutTroChuyen() {
  const pathname = usePathname();
  const [chuaDoc, setChuaDoc] = useState(0);
  const [cauHinh, setCauHinh] = useState<{ realtime: CauHinhRealtime; hopThu: string } | null>(null);

  const tai = useCallback(async () => {
    const res = await fetch("/api/erp/tro-chuyen", { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { chuaDoc?: number; hopThu?: string; realtime?: CauHinhRealtime } | null;
    if (!res?.ok || !d) return;
    setChuaDoc(d.chuaDoc ?? 0);
    setCauHinh((cu) => cu ?? { realtime: d.realtime ?? null, hopThu: d.hopThu ?? "" });
  }, []);

  useEffect(() => {
    // Hỏi lần đầu ngay sau khi dựng xong, rồi mỗi 45 giây khi thẻ đang mở.
    const dau = window.setTimeout(tai, 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void tai();
    }, 45_000);
    return () => {
      window.clearTimeout(dau);
      window.clearInterval(id);
    };
  }, [tai, pathname]);

  useEffect(() => {
    const khiDoc = (e: Event) => setChuaDoc(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener("nbj:tc-chua-doc", khiDoc);
    return () => window.removeEventListener("nbj:tc-chua-doc", khiDoc);
  }, []);

  const kenh = useMemo(() => (cauHinh?.hopThu ? [cauHinh.hopThu] : []), [cauHinh]);
  useKenh(cauHinh?.realtime ?? null, kenh, () => void tai());

  const dangO = pathname?.startsWith("/erp/tro-chuyen");
  return (
    <Link
      href="/erp/tro-chuyen"
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${dangO ? "border-[#173f34] bg-[#eef7f1]" : "border-[#ced8d1] bg-white hover:border-[#8fa99f]"}`}
      aria-label={chuaDoc ? `Trò chuyện, ${chuaDoc} tin chưa đọc` : "Trò chuyện"}
      data-testid="nut-tro-chuyen"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#173f34]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
      </svg>
      {chuaDoc ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#c4482a] px-1 text-center text-[11px] font-black leading-5 text-white" data-testid="nut-tro-chuyen-so">
          {chuaDoc > 99 ? "99+" : chuaDoc}
        </span>
      ) : null}
    </Link>
  );
}
