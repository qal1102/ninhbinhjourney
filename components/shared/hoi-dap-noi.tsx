"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import { CAU_GOI_Y } from "@/domain/hoi-dap-goi-y";
import type { NgonNgu } from "@/lib/ngon-ngu";
import { FLOATING_YIELD_CLASS } from "@/lib/use-floating-yield";

/**
 * Khung "Hỏi AI" nổi trên web khách (08/10/2026): chủ dự án muốn "hiện ra
 * khung cho mọi người bấm vào hỏi", và khách phải thấy rõ đây là AI chứ
 * không phải trả lời tự động. Máy chủ trả lời theo sổ nội dung soạn sẵn với
 * câu gợi ý, hỏi AI với câu tự gõ, và điền sẵn đơn khi khách nhờ đặt
 * (`lib/hoi-dap/tra-loi.ts`).
 *
 * Là `<dialog>` mở bằng `showModal()`: nằm ở lớp trên cùng nên luôn trên bản
 * đồ Leaflet/MapLibre; đóng bằng nút, bấm nền mờ hoặc Escape.
 */

type DatVe = { tenGoi: string; ngay: string | null; gio: string | null; nguoiLon: number; treEm: number; href: string };

type Tin = {
  vai: "khach" | "tro-ly";
  chu: string;
  nguon?: "so" | "ai" | "nho" | "chua-co" | "gioi-han" | "loi";
  lienKet?: { href: string; nhan: string }[];
  datVe?: DatVe;
  moi?: boolean;
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
  nut: { vi: "Hỏi AI", en: "Ask AI" },
  ten: { vi: "AI của Ninh Bình Journey", en: "Ninh Binh Journey AI" },
  dan: {
    vi: "Hỏi gì cũng được: vé, gói, chỗ chơi, món ngon, hay nhờ đặt giúp. Giá và luật đặt chỗ lấy đúng theo web.",
    en: "Ask anything: tickets, packages, places, food, or ask it to book for you. Prices and booking rules come straight from this site.",
  },
  goiY: { vi: "Câu hay hỏi · trả lời có sẵn", en: "Common questions · instant answers" },
  thuNoi: { vi: "Hoặc nhờ AI đặt giúp", en: "Or let the AI book for you" },
  mauDat: {
    vi: "Đặt giúp mình gói Gia đình khám phá thứ bảy này, 2 người lớn 1 bé",
    en: "Book the Family discovery package this Saturday for 2 adults and 1 child",
  },
  oNhap: { vi: "Hỏi AI bất cứ điều gì…", en: "Ask the AI anything…" },
  gui: { vi: "Gửi", en: "Send" },
  dong: { vi: "Đóng", en: "Close" },
  dangTraLoi: { vi: "AI đang soạn câu trả lời", en: "The AI is writing" },
  loi: { vi: "Chưa kết nối được. Xin thử lại sau giây lát.", en: "Could not connect. Please try again in a moment." },
  nhanAi: { vi: "AI trả lời", en: "AI answer" },
  nhanSo: { vi: "Trả lời có sẵn", en: "Instant answer" },
  gioiHan: { vi: "Đã hỏi nhiều trong ít phút, AI tạm nghỉ; đây là câu trả lời có sẵn.", en: "Many questions in a short time, so the AI is resting; this is an instant answer." },
  canhBao: { vi: "AI có thể nhầm. Giá và giờ chạy xem lại ở trang đặt vé.", en: "AI can make mistakes. Check prices and times on the booking page." },
  donSan: { vi: "Đơn AI đã điền sẵn", en: "Booking filled in by the AI" },
  moDon: { vi: "Mở đơn đã điền", en: "Open the filled booking" },
  chuaChon: { vi: "chọn ở bước sau", en: "pick on the next page" },
  nguoiLon: { vi: "người lớn", en: "adults" },
  treEm: { vi: "trẻ em", en: "children" },
} as const;

