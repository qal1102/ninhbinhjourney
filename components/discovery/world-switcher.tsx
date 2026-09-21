"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Thanh chuyển thế giới — một khuôn dùng chung cho mọi chương ngoài trang chủ.
 *
 * ## Vấn đề nó chữa
 *
 * Chủ dự án mở web rồi nói đúng một câu: *"ở các mục này rất khó để back lại
 * hoặc rất khó để qua chỗ khác"*. Soi lại thì đúng:
 *
 * - Trang Trung thu chỉ có hai liên kết ở đầu trang (Hợp tác, Đặt chỗ) và một
 *   chữ "NINH BÌNH" — không ai biết chữ ấy là nút quay về.
 * - Trang Hợp tác cũng chỉ hai liên kết.
 * - Cả hai trang **cao trên 5.800px**. Cuộn xuống giữa chương là mất hẳn
 *   đường ra: phải cuộn ngược lên tận đỉnh mới có chỗ bấm.
 *
 * ## Cách làm
 *
 * Một thanh **dính** ở đầu trang, luôn thấy: mũi tên quay lại + tên chương
 * đang đứng + ba chương còn lại. Cuộn xuống thì thanh **co lại** cho gọn chứ
 * không biến mất — vì biến mất là quay về đúng cái bệnh đang chữa.
 *
 * Mỗi chương mang màu nền riêng của nó (`tone`), nên thanh không phá nhịp thị
 * giác của thế giới đang mở: Trung thu tối và ấm, Hợp tác sáng màu giấy.
 */

export type TheGioi = "travel" | "collaboration" | "seasonal" | "booking";

const TEN: Record<TheGioi, { vi: string; en: string }> = {
  travel: { vi: "Du lịch Ninh Bình", en: "Ninh Binh travel" },
  collaboration: { vi: "Hợp tác thương hiệu", en: "Brand collaborations" },
  seasonal: { vi: "Trung thu", en: "Mid-Autumn" },
  booking: { vi: "Đặt chỗ", en: "Reserve" },
};

const TEN_NGAN: Record<TheGioi, { vi: string; en: string }> = {
  travel: { vi: "Du lịch", en: "Travel" },
  collaboration: { vi: "Thương hiệu", en: "Brands" },
  seasonal: { vi: "Trung thu", en: "Mid-Autumn" },
  booking: { vi: "Đặt chỗ", en: "Reserve" },
};

const THU_TU: readonly TheGioi[] = ["travel", "collaboration", "seasonal", "booking"];

function duongDan(dich: TheGioi, lang: "vi" | "en", source: string) {
  const params = new URLSearchParams({ lang });
  if (source) params.set("source", source);
  const goc =
    dich === "travel"
      ? "/"
      : dich === "collaboration"
        ? "/collaborations"
        : dich === "seasonal"
          ? "/seasonal/mid-autumn"
          : "/packages";
  return `${goc}?${params.toString()}`;
}

export function WorldSwitcher({
  hienTai,
  lang,
  source = "",
  tone = "toi",
}: {
  hienTai: TheGioi;
  lang: "vi" | "en";
  source?: string;
  /** `toi` cho nền sẫm (Trung thu, Du lịch); `sang` cho nền giấy (Hợp tác). */
  tone?: "toi" | "sang";
}) {
  const [daCuon, setDaCuon] = useState(false);

  useEffect(() => {
    const doi = () => setDaCuon(window.scrollY > 120);
    doi();
    window.addEventListener("scroll", doi, { passive: true });
    return () => window.removeEventListener("scroll", doi);
  }, []);

  const toiMau = tone === "toi";
  const nen = toiMau
    ? daCuon
      ? "border-white/12 bg-[#0d1915]/92 backdrop-blur-md"
      : "border-white/12 bg-transparent"
    : daCuon
      ? "border-[#d8d0bd] bg-[#EDE7DA]/92 backdrop-blur-md"
      : "border-[#d8d0bd]/0 bg-transparent";
  const chuChinh = toiMau ? "text-[#fbf7ee]" : "text-[#20342c]";
  const chuMo = toiMau ? "text-white/62" : "text-[#20342c]/62";
  const vang = toiMau ? "text-[#e7b96a]" : "text-[#8a6a2f]";

  return (
    <div
      data-world-switcher={hienTai}
      className={`sticky top-0 z-[900] border-b transition-colors duration-300 motion-reduce:transition-none ${nen}`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center gap-3 px-5 transition-[padding] duration-300 motion-reduce:transition-none sm:px-8 ${
          daCuon ? "py-2" : "py-3.5"
        }`}
      >
        {/*
          Mũi tên quay lại, luôn hiện. Trước đây đường về duy nhất là chữ
          "NINH BÌNH" ở góc trái — đúng là một liên kết, nhưng không ai đọc
          một cái tên thương hiệu thành "bấm vào đây để quay lại".
        */}
        <Link
          href={duongDan("travel", lang, source)}
          // Giữ đúng kiểu chuyển cảnh của từng chiều: lùi về thế giới mặc
          // định là `nav-back`, sang một chương khác là `portal-enter`. Bản
          // đầu của thanh này quên cả hai, và bài page-continuity bắt được
          // ngay — chuyển trang mất hẳn hiệu ứng, cắt trắng rồi dựng lại.
          transitionTypes={["nav-back"]}
          data-world-back
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold ${chuChinh}`}
        >
          <span
            aria-hidden="true"
            className={`grid h-7 w-7 place-items-center rounded-full border ${
              toiMau ? "border-white/28" : "border-[#20342c]/25"
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </span>
          <span className={daCuon ? "hidden sm:inline" : ""}>
            {lang === "vi" ? "Về Ninh Bình" : "Back to Ninh Binh"}
          </span>
        </Link>

        <span aria-hidden="true" className={`hidden shrink-0 sm:inline ${chuMo}`}>
          /
        </span>

        {/* Ba chương còn lại, cuộn ngang được ở khổ hẹp. */}
        <nav
          aria-label={lang === "vi" ? "Chuyển chương" : "Switch chapter"}
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <span className="flex w-max items-center gap-4 font-display text-sm">
            {THU_TU.filter((t) => t !== "travel").map((t) => {
              const dangO = t === hienTai;
              return (
                <Link
                  key={t}
                  href={duongDan(t, lang, source)}
                  transitionTypes={["portal-enter"]}
                  aria-current={dangO ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 transition motion-reduce:transition-none ${
                    dangO
                      ? `border-current ${vang} font-bold`
                      : `border-transparent ${chuMo} hover:${chuChinh}`
                  }`}
                >
                  <span aria-hidden="true">{TEN_NGAN[t][lang]}</span>
                  <span className="sr-only">{TEN[t][lang]}</span>
                </Link>
              );
            })}
          </span>
        </nav>
      </div>
    </div>
  );
}
