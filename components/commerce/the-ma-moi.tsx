"use client";

import { useState } from "react";
import { chiaSe } from "@/components/commerce/chia-se";
import { SO_DAU } from "@/domain/so-dau";
import { duongDanMoi, LUOT_MOI_TOI_DA_MOT_NAM, PHAN_TRAM_GIAM_MA_MOI } from "@/domain/ma-moi";

/**
 * Mã mời bạn (13/10/2026, migration 125). Không gửi tin nhắn nào: khách tự
 * gửi đường dẫn qua Zalo, Messenger… bằng nút chia sẻ của điện thoại.
 */
export function TheMaMoi({
  ma,
  banDaMoi,
  lang = "vi",
  noiDaDi = [],
}: {
  ma: string;
  banDaMoi: number;
  lang?: "vi" | "en";
  /** Tên các điểm đã qua cổng (từ danh sách lượt đi): mỗi điểm một nút khoe kèm mã mời. */
  noiDaDi?: readonly string[];
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [daChep, setDaChep] = useState(false);
  if (!ma) return null;

  async function gui() {
    const url = duongDanMoi(window.location.origin, ma);
    const loi = t(
      `Mình vừa đi Ninh Bình. Mua vé bằng mã ${ma} được giảm ${PHAN_TRAM_GIAM_MA_MOI}%:`,
      `I just visited Ninh Binh. Use code ${ma} for ${PHAN_TRAM_GIAM_MA_MOI}% off your tickets:`,
    );
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ninh Bình Journey", text: loi, url });
        return;
      }
      await navigator.clipboard.writeText(`${loi} ${url}`);
      setDaChep(true);
    } catch {
      // Khách đóng hộp chia sẻ: không làm gì.
    }
  }

  return (
    <div data-testid="the-ma-moi" className="mt-5 rounded-2xl border border-dashed border-[#c89a55] bg-white p-4">
      <h3 className="font-bold text-[#183f34]">{t("Mời bạn đi Ninh Bình", "Invite a friend")}</h3>
      <p className="mt-1 text-sm leading-6 text-[#4a554e]">
        {t(
          `Bạn bè mua vé bằng mã này được giảm ${PHAN_TRAM_GIAM_MA_MOI}%. Mỗi người đã qua cổng, bạn được cộng một lượt tích (tối đa ${LUOT_MOI_TOI_DA_MOT_NAM} lượt một năm).`,
          `Friends get ${PHAN_TRAM_GIAM_MA_MOI}% off with this code. Each friend who passes the gate adds one visit to your count (up to ${LUOT_MOI_TOI_DA_MOT_NAM} a year).`,
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code data-testid="ma-moi" className="rounded-xl bg-[#f4f0e7] px-4 py-2 font-mono text-lg font-bold tracking-wider text-[#183f34]">{ma}</code>
        <button
          type="button"
          onClick={gui}
          className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-extrabold text-white transition hover:bg-[#12332a]"
        >
          {daChep ? t("Đã chép, dán gửi bạn", "Copied, paste to a friend") : t("Gửi cho bạn", "Send to a friend")}
        </button>
      </div>
      {(() => {
        const diem = SO_DAU.filter((d) => d.diemDen && noiDaDi.includes(d.ten.vi));
        if (diem.length === 0) return null;
        return (
          <div className="mt-3" data-testid="khoe-noi-da-di">
            <p className="text-sm text-[#4a554e]">{t("Khoe nơi bạn đã đi, kèm mã mời:", "Share a place you visited, with your code:")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {diem.map((d) => (
                <button
                  key={d.ma}
                  type="button"
                  onClick={() =>
                    void chiaSe(
                      `${window.location.origin}/moi/${ma}?d=${d.ma}`,
                      t(`Mình vừa đi ${d.ten.vi}. Bạn đi thử không? Mã ${ma} giảm 10%.`, `I just went to ${d.ten.en}. Fancy it? Code ${ma} takes 10% off.`),
                    )
                  }
                  className="inline-flex min-h-10 items-center rounded-full border border-[#183f34] px-4 text-xs font-extrabold text-[#183f34]"
                >
                  {t(`Khoe ${d.ten.vi}`, `Share ${d.ten.en}`)}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {banDaMoi > 0 ? (
        <p className="mt-2 text-sm font-bold text-[#8a5a1f]" data-testid="ban-da-moi">
          {t(`${banDaMoi} bạn đã đi nhờ mã của bạn, đã cộng ${banDaMoi} lượt.`, `${banDaMoi} ${banDaMoi === 1 ? "friend has" : "friends have"} visited with your code: ${banDaMoi} ${banDaMoi === 1 ? "visit" : "visits"} added.`)}
        </p>
      ) : null}
    </div>
  );
}
