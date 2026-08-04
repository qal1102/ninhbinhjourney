"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Chuyen trang mem: moi lan doi duong dan, noi dung moi mo dan len mot
 * chut thay vi nhay cai bup.
 *
 * Co tinh KHONG dung View Transitions API hay co experimental cua Next:
 * ca hai deu con thay doi va chi chay tren mot so trinh duyet. Cach nay
 * la CSS thuan + mot lop class, chay o moi noi, va neu JS chet thi trang
 * van hien binh thuong (khong bao gio ket o trang thai mo).
 *
 * prefers-reduced-motion: bo qua hoan toan, khong dung tay vao DOM.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // Lan dau tai trang da co man intro roi, khong chen them chuyen dong.
    if (first.current) {
      first.current = false;
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.remove("page-enter");
    // Doc offsetWidth de ep trinh duyet tinh lai layout, nho vay animation
    // duoc chay lai tu dau khi vao cung mot trang lan thu hai.
    void node.offsetWidth;
    node.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
