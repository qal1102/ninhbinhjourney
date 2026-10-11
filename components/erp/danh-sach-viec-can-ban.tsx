"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { NHAN_LOAI_VIEC, type ViecCanBan } from "@/domain/viec-can-ban";
import { ERP_SITES } from "@/domain/erp";

const MAU_LOAI: Record<ViecCanBan["loai"], string> = {
  sop: "bg-[#f6d2be] text-[#8a3a12]",
  "su-co": "bg-[#f6d2be] text-[#8a3a12]",
  "ca-lech": "bg-[#e9ebe7] text-[#3f4a44]",
  "hoa-don": "bg-[#e6eef8] text-[#24466e]",
  "du-an": "bg-[#e3efe8] text-[#24594a]",
};

// "Hoãn tới mai" chỉ lưu trên máy này (H7, 11/10/2026): không thêm cột vào kho,
// hồ sơ vẫn chờ ở màn gốc. Khoá là mã việc, giá trị là ngày (giờ VN) hiện lại.
const KHOA = "nbj-viec-hoan";
const SU_KIEN = "nbj:viec-hoan";

function ngayVN(cong = 0) {
  return new Date(Date.now() + 7 * 3_600_000 + cong * 86_400_000).toISOString().slice(0, 10);
}

function docTho() {
  try {
    return window.localStorage.getItem(KHOA) ?? "";
  } catch {
    return "";
  }
}

function theoDoi(bao: () => void) {
  window.addEventListener("storage", bao);
  window.addEventListener(SU_KIEN, bao);
  return () => {
    window.removeEventListener("storage", bao);
    window.removeEventListener(SU_KIEN, bao);
  };
}

function ghi(hoan: Record<string, string>) {
  try {
    window.localStorage.setItem(KHOA, JSON.stringify(hoan));
  } catch {
    // Bộ nhớ bị chặn thì việc vẫn hiện như cũ.
  }
  window.dispatchEvent(new Event(SU_KIEN));
}

