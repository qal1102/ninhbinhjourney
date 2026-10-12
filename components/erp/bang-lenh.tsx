"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type MucBangLenh = {
  id: string;
  nhom: "man" | "chuc-nang";
  ten: string;
  phu: string;
  href: string;
};

const TEN_NHOM: Record<MucBangLenh["nhom"], string> = {
  man: "Màn hình",
  "chuc-nang": "Việc làm được",
};

function boDau(chu: string) {
  return chu
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Bảng lệnh Ctrl+K của ERP (G2, chủ dự án chọn 11/10/2026 từ bảng vẽ). ERP có
 * hơn bảy chục màn, trước chỉ đi bằng menu. Gõ vài chữ, không cần dấu, là ra
 * màn hay việc; Enter mở; Tab (hoặc dòng cuối) chuyển câu sang trợ lý qua sự
 * kiện `nbj:tro-ly-hoi` mà `voice-command-center.tsx` nghe.
 */
export function BangLenh({ muc }: { muc: readonly MucBangLenh[] }) {
  const router = useRouter();
  const hop = useRef<HTMLDialogElement>(null);
  const oNhap = useRef<HTMLInputElement>(null);
  const [cau, setCau] = useState("");
  const [chon, setChon] = useState(0);

  const daChuan = useMemo(() => muc.map((m) => ({ ...m, khoa: boDau(`${m.ten} ${m.phu}`), khoaTen: boDau(m.ten) })), [muc]);

  const ketQua = useMemo(() => {
    const tu = boDau(cau).split(/\s+/).filter(Boolean);
    if (tu.length === 0) return daChuan.filter((m) => m.nhom === "man").slice(0, 7);
    return daChuan
      .filter((m) => tu.every((t) => m.khoa.includes(t)))
      .map((m) => ({ m, diem: (m.khoaTen.startsWith(tu[0]) ? 0 : m.khoaTen.includes(tu[0]) ? 1 : 2) + (m.nhom === "man" ? 0 : 0.5) }))
      .sort((a, b) => a.diem - b.diem)
      .slice(0, 8)
      .map((x) => x.m);
  }, [cau, daChuan]);

  const coHoiTroLy = cau.trim().length > 0;
  const tongDong = ketQua.length + (coHoiTroLy ? 1 : 0);

  function mo() {
    const d = hop.current;
    if (!d || d.open) return;
    setCau("");
    setChon(0);
    d.showModal();
    window.setTimeout(() => oNhap.current?.focus(), 30);
  }

  function dong() {
    hop.current?.close();
  }

  function hoiTroLy() {
    const noiDung = cau.trim();
    if (!noiDung) return;
    dong();
    window.dispatchEvent(new CustomEvent("nbj:tro-ly-hoi", { detail: { cau: noiDung } }));
  }

  function moDong(i: number) {
    if (i < ketQua.length) {
      dong();
      router.push(ketQua[i].href);
    } else if (coHoiTroLy) {
      hoiTroLy();
    }
  }

  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (hop.current?.open) dong();
        else mo();
      }
    };
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={mo}
        data-testid="mo-bang-lenh"
        data-chi="bang-lenh"
        data-chi-loi="Bấm kính lúp, gõ vài chữ không cần dấu là ra màn cần mở."
        aria-label="Tìm màn, việc"
        title="Tìm màn, việc"
        className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-[#ced8d1] bg-white px-2.5 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7]"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      </button>

      <dialog
        ref={hop}
        aria-label="Bảng lệnh: tìm màn, việc, hỏi trợ lý"
        data-testid="bang-lenh"
        onClick={(e) => {
          if (e.target === e.currentTarget) dong();
        }}
        className="m-0 mx-auto mt-[12vh] w-[min(40rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[22px] border border-[#d8e0db] bg-white p-0 text-[#20342c] shadow-[0_30px_90px_rgba(5,20,16,.4)] backdrop:bg-[#0f201b]/45"
      >
        <div className="flex items-center gap-3 border-b border-[#e3e8e4] px-4 py-3">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f7068" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <label htmlFor="o-bang-lenh" className="sr-only">
            Tìm màn, việc, hoặc gõ câu hỏi cho trợ lý
          </label>
          <input
            id="o-bang-lenh"
            ref={oNhap}
            value={cau}
            autoComplete="off"
            placeholder="Tìm màn, việc… hoặc gõ câu hỏi"
            onChange={(e) => {
              setCau(e.target.value);
              setChon(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setChon((c) => (tongDong ? (c + 1) % tongDong : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setChon((c) => (tongDong ? (c - 1 + tongDong) % tongDong : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                moDong(chon);
              } else if (e.key === "Tab" && coHoiTroLy) {
                e.preventDefault();
                hoiTroLy();
              }
            }}
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-[#183f34] outline-none"
          />
          <button type="button" onClick={dong} className="rounded-md border border-[#ced8d1] px-2 py-0.5 text-xs font-bold text-[#5f7068]">
            Esc
          </button>
        </div>

        <ul className="max-h-[min(26rem,60vh)] overflow-y-auto p-2" role="listbox" aria-label="Kết quả">
          {ketQua.map((m, i) => {
            const tieuDe = i === 0 || ketQua[i - 1].nhom !== m.nhom ? TEN_NHOM[m.nhom] : null;
            const dangChon = i === chon;
            return (
              <li key={m.id} role="presentation">
                {tieuDe ? <p className="px-3 pb-1 pt-2 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-[#6b786f]">{tieuDe}</p> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={dangChon}
                  onMouseEnter={() => setChon(i)}
                  onClick={() => moDong(i)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${dangChon ? "bg-[#173f34] text-white" : "text-[#183f34] hover:bg-[#f2f5f3]"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{m.ten}</span>
                    <span className={`block truncate text-xs ${dangChon ? "text-white/70" : "text-[#6b786f]"}`}>{m.phu}</span>
                  </span>
                  {dangChon ? <kbd className="rounded-md border border-white/35 px-1.5 text-[0.68rem]">↵</kbd> : null}
                </button>
              </li>
            );
          })}
          {coHoiTroLy ? (
            <li role="presentation">
              <p className="px-3 pb-1 pt-2 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-[#6b786f]">Hỏi trợ lý</p>
              <button
                type="button"
                role="option"
                aria-selected={chon === ketQua.length}
                onMouseEnter={() => setChon(ketQua.length)}
                onClick={hoiTroLy}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${chon === ketQua.length ? "bg-[#173f34] text-white" : "text-[#183f34] hover:bg-[#f2f5f3]"}`}
              >
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#183f34] text-sm text-[#e7b96a]">
                  ✦
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">&ldquo;{cau.trim()}&rdquo;</span>
                <kbd className={`rounded-md border px-1.5 text-[0.68rem] ${chon === ketQua.length ? "border-white/35" : "border-[#ced8d1] text-[#5f7068]"}`}>Tab</kbd>
              </button>
            </li>
          ) : null}
          {ketQua.length === 0 && !coHoiTroLy ? <li className="px-3 py-4 text-sm text-[#6b786f]">Chưa có màn nào khớp.</li> : null}
        </ul>

        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#e3e8e4] bg-[#f8faf8] px-4 py-2.5 text-xs text-[#5f7068]">
          <span>↑ ↓ chọn</span>
          <span>↵ mở</span>
          <span>Tab hỏi trợ lý</span>
          <span className="ml-auto">{muc.length} màn và việc · gõ không dấu cũng được</span>
        </p>
      </dialog>
    </>
  );
}
