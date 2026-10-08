"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CAU_GOI_Y } from "@/domain/hoi-dap-goi-y";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Khung hỏi đáp nổi trên web khách (08/10/2026): chủ dự án muốn "hiện ra
 * khung cho mọi người bấm vào hỏi". Máy chủ trả lời theo sổ nội dung soạn sẵn
 * trước, chỉ hỏi AI khi câu lạ (`lib/hoi-dap/tra-loi.ts`).
 *
 * Là `<dialog>` mở bằng `showModal()`: nằm ở lớp trên cùng nên luôn trên bản
 * đồ Leaflet/MapLibre; đóng bằng nút, bấm nền mờ hoặc Escape.
 */

type Tin = {
  vai: "khach" | "tro-ly";
  chu: string;
  nguon?: "so" | "ai" | "nho" | "chua-co" | "gioi-han" | "loi";
  lienKet?: { href: string; nhan: string }[];
};

const AN_O = ["/erp", "/kiosk", "/xep-hang"];

function ngonNguTrang(): NgonNgu {
  const main = document.querySelector("main[lang]")?.getAttribute("lang");
  if (main === "en" || main === "vi") return main;
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q === "en" || q === "vi") return q;
  if (document.documentElement.lang === "en") return "en";
  return /(?:^|;\s*)ninh-binh-lang=en(?:;|$)/.test(document.cookie) ? "en" : "vi";
}

const CHU = {
  nut: { vi: "Hỏi nhanh", en: "Ask us" },
  tieuDe: { vi: "Hỏi gì về chuyến đi?", en: "Questions about your trip?" },
  dan: {
    vi: "Trả lời theo đúng thông tin trên web. Câu nào web chưa có thì chỉ chỗ gọi hỏi.",
    en: "Answers come from what this site already says. Anything it doesn't cover points you to the phone line.",
  },
  goiY: { vi: "Hay được hỏi", en: "Often asked" },
  oNhap: { vi: "Ví dụ: đi Tràng An mất bao lâu?", en: "e.g. How long is the Trang An boat trip?" },
  gui: { vi: "Gửi", en: "Send" },
  dong: { vi: "Đóng", en: "Close" },
  dangTraLoi: { vi: "Đang tìm câu trả lời", en: "Finding the answer" },
  loi: { vi: "Chưa kết nối được. Xin thử lại sau giây lát.", en: "Could not connect. Please try again in a moment." },
  nguonSo: { vi: "Theo thông tin trên web", en: "From this site" },
  nguonAi: { vi: "AI tóm từ thông tin trên web", en: "AI summary of this site" },
  gioiHan: { vi: "Đã hỏi nhiều trong ít phút, phần trả lời bằng AI tạm nghỉ.", en: "Many questions in a short time, so AI answers are paused for now." },
} as const;

