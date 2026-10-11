"use client";

import { useEffect, useMemo, useState } from "react";
import type { DuBaoDoDong as DuBao } from "@/domain/du-bao-do-dong";
import type { ErpSiteId } from "@/domain/erp";

type Lang = "vi" | "en";
type KetQua = { trangThai: "co"; duBao: DuBao } | { trangThai: "chua-du" | "chua-noi" | "loi" };

const GIO = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const TEN_CO_SO: Record<ErpSiteId, { vi: string; en: string }> = {
  "trang-an": { vi: "Tràng An", en: "Trang An" },
  "tam-coc": { vi: "Tam Cốc", en: "Tam Coc" },
  "bai-dinh": { vi: "Bái Đính", en: "Bai Dinh" },
  "tam-chuc": { vi: "Tam Chúc", en: "Tam Chuc" },
};

/** Mã cơ sở của gói (`siteIds` là UUID) sang tên ngắn; chỉ bốn nơi có cổng soát vé. */
export const CO_SO_THEO_UUID: Record<string, ErpSiteId> = {
  "10000000-0000-4000-8000-000000000001": "trang-an",
  "10000000-0000-4000-8000-000000000009": "tam-chuc",
  "10000000-0000-4000-8000-000000000005": "tam-coc",
  "10000000-0000-4000-8000-000000000003": "bai-dinh",
};

const MAU = {
  vang: "bg-[#5e8c7c]",
  vua: "bg-[#c9a259]",
  dong: "bg-[#c2672f]",
} as const;

function ngayVN(cong = 0) {
  return new Date(Date.now() + 7 * 3_600_000 + cong * 86_400_000).toISOString().slice(0, 10);
}

function thuNgan(ngay: string, lang: Lang) {
  const d = new Date(`${ngay}T00:00:00Z`);
  const thu = d.getUTCDay();
  const vi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][thu];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][thu];
  return { thu: lang === "en" ? en : vi, so: d.getUTCDate(), cuoiTuan: thu === 0 || thu === 6 };
}

function thuDai(ngay: string, lang: Lang) {
  const d = new Date(`${ngay}T00:00:00Z`);
  const thu = d.getUTCDay();
  const vi = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"][thu];
  const en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][thu];
  return lang === "en" ? en : vi;
}

/**
 * Dự báo độ đông theo ngày đi (H1). Điện thoại trước: dải ngày vuốt ngang,
 * cột giờ cao lên theo số, chữ nói giờ nên đi. Số là trung bình lượt qua cổng
 * thật những ngày cùng thứ, không phải mô hình đoán.
 *
 * `coDinh` dùng ở trang đặt vé: một cơ sở, một ngày đã chọn, không có dải chọn.
 */
