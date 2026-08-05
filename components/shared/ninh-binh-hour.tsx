"use client";

import { useEffect, useState } from "react";

export type DayBand = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";

export type NinhBinhHour = {
  /** "06:42" -- gio tai Ninh Binh, khong phai gio may khach. */
  clock: string;
  band: DayBand;
};

/*
 * Ninh Binh la UTC+7 quanh nam, Viet Nam khong doi gio mua he. Tinh thang
 * tu UTC thay vi dua vao mui gio may khach: mot nguoi dang o London mo
 * trang nay phai thay gio O NINH BINH -- do moi la y nghia cua dong chu.
 */
const NINH_BINH_UTC_OFFSET_HOURS = 7;

function bandForHour(hour: number): DayBand {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

function readNinhBinhHour(): NinhBinhHour {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const local = new Date(utcMs + NINH_BINH_UTC_OFFSET_HOURS * 3_600_000);
  const hour = local.getHours();
  return {
    clock: `${String(hour).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`,
    band: bandForHour(hour),
  };
}

/**
 * Gio thuc tai Ninh Binh, cap nhat moi phut.
 *
 * Tra `null` cho toi khi component da mount tren may khach. BAT BUOC nhu
 * vay: doc dong ho ngay trong lan render dau se cho ra chuoi khac voi
 * HTML may chu da gui (may chu render luc khac, va co the o mui gio
 * khac), gay hydration mismatch -- dung loai loi da tung sap o
 * `reveal.tsx` va da ghi trong HANDOFF dot muoi. Ben goi phai chiu duoc
 * gia tri `null` va khong dung cho no.
 */
export function useNinhBinhHour(): NinhBinhHour | null {
  const [value, setValue] = useState<NinhBinhHour | null>(null);

  useEffect(() => {
    // queueMicrotask thay vi goi setState thang trong than effect: goi
    // thang gay cascading render (lint chan) -- cung cach da dung o
    // components/commerce/booking-confirmation.tsx.
    queueMicrotask(() => setValue(readNinhBinhHour()));
    const id = window.setInterval(() => setValue(readNinhBinhHour()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return value;
}
