"use client";

import { useEffect } from "react";

/**
 * Thanh đầu ERP có ba menu `<details>` (chuông, Quản trị, Vai trò) không biết
 * nhau, mở cái này cái kia vẫn mở, ba hộp chồng lên nhau (soát 13/10/2026).
 * Mở một menu thì đóng các menu khác; bấm ra ngoài hay nhấn Escape thì đóng hết.
 */
export function MotMenuMotLuc({ chon }: { chon: string }) {
  useEffect(() => {
    const vung = document.querySelector<HTMLElement>(chon);
    if (!vung) return;
    const cacMenu = () => Array.from(vung.querySelectorAll<HTMLDetailsElement>("details"));
    const khiMo = (event: Event) => {
      const mo = event.target;
      if (!(mo instanceof HTMLDetailsElement) || !mo.open) return;
      for (const khac of cacMenu()) {
        if (khac !== mo && khac.open && !khac.contains(mo) && !mo.contains(khac)) khac.open = false;
      }
    };
    const khiBam = (event: MouseEvent) => {
      if (event.target instanceof Node && vung.contains(event.target)) return;
      for (const menu of cacMenu()) menu.open = false;
    };
    const khiPhim = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of cacMenu()) menu.open = false;
    };
    vung.addEventListener("toggle", khiMo, true);
    document.addEventListener("click", khiBam);
    document.addEventListener("keydown", khiPhim);
    return () => {
      vung.removeEventListener("toggle", khiMo, true);
      document.removeEventListener("click", khiBam);
      document.removeEventListener("keydown", khiPhim);
    };
  }, [chon]);
  return null;
}
