"use client";

import { useState } from "react";

type Lang = "vi" | "en";

const RONG = 1500;
const CAO = 1000;

function taiAnh(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, loi) => {
    const anh = new Image();
    anh.onload = () => ok(anh);
    anh.onerror = loi;
    // Qua bộ tối ưu ảnh của Next để khỏi tải ảnh gốc vài MB; cùng nguồn nên canvas không bị khoá.
    anh.src = `/_next/image?url=${encodeURIComponent(src)}&w=1920&q=80`;
  });
}

function veDauMoc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ngay: string, nam: string, nhan: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-9 * Math.PI) / 180);
  ctx.fillStyle = "rgba(243, 238, 227, 0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b23a2a";
  ctx.fillStyle = "#b23a2a";
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  // Chữ chạy vòng quanh dấu.
  const vong = `NINH BÌNH JOURNEY · ${nhan.toUpperCase()} · `;
  ctx.font = `800 ${Math.round(r * 0.15)}px "Manrope Variable", Manrope, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const goc = (Math.PI * 2) / vong.length;
  for (let i = 0; i < vong.length; i++) {
    ctx.save();
    ctx.rotate(i * goc - Math.PI / 2);
    ctx.fillText(vong[i], 0, -r * 0.85 + r * 0.0);
    ctx.restore();
  }
  ctx.font = `800 ${Math.round(r * 0.34)}px "Manrope Variable", Manrope, "Segoe UI", sans-serif`;
  ctx.fillText(ngay, 0, -r * 0.02);
  ctx.font = `700 ${Math.round(r * 0.17)}px "Manrope Variable", Manrope, "Segoe UI", sans-serif`;
  ctx.fillText(nam, 0, r * 0.3);
  ctx.restore();
}

/**
 * Bưu thiếp kỷ niệm (H4, chủ dự án duyệt 11/10/2026; học từ \"virtual
 * postcards\" của ứng dụng NPS). Vẽ trên máy khách, từ dữ kiện thật: ảnh nơi
 * ấy, ngày qua cổng lần đầu, dấu mộc như trên hộ chiếu. Không gửi gì lên máy
 * chủ; khách lưu về máy hay chia sẻ qua ứng dụng trên điện thoại.
 */
export function BuuThiep({ ten, anh, lanDau, lang }: { ten: string; anh: string; lanDau: string; lang: Lang }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");

  async function tao() {
    setDang(true);
    setLoi("");
    try {
      await document.fonts?.ready;
      const canvas = document.createElement("canvas");
      canvas.width = RONG;
      canvas.height = CAO;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const hinh = await taiAnh(anh);
      // Ảnh phủ kín khung, cắt giữa.
      const tiLe = Math.max(RONG / hinh.width, CAO / hinh.height);
      const w = hinh.width * tiLe;
      const h = hinh.height * tiLe;
      ctx.drawImage(hinh, (RONG - w) / 2, (CAO - h) / 2, w, h);
      const toi = ctx.createLinearGradient(0, CAO * 0.45, 0, CAO);
      toi.addColorStop(0, "rgba(12, 28, 23, 0)");
      toi.addColorStop(1, "rgba(12, 28, 23, 0.82)");
      ctx.fillStyle = toi;
      ctx.fillRect(0, 0, RONG, CAO);
      // Viền giấy.
      ctx.strokeStyle = "rgba(243, 238, 227, 0.9)";
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, RONG - 18, CAO - 18);

      ctx.fillStyle = "#e7b96a";
      ctx.font = '800 30px "Manrope Variable", Manrope, "Segoe UI", sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t("GỬI TỪ NINH BÌNH", "GREETINGS FROM NINH BINH"), 70, CAO - 190);
      ctx.fillStyle = "#fbfaf6";
      ctx.font = '600 112px "Fraunces Variable", Fraunces, Georgia, serif';
      ctx.fillText(ten, 64, CAO - 80);

      const phan = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date(lanDau));
      const lay = (loai: string) => phan.find((p) => p.type === loai)?.value ?? "";
      veDauMoc(ctx, RONG - 210, 210, 150, `${lay("day")}.${lay("month")}`, lay("year"), t("Đã đến", "Visited"));

      const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
      if (!blob) throw new Error("blob");
      const tenTep = `buu-thiep-${ten.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-")}.jpg`;
      const tep = new File([blob], tenTep, { type: "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [tep] })) {
        await nav.share({ files: [tep], title: t(`Bưu thiếp ${ten}`, `Postcard from ${ten}`) }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = tenTep;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch {
      setLoi(t("Chưa tạo được bưu thiếp. Mời bạn thử lại.", "Could not make the postcard. Please try again."));
    } finally {
      setDang(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={tao}
        disabled={dang}
        data-testid="buu-thiep"
        className="mt-2 inline-flex min-h-10 items-center rounded-full border border-[#d58c35] px-3 text-xs font-extrabold text-[#9a6328] disabled:opacity-60"
      >
        {dang ? t("Đang vẽ…", "Drawing…") : t("Tạo bưu thiếp", "Make a postcard")}
      </button>
      {loi ? <p role="status" className="mt-1 text-xs text-[#8b3d31]">{loi}</p> : null}
    </>
  );
}