function ngayDoc(iso: string, lang: NgonNgu) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "vi-VN", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Chữ AI hiện dần như đang gõ; giảm chuyển động thì hiện ngay. */
function ChuHienDan({ chu, chay, onXong }: { chu: string; chay: boolean; onXong: () => void }) {
  const [so, setSo] = useState(chay ? 0 : chu.length);
  // Giữ hàm báo xong trong ref: khung cha vẽ lại giữa chừng không làm chữ gõ lại từ đầu.
  const baoXong = useRef(onXong);
  useEffect(() => {
    baoXong.current = onXong;
  });
  useEffect(() => {
    if (!chay) return;
    const tu = chu.split(/(\s+)/);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setSo(tu.slice(0, i).join("").length);
      if (i >= tu.length) {
        window.clearInterval(id);
        baoXong.current();
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [chu, chay]);
  return <p className="whitespace-pre-line">{chu.slice(0, so)}</p>;
}

export function HoiDapNoi() {
  const pathname = usePathname() ?? "/";
  const giamChuyenDong = useReducedMotion();
  const [lang, setLang] = useState<NgonNgu>("vi");
  const [tin, setTin] = useState<Tin[]>([]);
  const [cau, setCau] = useState("");
  const [dangHoi, setDangHoi] = useState(false);
  // Khung đồng ý quyền riêng tư nằm ở đáy trang tới khi khách chọn: đẩy nút
  // lên trên nó, nếu không thì điện thoại không thấy nút.
  const [deDay, setDeDay] = useState<number | null>(null);
  // Màn thấp (iPhone SE) mà dải đồng ý còn hiện thì không đủ chỗ: nút nằm
  // trên dải sẽ che nút chính của trang. Tạm ẩn cho tới khi khách trả lời dải.
  const [nhuongCho, setNhuongCho] = useState(false);
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
      setNhuongCho(Boolean(dai) && window.innerHeight <= 640);
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
  const themLang = (href: string) => (href.includes("lang=") ? href : `${href}${href.includes("?") ? "&" : "?"}lang=${lang}`);

  function mo() {
    const d = hop.current;
    if (d && !d.open) d.showModal();
    window.setTimeout(() => oNhap.current?.focus(), 50);
  }

  function xongGo(i: number) {
    setTin((cu) => cu.map((m, j) => (j === i ? { ...m, moi: false } : m)));
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
      const kq = (await res.json()) as { traLoi: string; nguon: Tin["nguon"]; lienKet: Tin["lienKet"]; datVe?: DatVe };
      const laAi = kq.nguon === "ai" || kq.nguon === "nho";
      setTin((cu) => [...cu, { vai: "tro-ly", chu: kq.traLoi, nguon: kq.nguon, lienKet: kq.lienKet, datVe: kq.datVe, moi: laAi && !giamChuyenDong }]);
    } catch {
      setTin((cu) => [...cu, { vai: "tro-ly", chu: t("loi"), nguon: "loi" }]);
    } finally {
      setDangHoi(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={mo}
        data-testid="hoi-dap-mo"
        aria-hidden={nhuongCho ? true : undefined}
        tabIndex={nhuongCho ? -1 : undefined}
        style={deDay !== null ? { bottom: deDay } : undefined}
        className={`fixed right-3 z-[1250] inline-flex min-h-12 items-center gap-2 rounded-full border border-[#E7B96A] bg-[#183F34] px-4 text-sm font-extrabold text-white shadow-[0_14px_42px_rgba(10,31,24,.32)] transition hover:bg-[#24594A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B96A] motion-reduce:transition-none sm:right-5 ${
          pathname === "/" ? "bottom-[4.5rem] sm:bottom-[5.25rem]" : "bottom-3 sm:bottom-5"
        } ${nhuongCho ? FLOATING_YIELD_CLASS : ""}`}
      >
        <span aria-hidden="true" className="text-base leading-none text-[#E7B96A]">
          ✦
        </span>
        {t("nut")}
      </button>

      <dialog
        ref={hop}
        aria-labelledby="hoi-dap-tieu-de"
        data-testid="hoi-dap"
        onClick={(e) => {
          if (e.target === e.currentTarget) hop.current?.close();
        }}
        className="fixed inset-x-2 bottom-2 top-auto m-0 mx-auto flex max-h-[min(42rem,calc(100dvh-1rem))] w-auto max-w-none flex-col overflow-hidden rounded-[24px] border border-[#D7D4C8] bg-[#F8F4EA] p-0 text-[#183F34] shadow-[0_28px_90px_rgba(7,27,21,.38)] backdrop:bg-[#0f1b17]/55 open:flex sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(27rem,calc(100vw-2.5rem))] [&:not([open])]:hidden"
      >
        <header className="flex items-start justify-between gap-3 bg-[#183F34] px-5 pb-4 pt-4 text-white">
          <div className="flex gap-3">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E7B96A] text-lg text-[#183F34]">
              ✦
            </span>
            <div>
              <h2 id="hoi-dap-tieu-de" className="font-display text-[1.3rem] leading-tight">
                {t("ten")}
              </h2>
              <p className="mt-1 text-[0.78rem] leading-5 text-white/75">{t("dan")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => hop.current?.close()}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-white/30 px-3 text-sm font-bold hover:bg-white/10"
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
              <p className="mt-4 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-[#8a6a2f]">{t("thuNoi")}</p>
              <button
                type="button"
                onClick={() => hoi(t("mauDat"))}
                data-testid="hoi-dap-mau-dat"
                className="mt-2.5 min-h-10 rounded-2xl border border-[#E7B96A] bg-[#fff8e8] px-3.5 py-2 text-left text-sm font-semibold"
              >
                <span aria-hidden="true" className="mr-1 text-[#b07f2a]">
                  ✦
                </span>
                {t("mauDat")}
              </button>
            </div>
          ) : (
            <ol className="space-y-3">
              {tin.map((m, i) => (
                <li key={i} className={m.vai === "khach" ? "flex justify-end" : ""}>
                  {m.vai === "khach" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#183F34] px-3.5 py-2 text-sm leading-6 text-white">{m.chu}</div>
                  ) : (
                    <div
                      className="max-w-[94%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-6 text-[#20342c] shadow-sm"
                      data-testid="hoi-dap-tra-loi"
                      data-nguon={m.nguon}
                    >
                      {m.nguon === "ai" || m.nguon === "nho" ? (
                        <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#183F34] px-2 py-0.5 text-[0.66rem] font-extrabold uppercase tracking-[0.1em] text-[#E7B96A]">
                          ✦ {t("nhanAi")}
                        </p>
                      ) : m.nguon === "so" || m.nguon === "gioi-han" ? (
                        <p className="mb-1 text-[0.66rem] font-extrabold uppercase tracking-[0.1em] text-[#7b8a82]">
                          {m.nguon === "gioi-han" ? t("gioiHan") : t("nhanSo")}
                        </p>
                      ) : null}
                      <ChuHienDan chu={m.chu} chay={Boolean(m.moi)} onXong={() => xongGo(i)} />
                      {!m.moi && m.datVe ? (
                        <div className="mt-2.5 rounded-xl border border-[#E7B96A] bg-[#fff8e8] p-3" data-testid="hoi-dap-don">
                          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.1em] text-[#8a6a2f]">{t("donSan")}</p>
                          <p className="mt-1 font-bold text-[#183F34]">{m.datVe.tenGoi}</p>
                          <p className="text-[0.8rem] leading-5 text-[#42554c]">
                            {m.datVe.ngay ? ngayDoc(m.datVe.ngay, lang) : t("chuaChon")}
                            {m.datVe.gio ? ` · ${m.datVe.gio}` : ""} · {m.datVe.nguoiLon} {t("nguoiLon")}
                            {m.datVe.treEm ? `, ${m.datVe.treEm} ${t("treEm")}` : ""}
                          </p>
                          <Link
                            href={m.datVe.href}
                            onClick={() => hop.current?.close()}
                            data-testid="hoi-dap-mo-don"
                            className="mt-2 inline-flex min-h-10 items-center rounded-full bg-[#183F34] px-4 text-sm font-extrabold text-white"
                          >
                            {t("moDon")} →
                          </Link>
                        </div>
                      ) : null}
                      {/* Đã có thẻ đơn thì thôi nút liên kết: hai nút "Xem gói" trùng nhau làm rối. */}
                      {!m.moi && !m.datVe && m.lienKet?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.lienKet.map((l) => (
                            <Link
                              key={l.href}
                              href={themLang(l.href)}
                              onClick={() => hop.current?.close()}
                              className="inline-flex min-h-9 items-center rounded-full border border-[#183F34] px-3 text-xs font-bold text-[#183F34]"
                            >
                              {l.nhan} →
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
              {dangHoi ? (
                <li className="inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm text-[#56695f] shadow-sm" role="status">
                  <span aria-hidden="true" className="text-[#b07f2a] motion-safe:animate-pulse">
                    ✦
                  </span>
                  {t("dangTraLoi")}…
                </li>
              ) : null}
            </ol>
          )}
          <div ref={cuoi} />
        </div>

        <form
          className="border-t border-[#E3DDCC] bg-[#F3EEE1] px-3 pb-2 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void hoi(cau);
          }}
        >
          <div className="flex gap-2">
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
          </div>
          <p className="mt-1.5 text-center text-[0.68rem] text-[#7b8a82]">{t("canhBao")}</p>
        </form>
      </dialog>
    </>
  );
}
