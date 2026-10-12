"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Đưa vé sang điện thoại khách (12/10/2026, chủ dự án: "sau khi có vé QR thì
 * đưa khách làm sao?").
 *
 * Một mã QR lớn mang **đường dẫn** tới vé: khách mở camera quét là thấy vé
 * trên máy mình, không cần cài gì. Kèm hai lối không cần khách đứng trước
 * quầy: sao chép đường dẫn, và nút chia sẻ của điện thoại (Zalo, Messenger,
 * tin nhắn… máy nào có gì hiện nấy). Không có cổng Zalo trả phí nào ở đây.
 */
export function DuaVeChoKhach({
  url,
  tieuDe,
  loiDan,
  chuChiaSe,
  className = "",
}: {
  url: string;
  tieuDe: string;
  loiDan: string;
  /** Câu đi kèm đường dẫn khi chia sẻ. */
  chuChiaSe: string;
  className?: string;
}) {
  const [qr, setQr] = useState("");
  const [daChep, setDaChep] = useState(false);
  const [coChiaSe, setCoChiaSe] = useState(false);

  useEffect(() => {
    let huy = false;
    void QRCode.toDataURL(url, { width: 560, margin: 2, errorCorrectionLevel: "M", color: { dark: "#183f34", light: "#ffffff" } }).then((src) => {
      if (!huy) setQr(src);
    });
    return () => {
      huy = true;
    };
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chỉ biết máy có nút chia sẻ sau khi chạy trên trình duyệt
    setCoChiaSe(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function chep() {
    try {
      await navigator.clipboard.writeText(url);
      setDaChep(true);
      window.setTimeout(() => setDaChep(false), 2500);
    } catch {
      window.prompt("Sao chép đường dẫn này:", url);
    }
  }

  return (
    <div className={`rounded-2xl border border-[#b8cfbf] bg-[#f3f8f5] p-4 ${className}`} data-testid="dua-ve-cho-khach" data-url={url}>
      <p className="text-sm font-black text-[#20342c]">{tieuDe}</p>
      <p className="mt-1 text-xs leading-5 text-[#4f6259]">{loiDan}</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- mã QR sinh tại chỗ
        <img src={qr} alt="Mã QR mở vé trên điện thoại khách" className="mx-auto mt-3 aspect-square w-full max-w-[16rem] rounded-xl bg-white p-2" />
      ) : (
        <div className="mx-auto mt-3 aspect-square w-full max-w-[16rem] rounded-xl bg-white" aria-hidden="true" />
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void chep()} className="min-h-11 rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm font-black text-[#35594b]">
          {daChep ? "Đã chép" : "Chép đường dẫn"}
        </button>
        {coChiaSe ? (
          <button
            type="button"
            onClick={() => void navigator.share({ title: "Vé Ninh Bình", text: chuChiaSe, url }).catch(() => undefined)}
            className="min-h-11 rounded-xl bg-[#183f34] px-3 text-sm font-black text-white"
          >
            Gửi Zalo, tin nhắn
          </button>
        ) : (
          <a
            href={`sms:?&body=${encodeURIComponent(`${chuChiaSe} ${url}`)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#183f34] px-3 text-sm font-black text-white"
          >
            Gửi tin nhắn
          </a>
        )}
      </div>
    </div>
  );
}
