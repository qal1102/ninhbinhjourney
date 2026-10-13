"use client";

import Link from "next/link";
import { useState } from "react";
import { cachTinhLuot, hatGiongKhop, tinhNguoiTrung, type SuKienCongKhai, type TraSuKien } from "@/domain/su-kien";

type Lang = "vi" | "en";

function ngayGio(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function goi(body: Record<string, unknown>) {
  const res = await fetch("/api/su-kien", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.accepted !== true) {
    const loi = (json.error as { message?: string } | undefined)?.message;
    throw new Error(loi ?? "Chưa xử lý được, xin thử lại.");
  }
  return json;
}

function TuKiem({ sk, lang }: { sk: SuKienCongKhai; lang: Lang }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [ket, setKet] = useState<{ khop: boolean; dung: boolean } | null>(null);
  const [dang, setDang] = useState(false);
  if (!sk.hatGiong || !sk.danhSach) return null;
  const hat = sk.hatGiong;
  const ds = sk.danhSach;
  async function kiem() {
    setDang(true);
    try {
      const khop = await hatGiongKhop(hat, sk.hatGiongBam);
      const tinh = await tinhNguoiTrung(hat, ds, sk.soGiai);
      const congBo = ds.filter((d) => d.trung !== null).sort((a, b) => (a.trung ?? 0) - (b.trung ?? 0)).map((d) => d.ma);
      setKet({ khop, dung: tinh.join(",") === congBo.join(",") });
    } finally {
      setDang(false);
    }
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={kiem}
        disabled={dang}
        data-testid="nut-tu-kiem"
        className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {dang ? t("Đang tính…", "Computing…") : t("Tự kiểm trên máy bạn", "Verify on your device")}
      </button>
      {ket ? (
        <p data-testid="ket-qua-tu-kiem" className={`mt-3 rounded-xl p-3 text-sm font-bold ${ket.khop && ket.dung ? "bg-[#dceadd] text-[#183f34]" : "bg-[#f6d2be] text-[#8a3a12]"}`}>
          {ket.khop && ket.dung
            ? t("Khớp: hạt giống đúng mã cam kết, và máy bạn tính ra đúng những người trúng đã công bố.", "Match: the seed fits the commitment, and your device computes exactly the announced winners.")
            : t("Không khớp. Xin báo ban tổ chức kèm ảnh màn hình này.", "Mismatch. Please report it to the organisers with a screenshot.")}
        </p>
      ) : null}
    </div>
  );
}

export function SuKienView({ sk, lang = "vi", conMo }: { sk: SuKienCongKhai; lang?: Lang; conMo: boolean }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [so, setSo] = useState("");
  const [dongYLienHe, setDongYLienHe] = useState(false);
  const [dongYTiepThi, setDongYTiepThi] = useState(false);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");
  const [daDangKy, setDaDangKy] = useState<{ maThamGia: string; soLuot: number; daCo: boolean } | null>(null);
  const [soTra, setSoTra] = useState("");
  const [tra, setTra] = useState<TraSuKien | null>(null);
  const [loiTra, setLoiTra] = useState("");

  async function dangKy(e: React.FormEvent) {
    e.preventDefault();
    setLoi("");
    if (!dongYLienHe) {
      setLoi(t("Tích ô đồng ý để chúng tôi liên hệ khi bạn trúng.", "Tick the box so we can contact you if you win."));
      return;
    }
    setDang(true);
    try {
      const json = await goi({ hanh_dong: "dang-ky", slug: sk.slug, so_dien_thoai: so, dong_y_lien_he: true, dong_y_tiep_thi: dongYTiepThi });
      setDaDangKy(json.dangKy as { maThamGia: string; soLuot: number; daCo: boolean });
    } catch (error) {
      setLoi(error instanceof Error ? error.message : String(error));
    } finally {
      setDang(false);
    }
  }

  async function traCuu(e: React.FormEvent) {
    e.preventDefault();
    setLoiTra("");
    setTra(null);
    try {
      const json = await goi({ hanh_dong: "tra", slug: sk.slug, so_dien_thoai: soTra });
      setTra(json.tra as TraSuKien);
    } catch (error) {
      setLoiTra(error instanceof Error ? error.message : String(error));
    }
  }

  const duoi = lang === "en" ? "?lang=en" : "";
  const nguoiTrung = sk.danhSach?.filter((d) => d.trung !== null).sort((a, b) => (a.trung ?? 0) - (b.trung ?? 0)) ?? [];

  return (
    <div className="mx-auto max-w-3xl" data-testid="su-kien">
      <header className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
          {t("Sự kiện", "Event")}{sk.site ? ` · ${sk.site}` : ""}
        </p>
        <h1 className="font-display mt-2 text-4xl leading-tight sm:text-5xl">{sk.ten}</h1>
        <p className="mt-3 text-lg text-white/80">{sk.khachMoi}</p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.08] p-3">
            <dt className="text-xs text-white/60">{t("Diễn ra", "Takes place")}</dt>
            <dd className="mt-1 font-bold">{ngayGio(sk.dienRaLuc, lang)}</dd>
          </div>
          <div className="rounded-2xl bg-white/[0.08] p-3">
            <dt className="text-xs text-white/60">{t("Hạn đăng ký rút thăm", "Draw entries close")}</dt>
            <dd className="mt-1 font-bold">{ngayGio(sk.hanDangKy, lang)}</dd>
          </div>
          <div className="rounded-2xl bg-white/[0.08] p-3">
            <dt className="text-xs text-white/60">{t("Đã đăng ký", "Registered")}</dt>
            <dd className="mt-1 font-bold" data-testid="so-nguoi-dang-ky">{sk.soNguoi.toLocaleString("vi-VN")} {t("người", "people")}</dd>
          </div>
        </dl>
      </header>

      {sk.moTa ? <p className="mt-6 leading-7 text-[#3f4a43]">{sk.moTa}</p> : null}

      <section className="mt-6 rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6">
        <h2 className="font-display text-2xl text-[#183f34]">{t(`${sk.soGiai} suất giao lưu`, `${sk.soGiai} meet-and-greet places`)}</h2>
        <p className="mt-2 leading-7 text-[#4a554e]">{sk.giaiThuong}</p>
        <p className="mt-2 text-sm text-[#6b786f]">{cachTinhLuot(lang)}</p>
      </section>

      {conMo ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm" data-testid="dang-ky-su-kien">
          {daDangKy ? (
            <div data-testid="da-dang-ky">
              <h2 className="font-display text-2xl text-[#183f34]">{daDangKy.daCo ? t("Số này đã đăng ký từ trước", "This number was already registered") : t("Đã ghi tên bạn vào rút thăm", "You are in the draw")}</h2>
              <p className="mt-2 text-[#4a554e]">
                {t("Mã tham gia của bạn:", "Your entry code:")} <strong className="font-mono text-lg text-[#183f34]" data-testid="ma-tham-gia">{daDangKy.maThamGia}</strong>
              </p>
              <p className="mt-1 text-[#4a554e]">{t(`Hiện bạn có ${daDangKy.soLuot} lượt.`, `You currently have ${daDangKy.soLuot} ${daDangKy.soLuot === 1 ? "chance" : "chances"}.`)}</p>
              <p className="mt-3 rounded-2xl bg-[#fff8eb] p-4 text-sm leading-6 text-[#6c4b1f]">
                {t("Thêm lượt: mua vé, gắn số này vào vé rồi qua cổng trước hạn đăng ký; mỗi lần qua cổng thêm 1 lượt.", "More chances: buy a ticket, link this number to it and pass the gate before entries close; each entry adds one.")}{" "}
                <Link href={`/packages${duoi}`} className="font-bold underline underline-offset-2">{t("Mua vé", "Buy tickets")}</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={dangKy}>
              <h2 className="font-display text-2xl text-[#183f34]">{t("Đăng ký rút thăm", "Enter the draw")}</h2>
              <label className="mt-4 block text-sm font-bold text-[#27362f]">
                {t("Số điện thoại", "Phone number")}
                <input value={so} onChange={(e) => setSo(e.target.value)} inputMode="tel" autoComplete="tel" required className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] px-4 font-normal" placeholder="09xx xxx xxx" />
              </label>
              <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-[#27362f]">
                <input type="checkbox" checked={dongYLienHe} onChange={(e) => setDongYLienHe(e.target.checked)} className="mt-1 size-5 shrink-0" />
                <span>{t("Đồng ý để Ninh Bình Journey dùng số này cho rút thăm và liên hệ khi tôi trúng (bắt buộc).", "I agree Ninh Binh Journey may use this number for the draw and to contact me if I win (required).")}</span>
              </label>
              <label className="mt-2 flex items-start gap-3 text-sm leading-6 text-[#27362f]">
                <input type="checkbox" checked={dongYTiepThi} onChange={(e) => setDongYTiepThi(e.target.checked)} className="mt-1 size-5 shrink-0" />
                <span>{t("Báo tôi các sự kiện và ưu đãi sau này (không bắt buộc, bỏ lúc nào cũng được).", "Tell me about future events and offers (optional, opt out any time).")}</span>
              </label>
              <button type="submit" disabled={dang} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#183f34] px-6 font-extrabold text-white disabled:opacity-60 sm:w-auto">
                {dang ? t("Đang ghi…", "Saving…") : t("Đăng ký rút thăm", "Enter the draw")}
              </button>
              {loi ? <p role="alert" className="mt-3 text-sm font-bold text-[#9a3b2f]">{loi}</p> : null}
            </form>
          )}
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-2xl text-[#183f34]">{sk.trangThai === "da-rut" ? t("Bạn có trúng không?", "Did you win?") : t("Đã đăng ký? Xem số lượt", "Registered? Check your chances")}</h2>
        <form onSubmit={traCuu} className="mt-3 flex flex-wrap gap-2">
          <input value={soTra} onChange={(e) => setSoTra(e.target.value)} inputMode="tel" aria-label={t("Số điện thoại đã đăng ký", "Registered phone number")} required className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bec7bf] px-4" placeholder="09xx xxx xxx" />
          <button type="submit" className="min-h-12 rounded-full border border-[#183f34] px-5 font-extrabold text-[#183f34]">{t("Tra", "Check")}</button>
        </form>
        {loiTra ? <p role="alert" className="mt-2 text-sm font-bold text-[#9a3b2f]">{loiTra}</p> : null}
        {tra ? (
          <p data-testid="ket-qua-tra-su-kien" className="mt-3 rounded-xl bg-[#f4f0e7] p-3 text-sm leading-6 text-[#27362f]">
            {!tra.dangKy
              ? t("Số này chưa đăng ký sự kiện.", "This number has not entered.")
              : !tra.daRut
                ? t(`Mã ${tra.maThamGia} · ${tra.soLuot} lượt. Chưa rút thăm.`, `Code ${tra.maThamGia} · ${tra.soLuot} chances. Not drawn yet.`)
                : tra.trungThuTu
                  ? t(`Chúc mừng! Bạn trúng suất số ${tra.trungThuTu}. Mã nhận giải: ${tra.maNhan}. Mang mã này và giấy tờ tùy thân tới quầy đón khách trước giờ diễn ra.`, `Congratulations! You won place ${tra.trungThuTu}. Claim code: ${tra.maNhan}. Bring it with photo ID to the visitor desk before the event.`)
                  : t(`Mã ${tra.maThamGia} · ${tra.soLuot} lượt. Lần này bạn chưa trúng; hẹn sự kiện sau.`, `Code ${tra.maThamGia} · ${tra.soLuot} chances. Not this time; see you at the next event.`)}
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-[#d7d5cd] bg-[#f4f0e7] p-6" data-testid="minh-bach">
        <h2 className="font-display text-2xl text-[#183f34]">{t("Rút thăm minh bạch", "A draw you can check")}</h2>
        <p className="mt-2 text-sm leading-6 text-[#4a554e]">
          {t(
            "Lúc mở sự kiện, máy sinh một hạt giống bí mật và công bố ngay mã cam kết dưới đây (mã băm SHA-256 của hạt giống). Rút thăm xong, hạt giống và danh sách tham gia được công bố. Ai cũng tính lại được: điểm của mỗi người là mã băm nhỏ nhất của “hạt giống:mã tham gia:k” với k từ 1 tới số lượt; điểm nhỏ nhất trúng trước. Không ai, kể cả ban tổ chức, chọn được người trúng sau khi đã công bố mã cam kết.",
            "When the event opens, a secret seed is generated and its SHA-256 commitment is published below. After the draw the seed and the entry list are published. Anyone can recompute: each entry's score is the smallest SHA-256 of “seed:entry code:k” for k from 1 to its chances; the lowest scores win. Nobody, organisers included, can pick winners once the commitment is out.",
          )}
        </p>
        <p className="mt-3 text-xs font-bold text-[#6b786f]">{t("Mã cam kết", "Commitment")}</p>
        <code className="block break-all rounded-xl bg-white p-3 text-xs text-[#183f34]" data-testid="ma-cam-ket">{sk.hatGiongBam}</code>
        {sk.hatGiong ? (
          <>
            <p className="mt-3 text-xs font-bold text-[#6b786f]">{t("Hạt giống (công bố sau khi rút)", "Seed (published after the draw)")}</p>
            <code className="block break-all rounded-xl bg-white p-3 text-xs text-[#183f34]">{sk.hatGiong}</code>
            {sk.rutLuc ? <p className="mt-2 text-xs text-[#6b786f]">{t("Rút lúc", "Drawn at")} {ngayGio(sk.rutLuc, lang)}</p> : null}
            <h3 className="mt-4 font-bold text-[#183f34]">{t("Người trúng", "Winners")}</h3>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2" data-testid="nguoi-trung">
              {nguoiTrung.map((d) => (
                <li key={d.ma} className="rounded-lg bg-white px-3 py-2">
                  {d.trung}. <span className="font-mono">{d.ma}</span> · {d.so} · {d.luot} {t("lượt", d.luot === 1 ? "chance" : "chances")}
                </li>
              ))}
            </ol>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold text-[#356957]">{t(`Cả danh sách (${sk.danhSach?.length ?? 0} người)`, `Full list (${sk.danhSach?.length ?? 0} entries)`)}</summary>
              <ul className="mt-2 max-h-72 overflow-auto rounded-xl bg-white p-3 font-mono text-xs leading-6">
                {sk.danhSach?.map((d) => <li key={d.ma}>{d.ma} · {d.so} · {d.luot}</li>)}
              </ul>
            </details>
            <TuKiem sk={sk} lang={lang} />
          </>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-[#6b786f]" data-testid="so-dang-ky-km">
          {sk.soDangKyKhuyenMai
            ? t(`Chương trình đã đăng ký khuyến mại với Sở Công Thương: ${sk.soDangKyKhuyenMai}.`, `Registered with the provincial Department of Industry and Trade: ${sk.soDangKyKhuyenMai}.`)
            : t("Bản trình diễn: chương trình chưa có số đăng ký khuyến mại với Sở Công Thương. Trước khi chạy thật phải đăng ký, vì có gắn lượt với vé.", "Demo: this programme has no trade-promotion registration yet. It must be registered before running for real, since chances are tied to tickets.")}
        </p>
      </section>
    </div>
  );
}
