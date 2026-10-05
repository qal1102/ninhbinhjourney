"use client";

import { useEffect, useMemo, useState } from "react";
import { doNoHoa, gioNinhBinh } from "@/domain/mua-hoa-sung";

/**
 * Hoa súng nở theo giờ thật ở Ninh Bình, vẽ thành một đường cong: trục ngang
 * là giờ trong buổi sáng, trục đứng là độ mở của hoa (`doNoHoa`). Chấm trên
 * đường cong là giờ hiện tại; kéo thanh giờ để xem cả buổi sáng.
 *
 * Thay cho cảnh mặt sông vẽ tay trước đây (chủ dự án chê "như NPC", 06/10).
 * Giờ ban đầu lấy từ máy chủ để hai bên dựng giống nhau, rồi mỗi phút đọc lại
 * đồng hồ máy khách.
 */

const TU = 5;
const DEN = 12;
const R = 640;
const C = 206;
const LE_TRAI = 8;
const LE_PHAI = 8;
const DINH = 30;
const DAY = 196;

const x = (gio: number) => LE_TRAI + ((gio - TU) / (DEN - TU)) * (R - LE_TRAI - LE_PHAI);
const y = (mo: number) => DAY - mo * (DAY - DINH);

function gioChu(gio: number) {
  const g = Math.floor(gio);
  const p = Math.round((gio - g) * 60);
  return `${String(p === 60 ? g + 1 : g).padStart(2, "0")}:${String(p === 60 ? 0 : p).padStart(2, "0")}`;
}

function loiTheoGio(gio: number, lang: "vi" | "en") {
  const f = doNoHoa(gio);
  if (lang === "en") {
    if (f >= 1) return "Fully open. This is the hour to be on the river.";
    if (f > 0) return gio < 8 ? "Opening now." : "Starting to close.";
    return gio < 7 ? "Still closed. They open around 7 am." : "Closed for the day. They open again tomorrow around 7 am.";
  }
  if (f >= 1) return "Hoa mở trọn, đúng lúc nên có mặt trên sông.";
  if (f > 0) return gio < 8 ? "Hoa đang hé nở." : "Hoa bắt đầu cụp lại.";
  return gio < 7 ? "Hoa chưa nở, khoảng 7 giờ mới mở." : "Hoa đã cụp, sáng mai khoảng 7 giờ nở lại.";
}

/** Bông súng nét mảnh: tám cánh ngoài, tám cánh trong, xoè theo độ mở. */
function BongNet({ mo }: { mo: number }) {
  const canh = (so: number, dai: number, lech: number, xoeToiDa: number) =>
    Array.from({ length: so }, (_, i) => {
      const goc = lech + (i - (so - 1) / 2) * (xoeToiDa * (0.25 + 0.75 * mo)) / (so - 1);
      return (
        <path
          key={`${dai}-${i}`}
          d={`M0 0 C ${-dai * 0.2} ${-dai * 0.45}, ${-dai * 0.12} ${-dai * 0.85}, 0 ${-dai} C ${dai * 0.12} ${-dai * 0.85}, ${dai * 0.2} ${-dai * 0.45}, 0 0 Z`}
          transform={`rotate(${goc})`}
        />
      );
    });
  return (
    <g fill="rgba(214,122,163,.14)" stroke="#9a5f8f" strokeWidth={1.2} strokeLinejoin="round">
      {canh(7, 34, 0, 150)}
      <g fill="rgba(214,122,163,.28)">{canh(5, 26, 0, 90)}</g>
      <circle r={3.5 + 2 * mo} fill="#e3b04b" stroke="none" />
    </g>
  );
}

