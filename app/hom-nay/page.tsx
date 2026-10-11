import type { Metadata } from "next";
import Link from "next/link";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { GIO_HOM_NAY, luotQuaCongHomNay } from "@/lib/hom-nay-repository";
import { duBaoBen } from "@/lib/erp/thoi-tiet-repository";
import { docTongQuanBen } from "@/lib/hang-cho-repository";
import { gioHienTaiVN, moTaThoiTiet, phanTichThoiTiet, type GioDuBao } from "@/domain/thoi-tiet-ben";
import { tinhTrangHoaSung, ngayDoc } from "@/domain/mua-hoa-sung";
import { trongGioNhanSo } from "@/domain/hang-cho";

export const metadata: Metadata = {
  title: "Hôm nay ở Ninh Bình · Ninh Bình Journey",
  description: "Lượt qua cổng theo giờ, thời tiết bến, giờ hoa súng nở và hàng chờ bến đò, trong một trang.",
};

export const dynamic = "force-dynamic";

const THOI_TIET_EN: Record<string, string> = {
  "Trời quang": "Clear sky",
  "Ít mây": "A few clouds",
  "Nhiều mây": "Cloudy",
  "Sương mù": "Fog",
  "Mưa phùn": "Drizzle",
  Mưa: "Rain",
  "Mưa rào": "Showers",
  Dông: "Thunderstorm",
};

const MUC_BEN = {
  "binh-thuong": { vi: "Thuyền chạy bình thường", en: "Boats running as usual", mau: "text-[#1f5a45]" },
  "luu-y": { vi: "Nên mang áo mưa, theo dõi thêm", en: "Bring a raincoat and keep an eye out", mau: "text-[#6b5520]" },
  "tam-dung": { vi: "Có thể tạm dừng thuyền", en: "Boats may pause", mau: "text-[#8a3a12]" },
} as const;

