"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const WORD_STAGGER_MS = 32;
// Tu thu 11 tro di giu nguyen do tre cua tu thu 10 -- tranh tieu de dai
// (vd cau trich dan bao chi) phai cho hang giay moi hien het.
const MAX_STAGGERED_WORDS = 10;

/**
 * Tieu de chinh cua mot khoi lon: moi TU hien rieng, troi len tu duoi mot
 * lan che (mask reveal), so le nhau ~32ms.
 *
 * Khac voi <Reveal> (lam mo ca khoi cung luc, dung cho moi khoi tren
 * trang) -- component nay CHI danh cho tieu de lon nhat cua mot so it
 * khoi trang chu, la dau hieu nhan dang thi giac ro nhat cua web hang
 * sang, va khong lam mo ca doan van dai (se roi mat va cham).
 *
 * KHONG dung cho .opening-sequence/.introWords -- do la chuoi khoa,
 * co bai kiem thu rieng, xem "Intro Rule" trong UI_UX_RULES.md.
 *
 * Vi sao tach tu (word) thay vi tach DONG (line) that: tach dong that can
 * do dac diem ngat dong luc runtime (thay doi theo be rong man hinh),
 * doi hoi mot thu vien do van ban (SplitText cua GSAP la plugin tra phi,
 * khong co san trong repo) hoac tu do bang Range.getClientRects() va
 * tinh lai khi resize. Tach tu la CSS thuan, tu thich ung moi be rong,
 * khong them thu vien nao -- va vi moi tu deu troi len giong het nhau,
 * mat nguoi khong nhan ra ranh gioi dong o dau, hieu ung doc gan nhu
 * giong tach dong that.
 */
export function RevealHeading({
  text,
  as = "h2",
  className = "",
  delayMs = 0,
}: {
  text: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const words = text.split(" ");
  /*
   * BUG THAT bat duoc qua chup anh: dau cach dat BEN TRONG
   * .reveal-word-inner (display: inline-block) bi trinh duyet cat mat --
   * mot the inline-block tu lap mot ngu canh dinh dang rieng, va khoang
   * trang o MEP ngu canh do bi xen. Ket qua la chu dinh lien nhau, khong
   * doc noi (da chup duoc, xem verify2.mjs/heading-0.png).
   * Sua: dua dau cach ra NGOAI, thanh mot node van ban rieng nam GIUA hai
   * the mask -- luc do no nam trong dong chay binh thuong cua <h2>, khong
   * bi inline-block nao nuot mat, va van la diem ngat dong hop le.
   */
  const content: ReactNode = words.flatMap((word, index) => {
    const maskedWord = (
      <span className="reveal-word-mask" key={`word-${index}`}>
        <span
          className={`reveal-word-inner ${visible ? "is-visible" : ""}`}
          style={{
            transitionDelay: `${delayMs + Math.min(index, MAX_STAGGERED_WORDS) * WORD_STAGGER_MS}ms`,
          }}
        >
          {word}
        </span>
      </span>
    );
    return index < words.length - 1 ? [maskedWord, " "] : [maskedWord];
  });

  // Nhanh cu the theo tung the thay vi createElement(as, ...): dynamic
  // tag qua createElement khien react-hooks/refs khong the biet chac `as`
  // la mot the host (h1/h2/h3) hay mot component tuy y doc `props.ref`
  // luc render -- lint chan. Viet JSX rieng cho tung nhanh thi ref gan
  // truc tiep vao mot the chu thuong, lint nhan dung day la the host.
  if (as === "h1") {
    return (
      <h1 ref={ref} className={className}>
        {content}
      </h1>
    );
  }
  if (as === "h3") {
    return (
      <h3 ref={ref} className={className}>
        {content}
      </h3>
    );
  }
  return (
    <h2 ref={ref} className={className}>
      {content}
    </h2>
  );
}
