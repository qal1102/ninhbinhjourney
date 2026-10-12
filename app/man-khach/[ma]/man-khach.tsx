"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { trangThaiManKhachAction } from "../actions";

export type ThongTinManKhach = {
  coSo: string;
  soKhach: number;
  nguoiLon: number;
  treEm: number;
  tongVnd: number;
  hetLuc: number;
  urlQuet: string;
  doan: { truongDoan: string; congTy: string | null; uuDai: number } | null;
};

function dongHo(giay: number) {
  return `${String(Math.floor(giay / 60)).padStart(2, "0")}:${String(giay % 60).padStart(2, "0")}`;
}

export function ManKhach({ ma, thongTin, loi }: { ma: string; thongTin: ThongTinManKhach | null; loi: string }) {
  const [qr, setQr] = useState("");
  const [conGiay, setConGiay] = useState(() => (thongTin ? Math.max(0, Math.ceil((thongTin.hetLuc - Date.now()) / 1000)) : 0));
  const [daTra, setDaTra] = useState<string | null>(null);

  useEffect(() => {
    if (!thongTin) return;
    let huy = false;
    void QRCode.toDataURL(thongTin.urlQuet, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#0f2c24", light: "#ffffff" } }).then(
      (url) => {
        if (!huy) setQr(url);
      },
    );
    return () => {
      huy = true;
    };
  }, [thongTin]);

  useEffect(() => {
    if (!thongTin || daTra) return;
    let huy = false;
    const dem = window.setInterval(() => setConGiay(Math.max(0, Math.ceil((thongTin.hetLuc - Date.now()) / 1000))), 1000);
    const hoi = window.setInterval(async () => {
      const kq = await trangThaiManKhachAction(ma).catch(() => null);
      if (!huy && kq?.daTra) {
        huy = true;
        setDaTra(kq.saleCode ?? "");
      }
    }, 2000);
    return () => {
      huy = true;
      window.clearInterval(dem);
      window.clearInterval(hoi);
    };
  }, [ma, thongTin, daTra]);

  if (!thongTin) {
    return (
      <div className="mx-auto mt-20 max-w-xl rounded-3xl bg-white/10 p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Ninh Bình Journey</p>
        <p role="alert" className="mt-4 text-xl font-bold">{loi}</p>
      </div>
    );
  }

  if (daTra !== null) {
    return (
      <section data-testid="man-khach-da-tra" className="mx-auto mt-10 max-w-2xl text-center" role="status">
        <div aria-hidden="true" className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#e7c78d] text-6xl font-black text-[#0f2c24]">
          ✓
        </div>
        <h1 className="font-display mt-6 text-5xl sm:text-6xl">Thanh toán thành công</h1>
        <p className="mt-4 text-xl text-white/80">
          Vé {thongTin.doan ? "đoàn " : ""}đã hiện trên điện thoại vừa quét. Tới cổng, đưa màn hình ấy cho nhân viên soát.
        </p>
        <p className="mt-3 text-white/55">
          {thongTin.coSo} · {thongTin.soKhach} khách · {thongTin.tongVnd.toLocaleString("vi-VN")} đ{daTra ? ` · ${daTra}` : ""}
        </p>
        <p className="mt-10 text-lg font-bold text-[#e7c78d]">Cảm ơn quý khách. Chúc một ngày đẹp ở Ninh Bình.</p>
      </section>
    );
  }

  const hetHan = conGiay <= 0;
  return (
    <section data-testid="man-khach-cho-quet" className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#e7c78d]">{thongTin.coSo}</p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-6xl">
          {hetHan ? "Mã đã hết thời gian giữ chỗ" : "Mời quý khách quét mã để thanh toán"}
        </h1>
        <dl className="mt-8 grid max-w-lg gap-3 text-lg">
          <div className="flex justify-between gap-4 border-b border-white/15 pb-3">
            <dt className="text-white/65">{thongTin.doan ? "Vé đoàn" : "Số vé"}</dt>
            <dd className="font-bold">
              {thongTin.doan
                ? `${thongTin.soKhach} người`
                : [thongTin.nguoiLon ? `${thongTin.nguoiLon} người lớn` : "", thongTin.treEm ? `${thongTin.treEm} trẻ em` : ""].filter(Boolean).join(", ")}
            </dd>
          </div>
          {thongTin.doan ? (
            <div className="flex justify-between gap-4 border-b border-white/15 pb-3">
              <dt className="text-white/65">Trưởng đoàn</dt>
              <dd className="text-right font-bold">
                {thongTin.doan.truongDoan}
                {thongTin.doan.congTy ? <span className="block text-base font-normal text-white/65">{thongTin.doan.congTy}</span> : null}
              </dd>
            </div>
          ) : null}
          {thongTin.doan && thongTin.doan.uuDai > 0 ? (
            <div className="flex justify-between gap-4 border-b border-white/15 pb-3">
              <dt className="text-white/65">Ưu đãi công ty</dt>
              <dd className="font-bold">{thongTin.doan.uuDai}%</dd>
            </div>
          ) : null}
          <div className="flex items-end justify-between gap-4 pt-2">
            <dt className="text-white/65">Cần thanh toán</dt>
            <dd className="text-4xl font-black tabular-nums text-[#e7c78d] sm:text-5xl">{thongTin.tongVnd.toLocaleString("vi-VN")} đ</dd>
          </div>
        </dl>
        <p
          className={`mt-8 inline-flex items-center gap-3 rounded-2xl px-5 py-3 text-xl font-black tabular-nums ${hetHan ? "bg-[#7a3a2f]" : "bg-white/10"}`}
          aria-live="off"
        >
          <span>{hetHan ? "Mời nhân viên quầy tạo mã mới" : "Giữ chỗ còn"}</span>
          {hetHan ? null : <span data-testid="man-khach-dong-ho">{dongHo(conGiay)}</span>}
        </p>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/55">
          Mở camera điện thoại, quét mã bên cạnh. Thanh toán xong, vé hiện ngay trên điện thoại của quý khách.
          Bản trình diễn: quét mã là coi như đã trả.
        </p>
      </div>
      <div className={`mx-auto rounded-[2rem] bg-white p-5 ${hetHan ? "opacity-30" : ""}`}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- mã QR sinh tại chỗ
          <img src={qr} alt="Mã QR thanh toán" className="h-72 w-72 sm:h-96 sm:w-96" />
        ) : (
          <div className="h-72 w-72 rounded-2xl bg-[#e7ebe8] sm:h-96 sm:w-96" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