function TheThoiTiet({ ten, du, bayGio, lang }: { ten: string; du: GioDuBao[] | null; bayGio: Date; lang: NgonNgu }) {
  const gioNay = gioHienTaiVN(bayGio);
  const nay = du?.find((g) => g.gio === gioNay) ?? du?.[0];
  const bao = du ? phanTichThoiTiet(du, bayGio) : null;
  return (
    <div className="rounded-2xl bg-[#f1ebdd] p-4">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-[#8a6a2f]">{ten}</p>
      {nay && bao ? (
        <>
          <p className="font-display mt-1 text-4xl leading-none text-[#183f34]">{Math.round(nay.nhietDo)}°</p>
          <p className="mt-1 text-sm text-[#4e5f57]">{lang === "en" ? THOI_TIET_EN[moTaThoiTiet(nay.maThoiTiet)] ?? "Cloudy" : moTaThoiTiet(nay.maThoiTiet)}</p>
          <p className={`mt-1 text-sm font-bold ${MUC_BEN[bao.muc].mau}`}>{MUC_BEN[bao.muc][lang]}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[#4e5f57]">{ch(lang, "Chưa lấy được dự báo lúc này.", "No forecast right now.")}</p>
      )}
    </div>
  );
}

/**
 * "Hôm nay ở Ninh Bình" (F1, chủ dự án chọn 11/10/2026 từ bảng vẽ Claude
 * Design). Mọi con số lấy từ nguồn thật đang chạy: lượt qua cổng (kho), dự báo
 * Open-Meteo (như màn Thời tiết bến của ERP), lịch mùa hoa súng, hàng chờ bến
 * đò. Nguồn nào chưa đọc được thì nói thẳng, không vẽ số đoán.
 */
export default async function HomNayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = await docNgonNgu(await searchParams);
  const bayGio = new Date();
  const [luot, duTrangAn, duTamCoc, hangCho] = await Promise.all([
    luotQuaCongHomNay("trang-an", bayGio).catch(() => null),
    duBaoBen("trang-an"),
    duBaoBen("tam-coc"),
    docTongQuanBen("tam-coc").catch(() => null),
  ]);
  const hoa = tinhTrangHoaSung(bayGio);
  const vn = new Date(bayGio.getTime() + 7 * 3_600_000);
  const gio = `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
  const ngay = bayGio.toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN", { weekday: "long", day: "numeric", month: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
  const gioNayVn = vn.getUTCHours();
  const cao = luot ? Math.max(1, ...luot.theoGio) : 1;
  const daQua = luot ? GIO_HOM_NAY.map((g, i) => ({ g, n: luot.theoGio[i] })).filter((x) => x.g <= gioNayVn && x.n > 0) : [];
  const dongNhat = daQua.length ? daQua.reduce((a, b) => (b.n > a.n ? b : a)) : null;
  const vangNhat = daQua.length > 1 ? daQua.reduce((a, b) => (b.n < a.n ? b : a)) : null;
  const moNhanSo = trongGioNhanSo(bayGio);

  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="kham-pha" />
      <main lang={lang} data-customer-section="hom-nay" className="min-h-screen bg-[#fbfaf6] px-5 py-10 text-[#20342c] sm:px-8 lg:py-14">
        <div className="mx-auto grid max-w-5xl gap-5">
          <header className="grid gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8a6a2f]">{ch(lang, `Hôm nay · ${ngay}`, `Today · ${ngay}`)}</p>
            <h1 className="font-display text-5xl leading-[0.95] text-[#183f34] sm:text-7xl">{ch(lang, `Ninh Bình lúc ${gio}`, `Ninh Binh at ${gio}`)}</h1>
            <p className="max-w-2xl text-lg leading-8 text-[#4e5f57]">
              {ch(lang, "Đông hay vắng, trời thế nào, hoa súng nở chưa, bến đò có phải chờ lâu: xem một chỗ trước khi đi.", "Busy or quiet, the weather, the water lilies, the wait at the pier: check it in one place before you go.")}
            </p>
          </header>

          <section data-testid="hom-nay-luot" className="rounded-[22px] bg-[#183f34] p-5 text-[#f3eee3] sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#e7b96a]">{ch(lang, "Lượt qua cổng hôm nay · Tràng An", "Gate entries today · Trang An")}</h2>
              {luot ? <span className="text-sm text-white/70">{ch(lang, `${luot.tong.toLocaleString("vi-VN")} lượt`, `${luot.tong.toLocaleString("en-GB")} entries`)}</span> : null}
            </div>
            {luot ? (
              <>
                <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label={ch(lang, "Biểu đồ lượt qua cổng theo giờ", "Gate entries by hour")}>
                  {GIO_HOM_NAY.map((g, i) => {
                    const n = luot.theoGio[i];
                    const nay = g === gioNayVn;
                    return (
                      <span key={g} className="flex h-full flex-1 flex-col justify-end gap-1">
                        <span
                          title={`${g}:00 · ${n}`}
                          className={`block rounded-[4px] ${g > gioNayVn ? "bg-white/12" : n / cao > 0.66 ? "bg-[#e7b96a]" : n / cao > 0.33 ? "bg-[#8fb3a5]" : "bg-[#5e8c7c]"} ${nay ? "outline outline-2 outline-offset-2 outline-[#f3eee3]" : ""}`}
                          style={{ height: `${Math.max(4, Math.round((n / cao) * 100))}%` }}
                        />
                      </span>
                    );
                  })}
                </div>
                <div className="mt-1 flex gap-1.5 text-[0.68rem] tabular-nums text-white/60">
                  {GIO_HOM_NAY.map((g) => (
                    <span key={g} className="flex-1 text-center">{g % 2 === 1 ? `${g}h` : ""}</span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-white/85">
                  {dongNhat
                    ? ch(
                        lang,
                        `Đông nhất lúc ${dongNhat.g}:00 (${dongNhat.n} lượt)${vangNhat ? `, vắng nhất lúc ${vangNhat.g}:00` : ""}.`,
                        `Busiest at ${dongNhat.g}:00 (${dongNhat.n} entries)${vangNhat ? `, quietest at ${vangNhat.g}:00` : ""}.`,
                      )
                    : ch(lang, "Hôm nay chưa có lượt qua cổng nào.", "No gate entries yet today.")}
                  {luot.chamTran ? ch(lang, " Số có thể thiếu vì quá nhiều lượt.", " Counts may be incomplete.") : ""}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-white/80">{ch(lang, "Chưa đọc được lượt qua cổng lúc này.", "Gate entries are not available right now.")}</p>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TheThoiTiet ten={ch(lang, "Thời tiết · bến Tràng An", "Weather · Trang An pier")} du={duTrangAn} bayGio={bayGio} lang={lang} />
            <TheThoiTiet ten={ch(lang, "Thời tiết · bến Văn Lâm, Tam Cốc", "Weather · Van Lam pier, Tam Coc")} du={duTamCoc} bayGio={bayGio} lang={lang} />
            <Link href={`/seasonal/hoa-sung?lang=${lang}`} className="rounded-2xl bg-[#f7e3e6] p-4 transition hover:bg-[#f3d6db]">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-[#8c3b4e]">{ch(lang, "Hoa súng Tam Cốc", "Tam Coc water lilies")}</p>
              <p className="font-display mt-1 text-2xl leading-tight text-[#5e2533]">{ch(lang, "Nở trọn 7:15–9:45 sáng", "Fully open 7:15–9:45 am")}</p>
              <p className="mt-1 text-sm text-[#6b3a46]">
                {hoa.giaiDoan === "sap-toi"
                  ? ch(lang, `Mùa ${ngayDoc(hoa.mua.tu)}–${ngayDoc(hoa.mua.den)}, còn ${hoa.ngayToiMua} ngày.`, `Season ${ngayDoc(hoa.mua.tu)}–${ngayDoc(hoa.mua.den)}, ${hoa.ngayToiMua} days to go.`)
                  : ch(lang, `Đang mùa hoa, tới ${ngayDoc(hoa.mua.den)}.`, `In season until ${ngayDoc(hoa.mua.den)}.`)}
              </p>
            </Link>
          </div>

          <section data-testid="hom-nay-hang-cho" className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#ddd6c6] bg-white p-4">
            <span className="font-display grid size-14 shrink-0 place-items-center rounded-2xl bg-[#183f34] text-2xl text-[#e7b96a]">
              {hangCho ? hangCho.soNhomCho : "–"}
            </span>
            <span className="min-w-0 flex-[999_1_14rem]">
              <b className="block text-[#183f34]">{ch(lang, "Hàng chờ bến đò Tam Cốc", "Tam Coc boat queue")}</b>
              <span className="block text-sm text-[#4e5f57]">
                {!moNhanSo
                  ? ch(lang, "Bến đã nghỉ. Nhận số từ 6:30 tới 17:00.", "The pier is closed. Numbers are given 6:30–17:00.")
                  : hangCho
                    ? hangCho.dangNhan
                      ? ch(lang, `${hangCho.soNhomCho} nhóm đang chờ · nhận số 6:30–17:00`, `${hangCho.soNhomCho} groups waiting · numbers 6:30–17:00`)
                      : hangCho.loiTamDung ?? ch(lang, "Bến tạm dừng nhận số.", "The pier has paused the queue.")
                    : ch(lang, "Chưa đọc được hàng chờ lúc này.", "The queue is not available right now.")}
              </span>
            </span>
            {moNhanSo ? (
              <Link href={`/xep-hang/tam-coc?lang=${lang}`} className="inline-flex min-h-11 items-center rounded-full bg-[#e7b96a] px-5 font-extrabold text-[#183f34]">
                {ch(lang, "Lấy số", "Get a number")}
              </Link>
            ) : null}
          </section>

          <Link href={`/plan?lang=${lang}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#183f34] px-6 font-extrabold text-[#fbfaf6]">
            {ch(lang, "Lập lịch đi theo giờ vắng", "Plan around the quiet hours")}
          </Link>
        </div>
      </main>
    </>
  );
}