export function HoiDapNoi() {
  const pathname = usePathname() ?? "/";
  const [lang, setLang] = useState<NgonNgu>("vi");
  const [tin, setTin] = useState<Tin[]>([]);
  const [cau, setCau] = useState("");
  const [dangHoi, setDangHoi] = useState(false);
  // Khung đồng ý quyền riêng tư nằm ở đáy trang tới khi khách chọn: đẩy nút
  // lên trên nó, nếu không thì điện thoại không thấy nút "Hỏi nhanh".
  const [deDay, setDeDay] = useState<number | null>(null);
  const hop = useRef<HTMLDialogElement>(null);
  const cuoi = useRef<HTMLDivElement>(null);
  const oNhap = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const doc = () => setLang(ngonNguTrang());
    const khung = window.requestAnimationFrame(doc);
    const observer = new MutationObserver(doc);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"], subtree: true, childList: true });
    return () => {
      window.cancelAnimationFrame(khung);
      observer.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const doDai = () => {
      const dai = document.querySelector<HTMLElement>("[data-dai-dong-y]");
      setDeDay(dai ? Math.max(0, window.innerHeight - dai.getBoundingClientRect().top) + 10 : null);
    };
    doDai();
    const observer = new MutationObserver(doDai);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", doDai);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", doDai);
    };
  }, []);

  useEffect(() => {
    cuoi.current?.scrollIntoView({ block: "end" });
  }, [tin, dangHoi]);

  if (AN_O.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const t = (k: keyof typeof CHU) => CHU[k][lang];

  function mo() {
    const d = hop.current;
    if (d && !d.open) d.showModal();
    window.setTimeout(() => oNhap.current?.focus(), 50);
  }

  async function hoi(cauHoi: string, mucId?: string) {
    const chu = cauHoi.trim();
    if (!chu || dangHoi) return;
    const lichSu = tin.filter((m) => m.nguon !== "loi").slice(-4).map(({ vai, chu: c }) => ({ vai, chu: c }));
    setTin((cu) => [...cu, { vai: "khach", chu }]);
    setCau("");
    setDangHoi(true);
    try {
      const res = await fetch("/api/hoi-dap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cau: chu, lang, ...(mucId ? { mucId } : {}), ...(lichSu.length ? { lichSu } : {}) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const kq = (await res.json()) as { traLoi: string; nguon: Tin["nguon"]; lienKet: Tin["lienKet"] };
      setTin((cu) => [...cu, { vai: "tro-ly", chu: kq.traLoi, nguon: kq.nguon, lienKet: kq.lienKet }]);
    } catch {
      setTin((cu) => [...cu, { vai: "tro-ly", chu: t("loi"), nguon: "loi" }]);
    } finally {
      setDangHoi(false);
    }
  }

  const nhanNguon = (n: Tin["nguon"]) =>
    n === "so" ? t("nguonSo") : n === "ai" || n === "nho" ? t("nguonAi") : n === "gioi-han" ? t("gioiHan") : null;

  return (
    <>
      <button
        type="button"
        onClick={mo}
        data-testid="hoi-dap-mo"
        style={deDay !== null ? { bottom: deDay } : undefined}
        className={`fixed right-3 z-[1250] inline-flex min-h-12 items-center gap-2 rounded-full border border-[#E7B96A]/60 bg-[#F8F4EA] px-4 text-sm font-extrabold text-[#183F34] shadow-[0_14px_42px_rgba(10,31,24,.28)] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B96A] motion-reduce:transition-none sm:right-5 ${
          pathname === "/" ? "bottom-[4.5rem] sm:bottom-[5.25rem]" : "bottom-3 sm:bottom-5"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
          <path d="M4 5h16v11H9l-5 4V5Z" strokeLinejoin="round" />
          <path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
        </svg>
        {t("nut")}
      </button>

      <dialog
        ref={hop}
        aria-labelledby="hoi-dap-tieu-de"
        data-testid="hoi-dap"
        onClick={(e) => {
          if (e.target === e.currentTarget) hop.current?.close();
        }}
        className="fixed inset-x-2 bottom-2 top-auto m-0 mx-auto flex max-h-[min(40rem,calc(100dvh-1rem))] w-auto max-w-none flex-col overflow-hidden rounded-[24px] border border-[#D7D4C8] bg-[#F8F4EA] p-0 text-[#183F34] shadow-[0_28px_90px_rgba(7,27,21,.38)] backdrop:bg-[#0f1b17]/55 open:flex sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(26rem,calc(100vw-2.5rem))] [&:not([open])]:hidden"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E3DDCC] px-5 pb-3 pt-4">
          <div>
            <h2 id="hoi-dap-tieu-de" className="font-display text-[1.45rem] leading-tight">
              {t("tieuDe")}
            </h2>
            <p className="mt-1 text-[0.8rem] leading-5 text-[#56695f]">{t("dan")}</p>
          </div>
          <button
            type="button"
            onClick={() => hop.current?.close()}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[#cfc8b4] px-3 text-sm font-bold hover:bg-white"
          >
            {t("dong")}
          </button>
        </header>

        <div className="min-h-[12rem] flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          {tin.length === 0 ? (
            <div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-[#8a6a2f]">{t("goiY")}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {CAU_GOI_Y.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => hoi(g.hoi[lang], g.id)}
                    className="min-h-10 rounded-full border border-[#cfd9d3] bg-white px-3.5 text-left text-sm font-semibold hover:border-[#183F34]"
                  >
                    {g.hoi[lang]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-3">
              {tin.map((m, i) => (
                <li key={i} className={m.vai === "khach" ? "flex justify-end" : ""}>
                  <div
                    className={
                      m.vai === "khach"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#183F34] px-3.5 py-2 text-sm leading-6 text-white"
                        : "max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-6 text-[#20342c] shadow-sm"
                    }
                    data-testid={m.vai === "tro-ly" ? "hoi-dap-tra-loi" : undefined}
                    data-nguon={m.nguon}
                  >
                    <p className="whitespace-pre-line">{m.chu}</p>
                    {m.lienKet?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.lienKet.map((l) => (
                          <Link
                            key={l.href}
                            href={`${l.href}${l.href.includes("?") ? "&" : "?"}lang=${lang}`}
                            onClick={() => hop.current?.close()}
                            className="inline-flex min-h-9 items-center rounded-full bg-[#183F34] px-3 text-xs font-bold text-white"
                          >
                            {l.nhan} →
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {m.vai === "tro-ly" && nhanNguon(m.nguon) ? (
                      <p className="mt-1.5 text-[0.68rem] font-semibold text-[#7b8a82]">{nhanNguon(m.nguon)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
              {dangHoi ? (
                <li className="text-sm text-[#56695f]" role="status">
                  {t("dangTraLoi")}
                  <span className="motion-safe:animate-pulse">…</span>
                </li>
              ) : null}
            </ol>
          )}
          <div ref={cuoi} />
        </div>

        <form
          className="flex gap-2 border-t border-[#E3DDCC] bg-[#F3EEE1] px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void hoi(cau);
          }}
        >
          <input
            ref={oNhap}
            value={cau}
            onChange={(e) => setCau(e.target.value)}
            maxLength={300}
            placeholder={t("oNhap")}
            aria-label={t("oNhap")}
            data-testid="hoi-dap-o-nhap"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#cfc8b4] bg-white px-3.5 text-base outline-none focus:border-[#183F34]"
          />
          <button
            type="submit"
            disabled={dangHoi || !cau.trim()}
            className="min-h-12 rounded-xl bg-[#183F34] px-4 text-sm font-extrabold text-white disabled:opacity-45"
          >
            {t("gui")}
          </button>
        </form>
      </dialog>
    </>
  );
}
