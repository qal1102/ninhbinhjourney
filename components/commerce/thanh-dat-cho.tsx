"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Thanh giá + "Giữ chỗ" dính đáy màn trên điện thoại (E1, chủ dự án chọn
 * 11/10/2026). Trước đây giá và nút nằm cuối trang gói, sau khoảng bốn màn
 * cuộn. Thanh hiện khi ảnh đầu đã cuộn qua, và ẩn khi khối giá chính
 * (`data-thanh-dat-moc="gia"`) đã vào màn để không có hai nút cùng lúc.
 *
 * Dải đồng ý quyền riêng tư còn hiện thì thanh nhường (CSS theo
 * `data-nbj-consent-banner-visible`); thanh hiện thì gắn
 * `data-thanh-dat-hien` lên <html> để nút "Hỏi AI" nhích lên trên thanh.
 */
export function ThanhDatCho({
  href,
  gia,
  nhanGia,
  nut,
  goiId,
}: {
  href: string;
  gia: string;
  nhanGia: string;
  nut: string;
  goiId: string;
}) {
  const [quaAnh, setQuaAnh] = useState(false);
  const [thayGia, setThayGia] = useState(false);
  const thanh = useRef<HTMLDivElement>(null);
  const hien = quaAnh && !thayGia;

  useEffect(() => {
    const anh = document.querySelector('[data-thanh-dat-moc="anh"]');
    const khoiGia = document.querySelector('[data-thanh-dat-moc="gia"]');
    const theoAnh = new IntersectionObserver(([e]) => setQuaAnh(!e.isIntersecting && e.boundingClientRect.top < 0));
    const theoGia = new IntersectionObserver(([e]) => setThayGia(e.isIntersecting), { threshold: 0.25 });
    if (anh) theoAnh.observe(anh);
    if (khoiGia) theoGia.observe(khoiGia);
    return () => {
      theoAnh.disconnect();
      theoGia.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (hien) {
      root.setAttribute("data-thanh-dat-hien", "true");
      root.style.setProperty("--nbj-thanh-dat", `${thanh.current?.offsetHeight ?? 76}px`);
    } else {
      root.removeAttribute("data-thanh-dat-hien");
      root.style.removeProperty("--nbj-thanh-dat");
    }
    return () => {
      root.removeAttribute("data-thanh-dat-hien");
      root.style.removeProperty("--nbj-thanh-dat");
    };
  }, [hien]);

  return (
    <div
      ref={thanh}
      data-testid="thanh-dat-cho"
      data-hien={hien ? "true" : undefined}
      aria-hidden={hien ? undefined : true}
      inert={!hien}
      className="thanh-dat-cho fixed inset-x-0 bottom-0 z-[1200] border-t border-[#e1dacb] bg-[#fbf8f1]/95 px-4 pt-3 text-[#151a17] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <p className="min-w-0 leading-tight">
          <span className="font-display block text-xl text-[#183f34]">{gia}</span>
          <span className="block text-xs text-[#59654b]">{nhanGia}</span>
        </p>
        <Link
          href={href}
          data-customer-track="package-checkout-sticky"
          data-customer-content-id={goiId}
          data-customer-content-type="package"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#d58c35] px-5 font-extrabold"
        >
          {nut}
        </Link>
      </div>
    </div>
  );
}
