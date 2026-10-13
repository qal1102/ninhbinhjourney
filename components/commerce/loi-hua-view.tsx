"use client";

import { useState } from "react";
import { SoDauView } from "@/components/commerce/so-dau-view";
import { LOI_HUA } from "@/domain/so-dau";

/**
 * Lời hứa giữ di sản Tràng An (13/10/2026). Cùng ý với Palau Pledge hay Tiaki
 * Promise của New Zealand, nhưng mời chứ không bắt: đọc năm điều, bấm "Tôi
 * hứa" thì được một dấu vào sổ. Không ghi tên, không gửi gì về máy chủ.
 */
export function LoiHuaView({ lang = "vi" }: { lang?: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [daHua, setDaHua] = useState(false);

  if (daHua) return <SoDauView lang={lang} dongMa="loi-hua" />;

  return (
    <section data-testid="loi-hua" className="mx-auto max-w-2xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">{t("Di sản thế giới UNESCO · 2014", "UNESCO World Heritage · 2014")}</p>
      <h1 className="font-display mt-2 text-4xl leading-tight text-[#183f34]">{t("Lời hứa giữ di sản Tràng An", "The Trang An heritage promise")}</h1>
      <p className="mt-3 leading-7 text-[#4a554e]">
        {t(
          "Tràng An là di sản thế giới hỗn hợp đầu tiên của Đông Nam Á. Người chèo đưa khách qua những hang đá có từ hàng vạn năm. Năm điều dưới đây giữ cho dòng sông còn như vậy cho người đến sau.",
          "Trang An was Southeast Asia's first mixed natural and cultural World Heritage site. Rowers take you through caves tens of thousands of years old. These five things keep the river as it is for those who come next.",
        )}
      </p>
      <ol className="mt-6 space-y-3">
        {LOI_HUA.map((dieu, i) => (
          <li key={dieu.vi} className="flex gap-3 rounded-2xl bg-white p-4">
            <span className="font-display text-2xl leading-none text-[#b23a24]">{i + 1}</span>
            <span className="leading-7 text-[#27362f]">{dieu[lang]}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setDaHua(true)}
        data-testid="nut-toi-hua"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#183f34] px-6 font-extrabold text-white transition hover:bg-[#12332a] sm:w-auto"
      >
        {t("Tôi hứa, đóng dấu vào sổ", "I promise, stamp my book")}
      </button>
      <p className="mt-3 text-xs text-[#6b786f]">
        {t("Không cần tên hay số điện thoại. Dấu lưu trên máy này.", "No name or phone number needed. The stamp is kept on this device.")}
      </p>
    </section>
  );
}
