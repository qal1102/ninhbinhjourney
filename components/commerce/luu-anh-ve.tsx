"use client";

import QRCode from "qrcode";
import { useState, useSyncExternalStore } from "react";
import { DESTINATIONS } from "@/content/destinations";

/**
 * Lưu vé về máy thành MỘT tấm ảnh.
 *
 * Ngoài đời khách làm đúng một việc: lưu mã QR vào thư viện ảnh, tới cổng mở
 * ảnh ra cho nhân viên quét. Chụp màn hình thì hay bị cắt mất nửa mã, mất mã
 * đặt chỗ. Nên dựng sẵn một tấm ảnh gọn: tên gói, ngày đi, mã đặt chỗ, và mỗi
 * vé một mã QR đủ lớn để máy quét đọc.
 *
 * Trên điện thoại có "chia sẻ tệp" (Android Chrome, iPhone Safari) thì có thêm
 * nút gửi ảnh sang Zalo hay tin nhắn; khỏi phải đấu nối Zalo trả phí. Máy
 * không có thì chỉ tải ảnh xuống.
 *
 * Nội dung mã QR giữ đúng mã vé trần, y như mã QR trên trang; máy ở cổng đọc
 * đúng chuỗi ấy.
 */

export type VeDeLuu = {
  ticketCode: string;
  siteId: string;
  validOn: string;
  entriesAllowed: number;
};

function tenDiem(siteId: string) {
  return DESTINATIONS.find((item) => item.id === siteId)?.name.vi ?? "Điểm tham quan";
}

// Máy có chia sẻ được tệp ảnh không. Đo một lần, đọc qua
// useSyncExternalStore để máy chủ và trình duyệt không vẽ lệch nhau.
let coChiaSe: boolean | null = null;
function doChiaSe() {
  if (coChiaSe === null) {
    try {
      const thu = new File([new Blob(["x"], { type: "image/png" })], "thu.png", { type: "image/png" });
      coChiaSe = Boolean(navigator.canShare?.({ files: [thu] }));
    } catch {
      coChiaSe = false;
    }
  }
  return coChiaSe;
}
const khongDoi = () => () => {};

function taiAnh(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const anh = new Image();
    anh.onload = () => resolve(anh);
    anh.onerror = reject;
    anh.src = src;
  });
}

async function veAnhVe(input: {
  orderCode: string;
  productName: string;
  tickets: VeDeLuu[];
}): Promise<Blob> {
  const rong = 1080;
  const le = 72;
  const oQr = 360;
  const buoc = oQr + 70;
  const cao = 440 + input.tickets.length * buoc + 110;
  const canvas = document.createElement("canvas");
  canvas.width = rong;
  canvas.height = cao;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, rong, cao);
  ctx.fillStyle = "#183f34";
  ctx.fillRect(0, 0, rong, 360);

  ctx.fillStyle = "#e7c78d";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("NINH BÌNH JOURNEY · VÉ VÀO CỔNG", le, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px Georgia, serif";
  const ten = input.productName.length > 34 ? `${input.productName.slice(0, 33)}…` : input.productName;
  ctx.fillText(ten, le, 180);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText("Mã đặt chỗ", le, 262);
  ctx.fillStyle = "#e7c78d";
  ctx.font = "800 48px ui-monospace, monospace";
  ctx.fillText(input.orderCode, le, 318);

  let y = 440;
  for (const ve of input.tickets) {
    const qr = await taiAnh(
      await QRCode.toDataURL(ve.ticketCode, {
        margin: 2,
        width: oQr,
        errorCorrectionLevel: "M",
        color: { dark: "#10231d", light: "#ffffff" },
      }),
    );
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(le - 12, y - 12, rong - 2 * le + 24, oQr + 24);
    ctx.drawImage(qr, le, y, oQr, oQr);
    const x = le + oQr + 40;
    ctx.fillStyle = "#183f34";
    ctx.font = "700 38px system-ui, sans-serif";
    ctx.fillText(tenDiem(ve.siteId), x, y + 70);
    ctx.fillStyle = "#27362f";
    ctx.font = "800 36px ui-monospace, monospace";
    ctx.fillText(ve.ticketCode, x, y + 140);
    ctx.fillStyle = "#59654b";
    ctx.font = "400 30px system-ui, sans-serif";
    ctx.fillText(`${ve.entriesAllowed} lượt vào`, x, y + 200);
    ctx.fillText(
      `Ngày ${new Date(`${ve.validOn}T00:00:00`).toLocaleDateString("vi-VN")}`,
      x,
      y + 250,
    );
    y += buoc;
  }

  ctx.fillStyle = "#59654b";
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillText("Tới cổng, mở ảnh này cho nhân viên quét mã là vào.", le, cao - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png");
  });
}

export function LuuAnhVe({
  orderCode,
  productName,
  tickets,
  tone = "dark",
}: {
  orderCode: string;
  productName: string;
  tickets: VeDeLuu[];
  tone?: "dark" | "light";
}) {
  const chiaSeDuoc = useSyncExternalStore(khongDoi, doChiaSe, () => false);
  const [dangLam, setDangLam] = useState(false);
  const [loi, setLoi] = useState("");
  const tenTep = `ve-${orderCode}.png`;

  async function luu() {
    setDangLam(true);
    setLoi("");
    try {
      const blob = await veAnhVe({ orderCode, productName, tickets });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tenTep;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setLoi("Máy chưa lưu được ảnh. Bạn chụp màn hình phần vé giúp em ạ.");
    } finally {
      setDangLam(false);
    }
  }

  async function guiDi() {
    setDangLam(true);
    setLoi("");
    try {
      const blob = await veAnhVe({ orderCode, productName, tickets });
      const tep = new File([blob], tenTep, { type: "image/png" });
      await navigator.share({ files: [tep], title: `Vé ${orderCode}` });
    } catch (error) {
      // Khách tự bấm huỷ bảng chia sẻ thì không phải lỗi.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setLoi("Chưa gửi được ảnh. Bạn bấm \"Lưu ảnh vé\" rồi gửi từ thư viện ảnh giúp em ạ.");
      }
    } finally {
      setDangLam(false);
    }
  }

  const nutChinh = tone === "dark"
    ? "bg-[#e7c78d] text-[#183f34]"
    : "bg-[#183f34] text-white";
  const nutPhu = tone === "dark"
    ? "border border-white/30 text-white"
    : "border border-[#183f34]/30 text-[#183f34]";

  return (
    <div data-testid="luu-anh-ve" className="mt-4 grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={luu}
        disabled={dangLam}
        className={`min-h-12 rounded-full px-5 text-sm font-extrabold disabled:opacity-60 ${nutChinh}`}
      >
        {dangLam ? "Đang dựng ảnh vé…" : "Lưu ảnh vé về máy"}
      </button>
      {chiaSeDuoc ? (
        <button
          type="button"
          onClick={guiDi}
          disabled={dangLam}
          className={`min-h-12 rounded-full px-5 text-sm font-extrabold disabled:opacity-60 ${nutPhu}`}
        >
          Gửi ảnh vé qua Zalo…
        </button>
      ) : null}
      {loi ? <p role="alert" className="text-sm sm:col-span-2">{loi}</p> : null}
    </div>
  );
}