export function DuBaoDoDong({
  lang,
  coSo = "trang-an",
  ngay,
  coDinh = false,
}: {
  lang: Lang;
  coSo?: ErpSiteId;
  ngay?: string;
  coDinh?: boolean;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const cacNgay = useMemo(() => Array.from({ length: 14 }, (_, i) => ngayVN(i + 1)), []);
  const [noi, setNoi] = useState<ErpSiteId>(coSo);
  const [chon, setChon] = useState(ngay ?? cacNgay[5]);
  const ngayXem = coDinh && ngay ? ngay : chon;
  const noiXem = coDinh ? coSo : noi;
  const [ketQua, setKetQua] = useState<{ khoa: string; kq: KetQua } | null>(null);
  const khoa = `${noiXem}|${ngayXem}`;

  useEffect(() => {
    if (!ngayXem) return;
    const huy = new AbortController();
    fetch(`/api/du-bao-do-dong?site=${noiXem}&ngay=${ngayXem}`, { signal: huy.signal })
      .then((r) => r.json())
      .then((d: { accepted: boolean } & Partial<KetQua> & { duBao?: DuBao }) => {
        const kq: KetQua = d.accepted && d.trangThai === "co" && d.duBao ? { trangThai: "co", duBao: d.duBao } : { trangThai: d.accepted && d.trangThai ? (d.trangThai as "chua-du" | "chua-noi") : "loi" };
        setKetQua({ khoa: `${noiXem}|${ngayXem}`, kq });
      })
      .catch(() => {
        if (!huy.signal.aborted) setKetQua({ khoa: `${noiXem}|${ngayXem}`, kq: { trangThai: "loi" } });
      });
    return () => huy.abort();
  }, [noiXem, ngayXem]);

  const dangTai = ketQua?.khoa !== khoa;
  const kq = dangTai ? null : ketQua?.kq ?? null;
  const du = kq?.trangThai === "co" ? kq.duBao : null;
  const cao = du ? Math.max(1, ...du.theoGio) : 1;
  const ten = TEN_CO_SO[noiXem][lang];

  if (coDinh && kq && kq.trangThai !== "co") return null;

  return (
    <section
      data-testid="du-bao-do-dong"
      className={coDinh ? "mt-4 min-w-0 rounded-2xl bg-[#f7f3ea] p-4" : "min-w-0 rounded-[22px] border border-[#ddd6c6] bg-white p-4 sm:p-6"}
      aria-busy={dangTai}
    >
      <h2 className={`text-xs font-extrabold uppercase tracking-[0.14em] text-[#8a6a2f]`}>
        {coDinh ? t("Ngày này thường đông lúc nào", "How busy this day usually is") : t("Đông vắng theo ngày bạn đi", "Busy hours on your day")}
      </h2>

      {coDinh ? null : (
        <>
          <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="radiogroup" aria-label={t("Nơi đến", "Place")}>
            {(Object.keys(TEN_CO_SO) as ErpSiteId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={noi === id}
                onClick={() => setNoi(id)}
                className={`min-h-10 shrink-0 snap-start rounded-full px-4 text-sm font-extrabold transition ${noi === id ? "bg-[#183f34] text-[#f3eee3]" : "bg-[#f1ebdd] text-[#4e5f57]"}`}
              >
                {TEN_CO_SO[id][lang]}
              </button>
            ))}
          </div>
          <div className="-mx-4 mt-3 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="radiogroup" aria-label={t("Ngày đi", "Date")}>
            {cacNgay.map((d) => {
              const n = thuNgan(d, lang);
              const dang = chon === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={dang}
                  data-ngay={d}
                  onClick={() => setChon(d)}
                  className={`grid min-h-14 w-12 shrink-0 snap-start place-items-center rounded-2xl py-1.5 text-center transition ${dang ? "bg-[#e7b96a] text-[#183f34] shadow-[0_6px_18px_-8px_rgba(160,110,30,0.7)]" : "bg-[#f7f3ea] text-[#4e5f57]"}`}
                >
                  <span className={`text-[0.65rem] font-extrabold uppercase ${n.cuoiTuan && !dang ? "text-[#a3542a]" : ""}`}>{n.thu}</span>
                  <span className="font-display text-xl leading-none">{n.so}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={t(`Độ đông theo giờ ở ${ten}`, `Busy hours at ${ten}`)}>
        {GIO.map((g, i) => {
          const n = du?.theoGio[i] ?? 0;
          const muc = du?.mucTheoGio[i] ?? "vang";
          const laDinh = du?.dinh === g;
          const laVang = du?.vangNhat === g;
          return (
            <span key={g} className="relative flex h-full flex-1 flex-col justify-end">
              {laVang ? (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-[#dcebe4] px-1.5 text-[0.6rem] font-extrabold whitespace-nowrap text-[#1f5a45]">
                  {t("Vắng", "Quiet")}
                </span>
              ) : null}
              <span
                title={du ? `${g}:00 · ~${n}` : undefined}
                className={`block rounded-[5px] transition-[height,background-color] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
                  du ? `${MAU[muc]} ${laDinh ? "ring-2 ring-[#c2672f]/30 ring-offset-1" : ""}` : `bg-[#ece6d8] ${dangTai ? "animate-pulse" : ""}`
                }`}
                style={{ height: du ? `${Math.max(5, Math.round((n / cao) * 100))}%` : `${18 + ((i * 37) % 50)}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className={`mt-1 flex gap-1 text-[0.65rem] tabular-nums text-[#7a857f]`}>
        {GIO.map((g) => (
          <span key={g} className="flex-1 text-center">{g % 3 === 0 ? `${g}h` : ""}</span>
        ))}
      </div>

      <p className={`mt-3 text-sm leading-6 text-[#4e5f57]`} aria-live="polite">
        {dangTai
          ? t("Đang xem số những tuần trước…", "Looking at past weeks…")
          : du
            ? t(
                `${thuDai(du.ngayDi, lang).replace(/^./, (c) => c.toUpperCase())} ở ${ten} thường đông nhất lúc ${du.dinh}:00${du.vangNhat ? `, thong thả nhất lúc ${du.vangNhat}:00` : ""}. Tính từ lượt qua cổng ${du.soNgay} ${thuDai(du.ngayDi, lang)} gần nhất.`,
                `${thuDai(du.ngayDi, lang)}s at ${ten} are busiest around ${du.dinh}:00${du.vangNhat ? `, calmest around ${du.vangNhat}:00` : ""}. Based on gate entries from the last ${du.soNgay} ${thuDai(du.ngayDi, lang)}s.`,
              )
            : kq?.trangThai === "chua-du"
              ? t(`Chưa đủ số những ${thuDai(ngayXem, lang)} trước ở ${ten} để đoán. Mời bạn xem độ đông hôm nay ở trên.`, `Not enough past ${thuDai(ngayXem, lang)}s at ${ten} yet. See today's numbers above.`)
              : t("Chưa đọc được lượt qua cổng lúc này.", "Gate entries are not available right now.")}
      </p>
      {du ? (
        <p className={`mt-2 flex flex-wrap gap-3 text-[0.7rem] font-bold text-[#6b7a72]`}>
          <span className="inline-flex items-center gap-1"><i className={`size-2 rounded-full ${MAU.vang}`} />{t("Vắng", "Quiet")}</span>
          <span className="inline-flex items-center gap-1"><i className={`size-2 rounded-full ${MAU.vua}`} />{t("Vừa", "Moderate")}</span>
          <span className="inline-flex items-center gap-1"><i className={`size-2 rounded-full ${MAU.dong}`} />{t("Đông", "Busy")}</span>
        </p>
      ) : null}
    </section>
  );
}
