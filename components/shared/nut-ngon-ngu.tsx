"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { KHOA_NGON_NGU, type NgonNgu } from "@/lib/ngon-ngu";

/** Ghi lựa chọn ngôn ngữ ở ngoài thành phần: sửa `document.cookie` là việc của trình xử lý, không phải của lượt dựng. */
function ghiNgonNgu(ke: NgonNgu) {
  try {
    window.localStorage.setItem(KHOA_NGON_NGU, ke);
  } catch {
    // Trình duyệt chặn bộ nhớ thì vẫn còn cookie và tham số đường dẫn.
  }
  document.cookie = `${KHOA_NGON_NGU}=${ke}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Nút VI/EN dùng chung cho web khách. Bấm là: ghi cookie (máy chủ đọc được ở
 * mọi trang sau), đổi `?lang=` trên đường dẫn và giữ nguyên mọi tham số khác
 * (`source`, `from`…), rồi trang dựng lại ngay bằng ngôn ngữ mới.
 */
export function NutNgonNgu({ lang, tone = "light" }: { lang: NgonNgu; tone?: "light" | "dark" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [dangDoi, batDauDoi] = useTransition();

  function doi(ke: NgonNgu) {
    if (ke === lang) return;
    ghiNgonNgu(ke);
    const moi = new URLSearchParams(params.toString());
    moi.set("lang", ke);
    batDauDoi(() => {
      router.replace(`${pathname}?${moi.toString()}${window.location.hash}`, { scroll: false });
    });
  }

  const vien = tone === "dark" ? "border-white/30 bg-black/25 text-white backdrop-blur" : "border-[#cfd8d2] bg-white text-[#183f34]";
  const dangChon = tone === "dark" ? "bg-white text-[#183f34]" : "bg-[#183f34] text-white";
  return (
    <div
      role="group"
      aria-label={lang === "en" ? "Language" : "Ngôn ngữ"}
      aria-busy={dangDoi}
      className={`inline-flex shrink-0 items-center rounded-full border p-1 text-xs font-extrabold ${vien}`}
    >
      {(["vi", "en"] as const).map((ma) => (
        <button
          key={ma}
          type="button"
          lang={ma}
          aria-pressed={lang === ma}
          onClick={() => doi(ma)}
          className={`min-h-9 min-w-10 rounded-full px-2.5 transition ${lang === ma ? dangChon : ""}`}
        >
          {ma.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
