"use client";

import { useState } from "react";
import { HoSoKhachView } from "@/components/commerce/ho-so-khach-view";
import type { HoSoKhach } from "@/domain/ho-so-khach";

/** Mở hộ chiếu từ một máy chưa từng đặt chỗ: mã đặt chỗ + số đã dùng. */
export function MoHoSo({ lang = "vi" }: { lang?: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [ma, setMa] = useState("");
  const [lienHe, setLienHe] = useState("");
  const [dangMo, setDangMo] = useState(false);
  const [loi, setLoi] = useState("");
  const [hoSo, setHoSo] = useState<HoSoKhach | null>(null);

  async function mo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDangMo(true);
    setLoi("");
    try {
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

  return (
    <form onSubmit={mo} className="rounded-3xl border border-[#d7d5cd] bg-white p-6 sm:p-8">
      <h2 className="font-display text-3xl text-[#183f34]">{t("Mở hộ chiếu của bạn", "Open your passport")}</h2>
      <p className="mt-3 leading-7 text-[#59654b]">
        {t("Nhập một mã đặt chỗ bất kỳ cùng số điện thoại hoặc email bạn đã dùng lúc đặt. Mọi chuyến đi cùng số ấy hiện ra chung một hồ sơ.", "Enter any booking code with the phone or email you used. Every trip booked with that contact appears in one passport.")}
      </p>
      <label className="mt-5 grid gap-1 text-sm font-bold text-[#27362f]">
        {t("Mã đặt chỗ", "Booking code")}
        <input
          value={ma}
          onChange={(event) => setMa(event.target.value)}
          placeholder="NBJ-…"
          autoCapitalize="characters"
          className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 font-medium"
        />
      </label>
      <label className="mt-4 grid gap-1 text-sm font-bold text-[#27362f]">
        {t("Số điện thoại hoặc email đã dùng lúc đặt", "Phone or email used when booking")}
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
        {dangMo ? t("Đang mở…", "Opening…") : t("Mở hộ chiếu", "Open passport")}
      </button>
    </form>
  );
}
