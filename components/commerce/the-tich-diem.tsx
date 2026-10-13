"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { DIEM_MOI_LUOT, MOC_THUONG, type TomTatThanThiet, type VoucherKhach } from "@/domain/khach-than-thiet";

type Lang = "vi" | "en";

function ngay(iso: string) {
  const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return k ? `${k[3]}/${k[2]}/${k[1]}` : iso;
}

function QrVoucher({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let huy = false;
    void QRCode.toDataURL(code, { margin: 1, width: 320, color: { dark: "#183f34", light: "#ffffff" } }).then((url) => {
      if (!huy) setSrc(url);
    });
    return () => {
      huy = true;
    };
  }, [code]);
  if (!src) return <div className="h-28 w-28 shrink-0 rounded-xl bg-[#ece6d8]" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- mã QR sinh tại chỗ
  return <img src={src} alt={`QR ${code}`} className="h-28 w-28 shrink-0 rounded-xl bg-white p-1" />;
}

function TheVoucher({ v, lang }: { v: VoucherKhach; lang: Lang }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const daDoi = v.status === "redeemed";
  return (
    <li className={`flex gap-4 rounded-2xl border p-4 ${daDoi ? "border-[#d8d3c6] bg-[#f6f3ec] opacity-70" : "border-[#d9b878] bg-white"}`}>
      {daDoi ? null : <QrVoucher code={v.code} />}
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9a6328]">
          {t(`Mốc ${v.milestone} lượt`, `${v.milestone} visits`)}
        </p>
        <p className="font-display mt-1 text-xl leading-snug text-[#183f34]">
          {v.kind === "ve-mien-phi" ? t("Một vé người lớn miễn phí", "One free adult ticket") : t("Quà lưu niệm", "A keepsake gift")}
        </p>
        <code className="mt-1 block font-mono text-sm font-bold tracking-[0.06em] text-[#27362f]">{v.code}</code>
        <p className="mt-1 text-xs leading-5 text-[#5c665f]">
          {daDoi
            ? t("Đã đổi", "Redeemed")
            : t(`Đưa mã này ở quầy vé bất kỳ cơ sở nào. Dùng tới ${ngay(v.expiresOn)}.`, `Show this code at any ticket desk. Valid until ${ngay(v.expiresOn)}.`)}
        </p>
      </div>
    </li>
  );
}

/**
 * Thẻ tích điểm trên trang vé của khách (12/10/2026, migration 119): để lại số
 * điện thoại thì vé đoàn thành vé riêng của mình, mỗi lượt đi tích điểm, đủ
 * mốc có quà. Hai ô đồng ý tách riêng: dùng số để giữ vé (bắt buộc) và nhận
 * tin ưu đãi (tuỳ chọn, mặc định không tích).
 */