export function DongHoHoaNo({ lang, bayGio }: { lang: "vi" | "en"; bayGio: string }) {
  const gioMayChu = useMemo(() => gioNinhBinh(new Date(bayGio)), [bayGio]);
  const [gioThat, setGioThat] = useState(gioMayChu);
  const [gioKeo, setGioKeo] = useState<number | null>(null);

  useEffect(() => {
    const capNhat = () => setGioThat(gioNinhBinh(new Date()));
    capNhat();
    const id = window.setInterval(capNhat, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const gio = gioKeo ?? gioThat;
  const gioVe = Math.min(DEN, Math.max(TU, gio));
  const mo = doNoHoa(gio);
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);

  const duong = useMemo(() => {
    const diem: string[] = [];
    for (let g = TU; g <= DEN + 1e-9; g += 0.05) diem.push(`${x(g).toFixed(1)} ${y(doNoHoa(g)).toFixed(1)}`);
    return { net: `M${diem.join(" L")}`, nen: `M${x(TU)} ${DAY} L${diem.join(" L")} L${x(DEN)} ${DAY} Z` };
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center" data-testid="dong-ho-hoa-no" data-do-no={mo.toFixed(2)}>
      <div>
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Giờ hoa nở", "Bloom hours")}</p>
        <h2 className="font-display mt-4 text-4xl leading-tight sm:text-5xl">{t("Hoa chỉ mở buổi sáng", "Open only in the morning")}</h2>
        <div className="mt-8 flex items-center gap-6">
          <svg viewBox="-44 -44 88 60" className="h-20 w-28 shrink-0" aria-hidden="true">
            <BongNet mo={mo} />
          </svg>
          <div>
            <p className="font-display text-6xl leading-none tabular-nums text-[#183f34]">{gioChu(gio)}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f8d]">
              {gioKeo === null ? t("Giờ Ninh Bình lúc này", "Ninh Binh time now") : t("Giờ bạn đang xem", "Time you picked")}
            </p>
          </div>
        </div>
        <p role="status" className="mt-6 max-w-md text-lg leading-8 text-[#4d5b55]">
          {loiTheoGio(gio, lang)}
        </p>
        {gioKeo !== null ? (
          <button
            type="button"
            onClick={() => setGioKeo(null)}
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#c7b9cc] px-5 text-sm font-bold text-[#5d3f6b] transition hover:border-[#9a5f8f]"
          >
            {t("Về giờ thật", "Back to now")}
          </button>
        ) : null}
      </div>

      <figure>
        <svg
          viewBox={`0 0 ${R} ${C}`}
          className="block h-auto w-full"
          role="img"
          aria-label={t(
            `Độ nở của hoa súng từ 5 tới 12 giờ: hé từ 6:30, mở trọn 7:15 tới 9:45, cụp hẳn lúc 10:30. Lúc ${gioChu(gio)}: ${loiTheoGio(gio, "vi")}`,
            `Lily bloom from 5 am to noon: opening from 6:30, fully open 7:15 to 9:45, closed by 10:30. At ${gioChu(gio)}: ${loiTheoGio(gio, "en")}`,
          )}
        >
          <defs>
            <linearGradient id="nen-no" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d67aa3" stopOpacity={0.38} />
              <stop offset="1" stopColor="#d67aa3" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <rect x={x(7.25)} y={DINH - 22} width={x(9.75) - x(7.25)} height={DAY - DINH + 22} fill="#f3e6ee" rx={6} />
          <text x={(x(7.25) + x(9.75)) / 2} y={DINH - 4} textAnchor="middle" fontSize={17} fontWeight={700} letterSpacing={1.5} fill="#9a5f8f">
            {t("MỞ TRỌN", "FULLY OPEN")}
          </text>
          {Array.from({ length: DEN - TU + 1 }, (_, i) => TU + i).map((g) => (
            <line key={g} x1={x(g)} x2={x(g)} y1={DAY} y2={DAY + 6} stroke="#b9adbc" />
          ))}
          <line x1={x(TU)} x2={x(DEN)} y1={DAY} y2={DAY} stroke="#cdbfcf" />
          <path d={duong.nen} fill="url(#nen-no)" />
          <path d={duong.net} fill="none" stroke="#9a5f8f" strokeWidth={2.4} strokeLinejoin="round" />
          <line x1={x(gioVe)} x2={x(gioVe)} y1={DINH - 14} y2={DAY} stroke="#183f34" strokeWidth={1.2} strokeDasharray="3 4" />
          <circle cx={x(gioVe)} cy={y(doNoHoa(gioVe))} r={8} fill="#fbf7ee" stroke="#183f34" strokeWidth={2.4} />
        </svg>
        {/* Nhãn giờ viết bằng HTML để chữ giữ cỡ đọc được trên điện thoại. */}
        <div className="relative mt-1 h-5 text-xs text-[#6b6f6c]" aria-hidden="true">
          {Array.from({ length: DEN - TU + 1 }, (_, i) => TU + i).map((g) => (
            <span
              key={g}
              className="absolute top-0"
              style={{
                left: `${(x(g) / R) * 100}%`,
                transform: g === TU ? "none" : g === DEN ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {`${g}h`}
            </span>
          ))}
        </div>
        <label className="mt-5 grid gap-2 text-sm font-bold text-[#183f34]">
          {t("Kéo để xem hoa nở trong một buổi sáng", "Drag through a morning")}
          <input
            type="range"
            min={TU}
            max={DEN}
            step={0.25}
            value={gioVe}
            onChange={(e) => setGioKeo(Number(e.target.value))}
            aria-valuetext={gioChu(gioVe)}
            className="h-11 w-full accent-[#9a5f8f]"
            data-testid="keo-gio-hoa"
          />
        </label>
      </figure>
    </div>
  );
}
