"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LuuAnhVe, type VeDeLuu } from "@/components/commerce/luu-anh-ve";
import { DESTINATIONS } from "@/content/destinations";

/**
 * Màn hình trên điện thoại sau khi quét mã QR thanh toán.
 *
 * Dáng giống bước xác nhận của một ứng dụng ngân hàng: người nhận, số tiền,
 * một nút xác nhận. Bấm là đơn ghi "đã thanh toán bằng QR", vé hiện ngay ở
 * đây (khách thường mang chính chiếc điện thoại này tới cổng), và màn hình
 * đặt chỗ trên máy kia cũng tự chuyển sang vé.
 */

type Ve = VeDeLuu & { ticketId: string };

type KetQua = { orderCode: string; tickets: Ve[] };

function MaQrVe({ ticketCode }: { ticketCode: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let huy = false;
    void QRCode.toDataURL(ticketCode, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then((url) => {
      if (!huy) setSrc(url);
    });
    return () => {
      huy = true;
    };
  }, [ticketCode]);
  if (!src) return <div className="h-32 w-32 shrink-0 rounded-xl bg-[#e7ebe8]" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Mã QR vé ${ticketCode}`} className="h-32 w-32 shrink-0 rounded-xl bg-white p-1.5" />;
}

function dongHo(giay: number) {
  const g = Math.max(0, giay);
  return `${String(Math.floor(g / 60)).padStart(2, "0")}:${String(g % 60).padStart(2, "0")}`;
}

export function TrangQuetThanhToan({
  phieu,
  amountVnd,
  productName,
  expiresAt,
}: {
  phieu: string;
  amountVnd: number;
  productName: string;
  expiresAt: number;
}) {
  const [conLai, setConLai] = useState(() => Math.ceil((expiresAt - Date.now()) / 1000));
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const [ketQua, setKetQua] = useState<KetQua | null>(null);

  useEffect(() => {
    if (ketQua) return;
    const t = window.setInterval(() => setConLai(Math.ceil((expiresAt - Date.now()) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [expiresAt, ketQua]);

  async function xacNhan() {
    setDangGui(true);
    setLoi("");
    try {
      const res = await fetch("/api/customer-booking-qr-payments/xac-nhan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phieu }),
      });
      const data = (await res.json().catch(() => null)) as
        | { accepted: true; order: { code: string }; tickets: Ve[] }
        | { accepted: false; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.accepted) {
        setLoi((data && !data.accepted && data.error?.message) || "Chưa xác nhận được, mời bạn thử lại.");
        return;
      }
      setKetQua({ orderCode: data.order.code, tickets: data.tickets });
    } catch {
      setLoi("Mạng đang chập chờn, mời bạn bấm lại.");
    } finally {
      setDangGui(false);
    }
  }

  if (ketQua) {
    return (
      <section data-testid="qr-da-thanh-toan" className="mx-auto max-w-md">
        <div className="rounded-3xl bg-[#183f34] p-7 text-center text-white">
          <div aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7c78d] text-3xl text-[#183f34]">✓</div>
          <h1 className="font-display mt-4 text-3xl">Thanh toán thành công</h1>
          <p className="mt-2 text-white/75">{amountVnd.toLocaleString("vi-VN")} đ · {productName}</p>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/60">Mã đặt chỗ</p>
          <p className="font-display mt-1 text-3xl tracking-[0.06em] text-[#e7c78d]">{ketQua.orderCode}</p>
        </div>
        <div className="mt-4 rounded-3xl bg-white p-5">
          <p className="font-bold text-[#183f34]">Vé của bạn</p>
          <p className="mt-1 text-sm leading-6 text-[#59654b]">
            Lưu ảnh vé về máy, tới cổng mở ảnh cho nhân viên quét là vào. Màn hình đặt chỗ trên máy kia cũng đã hiện vé.
          </p>
          <ul className="mt-4 space-y-4">
            {ketQua.tickets.map((ve) => (
              <li key={ve.ticketId} className="flex items-center gap-4">
                <MaQrVe ticketCode={ve.ticketCode} />
                <div className="min-w-0">
                  <p className="font-bold text-[#183f34]">
                    {DESTINATIONS.find((item) => item.id === ve.siteId)?.name.vi ?? "Điểm tham quan"}
                  </p>
                  <code className="mt-1 block break-all font-extrabold tracking-[0.06em] text-[#27362f]">{ve.ticketCode}</code>
                  <p className="mt-1 text-sm text-[#59654b]">{ve.entriesAllowed} lượt vào</p>
                </div>
              </li>
            ))}
          </ul>
          <LuuAnhVe orderCode={ketQua.orderCode} productName={productName} tickets={ketQua.tickets} tone="light" />
          <Link href="/ho-so" className="mt-4 block text-center text-sm font-bold text-[#356957] underline underline-offset-4">
            Xem hộ chiếu Ninh Bình: đi đủ các vùng để mở quà
          </Link>
        </div>
      </section>
    );
  }

  const hetHan = conLai <= 0;
  return (
    <section data-testid="qr-xac-nhan" className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_rgba(24,63,52,0.12)]">
        <div className="bg-[#183f34] px-6 py-5 text-white">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">Chuyển khoản qua mã QR</p>
          <p className="mt-1 text-sm text-white/70">Ninh Bình Journey · bản trình diễn</p>
        </div>
        <dl className="divide-y divide-[#e7ebe8] px-6">
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-[#59654b]">Người nhận</dt>
            <dd className="text-right font-bold text-[#183f34]">Ninh Bình Journey</dd>
          </div>
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-[#59654b]">Nội dung</dt>
            <dd className="text-right font-bold text-[#183f34]">{productName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt className="text-[#59654b]">Số tiền</dt>
            <dd className="font-display text-3xl text-[#183f34]">{amountVnd.toLocaleString("vi-VN")} đ</dd>
          </div>
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-[#59654b]">Giữ chỗ còn</dt>
            <dd className={`font-bold ${hetHan ? "text-[#9a3b2f]" : "text-[#183f34]"}`}>{hetHan ? "Đã hết hạn" : dongHo(conLai)}</dd>
          </div>
        </dl>
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={xacNhan}
            disabled={dangGui || hetHan}
            className="min-h-14 w-full rounded-full bg-[#d58c35] px-6 text-lg font-extrabold text-[#151a17] disabled:opacity-50"
          >
            {dangGui ? "Đang chuyển…" : hetHan ? "Lượt giữ chỗ đã hết hạn" : "Xác nhận chuyển khoản"}
          </button>
          {loi ? <p role="alert" className="mt-3 text-sm text-[#9a3b2f]">{loi}</p> : null}
          <p className="mt-4 text-xs leading-5 text-[#6b786f]">
            Đây là bản trình diễn: bấm xác nhận là đơn được ghi đã thanh toán, không có tiền thật nào rời tài khoản của bạn.
          </p>
        </div>
      </div>
    </section>
  );
}
