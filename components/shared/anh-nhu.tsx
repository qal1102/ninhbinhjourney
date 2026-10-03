"use client";

import { useEffect } from "react";

/**
 * Ánh nhũ trên thẻ có `data-anh-nhu` (thẻ gói kiểu vé giấy): rê chuột thì thẻ
 * nghiêng nhẹ theo tay như cầm một tấm vé, và một vệt nhũ vàng chạy theo con
 * trỏ trên mặt giấy. Toạ độ đi qua biến CSS (`--nhu-x`, `--nhu-y`,
 * `--nghieng-x`, `--nghieng-y`); phần vẽ nằm trong `globals.css`.
 *
 * Một trình nghe cho cả trang, không gắn từng thẻ. Chỉ chạy với chuột thật
 * (`pointer: fine`) và khi khách không chọn giảm chuyển động; màn cảm ứng
 * không có gì, thẻ đứng yên như cũ.
 */
export function AnhNhu() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dangGiu: HTMLElement | null = null;
    let khung = 0;
    let suKien: PointerEvent | null = null;

    const tha = () => {
      if (!dangGiu) return;
      dangGiu.dataset.nhuOn = "0";
      dangGiu.style.setProperty("--nghieng-x", "0deg");
      dangGiu.style.setProperty("--nghieng-y", "0deg");
      dangGiu = null;
    };

    const capNhat = () => {
      khung = 0;
      const e = suKien;
      if (!e) return;
      const the = (e.target as Element | null)?.closest?.<HTMLElement>("[data-anh-nhu]") ?? null;
      if (the !== dangGiu) tha();
      if (!the) return;
      dangGiu = the;
      const r = the.getBoundingClientRect();
      const x = (e.clientX - r.left) / Math.max(r.width, 1);
      const y = (e.clientY - r.top) / Math.max(r.height, 1);
      the.dataset.nhuOn = "1";
      the.style.setProperty("--nhu-x", `${(x * 100).toFixed(1)}%`);
      the.style.setProperty("--nhu-y", `${(y * 100).toFixed(1)}%`);
      // Thẻ to thì nghiêng ít: tối đa 2,5 độ, đủ thấy mà không làm chữ khó đọc.
      the.style.setProperty("--nghieng-x", `${((x - 0.5) * 5).toFixed(2)}deg`);
      the.style.setProperty("--nghieng-y", `${((0.5 - y) * 3).toFixed(2)}deg`);
    };

    const khiDi = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      suKien = e;
      if (!khung) khung = requestAnimationFrame(capNhat);
    };
    const khiRoi = () => tha();
    document.addEventListener("pointermove", khiDi, { passive: true });
    document.documentElement.addEventListener("pointerleave", khiRoi);
    return () => {
      if (khung) cancelAnimationFrame(khung);
      document.removeEventListener("pointermove", khiDi);
      document.documentElement.removeEventListener("pointerleave", khiRoi);
      tha();
    };
  }, []);
  return null;
}
