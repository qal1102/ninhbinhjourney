"use client";

import { VeLapLanh } from "@/components/commerce/ve-lap-lanh";

type Lang = "vi" | "en";

/**
 * Một mã cho cả ngày (H6, 11/10/2026; học thẻ lên tàu gộp chặng của hãng
 * bay). Gói đi từ hai nơi trở lên thì đặt mã đơn lên đầu: tới cổng nào cũng
 * đưa đúng một mã, cổng tự tìm vé của đơn ở nơi ấy. Từng vé riêng vẫn nằm
 * bên dưới, ai muốn đưa vé lẻ vẫn được.
 */
export function MaCaNgay({
  maDon,
  noi,
  ngayDi,
  soLuot,
  lang,
  toi = false,
}: {
  maDon: string;
  noi: string[];
  ngayDi: string;
  soLuot: number;
  lang: Lang;
  toi?: boolean;
}) {
  if (noi.length < 2) return null;
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  return (
    <section data-testid="ma-ca-ngay" className="mt-8">
      <p className={`text-xs font-extrabold uppercase tracking-[0.18em] ${toi ? "text-white/55" : "text-[#557568]"}`}>{t("Một mã cho cả ngày", "One code for the whole day")}</p>
      <p className={`mt-1 text-sm leading-6 ${toi ? "text-white/75" : "text-[#4e5f57]"}`}>
        {t(
          `Tới ${noi.join(", ")}: cổng nào cũng quét mã này, không cần lục từng vé.`,
          `At ${noi.join(", ")}: every gate scans this one code, no need to find each ticket.`,
        )}
      </p>
      <div className="mt-3">
        <VeLapLanh
          ticketCode={maDon}
          siteName={t(`Cả ngày · ${noi.length} nơi`, `All day · ${noi.length} places`)}
          detail={t("Quét ở mọi cổng trong gói", "Scan at every gate")}
          validOn={ngayDi}
          entriesAllowed={soLuot}
          lang={lang}
        />
      </div>
    </section>
  );
}
