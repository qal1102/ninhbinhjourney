"use client";

import Link from "next/link";
import { useMidAutumnSeasonOpen } from "@/lib/seasonal/use-mid-autumn-season";

type Language = "en" | "vi";

const COPY: Record<Language, { eyebrow: string; body: string; cta: string }> = {
  vi: {
    eyebrow: "Mùa trăng 2026 đã khép",
    body: "Rằm tháng Tám qua ngày 25/09, Bàn Trăng khép ngày 27/09 — trang này giờ là nơi xem lại mùa, hẹn bạn mùa trăng 2027.",
    cta: "Xem các gói đang mở",
  },
  en: {
    eyebrow: "The 2026 moon season has closed",
    body: "The 25 Sep full moon has passed and the Moon Table closed on 27 Sep — this page now holds the season's record, see you in 2027.",
    cta: "Browse open packages",
  },
};

/**
 * A15-TRUNG-THU-01. Trang `/seasonal/mid-autumn` phải vẫn mở được sau khi
 * mùa khép (không 404) nhưng phải "mở đầu" bằng đúng một lời nói thẳng --
 * đây là khối đó, đặt ngay dưới thanh điều hướng của trang, trước cả tiêu
 * đề "Ba đêm, một dòng Ngô Đồng". Trống hẳn (không chiếm chỗ, không giật
 * layout) khi mùa còn mở.
 *
 * `useMidAutumnSeasonOpen` mặc định "còn mở" phía máy chủ nên không lệch
 * hydrate trước 27/09; sau khi mount, trình duyệt tự tính lại theo đồng hồ
 * thật của khách.
 */
export function MidAutumnSeasonBanner({ lang, source }: { lang: Language; source: string }) {
  const seasonOpen = useMidAutumnSeasonOpen();
  if (seasonOpen) return null;

  const copy = COPY[lang];
  const params = new URLSearchParams({ lang });
  if (source) params.set("source", source);

  return (
    <div
      data-mid-autumn-season-closed
      className="border-b border-[#E7B96A]/35 bg-[#0d1915] px-5 py-4 text-[#fbf7ee] sm:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-white/82">
          <span className="mr-2 inline-block text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">
            {copy.eyebrow}
          </span>
          <span className="block sm:inline">{copy.body}</span>
        </p>
        <Link
          href={`/packages?${params.toString()}`}
          transitionTypes={["portal-enter"]}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#E7B96A]/60 px-5 text-sm font-bold text-[#E7B96A] transition hover:bg-[#E7B96A]/10"
        >
          {copy.cta}
        </Link>
      </div>
    </div>
  );
}
