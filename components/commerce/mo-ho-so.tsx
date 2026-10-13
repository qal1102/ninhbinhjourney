"use client";

import { TheMaMoi } from "@/components/commerce/the-ma-moi";
import { useState } from "react";
import { HoSoKhachView } from "@/components/commerce/ho-so-khach-view";
import { TheTichDiem } from "@/components/commerce/the-tich-diem";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import { MOC_THUONG, type KetQuaTraBangSo, type TomTatThanThiet } from "@/domain/khach-than-thiet";

function ngayViet(iso: string) {
  const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return k ? `${k[3]}/${k[2]}/${k[1]}` : iso;
}

/** Kết quả tra chỉ bằng số điện thoại: lượt đi, mốc quà, vé (mã đã che). */
function KetQuaSo({ ketQua, so, lang, traLai }: { ketQua: Extract<KetQuaTraBangSo, { found: true }>; so: string; lang: "vi" | "en"; traLai: () => void }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const moc = ketQua.nextMilestone;
  const luotTinh = ketQua.visits + ketQua.banDaMoi;
  const mocTruoc = MOC_THUONG.filter((m) => m.visits <= luotTinh).at(-1)?.visits ?? 0;
  const phanTram = moc ? Math.round(((luotTinh - mocTruoc) / Math.max(1, moc.visits - mocTruoc)) * 100) : 100;
  return (
    <section data-testid="ket-qua-tra-so" className="rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6 sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">{t("Tra bằng số điện thoại", "Looked up by phone")}</p>
      <h2 className="font-display mt-2 text-2xl leading-snug text-[#183f34]">
        {t(`Vé và lượt đi của số •••${so.slice(-3)}`, `Tickets and visits for •••${so.slice(-3)}`)}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4">
          <dt className="text-xs font-bold text-[#6b786f]">{t("Lượt đã đi", "Visits")}</dt>
          <dd className="font-display mt-1 text-3xl text-[#183f34]" data-testid="tra-so-luot">{ketQua.visits}</dd>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <dt className="text-xs font-bold text-[#6b786f]">{t("Điểm", "Points")}</dt>
          <dd className="font-display mt-1 text-3xl text-[#183f34]">{ketQua.points.toLocaleString("vi-VN")}</dd>
        </div>
      </dl>
      {moc ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#eadfc6]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#c89a55]" style={{ width: `${phanTram}%` }} />
          </div>
          <p className="mt-2 text-sm leading-6 text-[#4a554e]">
            {t(`Thêm ${moc.remaining} lượt nữa: ${moc.reward.toLocaleLowerCase("vi")}.`, `${moc.remaining} more ${moc.remaining === 1 ? "visit" : "visits"} to your next reward.`)}
          </p>
        </div>
      ) : null}
      {ketQua.voucherCount > 0 ? (
        <p className="mt-3 rounded-2xl bg-[#183f34] px-4 py-3 text-sm font-bold text-white">
          {t(`Bạn có ${ketQua.voucherCount} quà chưa đổi. Nhập thêm mã in trên vé để xem mã quà.`, `You have ${ketQua.voucherCount} unclaimed ${ketQua.voucherCount === 1 ? "reward" : "rewards"}. Add the code printed on your ticket to see the reward code.`)}
        </p>
      ) : null}
      {ketQua.visitList.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-[#183f34]">{t("Những lượt đã đi", "Your visits")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ketQua.visitList.map((luot, i) => (
              <li key={`${luot.site}-${luot.date}-${i}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#27362f]">
                {luot.site} · {ngayViet(luot.date)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <TheMaMoi ma={ketQua.maMoi} banDaMoi={ketQua.banDaMoi} lang={lang} />
      <h3 className="mt-6 font-bold text-[#183f34]">{t("Vé của số này", "Tickets on this number")}</h3>
      {ketQua.ve.length === 0 ? (
        <p className="mt-1 text-sm text-[#6b786f]">{t("Chưa có vé nào gắn với số này.", "No tickets on this number yet.")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#e6dcc6] rounded-2xl bg-white" data-testid="tra-so-ve">
          {ketQua.ve.map((ve) => (
            <li key={`${ve.maChe}-${ve.validOn}-${ve.site}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-[#27362f]">{ve.tenGoi || ve.site}</span>
                <span className="block text-xs text-[#5c665f]">{ve.tenGoi ? `${ve.site} · ` : ""}<code className="font-mono">{ve.maChe}</code></span>
              </span>
              <span className="shrink-0 text-right text-xs text-[#5c665f]">
                {ngayViet(ve.validOn)}
                <br />
                {ve.status === "void"
                  ? t("đã huỷ", "cancelled")
                  : ve.entriesUsed >= ve.entriesAllowed
                    ? t("đã qua cổng", "used")
                    : t(`còn ${ve.entriesAllowed - ve.entriesUsed}/${ve.entriesAllowed} lượt`, `${ve.entriesAllowed - ve.entriesUsed}/${ve.entriesAllowed} left`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-[#6b786f]">
        {t(
          "Mã vé được che vì ai biết số điện thoại cũng tra được. Cần mã QR để vào cổng: nhập thêm mã in trên vé, mở trang vé đã lưu trên máy, hoặc đọc số điện thoại ở quầy để nhân viên tra giúp.",
          "Ticket codes are hidden because anyone who knows the number can look it up. To get the QR code for the gate, add the code printed on your ticket, open the ticket saved on your phone, or give your number at the desk.",
        )}
      </p>
      <button type="button" onClick={traLai} className="mt-5 min-h-12 w-full rounded-full border border-[#183f34] px-6 font-extrabold text-[#183f34]">
        {t("Tra lại", "Look up again")}
      </button>
    </section>
  );
}

/**
 * Mở hộ chiếu từ một máy chưa từng đặt chỗ. Mã đặt chỗ web `NBJ-…` + số
 * hay email đã dùng thì ra hồ sơ chuyến đi; mã vé quầy `QUAY-…`, mã riêng
 * trong đoàn `TV-…` hay mã vé `WEB-…` + số đã gắn thì ra thẻ khách thân
 * thiết: lượt đã đi, mốc quà, voucher, mọi vé (13/10/2026, chủ dự án hỏi khách
 * gắn số xong thì tự xem ở đâu).
 */
export function MoHoSo({ lang = "vi" }: { lang?: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [ma, setMa] = useState("");
  const [lienHe, setLienHe] = useState("");
  const [dangMo, setDangMo] = useState(false);
  const [loi, setLoi] = useState("");
  const [hoSo, setHoSo] = useState<HoSoKhach | null>(null);
  const [thanThiet, setThanThiet] = useState<{ ma: string; tomTat: TomTatThanThiet } | null>(null);
  const [theoSo, setTheoSo] = useState<Extract<KetQuaTraBangSo, { found: true }> | null>(null);

  async function mo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDangMo(true);
    setLoi("");
    const maGon = ma.trim().toUpperCase();
    try {
      if (!maGon) {
        // Chỉ có số điện thoại: tra mọi vé của số ấy (mã đã che).
        if (lienHe.includes("@")) {
          setLoi(t("Tra bằng email thì thêm mã đặt chỗ NBJ-… ở ô dưới.", "To look up by email, add your NBJ-… booking code below."));
          return;
        }
        const res = await fetch("/api/khach-than-thiet", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hanh_dong: "tra-so", so_dien_thoai: lienHe.trim() }),
        });
        const data = (await res.json().catch(() => null)) as
          | { accepted?: boolean; ketQua?: KetQuaTraBangSo; error?: { message?: string } }
          | null;
        if (!res.ok || !data?.accepted || !data.ketQua) {
          setLoi(
            res.status === 400
              ? t("Mời bạn nhập số điện thoại Việt Nam 10 số.", "Please enter a 10-digit Vietnamese phone number.")
              : data?.error?.message || t("Chưa tra được, mời bạn thử lại.", "Could not look it up. Please try again."),
          );
          return;
        }
        if (!data.ketQua.found) {
          setLoi(t("Chưa có vé nào gắn với số này. Vé mua ở quầy cần nhờ nhân viên gắn số, hoặc tự gắn ở trang vé trên điện thoại.", "No tickets on this number yet. Desk tickets need the staff to add your number, or add it yourself on the ticket page."));
          return;
        }
        setTheoSo(data.ketQua);
        return;
      }
      if (maGon.startsWith("PT-")) {
        setLoi(t("PT-… là mã phiếu thu. Mời bạn nhập mã vé QUAY-… in ngay dưới mã QR trên phiếu.", "PT-… is the receipt number. Please enter the ticket code QUAY-… printed under the QR code."));
        return;
      }
      if (!maGon.startsWith("NBJ-")) {
        const res = await fetch("/api/khach-than-thiet", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hanh_dong: "xem", ma: maGon, so_dien_thoai: lienHe.trim() }),
        });
        const data = (await res.json().catch(() => null)) as
          | { accepted?: boolean; tomTat?: TomTatThanThiet; error?: { message?: string } }
          | null;
        if (!res.ok || !data?.accepted || !data.tomTat) {
          setLoi(
            res.status === 400
              ? t("Mã vé gồm chữ và số, ví dụ QUAY-… hoặc TV-…; số điện thoại 10 số.", "Use the code printed on your ticket (QUAY-… or TV-…) and a 10-digit phone number.")
              : data?.error?.message || t("Chưa mở được, mời bạn thử lại.", "Could not open. Please try again."),
          );
          return;
        }
        setThanThiet({ ma: maGon, tomTat: data.tomTat });
        return;
      }
      const res = await fetch("/api/ho-so", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_code: ma.trim(), contact: lienHe.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { accepted: true; hoSo: HoSoKhach }
        | { accepted: false; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.accepted) {
        setLoi((data && !data.accepted && data.error?.message) || t("Chưa mở được hồ sơ, mời bạn thử lại.", "Could not open the passport. Please try again."));
        return;
      }
      setHoSo(data.hoSo);
    } catch {
      setLoi(t("Mạng đang chập chờn, mời bạn thử lại.", "The connection is unstable. Please try again."));
    } finally {
      setDangMo(false);
    }
  }

  if (hoSo) return <HoSoKhachView hoSo={hoSo} lang={lang} />;
  if (theoSo) return <KetQuaSo ketQua={theoSo} so={lienHe.replace(/\D/g, "")} lang={lang} traLai={() => setTheoSo(null)} />;
  if (thanThiet) {
    return (
      <div className="space-y-4">
        <TheTichDiem codes={[thanThiet.ma]} tomTatBanDau={thanThiet.tomTat} goiYHoSo={false} lang={lang} />
        <button
          type="button"
          onClick={() => setThanThiet(null)}
          className="min-h-12 w-full rounded-full border border-[#183f34] px-6 font-extrabold text-[#183f34]"
        >
          {t("Tra mã khác", "Look up another code")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={mo} className="rounded-3xl border border-[#d7d5cd] bg-white p-6 sm:p-8">
      <h2 className="font-display text-3xl text-[#183f34]">{t("Lượt đi và quà của bạn", "Your visits and rewards")}</h2>
      <p className="mt-3 leading-7 text-[#59654b]">
        {t("Nhập số điện thoại đã để lại khi mua vé: mọi vé, lượt đã đi và mốc quà của số ấy hiện ra.", "Enter the phone number you left when buying: every ticket, visit and reward on that number appears.")}
      </p>
      <label className="mt-5 grid gap-1 text-sm font-bold text-[#27362f]">
        {t("Số điện thoại", "Phone number")}
        <input
          required
          value={lienHe}
          onChange={(event) => setLienHe(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0912 345 678"
          className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 font-medium"
        />
      </label>
      <label className="mt-4 grid gap-1 text-sm font-bold text-[#27362f]">
        <span>
          {t("Mã trên vé", "Ticket code")} <span className="font-normal text-[#6b786f]">{t("(không bắt buộc)", "(optional)")}</span>
        </span>
        <input
          value={ma}
          onChange={(event) => setMa(event.target.value)}
          placeholder={t("NBJ-…, QUAY-… hoặc TV-…", "NBJ-…, QUAY-… or TV-…")}
          autoCapitalize="characters"
          className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 font-medium"
        />
        <span className="text-xs font-normal leading-5 text-[#6b786f]">
          {t("Điền thêm để mở mã QR và mã quà. Đặt trên web bằng email thì nhập mã NBJ-… và email ở ô trên.", "Add it to open the QR code and reward codes. Booked online with email? Enter the NBJ-… code and your email above.")}
        </span>
      </label>
      {loi ? <p role="alert" className="mt-4 text-sm text-[#9a3b2f]">{loi}</p> : null}
      <button
        type="submit"
        disabled={dangMo}
        className="mt-5 min-h-12 w-full rounded-full bg-[#183f34] px-6 font-extrabold text-white disabled:opacity-60"
      >
        {dangMo ? t("Đang mở…", "Opening…") : t("Xem lượt đi và quà", "See visits and rewards")}
      </button>
    </form>
  );
}
