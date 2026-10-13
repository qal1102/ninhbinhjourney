"use client";

import { useState } from "react";
import { HoSoKhachView } from "@/components/commerce/ho-so-khach-view";
import { TheTichDiem } from "@/components/commerce/the-tich-diem";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import type { TomTatThanThiet } from "@/domain/khach-than-thiet";

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

  async function mo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDangMo(true);
    setLoi("");
    const maGon = ma.trim().toUpperCase();
    try {
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
        {t("Nhập mã in trên vé cùng số điện thoại đã gắn: lượt đã đi, quà, voucher và mọi vé của bạn hiện ra ở đây.", "Enter the code on your ticket with the phone number you linked: your visits, rewards and tickets appear here.")}
      </p>
      <label className="mt-5 grid gap-1 text-sm font-bold text-[#27362f]">
        {t("Mã trên vé", "Ticket code")}
        <input
          value={ma}
          onChange={(event) => setMa(event.target.value)}
          placeholder={t("NBJ-…, QUAY-… hoặc TV-…", "NBJ-…, QUAY-… or TV-…")}
          autoCapitalize="characters"
          className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 font-medium"
        />
      </label>
      <label className="mt-4 grid gap-1 text-sm font-bold text-[#27362f]">
        {t("Số điện thoại đã gắn (đặt trên web thì số hoặc email lúc đặt)", "Linked phone (web bookings: phone or email used)")}
        <input
          value={lienHe}
          onChange={(event) => setLienHe(event.target.value)}
          placeholder={t("0912 345 678 hoặc ban@email.com", "0912 345 678 or you@email.com")}
          className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 font-medium"
        />
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