function DongViec({ v, onHoan, datLink }: { v: ViecCanBan; onHoan: () => void; datLink: (el: HTMLAnchorElement | null) => void }) {
  const coSo = ERP_SITES.find((s) => s.id === v.siteId)?.shortName ?? v.siteId;
  return (
    <li
      data-viec-id={v.id}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-3 py-2.5 transition-shadow has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[#183f34] ${v.gap ? "border-[#e9b79a]" : "border-[#dde3de]"}`}
    >
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-black ${MAU_LOAI[v.loai]}`}>{NHAN_LOAI_VIEC[v.loai]}</span>
      <span className="min-w-0 flex-[999_1_14rem]">
        <span className="block truncate text-sm font-black text-[#1f2f2a]">{v.ten}</span>
        <span className="block truncate text-xs text-[#5f7068]">{coSo} · {v.phu}</span>
      </span>
      <span className={`shrink-0 text-xs font-bold ${v.gap ? "text-[#8a3a12]" : "text-[#6b786f]"}`}>{v.han}</span>
      <span className="ml-auto flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onHoan}
          data-testid="hoan-viec"
          className="inline-flex min-h-10 items-center rounded-lg px-2.5 text-sm font-bold text-[#5f7068] hover:bg-[#f1f4f2]"
        >
          Để mai
        </button>
        <Link ref={datLink} href={v.href} className="inline-flex min-h-10 items-center rounded-lg border border-[#ccd8d1] px-3 text-sm font-bold text-[#183f34] outline-none hover:border-[#183f34]">
          Mở
        </Link>
      </span>
    </li>
  );
}

/**
 * "Việc cần bạn" (G1) thêm H7: trên máy tính bấm j/k đi qua từng việc, Enter
 * mở, h để mai; điện thoại có nút "Để mai" ngay trên dòng. Hoãn chỉ trên máy
 * này, sáng mai việc tự hiện lại.
 */
export function DanhSachViecCanBan({ danhSach }: { danhSach: readonly ViecCanBan[] }) {
  const tho = useSyncExternalStore(theoDoi, docTho, () => "");
  const hoan = useMemo<Record<string, string>>(() => {
    try {
      return tho ? (JSON.parse(tho) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }, [tho]);
  const homNay = ngayVN();
  const hien = danhSach.filter((v) => !(hoan[v.id] && hoan[v.id] > homNay));
  const soHoan = danhSach.length - hien.length;
  const links = useRef(new Map<string, HTMLAnchorElement>());

  function hoanViec(id: string) {
    const giu = Object.fromEntries(Object.entries(hoan).filter(([, ngay]) => ngay > homNay));
    ghi({ ...giu, [id]: ngayVN(1) });
  }

  useEffect(() => {
    function phim(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const dich = e.target as HTMLElement | null;
      if (dich?.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return;
      if (e.key !== "j" && e.key !== "k" && e.key !== "h") return;
      const ds = hien.map((v) => links.current.get(v.id)).filter((a): a is HTMLAnchorElement => Boolean(a && a.offsetParent));
      if (!ds.length) return;
      const dang = ds.findIndex((a) => a === document.activeElement);
      if (e.key === "h") {
        if (dang < 0) return;
        e.preventDefault();
        const id = hien.find((v) => links.current.get(v.id) === ds[dang])?.id;
        if (id) hoanViec(id);
        window.requestAnimationFrame(() => ds[Math.min(dang + 1, ds.length - 1)]?.focus());
        return;
      }
      e.preventDefault();
      const toi = dang < 0 ? 0 : Math.max(0, Math.min(ds.length - 1, dang + (e.key === "j" ? 1 : -1)));
      ds[toi].focus();
      ds[toi].closest("li")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  });

  const dong = (v: ViecCanBan) => (
    <DongViec
      key={v.id}
      v={v}
      onHoan={() => hoanViec(v.id)}
      datLink={(el) => {
        if (el) links.current.set(v.id, el);
        else links.current.delete(v.id);
      }}
    />
  );

  return (
    <div data-testid="viec-can-ban" data-chi="viec-can-ban" data-chi-loi="Mọi hồ sơ đang chờ bạn, việc gấp lên đầu. Bấm Mở là tới đúng màn; chưa làm được thì bấm Để mai." className="mt-4 border-t border-[#ead6cf]/70 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-black text-[#1f2f2a]">Việc cần bạn · {hien.length}</h2>
        <p className="hidden text-xs text-[#6b786f] lg:block">
          <kbd className="rounded border border-[#ccd8d1] px-1 font-sans">j</kbd> <kbd className="rounded border border-[#ccd8d1] px-1 font-sans">k</kbd> đi qua từng việc ·{" "}
          <kbd className="rounded border border-[#ccd8d1] px-1 font-sans">Enter</kbd> mở · <kbd className="rounded border border-[#ccd8d1] px-1 font-sans">h</kbd> để mai
        </p>
      </div>
      {hien.length ? (
        <ul className="mt-2 space-y-2">{hien.slice(0, 6).map(dong)}</ul>
      ) : (
        <p className="mt-2 text-sm text-[#5f7068]">Mọi việc đã để sang mai.</p>
      )}
      {hien.length > 6 ? (
        <details className="mt-2">
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-bold text-[#356957]">Xem thêm {hien.length - 6} việc</summary>
          <ul className="mt-1 space-y-2">{hien.slice(6).map(dong)}</ul>
        </details>
      ) : null}
      {soHoan > 0 ? (
        <button
          type="button"
          data-testid="hien-lai-viec"
          onClick={() => ghi(Object.fromEntries(Object.entries(hoan).filter(([id]) => !danhSach.some((v) => v.id === id))))}
          className="mt-2 inline-flex min-h-10 items-center text-sm font-bold text-[#356957] underline-offset-4 hover:underline"
        >
          Hiện lại {soHoan} việc đã để mai
        </button>
      ) : null}
    </div>
  );
}
