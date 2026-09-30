"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * "Nghe thuyết minh" trên trang điểm đến: đọc to lời giới thiệu, câu chuyện
 * và dòng thời gian bằng giọng đọc có sẵn trên máy khách (Web Speech API).
 *
 * Không có tệp âm thanh thu sẵn, không gửi chữ đi đâu: trình duyệt tự đọc.
 * Máy không có giọng tiếng Việt thì nói thẳng, vì giọng tiếng Anh đọc chữ có
 * dấu nghe như đọc mã. Chia câu ra đọc từng câu: Chrome tự ngắt một câu đọc
 * dài quá chừng mười lăm giây, đọc cả đoạn một lần là bị cắt giữa chừng.
 */

type TrangThai = "nghi" | "dang-doc" | "tam-dung";

const TOC_DO = [0.85, 1, 1.15] as const;

function khongDoi() {
  return () => {};
}

function coGiongDoc() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function chiaCau(doan: readonly string[]): string[] {
  return doan
    .flatMap((d) => d.split(/(?<=[.!?…])\s+/))
    .map((c) => c.trim())
    .filter(Boolean);
}

function chonGiong(lang: "vi" | "en"): SpeechSynthesisVoice | null {
  const giong = window.speechSynthesis.getVoices();
  const tien = lang === "vi" ? "vi" : "en";
  return giong.find((g) => g.lang.toLowerCase().startsWith(tien)) ?? null;
}

export function ThuyetMinh({
  ten,
  doan,
  lang,
  tone = "light",
}: {
  ten: string;
  doan: readonly string[];
  lang: "vi" | "en";
  tone?: "light" | "dark";
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const hoTro = useSyncExternalStore(khongDoi, coGiongDoc, () => false);
  const [trangThai, setTrangThai] = useState<TrangThai>("nghi");
  const [cauDangDoc, setCauDangDoc] = useState(0);
  const [tocDo, setTocDo] = useState<(typeof TOC_DO)[number]>(1);
  const [thieuGiong, setThieuGiong] = useState(false);
  const cau = useRef<string[]>([]);
  const phien = useRef(0);

  // Rời trang (hay đổi ngôn ngữ) thì thôi đọc: giọng máy không tự dừng theo trang.
  useEffect(() => {
    return () => {
      phien.current += 1;
      if (coGiongDoc()) window.speechSynthesis.cancel();
    };
  }, [lang, doan]);

  function docTu(viTri: number, maPhien: number, giong: SpeechSynthesisVoice | null) {
    if (maPhien !== phien.current) return;
    if (viTri >= cau.current.length) {
      setTrangThai("nghi");
      setCauDangDoc(0);
      return;
    }
    const loi = new SpeechSynthesisUtterance(cau.current[viTri]);
    loi.lang = lang === "vi" ? "vi-VN" : "en-GB";
    if (giong) loi.voice = giong;
    loi.rate = tocDo;
    loi.onstart = () => setCauDangDoc(viTri);
    loi.onend = () => docTu(viTri + 1, maPhien, giong);
    loi.onerror = (event) => {
      // "interrupted"/"canceled" là do chính khách bấm dừng, không phải lỗi.
      if (event.error !== "interrupted" && event.error !== "canceled") setTrangThai("nghi");
    };
    window.speechSynthesis.speak(loi);
  }

  function batDau() {
    const tong = window.speechSynthesis;
    tong.cancel();
    phien.current += 1;
    const maPhien = phien.current;
    cau.current = chiaCau([ten, ...doan]);
    const giong = chonGiong(lang);
    setThieuGiong(!giong && lang === "vi");
    setTrangThai("dang-doc");
    docTu(0, maPhien, giong);
  }

  function tamDung() {
    window.speechSynthesis.pause();
    setTrangThai("tam-dung");
  }

  function tiepTuc() {
    window.speechSynthesis.resume();
    setTrangThai("dang-doc");
  }

  function dung() {
    phien.current += 1;
    window.speechSynthesis.cancel();
    setTrangThai("nghi");
    setCauDangDoc(0);
  }

  if (!hoTro) return null;

  const toi = tone === "dark";
  const nutChinh = toi
    ? "bg-[#e7c78d] text-[#183f34]"
    : "bg-[#183f34] text-white";
  const nutPhu = toi
    ? "border border-white/30 text-white"
    : "border border-[#b9c4bd] text-[#183f34]";
  const tongCau = cau.current.length;

  return (
    <section
      data-testid="thuyet-minh"
      data-trang-thai={trangThai}
      aria-label={t("Nghe thuyết minh", "Audio guide")}
      className={`mt-8 rounded-2xl p-4 sm:p-5 ${toi ? "border border-white/15 bg-white/8 text-white" : "border border-[#d7d5cd] bg-white text-[#27362f]"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toi ? "bg-white/12" : "bg-[#edf3f0]"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
            <path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t("Nghe thuyết minh", "Audio guide")}</p>
          <p role="status" className={`text-sm ${toi ? "text-white/70" : "text-[#59654b]"}`}>
            {trangThai === "nghi"
              ? t("Giọng đọc của máy bạn kể lại câu chuyện nơi này, đeo tai nghe là nghe được khi đang đi.", "Your device reads this place's story aloud; put in earphones and listen as you walk.")
              : trangThai === "tam-dung"
                ? t("Đang tạm dừng.", "Paused.")
                : t(`Đang đọc câu ${cauDangDoc + 1}/${tongCau}.`, `Reading sentence ${cauDangDoc + 1} of ${tongCau}.`)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trangThai === "nghi" ? (
          <button type="button" onClick={batDau} className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-extrabold ${nutChinh}`}>
            ▶ {t("Nghe", "Listen")}
          </button>
        ) : trangThai === "dang-doc" ? (
          <button type="button" onClick={tamDung} className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-extrabold ${nutChinh}`}>
            ❚❚ {t("Tạm dừng", "Pause")}
          </button>
        ) : (
          <button type="button" onClick={tiepTuc} className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-extrabold ${nutChinh}`}>
            ▶ {t("Nghe tiếp", "Resume")}
          </button>
        )}
        {trangThai !== "nghi" ? (
          <button type="button" onClick={dung} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${nutPhu}`}>
            ■ {t("Dừng", "Stop")}
          </button>
        ) : null}
        <label className={`ml-auto inline-flex min-h-11 items-center gap-2 text-sm font-bold ${toi ? "text-white/80" : "text-[#42554c]"}`}>
          {t("Tốc độ", "Speed")}
          <select
            value={tocDo}
            disabled={trangThai !== "nghi"}
            onChange={(event) => setTocDo(Number(event.target.value) as (typeof TOC_DO)[number])}
            className={`min-h-11 rounded-lg px-2 font-bold ${toi ? "border border-white/30 bg-transparent text-white" : "border border-[#ccd8d1] bg-white"}`}
          >
            {TOC_DO.map((muc, i) => (
              <option key={muc} value={muc}>
                {[t("Chậm", "Slow"), t("Vừa", "Normal"), t("Nhanh", "Fast")][i]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {thieuGiong ? (
        <p className={`mt-3 text-xs leading-5 ${toi ? "text-white/70" : "text-[#8a6b38]"}`}>
          {t(
            "Máy bạn chưa cài giọng đọc tiếng Việt nên trình duyệt đọc bằng giọng mặc định, nghe có thể lơ lớ. Cài thêm giọng tiếng Việt trong phần cài đặt ngôn ngữ của máy là nghe rõ.",
            "",
          )}
        </p>
      ) : null}
    </section>
  );
}
