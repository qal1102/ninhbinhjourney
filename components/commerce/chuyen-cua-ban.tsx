"use client";

import { useEffect, useState } from "react";

type Lang = "vi" | "en";

/**
 * Khối "Chuyến của bạn" trên vé (F3, chủ dự án chọn 11/10/2026 từ bảng vẽ):
 * đếm tới giờ khởi hành, chỉ đường tới bến, thêm vào lịch.
 *
 * Có giờ khởi hành (màn vé ngay sau khi trả tiền) thì đếm tới phút. Trang tra
 * vé chỉ có ngày đi (hàm tra vé trong kho chưa trả giờ khung), nên đếm theo
 * ngày, không đoán giờ.
 */
export function ChuyenCuaBan({
  batDau,
  ngayDi,
  diemDen,
  toaDo,
  tenGoi,
  maDon,
  lang,
}: {
  batDau: string | null;
  ngayDi: string;
  diemDen: string;
  toaDo: readonly [number, number] | null;
  tenGoi: string;
  maDon: string;
  lang: Lang;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [bayGio, setBayGio] = useState<number | null>(null);

  useEffect(() => {
    const capNhat = () => setBayGio(Date.now());
    const khung = window.requestAnimationFrame(capNhat);
    const nhip = window.setInterval(capNhat, 30_000);
    return () => {
      window.cancelAnimationFrame(khung);
      window.clearInterval(nhip);
    };
  }, []);

  const moc = batDau ? Date.parse(batDau) : Date.parse(`${ngayDi}T00:00:00+07:00`);
  const conLai = bayGio === null ? null : moc - bayGio;

  let dong1 = "";
  let dong2 = "";
  let thanh = 0;
  if (conLai !== null) {
    if (batDau) {
      const gioKhoiHanh = new Date(moc).toLocaleTimeString(lang === "en" ? "en-GB" : "vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
      if (conLai > 0) {
        const phut = Math.ceil(conLai / 60_000);
        const ngay = Math.floor(phut / 1440);
        const gio = Math.floor((phut % 1440) / 60);
        const ph = phut % 60;
        dong1 =
          ngay > 0
            ? t(`${ngay} ngày ${gio} giờ`, `${ngay} d ${gio} h`)
            : gio > 0
              ? t(`${gio} giờ ${ph} phút`, `${gio} h ${ph} min`)
              : t(`${ph} phút`, `${ph} min`);
        dong2 = t(`Khởi hành ${gioKhoiHanh} ở ${diemDen}. Nên tới bến sớm để qua cổng thong thả.`, `Departs ${gioKhoiHanh} at ${diemDen}. Arrive early so the gate is unhurried.`);
        thanh = Math.min(1, Math.max(0.04, 1 - conLai / 86_400_000));
      } else {
        dong1 = t("Chuyến đã bắt đầu", "Your trip has started");
        dong2 = t(`Khởi hành lúc ${gioKhoiHanh} ở ${diemDen}.`, `Departed ${gioKhoiHanh} at ${diemDen}.`);
        thanh = 1;
      }
    } else {
      const homNay = new Date(bayGio!).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
      const soNgay = Math.round((Date.parse(`${ngayDi}T00:00:00Z`) - Date.parse(`${homNay}T00:00:00Z`)) / 86_400_000);
      dong1 =
        soNgay === 0
          ? t("Hôm nay", "Today")
          : soNgay === 1
            ? t("Ngày mai", "Tomorrow")
            : soNgay > 1
              ? t(`Còn ${soNgay} ngày`, `In ${soNgay} days`)
              : t("Chuyến đã qua", "This trip has passed");
      dong2 = t(`Đi ${diemDen}. Giờ lên thuyền ghi trong lịch của gói.`, `To ${diemDen}. Boarding time is in the package schedule.`);
      thanh = soNgay <= 0 ? 1 : Math.max(0.04, 1 - soNgay / 14);
    }
  }

  function themVaoLich() {
    const dinhDang = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ngayGon = ngayDi.replace(/-/g, "");
    const ngaySau = new Date(Date.parse(`${ngayDi}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
    const dong = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ninh Binh Journey//VI",
      "BEGIN:VEVENT",
      `UID:${maDon}@ninhbinhjourney`,
      `DTSTAMP:${dinhDang(Date.now())}`,
      ...(batDau ? [`DTSTART:${dinhDang(moc)}`, `DTEND:${dinhDang(moc + 3 * 3_600_000)}`] : [`DTSTART;VALUE=DATE:${ngayGon}`, `DTEND;VALUE=DATE:${ngaySau}`]),
      `SUMMARY:${tenGoi} · Ninh Bình Journey`,
      `LOCATION:${diemDen}`,
      `DESCRIPTION:${t("Mã đặt chỗ", "Booking code")} ${maDon}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const url = URL.createObjectURL(new Blob([dong.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${maDon}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chiDuong = toaDo ? `https://www.google.com/maps/dir/?api=1&destination=${toaDo[0]},${toaDo[1]}` : null;

  return (
    <section data-testid="chuyen-cua-ban" className="mt-5 rounded-2xl border border-[#e7c78d]/40 bg-[#0f2a22] p-4 text-[#f3eee3]">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-[#e7b96a]">
        {batDau ? t("Lên thuyền sau", "Boarding in") : t("Chuyến của bạn", "Your trip")}
      </p>
      <p className="font-display mt-1 min-h-[2.6rem] text-4xl leading-none tabular-nums" aria-live="polite">
        {dong1}
      </p>
      <span aria-hidden="true" className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/15">
        <span className="block h-full rounded-full bg-[#e7b96a] transition-[width] duration-700" style={{ width: `${Math.round(thanh * 100)}%` }} />
      </span>
      <p className="mt-2 text-sm leading-6 text-white/72">{dong2}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {chiDuong ? (
          <a
            href={chiDuong}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#e7b96a] px-4 text-sm font-extrabold text-[#183f34]"
          >
            {t("Chỉ đường tới bến", "Directions")}
          </a>
        ) : null}
        <button
          type="button"
          onClick={themVaoLich}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/35 px-4 text-sm font-extrabold text-[#f3eee3]"
        >
          {t("Thêm vào lịch", "Add to calendar")}
        </button>
      </div>
    </section>
  );
}
