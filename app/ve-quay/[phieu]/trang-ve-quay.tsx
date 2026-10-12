"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { LuuAnhVe } from "@/components/commerce/luu-anh-ve";
import { TheTichDiem } from "@/components/commerce/the-tich-diem";
import { xacNhanQuetAction } from "../actions";
import type { VeQuayHienThi } from "../ve-tu-phieu";

type Lang = "vi" | "en";

const TEN_VE: Record<string, { vi: string; en: string }> = {
  adult: { vi: "Người lớn", en: "Adult" },
  child: { vi: "Trẻ dưới 1m3", en: "Child under 1.3 m" },
};

function ngay(iso: string) {
  const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return k ? `${k[3]}/${k[2]}/${k[1]}` : iso;
}

function MaQr({ code, lang }: { code: string; lang: Lang }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let huy = false;
    void QRCode.toDataURL(code, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#183f34", light: "#ffffff" } }).then((url) => {
      if (!huy) setSrc(url);
    });
    return () => {
      huy = true;
    };
  }, [code]);
  if (!src) return <div className="mx-auto h-56 w-56 rounded-2xl bg-[#e7ebe8]" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- mã QR sinh tại chỗ
  return <img src={src} alt={lang === "en" ? `Ticket QR code ${code}` : `Mã QR vé ${code}`} className="mx-auto h-56 w-56 rounded-2xl bg-white p-2" />;
}

/**
 * Điện thoại khách sau khi quét mã ở quầy: tự xác nhận trả (giả lập), rồi hiện
 * vé để đưa nhân viên soát ở cổng. Mở lại đường dẫn này lúc nào cũng thấy vé.
 */
