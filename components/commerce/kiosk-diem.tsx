"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { soHienThi, type MaBen } from "@/domain/hang-cho";
import { KIOSK_NGHI_MS } from "@/domain/kiosk";

type Lang = "vi" | "en";
type Chu = Record<Lang, string>;

export type GoiKiosk = { slug: string; ten: Chu; thoiLuong: Chu; gia: Chu };

type Man = "dau" | "dat-ve" | "so-do" | "tra-cuu" | "nghe" | "thong-tin";

/** Mã QR trỏ tới một trang trên chính trang web này, để khách đi tiếp trên điện thoại. */
function MaQr({ duong, nhan }: { duong: string; nhan: string }) {
  const [anh, setAnh] = useState<string | null>(null);
  useEffect(() => {
    let huy = false;
    void QRCode.toDataURL(new URL(duong, window.location.origin).toString(), {
      margin: 1,
      width: 320,
      color: { dark: "#183f34", light: "#ffffff" },
    }).then((u) => {
      if (!huy) setAnh(u);
    });
    return () => {
      huy = true;
    };
  }, [duong]);
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="grid h-48 w-48 place-items-center rounded-3xl bg-white p-3 shadow-sm sm:h-60 sm:w-60">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR sinh tại chỗ dạng data URL */}
        {anh ? <img src={anh} alt={nhan} className="h-full w-full" /> : null}
      </div>
      <figcaption className="max-w-xs text-center text-lg font-bold text-[#183f34]">{nhan}</figcaption>
    </figure>
  );
}

