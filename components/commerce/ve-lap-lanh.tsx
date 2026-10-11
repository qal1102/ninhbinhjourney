"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import QRCode from "qrcode";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";

type Lang = "vi" | "en";

/**
 * Một tấm vé QR như vé giấy có tem nhũ (D2, chủ dự án chọn 11/10/2026 từ trang
 * thử hiệu ứng). Nghiêng theo chuột hay ngón tay kéo ngang, lớp nhũ chạy theo
 * góc nhìn. Mã QR nằm TRÊN lớp nhũ và giữ nền trắng: máy ở cổng phải quét
 * được, nên không phủ gì lên mã.
 *
 * Dấu mộc chỉ hiện khi vé đã qua cổng thật (`entriesUsed` từ kho): vào hết
 * lượt thì "Đã qua cổng", mới vào một phần thì ghi số lượt. Vé vừa mua chưa
 * có dấu. Dấu đặt ở mép phần chữ, không đè lên mã, vì vé còn lượt vẫn phải
 * quét tiếp.
 */
export function VeLapLanh({
  ticketCode,
  siteName,
  detail,
  validOn,
  entriesAllowed,
  entriesUsed = 0,
  lang,
}: {
  ticketCode: string;
  siteName: string;
  detail: string;
  validOn: string;
  entriesAllowed: number;
  entriesUsed?: number;
  lang: Lang;
}) {
  const giamChuyenDong = useReducedMotion();
  const the = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");

  useEffect(() => {
    let conDung = true;
    void QRCode.toDataURL(ticketCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#183f34", light: "#ffffff" },
    })
      .then((url) => {
        if (conDung) setQr(url);
      })
      .catch(() => {
        if (conDung) setQr("");
      });
    return () => {
      conDung = false;
    };
  }, [ticketCode]);

  function nghieng(e: PointerEvent<HTMLDivElement>) {
    const el = the.current;
    if (!el || giamChuyenDong) return;
    if (e.pointerType !== "mouse" && e.buttons === 0) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--ve-ry", `${((nx - 0.5) * 14).toFixed(2)}deg`);
    el.style.setProperty("--ve-rx", `${((0.5 - ny) * 10).toFixed(2)}deg`);
    el.style.setProperty("--ve-nhu", `${Math.round(nx * 100)}%`);
    el.dataset.dangNghieng = "true";
  }

  function thoi() {
    const el = the.current;
    if (!el) return;
    el.style.removeProperty("--ve-ry");
    el.style.removeProperty("--ve-rx");
    el.style.removeProperty("--ve-nhu");
    delete el.dataset.dangNghieng;
  }

  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const daHet = entriesAllowed > 0 && entriesUsed >= entriesAllowed;
  const motPhan = entriesUsed > 0 && !daHet;
  const ngay = new Date(`${validOn}T00:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN");

  return (
    <div className="ve-lap-lanh-san">
      <div
        ref={the}
        className="ve-lap-lanh"
        data-testid="ve-lap-lanh"
        onPointerMove={nghieng}
        onPointerLeave={thoi}
        onPointerCancel={thoi}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") thoi();
        }}
      >
        <div className="ve-lap-lanh-chu">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-[#e7b96a]">
            Ninh Bình Journey · {siteName}
          </p>
          <code className="mt-2 block break-all text-lg font-extrabold tracking-[0.08em] text-[#f3eee3]">{ticketCode}</code>
          <p className="mt-2 text-sm text-white/75">
            {detail} · {entriesAllowed} {t("lượt vào", entriesAllowed > 1 ? "entries" : "entry")}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {t("Hiệu lực", "Valid on")} {ngay}
          </p>
        </div>
        <span className="ve-lap-lanh-nhu" aria-hidden="true" />
        <div className="ve-lap-lanh-ma">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={t(`Mã QR để quét ở cổng, mã vé ${ticketCode}`, `QR code for the gate, ticket ${ticketCode}`)}
              className="size-32 rounded-xl bg-white p-1.5"
            />
          ) : (
            <span className="grid size-32 place-items-center rounded-xl bg-white/10 text-xs text-white/60">{t("Đang tạo mã…", "Making code…")}</span>
          )}
        </div>
        {daHet || motPhan ? (
          <span className="ve-lap-lanh-dau" role="img" aria-label={daHet ? t(`Đã qua cổng ${siteName}`, `Used at ${siteName}`) : t(`Đã vào ${entriesUsed} trên ${entriesAllowed} lượt`, `${entriesUsed} of ${entriesAllowed} entries used`)}>
            <span aria-hidden="true">
              {daHet ? t("Đã qua cổng", "Used") : t("Đã vào", "Entered")}
              <b>{daHet ? siteName : `${entriesUsed}/${entriesAllowed}`}</b>
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