export function TrangVeQuay({
  ma,
  lang,
  veBanDau,
  choXacNhan,
  loi: loiBanDau,
}: {
  ma: string;
  lang: Lang;
  veBanDau: VeQuayHienThi | null;
  choXacNhan: { totalVnd: number; soKhach: number; expiresAt: number } | null;
  loi: string;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [ve, setVe] = useState(veBanDau);
  const [loi, setLoi] = useState(loiBanDau);
  const [vuaTra, setVuaTra] = useState(false);
  const daGui = useRef(false);

  async function xacNhan() {
    setLoi("");
    const kq = await xacNhanQuetAction(ma).catch(() => null);
    if (kq?.ok) {
      setVe(kq.ve);
      setVuaTra(true);
    } else {
      setLoi(kq?.message ?? t("Mạng đang chập chờn. Mời bạn bấm thử lại.", "The connection is unstable. Please try again."));
    }
  }

  useEffect(() => {
    if (ve || !choXacNhan || daGui.current) return;
    daGui.current = true;
    void xacNhan();
    // Chỉ chạy một lần khi trang mở; xacNhan đọc `ma` cố định của trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ve) {
    const tongLuot = ve.lines.reduce((tong, line) => tong + line.entriesAllowed, 0);
    return (
      <section data-testid="ve-quay-da-co" className="mx-auto max-w-md">
        <div className="rounded-3xl bg-[#183f34] p-7 text-center text-white">
          <div aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7c78d] text-3xl text-[#183f34]">
            {ve.daHuy ? "×" : "✓"}
          </div>
          <h1 className="font-display mt-4 text-3xl">
            {ve.daHuy
              ? t("Vé này đã huỷ", "This ticket was cancelled")
              : vuaTra
                ? t("Thanh toán thành công", "Payment successful")
                : ve.doan
                  ? t("Vé đoàn của bạn", "Your group ticket")
                  : ve.laVeMoi
                    ? t("Vé mời của bạn", "Your complimentary ticket")
                    : t("Vé của bạn", "Your ticket")}
          </h1>
          <p className="mt-2 text-white/75">
            {ve.siteName} · {tongLuot} {t("lượt vào", tongLuot === 1 ? "entry" : "entries")} ·{" "}
            {ve.laVeMoi ? t("vé mời, không thu tiền", "complimentary") : `${ve.totalVnd.toLocaleString("vi-VN")} đ`}
          </p>
          {ve.doan ? (
            <p className="mt-1 text-sm text-white/75">
              {t("Trưởng đoàn", "Group leader")} {ve.doan.leaderName}
              {ve.doan.companyName ? ` · ${ve.doan.companyName}` : ""}
              {ve.doan.discountVnd > 0 ? ` · ${t("ưu đãi", "discount")} ${ve.doan.discountVnd.toLocaleString("vi-VN")} đ` : ""}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-white/60">
            {t("Dùng trong ngày", "Valid on")} {ngay(ve.businessDate)} · {ve.saleCode}
          </p>
        </div>
        {ve.daHuy ? (
          <p className="mt-4 rounded-3xl bg-white p-5 text-sm leading-6 text-[#7a3a2f]">
            {t("Phiếu đã được quầy huỷ, mã dưới đây không còn qua cổng được. Cần vé thì mời bạn quay lại quầy.", "The desk cancelled this sale, so these codes no longer open the gate. Please return to the desk if you need a ticket.")}
          </p>
        ) : (
          <div className="mt-4 rounded-3xl bg-white p-5">
            <p className="font-bold text-[#183f34]">{t("Tới cổng, đưa màn hình này cho nhân viên quét", "At the gate, show this screen to be scanned")}</p>
            <p className="mt-1 text-sm leading-6 text-[#59654b]">
              {t("Mỗi mã cho đủ số người ghi bên dưới. Lưu ảnh vé hoặc giữ đường dẫn này để mở lại lúc mất sóng.", "Each code admits the number of people shown. Save the ticket image or keep this link to open it again offline.")}
            </p>
            <ul className="mt-5 space-y-6">
              {ve.lines.map((line) => (
                <li key={line.ticketCode} className="text-center">
                  <MaQr code={line.ticketCode} lang={lang} />
                  <code className="mt-2 block font-extrabold tracking-[0.06em] text-[#27362f]">{line.ticketCode}</code>
                  <p className="mt-1 text-sm text-[#59654b]">
                    {TEN_VE[line.product]?.[lang] ?? line.product} × {line.quantity} · {t("còn", "")} {Math.max(0, line.entriesAllowed - line.entriesUsed)}/{line.entriesAllowed}{" "}
                    {t("lượt", "entries left")}
                  </p>
                </li>
              ))}
            </ul>
            {ve.doan?.groupCode ? (
              <a
                href={`/doan/truong/${ve.doan.groupCode}`}
                data-testid="ve-quay-trang-truong-doan"
                className="mt-6 flex min-h-12 items-center justify-center rounded-full border-2 border-[#183f34] px-5 text-center font-extrabold text-[#183f34]"
              >
                {t("Trang trưởng đoàn: mã từng người, ai đã qua cổng", "Group leader page: personal codes, who has entered")}
              </a>
            ) : null}
            <LuuAnhVe
              orderCode={ve.saleCode}
              productName={ve.siteName}
              tickets={ve.lines.map((line) => ({
                ticketCode: line.ticketCode,
                siteId: "",
                validOn: ve.businessDate,
                entriesAllowed: line.entriesAllowed,
              }))}
              tone="light"
              lang={lang}
            />
          </div>
        )}
        {ve.daHuy ? null : (
          <TheTichDiem
            className="mt-4"
            codes={ve.lines.map((line) => line.ticketCode)}
            lang={lang}
            laTruongDoan={Boolean(ve.doan)}
          />
        )}
      </section>
    );
  }

  if (choXacNhan && !loi) {
    return (
      <section data-testid="ve-quay-dang-xac-nhan" className="mx-auto max-w-md rounded-3xl bg-white p-7 text-center" aria-busy="true">
        <div aria-hidden="true" className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#d9e3de] border-t-[#183f34] motion-reduce:animate-none" />
        <p className="font-display mt-5 text-2xl text-[#183f34]">{t("Đang xác nhận thanh toán…", "Confirming payment…")}</p>
        <p className="mt-2 text-[#59654b]">
          {choXacNhan.soKhach} {t("khách", choXacNhan.soKhach === 1 ? "guest" : "guests")} · {choXacNhan.totalVnd.toLocaleString("vi-VN")} đ
        </p>
        <p className="mt-4 text-xs leading-5 text-[#6b786f]">
          {t("Bản trình diễn: quét mã là coi như đã trả, không có tiền thật nào rời tài khoản của bạn.", "Demo: scanning counts as paid, and no real money leaves your account.")}
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-[#d7d5cd] bg-white p-7 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">Ninh Bình Journey</p>
      <p role="alert" className="mt-3 text-lg font-bold text-[#7a3a2f]">{loi}</p>
      {choXacNhan ? (
        <button type="button" onClick={() => void xacNhan()} className="mt-5 min-h-12 w-full rounded-full bg-[#183f34] px-6 font-extrabold text-white">
          {t("Thử lại", "Try again")}
        </button>
      ) : null}
    </div>
  );
}