export function KioskDiem({
  langDau,
  ten,
  slugDiemDen,
  goi,
  ben,
  thongTin,
}: {
  langDau: Lang;
  ten: Chu;
  slugDiemDen: string;
  goi: GoiKiosk[];
  ben: { ma: MaBen; ten: Chu } | null;
  thongTin: { gioVe: Chu; diLai: Chu; meoDong: Chu; thucDung: Record<Lang, string[]> };
}) {
  const [lang, setLang] = useState<Lang>(langDau);
  const [man, setMan] = useState<Man>("dau");
  const [soDo, setSoDo] = useState<{ so: number; biMat: string } | null>(null);
  const [soKhach, setSoKhach] = useState(2);
  const [dangLay, setDangLay] = useState(false);
  const [loiSo, setLoiSo] = useState<string | null>(null);
  const [gio, setGio] = useState("");
  const hen = useRef<number | null>(null);
  const t = useCallback((vi: string, en: string) => (lang === "en" ? en : vi), [lang]);

  const veDau = useCallback(() => {
    setMan("dau");
    setLang(langDau);
    setSoDo(null);
    setLoiSo(null);
    setSoKhach(2);
  }, [langDau]);

  // Bỏ trống một phút thì về màn đầu: người sau không thấy việc của người trước.
  useEffect(() => {
    const datLai = () => {
      if (hen.current) window.clearTimeout(hen.current);
      hen.current = window.setTimeout(veDau, KIOSK_NGHI_MS);
    };
    datLai();
    window.addEventListener("pointerdown", datLai);
    window.addEventListener("keydown", datLai);
    return () => {
      if (hen.current) window.clearTimeout(hen.current);
      window.removeEventListener("pointerdown", datLai);
      window.removeEventListener("keydown", datLai);
    };
  }, [veDau]);

  useEffect(() => {
    const dem = () =>
      setGio(new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
    dem();
    const id = window.setInterval(dem, 15_000);
    return () => window.clearInterval(id);
  }, []);

  async function laySoDo() {
    if (!ben) return;
    setDangLay(true);
    setLoiSo(null);
    try {
      // Kiosk là máy dùng chung: mỗi lượt lấy số mang một mã máy mới, và
      // kiosk không giữ chuỗi bí mật; điện thoại khách nhận nó qua mã QR.
      const maMay = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
      const res = await fetch("/api/hang-cho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hanh_dong: "lay-so", ben: ben.ma, so_khach: soKhach, ngon_ngu: lang, ma_may: maMay }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; ma?: string; bi_mat?: string; so_thu_tu?: number } | null;
      if (!res.ok || !body?.ok || !body.bi_mat) {
        setLoiSo(
          body?.ma === "TAM_DUNG"
            ? t("Bến đang tạm dừng nhận số. Mời bạn hỏi nhân viên bến.", "The pier has paused the queue. Please ask the staff.")
            : t("Chưa lấy được số. Mời bạn thử lại hoặc hỏi nhân viên.", "Couldn't get a number. Try again or ask the staff."),
        );
        return;
      }
      setSoDo({ so: body.so_thu_tu ?? 0, biMat: body.bi_mat });
    } finally {
      setDangLay(false);
    }
  }

  const oLon = "flex min-h-40 flex-col lg:min-h-56 justify-between rounded-[2rem] p-6 text-left transition active:scale-[0.98]";
  const nutVe = (
    <button type="button" onClick={veDau} className="inline-flex min-h-16 items-center rounded-full border-2 border-[#183f34] px-8 text-xl font-extrabold text-[#183f34]">
      ← {t("Về màn đầu", "Back to start")}
    </button>
  );

  return (
    <main lang={lang} className="flex min-h-screen flex-col bg-[#f4f0e7] px-5 py-6 text-[#151a17] sm:px-10 sm:py-10" data-testid="kiosk" data-man={man}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">Ninh Bình Journey · Kiosk</p>
          <p className="font-display text-3xl text-[#183f34] sm:text-4xl">{ten[lang]}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold tabular-nums text-[#183f34]" aria-label={t("Giờ hiện tại", "Current time")}>{gio}</span>
          <div role="group" aria-label={t("Ngôn ngữ", "Language")} className="inline-flex rounded-full border-2 border-[#183f34] p-1">
            {(["vi", "en"] as const).map((ma) => (
              <button
                key={ma}
                type="button"
                lang={ma}
                aria-pressed={lang === ma}
                onClick={() => setLang(ma)}
                className={`min-h-14 min-w-20 rounded-full px-4 text-xl font-extrabold ${lang === ma ? "bg-[#183f34] text-white" : "text-[#183f34]"}`}
              >
                {ma === "vi" ? "Tiếng Việt" : "English"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {man === "dau" ? (
        <section className="mt-8 flex-1">
          <h1 className="font-display text-5xl leading-tight text-[#183f34] sm:text-6xl">{t("Xin chào! Bạn cần gì ạ?", "Hello! How can we help?")}</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => setMan("dat-ve")} className={`${oLon} bg-[#183f34] text-white`}>
              <span className="text-3xl font-extrabold">{t("Đặt vé", "Book tickets")}</span>
              <span className="text-lg text-white/80">{t("Chọn gói, trả bằng QR trên điện thoại", "Pick a package, pay by QR on your phone")}</span>
            </button>
            {ben ? (
              <button type="button" onClick={() => setMan("so-do")} className={`${oLon} bg-[#c77b25] text-white`}>
                <span className="text-3xl font-extrabold">{t("Lấy số đò", "Take a boat number")}</span>
                <span className="text-lg text-white/85">{t("Khỏi đứng xếp hàng, tới lượt điện thoại báo", "Skip the line; your phone tells you when")}</span>
              </button>
            ) : null}
            <button type="button" onClick={() => setMan("tra-cuu")} className={`${oLon} border-2 border-[#183f34] bg-white text-[#183f34]`}>
              <span className="text-3xl font-extrabold">{t("Mở lại vé đã đặt", "Find my booking")}</span>
              <span className="text-lg text-[#4d5b55]">{t("Mất màn hình vé? Mở lại trên điện thoại", "Lost your ticket screen? Reopen it on your phone")}</span>
            </button>
            <button type="button" onClick={() => setMan("nghe")} className={`${oLon} border-2 border-[#183f34] bg-white text-[#183f34]`}>
              <span className="text-3xl font-extrabold">{t("Nghe thuyết minh", "Audio guide")}</span>
              <span className="text-lg text-[#4d5b55]">{t("Câu chuyện nơi này, đọc trên điện thoại của bạn", "This place's story, read aloud on your phone")}</span>
            </button>
            <button type="button" onClick={() => setMan("thong-tin")} className={`${oLon} border-2 border-[#183f34] bg-white text-[#183f34]`}>
              <span className="text-3xl font-extrabold">{t("Giá vé, đi lại, mẹo tránh đông", "Fees, getting around, crowd tips")}</span>
              <span className="text-lg text-[#4d5b55]">{t("Đọc ngay trên màn hình", "Read it right here")}</span>
            </button>
          </div>
          <p className="mt-8 text-lg text-[#59654b]">
            {t("Kiosk không lưu gì của bạn. Việc cần thông tin riêng đều làm tiếp trên điện thoại của bạn.", "This kiosk keeps nothing about you. Anything personal continues on your own phone.")}
          </p>
        </section>
      ) : null}

      {man === "dat-ve" ? (
        <section className="mt-8 flex-1">
          <h1 className="font-display text-5xl text-[#183f34]">{t("Quét để đặt vé trên điện thoại", "Scan to book on your phone")}</h1>
          <p className="mt-3 text-xl text-[#4d5b55]">
            {t("Chọn gói, quét mã bằng camera điện thoại. Giữ chỗ 15 phút, trả bằng QR, vé về ngay máy bạn.", "Pick a package and scan with your phone camera. Seats are held 15 minutes, you pay by QR and the ticket lands on your phone.")}
          </p>
          {goi.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-6 rounded-[2rem] border-2 border-[#d7d5cd] bg-white p-6 sm:flex-row" data-testid="kiosk-khong-goi">
              <MaQr duong={`/packages?lang=${lang}`} nhan={t("Xem các gói khác", "See other packages")} />
              <p className="max-w-lg text-xl leading-8 text-[#4d5b55]">
                {t(
                  `${ten.vi} chưa có gói đặt trước trên web. Mời bạn mua vé ngay tại quầy bên cạnh, hoặc quét mã để xem các gói ở những điểm khác.`,
                  `${ten.en} has no online package yet. Please buy at the ticket desk next to this kiosk, or scan to see packages for other places.`,
                )}
              </p>
            </div>
          ) : null}
          <ul className="mt-6 grid gap-6 lg:grid-cols-2">
            {goi.map((g) => (
              <li key={g.slug} className="flex min-w-0 flex-col items-center gap-6 rounded-[2rem] border-2 border-[#d7d5cd] bg-white p-6 sm:flex-row" data-testid={`kiosk-goi-${g.slug}`}>
                <MaQr duong={`/checkout?package=${g.slug}&ngay=hom-nay&lang=${lang}`} nhan={t("Quét để đặt", "Scan to book")} />
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-extrabold text-[#183f34]">{g.ten[lang]}</p>
                  <p className="mt-2 text-lg text-[#4d5b55]">{g.thoiLuong[lang]}</p>
                  <p className="mt-2 text-2xl font-extrabold text-[#9a6328]">{g.gia[lang]}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-lg text-[#59654b]">{t("Muốn trả tiền mặt? Mời bạn tới quầy vé ngay cạnh.", "Paying cash? The ticket desk is right next to this kiosk.")}</p>
          <div className="mt-8">{nutVe}</div>
        </section>
      ) : null}

      {man === "so-do" && ben ? (
        <section className="mt-8 flex-1">
          {soDo ? (
            <div className="flex flex-wrap items-center gap-10" data-testid="kiosk-so-do">
              <div>
                <p className="text-2xl font-bold text-[#59654b]">{t("Số của bạn", "Your number")}</p>
                <p className="font-display text-8xl leading-none text-[#183f34] sm:text-[9rem]">{soHienThi(soDo.so)}</p>
                <p className="mt-4 max-w-md text-xl leading-8 text-[#4d5b55]">
                  {t(
                    "Quét mã bên cạnh để điện thoại nhận số này và báo khi tới lượt. Không quét cũng được: nhớ số này, nghe gọi ở bến.",
                    "Scan the code to follow this number on your phone; it alerts you when it's your turn. No phone? Remember the number and listen at the pier.",
                  )}
                </p>
              </div>
              <MaQr duong={`/xep-hang/${ben.ma}?luot=${soDo.biMat}&lang=${lang}`} nhan={t("Quét để theo dõi lượt", "Scan to follow your turn")} />
            </div>
          ) : (
            <>
              <h1 className="font-display text-5xl text-[#183f34]">{t("Lấy số đò", "Take a boat number")} · {ben.ten[lang]}</h1>
              <p className="mt-6 text-2xl font-bold text-[#183f34]">{t("Nhóm bạn mấy người?", "How many in your group?")}</p>
              <div role="radiogroup" aria-label={t("Số người", "Group size")} className="mt-4 flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={soKhach === n}
                    onClick={() => setSoKhach(n)}
                    className={`h-20 w-20 rounded-2xl border-2 text-3xl font-extrabold ${soKhach === n ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#b9c4bd] bg-white text-[#183f34]"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={laySoDo}
                disabled={dangLay}
                className="mt-8 inline-flex min-h-20 items-center rounded-full bg-[#c77b25] px-12 text-3xl font-extrabold text-white disabled:opacity-60"
              >
                {dangLay ? t("Đang lấy số…", "Getting a number…") : t("Lấy số", "Take a number")}
              </button>
              {loiSo ? <p role="alert" className="mt-4 text-xl font-bold text-[#9b2c1f]">{loiSo}</p> : null}
              <p className="mt-6 text-lg text-[#59654b]">{t("Số này giữ chỗ trong hàng, không thay vé đò.", "Your number holds a place in line; it is not a boat ticket.")}</p>
            </>
          )}
          <div className="mt-10">{nutVe}</div>
        </section>
      ) : null}

      {man === "tra-cuu" ? (
        <section className="mt-8 flex-1">
          <h1 className="font-display text-5xl text-[#183f34]">{t("Mở lại vé trên điện thoại", "Reopen your ticket on your phone")}</h1>
          <div className="mt-8 flex flex-wrap items-center gap-10">
            <MaQr duong={`/tra-cuu-ve?lang=${lang}`} nhan={t("Quét để tra cứu vé", "Scan to find your booking")} />
            <p className="max-w-lg text-xl leading-8 text-[#4d5b55]">
              {t(
                "Trên điện thoại, nhập mã đặt chỗ (dạng NBJ-…) cùng số điện thoại hoặc email đã dùng lúc đặt. Kiosk không hỏi số điện thoại của bạn ở nơi đông người.",
                "On your phone, enter the booking code (NBJ-…) and the phone or email you booked with. The kiosk never asks for your phone number in public.",
              )}
            </p>
          </div>
          <div className="mt-10">{nutVe}</div>
        </section>
      ) : null}

      {man === "nghe" ? (
        <section className="mt-8 flex-1">
          <h1 className="font-display text-5xl text-[#183f34]">{t("Nghe thuyết minh trên điện thoại", "Listen on your phone")}</h1>
          <div className="mt-8 flex flex-wrap gap-10">
            <MaQr duong={`/destination/${slugDiemDen}?lang=${lang}#thuyet-minh`} nhan={t(`Chuyện về ${ten.vi}`, `The story of ${ten.en}`)} />
            <MaQr duong={`/nghe?lang=${lang}`} nhan={t("Tự đọc khi bạn tới từng nơi", "Reads each place as you arrive")} />
          </div>
          <div className="mt-10">{nutVe}</div>
        </section>
      ) : null}

      {man === "thong-tin" ? (
        <section className="mt-8 flex-1">
          <h1 className="font-display text-5xl text-[#183f34]">{ten[lang]}</h1>
          <dl className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              [t("Giá vé", "Entrance"), thongTin.gioVe[lang]],
              [t("Đi lại", "Getting there"), thongTin.diLai[lang]],
              [t("Mẹo tránh đông", "Beat the crowds"), thongTin.meoDong[lang]],
            ].map(([nhan, noiDung]) => (
              <div key={nhan} className="rounded-[2rem] bg-white p-6">
                <dt className="text-lg font-extrabold uppercase tracking-[0.12em] text-[#9a6328]">{nhan}</dt>
                <dd className="mt-3 text-xl leading-8 text-[#27362f]">{noiDung}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-6 space-y-2 text-xl leading-8 text-[#27362f]">
            {thongTin.thucDung[lang].map((dong) => (
              <li key={dong}>• {dong}</li>
            ))}
          </ul>
          <div className="mt-10">{nutVe}</div>
        </section>
      ) : null}
    </main>
  );
}