export function TheTichDiem({
  codes,
  lang = "vi",
  laTruongDoan = false,
  className = "",
  tomTatBanDau,
  goiYHoSo = true,
}: {
  /** Mã khách đang cầm: mã người trong đoàn, hoặc các mã vé của một phiếu. */
  codes: string[];
  lang?: Lang;
  /** Vé cả đoàn: nhắc từng người mở mã riêng để tích cho mình. */
  laTruongDoan?: boolean;
  className?: string;
  /** Đã có kết quả (trang Hộ chiếu vừa tra bằng mã + số): khỏi đọc lại. */
  tomTatBanDau?: TomTatThanThiet;
  /** Chỉ chỗ mở lại vé ở máy khác; tắt khi đang ở chính trang Hộ chiếu. */
  goiYHoSo?: boolean;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [tomTat, setTomTat] = useState<TomTatThanThiet | null>(tomTatBanDau ?? null);
  const [trangThai, setTrangThai] = useState<"dang-doc" | "san-sang" | "tat">(tomTatBanDau ? "san-sang" : "dang-doc");
  const [so, setSo] = useState("");
  const [dongYDichVu, setDongYDichVu] = useState(false);
  const [dongYTiepThi, setDongYTiepThi] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const [moXem, setMoXem] = useState(false);
  const maDau = codes[0] ?? "";

  useEffect(() => {
    if (!maDau || tomTatBanDau) return;
    let huy = false;
    fetch(`/api/khach-than-thiet?ma=${encodeURIComponent(maDau)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { accepted?: boolean; tomTat?: TomTatThanThiet } | null;
        if (huy) return;
        if (res.ok && body?.accepted && body.tomTat) {
          setTomTat(body.tomTat);
          setTrangThai("san-sang");
        } else {
          // Kho chưa có phần này hay mã không tích được: không hiện thẻ, vé vẫn dùng bình thường.
          setTrangThai("tat");
        }
      })
      .catch(() => {
        if (!huy) setTrangThai("tat");
      });
    return () => {
      huy = true;
    };
  }, [maDau, tomTatBanDau]);

  async function gui(hanhDong: "gan" | "xem") {
    setLoi("");
    setDangGui(true);
    try {
      const res = await fetch("/api/khach-than-thiet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hanhDong === "gan"
            ? { hanh_dong: "gan", ma: codes.slice(0, 4), so_dien_thoai: so, dong_y_dich_vu: true, dong_y_tiep_thi: dongYTiepThi }
            : { hanh_dong: "xem", ma: maDau, so_dien_thoai: so },
        ),
      });
      const body = (await res.json().catch(() => null)) as
        | { accepted?: boolean; tomTat?: TomTatThanThiet; error?: { message?: string } }
        | null;
      if (res.ok && body?.accepted && body.tomTat) {
        setTomTat(body.tomTat);
        setMoXem(false);
      } else {
        setLoi(body?.error?.message ?? t("Chưa lưu được, mời bạn thử lại.", "Could not save. Please try again."));
      }
    } catch {
      setLoi(t("Mạng đang chập chờn, mời bạn thử lại.", "The connection is unstable. Please try again."));
    } finally {
      setDangGui(false);
    }
  }

  if (trangThai === "tat" || !maDau) return null;
  if (trangThai === "dang-doc" || !tomTat) {
    return <div className={`h-40 animate-pulse rounded-3xl bg-[#efe9dc] motion-reduce:animate-none ${className}`} aria-hidden="true" />;
  }

  const oSo = (
    <label className="block text-sm font-bold text-[#27362f]">
      {t("Số điện thoại", "Phone number")}
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={so}
        onChange={(e) => setSo(e.target.value)}
        placeholder="09xx xxx xxx"
        className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 text-base font-normal text-[#27362f]"
      />
    </label>
  );
  const dongLoi = loi ? (
    <p role="alert" className="text-sm leading-6 text-[#9a3b2f]">
      {loi}
    </p>
  ) : null;

  if (!tomTat.linked) {
    return (
      <section data-testid="the-tich-diem" data-chi="tich-diem" data-chi-loi="Nhập số điện thoại, tích ô đồng ý giữ vé, bấm Gắn vé." data-trang-thai="chua-gan" className={`rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6 ${className}`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">{t("Khách thân thiết", "Loyalty")}</p>
        <h2 className="font-display mt-2 text-2xl leading-snug text-[#183f34]">
          {t("Giữ vé bằng số điện thoại, đi lần nào tích lần ấy", "Keep this ticket on your phone number and collect every visit")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#4a554e]">
          {laTruongDoan
            ? t(
                "Vé cả đoàn gắn vào số của trưởng đoàn. Từng người muốn tích cho mình thì mở mã riêng ở trang trưởng đoàn.",
                "The group ticket is kept on the leader's number. Each traveller can open their own code from the leader page to collect for themselves.",
              )
            : t(
                "Vé này thành vé riêng của bạn, mở lại được ở máy khác. Mỗi lượt qua cổng được 100 điểm.",
                "This becomes your own ticket, reopenable on any phone. Every gate entry earns 100 points.",
              )}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#6c4b1f]">
          {MOC_THUONG.map((m) => (
            <li key={m.visits} className="rounded-full bg-[#f3e6c9] px-3 py-1">
              {m.visits} {t("lượt", "visits")}: {lang === "en" ? (m.visits === 2 ? "keepsake gift" : "free adult ticket") : m.reward.toLocaleLowerCase("vi")}
            </li>
          ))}
        </ul>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void gui("gan");
          }}
        >
          {oSo}
          <label className="flex gap-3 text-sm leading-6 text-[#27362f]">
            <input
              type="checkbox"
              checked={dongYDichVu}
              onChange={(e) => setDongYDichVu(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#183f34]"
            />
            <span>
              {t("Dùng số này để giữ vé và tích điểm cho tôi.", "Use this number to keep my ticket and collect points.")}{" "}
              <span className="text-[#7a5a2a]">{t("(bắt buộc)", "(required)")}</span>
            </span>
          </label>
          <label className="flex gap-3 text-sm leading-6 text-[#27362f]">
            <input
              type="checkbox"
              checked={dongYTiepThi}
              onChange={(e) => setDongYTiepThi(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#183f34]"
            />
            <span>
              {t("Báo tôi ưu đãi và mùa lễ hội qua số này.", "Tell me about offers and festival seasons on this number.")}{" "}
              <span className="text-[#6b786f]">{t("(không bắt buộc, bỏ lúc nào cũng được)", "(optional, you can opt out any time)")}</span>
            </span>
          </label>
          {dongLoi}
          <button
            type="submit"
            disabled={dangGui || !dongYDichVu || so.replace(/\D/g, "").length < 9}
            className="min-h-12 w-full rounded-full bg-[#183f34] px-6 font-extrabold text-white transition-colors hover:bg-[#122e26] disabled:opacity-50"
          >
            {dangGui ? t("Đang lưu…", "Saving…") : t("Gắn vé vào số của tôi", "Keep this ticket on my number")}
          </button>
          <p className="text-xs leading-5 text-[#6b786f]">
            {t(
              "Số điện thoại được mã hoá; nhân viên chỉ thấy ba số cuối. Không gửi tin nhắn nếu bạn không tích ô thứ hai.",
              "Your number is encrypted; staff only see the last three digits. No messages unless you tick the second box.",
            )}
          </p>
        </form>
      </section>
    );
  }

  const moc = tomTat.nextMilestone;
  const mocTruoc = MOC_THUONG.filter((m) => m.visits <= tomTat.visits).at(-1)?.visits ?? 0;
  const phanTram = moc ? Math.round(((tomTat.visits - mocTruoc) / Math.max(1, moc.visits - mocTruoc)) * 100) : 100;

  return (
    <section data-testid="the-tich-diem" data-chi="tich-diem" data-trang-thai="da-gan" className={`rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6 ${className}`}>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">{t("Khách thân thiết", "Loyalty")}</p>
      <h2 className="font-display mt-2 text-2xl leading-snug text-[#183f34]">
        {t(`Vé đã gắn với số •••${tomTat.contactHint}`, `Ticket kept on •••${tomTat.contactHint}`)}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4">
          <dt className="text-xs font-bold text-[#6b786f]">{t("Lượt đã đi", "Visits")}</dt>
          <dd className="font-display mt-1 text-3xl text-[#183f34]" data-testid="tich-diem-luot">{tomTat.visits}</dd>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <dt className="text-xs font-bold text-[#6b786f]">{t("Điểm", "Points")}</dt>
          <dd className="font-display mt-1 text-3xl text-[#183f34]">{tomTat.points.toLocaleString("vi-VN")}</dd>
        </div>
      </dl>
      {moc ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#eadfc6]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#c89a55] transition-[width] motion-reduce:transition-none" style={{ width: `${phanTram}%` }} />
          </div>
          <p className="mt-2 text-sm leading-6 text-[#4a554e]">
            {t(
              `Thêm ${moc.remaining} lượt nữa: ${moc.reward.toLocaleLowerCase("vi")}.`,
              `${moc.remaining} more ${moc.remaining === 1 ? "visit" : "visits"} to your next reward.`,
            )}{" "}
            <span className="text-[#6b786f]">
              {t(`Mỗi lượt qua cổng ${DIEM_MOI_LUOT} điểm.`, `${DIEM_MOI_LUOT} points per gate entry.`)}
            </span>
          </p>
        </div>
      ) : null}
      {tomTat.visitList.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-[#183f34]">{t("Những lượt đã đi", "Your visits")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="tich-diem-luot-di">
            {tomTat.visitList.map((luot, i) => (
              <li key={`${luot.site}-${luot.date}-${i}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#27362f]">
                {luot.site} · {ngay(luot.date)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tomTat.voucherCount > 0 && !tomTat.vouchers ? (
        <p className="mt-3 rounded-2xl bg-[#183f34] px-4 py-3 text-sm font-bold text-white">
          {t(`Bạn có ${tomTat.voucherCount} quà chưa đổi.`, `You have ${tomTat.voucherCount} unclaimed ${tomTat.voucherCount === 1 ? "reward" : "rewards"}.`)}
        </p>
      ) : null}

      {tomTat.vouchers ? (
        <div className="mt-5">
          <h3 className="font-bold text-[#183f34]">{t("Quà và voucher", "Rewards")}</h3>
          {tomTat.vouchers.length === 0 ? (
            <p className="mt-1 text-sm text-[#6b786f]">{t("Chưa tới mốc quà đầu tiên.", "No rewards yet.")}</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {tomTat.vouchers.map((v) => (
                <TheVoucher key={v.code} v={v} lang={lang} />
              ))}
            </ul>
          )}
          {tomTat.tickets && tomTat.tickets.length > 0 ? (
            <>
              <h3 className="mt-5 font-bold text-[#183f34]">{t("Vé đã gắn vào số này", "Tickets on this number")}</h3>
              <ul className="mt-2 divide-y divide-[#e6dcc6] rounded-2xl bg-white">
                {tomTat.tickets.map((ve) => (
                  <li key={ve.code} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-bold text-[#27362f]">{ve.site}</span>
                      <code className="block truncate font-mono text-xs text-[#5c665f]">{ve.code}</code>
                    </span>
                    <span className="shrink-0 text-right text-xs text-[#5c665f]">
                      {ngay(ve.validOn)}
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
            </>
          ) : null}
        </div>
      ) : moXem ? (
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void gui("xem");
          }}
        >
          {oSo}
          {dongLoi}
          <button
            type="submit"
            disabled={dangGui || so.replace(/\D/g, "").length < 9}
            className="min-h-12 w-full rounded-full bg-[#183f34] px-6 font-extrabold text-white disabled:opacity-50"
          >
            {dangGui ? t("Đang mở…", "Opening…") : t("Mở quà và mọi vé của tôi", "Open my rewards and tickets")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setMoXem(true)}
          className="mt-5 min-h-12 w-full rounded-full border-2 border-[#183f34] px-6 font-extrabold text-[#183f34]"
        >
          {t("Xem quà và mọi vé của tôi", "See my rewards and tickets")}
        </button>
      )}
      <p className="mt-3 text-xs leading-5 text-[#6b786f]">
        {t("Mã quà chỉ hiện khi nhập lại đúng số điện thoại đã gắn.", "Reward codes only appear after re-entering the linked number.")}
      </p>
      {goiYHoSo ? (
        <p className="mt-2 text-xs leading-5 text-[#6b786f]">
          {t("Lần sau ở máy khác: vào ", "Next time, on any phone: open ")}
          <Link href={lang === "en" ? "/ho-so?lang=en" : "/ho-so"} className="font-bold text-[#183f34] underline underline-offset-2">
            {t("Hộ chiếu Ninh Bình", "Ninh Binh passport")}
          </Link>
          {t(`, gõ mã ${maDau} và số điện thoại này.`, `, enter code ${maDau} and this phone number.`)}
        </p>
      ) : null}
    </section>
  );
}
