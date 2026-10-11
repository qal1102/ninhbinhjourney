"use client";

import { useEffect, useState } from "react";

/**
 * Nút nổi có chữ ở mép phải che mất tiêu đề, ô chọn, dòng liên kết trên điện
 * thoại. Trả `true` khi khách đang cuộn xuống (đã qua đầu trang) để nút thu về
 * vòng tròn chỉ còn biểu tượng; cuộn lên hay về đầu trang thì trả `false`.
 */
export function useThuGonKhiCuon(nguong = 160): boolean {
  const [gon, setGon] = useState(false);

  useEffect(() => {
    let truoc = window.scrollY;
    let khung = 0;
    const xem = () => {
      khung = 0;
      const y = window.scrollY;
      if (Math.abs(y - truoc) < 12) return;
      setGon(y > nguong && y > truoc);
      truoc = y;
    };
    const khiCuon = () => {
      if (!khung) khung = window.requestAnimationFrame(xem);
    };
    window.addEventListener("scroll", khiCuon, { passive: true });
    return () => {
      window.removeEventListener("scroll", khiCuon);
      window.cancelAnimationFrame(khung);
    };
  }, [nguong]);

  return gon;
}
