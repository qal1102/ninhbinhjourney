"use client";

import { useEffect, useState } from "react";

/**
 * QA-P2-09 — nút nổi nhường chỗ cho nội dung.
 *
 * Lượt kiểm 12/09/2026: nút nổi bám đáy màn hình che đúng nút "Thôi", ô số
 * tiền, dòng chữ cuối mỗi mục. Luật giao diện của dự án nói thẳng "không lớp
 * nổi nào được che nội dung". Trả `true` khi nút nên lùi đi:
 *
 * - đang cuộn xuống đọc tiếp (quá 80px đầu trang);
 * - đang gõ vào một ô nhập — trên điện thoại bàn phím đẩy nút lên đè chữ.
 *
 * Cuộn ngược lên, chạm cuối trang, hoặc rời ô nhập thì nút hiện lại. Không
 * bắt sự kiện nào nặng: một lượt đọc `scrollY` mỗi lần cuộn, có đăng ký
 * `passive`.
 */
export function useFloatingYield(): boolean {
  const [nhuong, setNhuong] = useState(false);

  useEffect(() => {
    let viTriCu = window.scrollY;
    let dangGo = false;
    const laONhap = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      el.matches("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=true]");

    const khiCuon = () => {
      if (dangGo) return;
      const y = window.scrollY;
      const cuoiTrang = window.innerHeight + y >= document.documentElement.scrollHeight - 48;
      if (cuoiTrang || y < 80 || y < viTriCu - 4) setNhuong(false);
      else if (y > viTriCu + 4) setNhuong(true);
      viTriCu = y;
    };
    const khiVaoO = (event: FocusEvent) => {
      if (!laONhap(event.target)) return;
      dangGo = true;
      setNhuong(true);
    };
    const khiRoiO = (event: FocusEvent) => {
      if (!laONhap(event.target)) return;
      dangGo = false;
      viTriCu = window.scrollY;
      setNhuong(false);
    };

    window.addEventListener("scroll", khiCuon, { passive: true });
    document.addEventListener("focusin", khiVaoO);
    document.addEventListener("focusout", khiRoiO);
    return () => {
      window.removeEventListener("scroll", khiCuon);
      document.removeEventListener("focusin", khiVaoO);
      document.removeEventListener("focusout", khiRoiO);
    };
  }, []);

  return nhuong;
}

/** Lớp Tailwind cho nút đang nhường chỗ: trượt xuống, mờ đi, không bấm nhầm được. */
export const FLOATING_YIELD_CLASS = "pointer-events-none translate-y-24 opacity-0";
