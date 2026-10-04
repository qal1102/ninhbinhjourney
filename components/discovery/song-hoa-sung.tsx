"use client";

import { useEffect, useMemo, useState } from "react";
import { doNoHoa, gioNinhBinh } from "@/domain/mua-hoa-sung";

/**
 * Mặt sông Ngô Đồng với hoa súng nở theo giờ thật ở Ninh Bình.
 *
 * Dữ kiện mà hình chở: hoa súng ở Tam Cốc chỉ nở khoảng 7–10 giờ sáng rồi
 * cụp lại (`doNoHoa`). Mở trang buổi chiều thì thấy hoa cụp, kèm câu nói rõ
 * sáng mai mấy giờ nở lại; kéo thanh giờ để xem hoa mở trong một buổi sáng.
 * Giờ ban đầu lấy từ máy chủ để hình dựng trên máy chủ và trình duyệt giống
 * nhau; sau đó mỗi phút tự cập nhật theo đồng hồ.
 */

const RONG = 1200;
const CAO = 420;

type Hoa = { x: number; y: number; r: number; xoay: number; mau: number; tre: number };
type La = { x: number; y: number; rx: number; ry: number; xoay: number };

/** Số giả ngẫu nhiên cố định theo hạt, để máy chủ và trình duyệt vẽ giống hệt. */
function ngauNhien(hat: number) {
  let s = hat;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const MAU_HOA = [
  ["#f7d3e4", "#c75b8f"],
  ["#ecd6f5", "#9a5fb8"],
  ["#fbe3ec", "#d27aa3"],
] as const;

function gioChu(gio: number) {
  const g = Math.floor(gio);
  const p = Math.round((gio - g) * 60);
  return `${String(g).padStart(2, "0")}:${String(p === 60 ? 0 : p).padStart(2, "0")}`;
}

function loiTheoGio(gio: number, lang: "vi" | "en") {
  const f = doNoHoa(gio);
  if (lang === "en") {
    if (f >= 1) return "Lilies fully open: the best hour to be on the river.";
    if (f > 0) return gio < 8 ? "The lilies are opening." : "The lilies are starting to close.";
    return gio < 7 ? "Not yet: the lilies open at around 7 am." : "Closed for the day: they open again tomorrow at around 7 am.";
  }
  if (f >= 1) return "Hoa mở trọn: đúng lúc nên có mặt trên sông.";
  if (f > 0) return gio < 8 ? "Hoa đang hé nở." : "Hoa bắt đầu cụp lại.";
  return gio < 7 ? "Chưa nở: hoa mở khoảng 7 giờ sáng." : "Hoa đã cụp: sáng mai nở lại khoảng 7 giờ.";
}

function BongHoa({ hoa, mo }: { hoa: Hoa; mo: number }) {
  const dam = MAU_HOA[hoa.mau][1];
  // Cánh xoè dần: góc nghiêng cánh và độ dài cánh cùng tăng theo độ mở.
  const f = Math.max(0, Math.min(1, mo - hoa.tre * 0.15));
  const cao = hoa.r * (0.55 + 0.45 * f);
  const rong = hoa.r * (0.18 + 0.2 * f);
  const lop = (soCanh: number, lech: number, ty: number, mau: string) =>
    Array.from({ length: soCanh }, (_, i) => {
      const goc = (360 / soCanh) * i + lech + hoa.xoay;
      const xoe = 10 + 70 * f * ty;
      return (
        <ellipse
          key={`${soCanh}-${i}`}
          cx={0}
          cy={-cao * ty * 0.55}
          rx={rong * ty}
          ry={cao * ty * 0.6}
          fill={mau}
          opacity={0.92}
          transform={`rotate(${goc}) rotate(${(i % 2 ? 1 : -1) * (90 - xoe) * 0.15})`}
        />
      );
    });
  return (
    <g transform={`translate(${hoa.x} ${hoa.y}) scale(1 0.62)`} className="hoa-sung-bong">
      {lop(8, 0, 1, `url(#canh-nhat-${hoa.mau})`)}
      {lop(8, 22.5, 0.72, `url(#canh-dam-${hoa.mau})`)}
      <circle r={hoa.r * (0.12 + 0.06 * f)} fill={f > 0.2 ? "#f5c84c" : dam} />
    </g>
  );
}

export function SongHoaSung({ lang, bayGio }: { lang: "vi" | "en"; bayGio: string }) {
  const gioMayChu = useMemo(() => gioNinhBinh(new Date(bayGio)), [bayGio]);
  const [gioThat, setGioThat] = useState(gioMayChu);
  const [gioKeo, setGioKeo] = useState<number | null>(null);
  const gio = gioKeo ?? gioThat;
  const mo = doNoHoa(gio);

  useEffect(() => {
    // Đọc giờ máy khách ngay khi mở (trang có thể nằm trong bộ đệm từ trước),
    // rồi mỗi phút một lần.
    const capNhat = () => setGioThat(gioNinhBinh(new Date()));
    capNhat();
    const id = window.setInterval(capNhat, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { hoa, la } = useMemo(() => {
    const r = ngauNhien(20261125);
    const la: La[] = [];
    const hoa: Hoa[] = [];
    for (let i = 0; i < 46; i++) {
      // Hàng lá dày dần về phía gần (dưới), như nhìn từ đò.
      const y = 190 + Math.pow(r(), 0.7) * 215;
      const gan = (y - 190) / 215;
      la.push({ x: r() * RONG, y, rx: 26 + gan * 46, ry: 9 + gan * 15, xoay: (r() - 0.5) * 18 });
      if (r() < 0.55) {
        hoa.push({
          x: la[la.length - 1].x + (r() - 0.5) * 20,
          y: y - 6 - gan * 8,
          r: 12 + gan * 22,
          xoay: r() * 45,
          mau: Math.floor(r() * MAU_HOA.length),
          tre: r(),
        });
      }
    }
    la.sort((a, b) => a.y - b.y);
    hoa.sort((a, b) => a.y - b.y);
    return { hoa, la };
  }, []);

  const t = (vi: string, en: string) => (lang === "en" ? en : vi);

  return (
    <figure className="relative" data-testid="song-hoa-sung" data-do-no={mo.toFixed(2)}>
      <svg
        viewBox={`0 0 ${RONG} ${CAO}`}
        className="block h-auto w-full rounded-[28px]"
        role="img"
        aria-label={t(
          `Mặt sông Ngô Đồng lúc ${gioChu(gio)}: ${loiTheoGio(gio, "vi")}`,
          `The Ngo Dong River at ${gioChu(gio)}: ${loiTheoGio(gio, "en")}`,
        )}
      >
        <defs>
          <linearGradient id="troi-sang" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6ede6" />
            <stop offset="1" stopColor="#e9e3ec" />
          </linearGradient>
          <linearGradient id="nuoc-sang" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9d9d6" />
            <stop offset="1" stopColor="#7fa49c" />
          </linearGradient>
          <linearGradient id="la-sung" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6f9a5b" />
            <stop offset="1" stopColor="#3f6b45" />
          </linearGradient>
          {MAU_HOA.map(([nhat, dam], i) => (
            <g key={i}>
              <radialGradient id={`canh-nhat-${i}`} cx="0.5" cy="0.9" r="0.9">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor={nhat} />
              </radialGradient>
              <radialGradient id={`canh-dam-${i}`} cx="0.5" cy="0.9" r="0.9">
                <stop offset="0" stopColor={nhat} />
                <stop offset="1" stopColor={dam} />
              </radialGradient>
            </g>
          ))}
        </defs>
        <rect width={RONG} height={CAO} fill="url(#troi-sang)" />
        {/* Núi đá vôi xa, mờ trong sương sớm. */}
        <path
          d="M0 190 L0 120 Q40 60 80 110 Q110 30 150 95 Q190 70 220 120 Q260 40 300 105 Q350 20 400 115 Q440 90 470 130 L470 190 Z"
          fill="#b9b3bf"
          opacity={0.55}
        />
        <path
          d="M560 190 L560 140 Q600 70 640 120 Q680 20 730 110 Q780 60 820 125 Q870 30 920 115 Q960 80 1000 130 Q1050 50 1100 120 Q1150 85 1200 130 L1200 190 Z"
          fill="#a9a3b4"
          opacity={0.6}
        />
        <rect y={182} width={RONG} height={CAO - 182} fill="url(#nuoc-sang)" />
        <rect y={176} width={RONG} height={26} fill="#f6f1f4" opacity={0.65} className="hoa-sung-suong" />
        {la.map((l, i) => (
          <ellipse key={i} cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} fill="url(#la-sung)" transform={`rotate(${l.xoay} ${l.x} ${l.y})`} opacity={0.95} />
        ))}
        {hoa.map((h, i) => (
          <BongHoa key={i} hoa={h} mo={mo} />
        ))}
      </svg>
      <figcaption className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <p role="status" className="text-sm leading-6 text-[#4d5b55]">
          <span className="font-bold text-[#183f34]">
            {gioKeo === null ? t(`Bây giờ ở Ninh Bình ${gioChu(gio)}`, `Now in Ninh Binh ${gioChu(gio)}`) : t(`Lúc ${gioChu(gio)}`, `At ${gioChu(gio)}`)}
          </span>
          {" · "}
          {loiTheoGio(gio, lang)}
        </p>
        {gioKeo !== null ? (
          <button
            type="button"
            onClick={() => setGioKeo(null)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c7b9cc] px-4 text-sm font-bold text-[#5d3f6b]"
          >
            {t("Về giờ thật", "Back to now")}
          </button>
        ) : null}
        <label className="grid gap-2 text-sm font-bold text-[#183f34] sm:col-span-2">
          {t("Kéo để xem hoa nở trong một buổi sáng", "Drag to watch a morning unfold")}
          <input
            type="range"
            min={5}
            max={12}
            step={0.25}
            value={Math.min(12, Math.max(5, gio))}
            onChange={(e) => setGioKeo(Number(e.target.value))}
            aria-valuetext={gioChu(Math.min(12, Math.max(5, gio)))}
            className="h-11 w-full accent-[#9a5fb8]"
            data-testid="keo-gio-hoa"
          />
          <span className="flex justify-between text-xs font-normal text-[#6b6f6c]">
            <span>05:00</span>
            <span>{t("7–10 giờ: hoa nở", "7–10 am: in bloom")}</span>
            <span>12:00</span>
          </span>
        </label>
      </figcaption>
    </figure>
  );
}
