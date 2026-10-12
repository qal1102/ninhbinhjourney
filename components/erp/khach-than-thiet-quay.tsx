"use client";

import { useState, useTransition } from "react";
import type { CounterSaleReceipt } from "@/domain/erp-counter-sale";
import type { VoucherQuay } from "@/domain/khach-than-thiet";
import { doiVoucherAction, ganSoChoPhieuAction, traVoucherAction } from "@/app/erp/khach-than-thiet-actions";

function ngay(iso: string) {
  const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return k ? `${k[3]}/${k[2]}/${k[1]}` : iso;
}

function khoaYeuCau() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `voucher-${crypto.randomUUID()}`
    : `voucher-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Đổi quà khách thân thiết ở quầy (migration 119). Khách đưa mã `VC-…` trên
 * điện thoại: quà lưu niệm thì bấm "Đã trao quà"; vé miễn phí thì máy cấp
 * đúng một vé mời 0 đ và hiện phiếu như mọi phiếu khác.
 */
export function DoiVoucherQuay({
  siteId,
  onReceipt,
}: {
  siteId: string;
  onReceipt: (receipt: CounterSaleReceipt) => void;
}) {
  const [ma, setMa] = useState("");
  const [voucher, setVoucher] = useState<VoucherQuay | null>(null);
  const [thongBao, setThongBao] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [khoa, setKhoa] = useState(khoaYeuCau);
  const [pending, start] = useTransition();

  function tra() {
    setThongBao(null);
    setVoucher(null);
    start(async () => {
      const kq = await traVoucherAction({ siteId, code: ma });
      if (kq.ok) setVoucher(kq.voucher);
      else setThongBao({ tone: "error", text: kq.message });
    });
  }

  function doi() {
    if (!voucher) return;
    setThongBao(null);
    start(async () => {
      const kq = await doiVoucherAction({ siteId, code: voucher.code, requestKey: khoa });
      if (kq.ok) {
        setVoucher(kq.voucher);
        setThongBao({ tone: "ok", text: kq.message });
        setKhoa(khoaYeuCau());
        if (kq.receipt) onReceipt(kq.receipt);
      } else {
        setThongBao({ tone: "error", text: kq.message });
      }
    });
  }

  const doiDuoc = voucher && voucher.status === "issued" && !voucher.expired;
  return (
    <details className="rounded-xl border border-[#e7c78d] bg-[#fff8eb] p-3 text-sm" data-testid="doi-voucher-quay" data-chi="doi-voucher" data-chi-loi="Khách đưa mã VC-… trên điện thoại: gõ mã, bấm Tra rồi Đổi.">
      <summary className="flex min-h-11 cursor-pointer items-center font-black text-[#6b4a14]">
        Đổi quà khách thân thiết (mã VC-…)
      </summary>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          tra();
        }}
      >
        <label className="sr-only" htmlFor="ma-voucher-quay">Mã voucher</label>
        <input
          id="ma-voucher-quay"
          value={ma}
          onChange={(e) => setMa(e.target.value.toUpperCase())}
          placeholder="VC-XXXXXXXX"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d9c6a0] bg-white px-3 font-mono font-bold uppercase text-[#20342c]"
        />
        <button
          type="submit"
          disabled={pending || ma.trim().length < 11}
          className="min-h-11 rounded-lg bg-[#183f34] px-4 font-black text-white disabled:opacity-50"
        >
          Tra
        </button>
      </form>
      {voucher ? (
        <div className="mt-3 rounded-lg bg-white p-3" data-testid="ket-qua-voucher">
          <p className="font-black text-[#20342c]">{voucher.label}</p>
          <p className="mt-1 text-xs leading-5 text-[#5c6f67]">
            {voucher.code} · khách •••{voucher.contactHint} · {voucher.visits} lượt đã đi · hạn {ngay(voucher.expiresOn)}
          </p>
          {voucher.status === "redeemed" ? (
            <p className="mt-2 text-xs font-bold text-[#8b3d31]">
              Đã đổi{voucher.redeemedByName ? ` bởi ${voucher.redeemedByName}` : ""}
              {voucher.redeemedSaleCode ? ` · vé ${voucher.redeemedSaleCode}` : ""}.
            </p>
          ) : voucher.expired ? (
            <p className="mt-2 text-xs font-bold text-[#8b3d31]">Voucher đã hết hạn.</p>
          ) : null}
          {doiDuoc ? (
            <button
              type="button"
              onClick={doi}
              disabled={pending}
              className="mt-3 min-h-11 w-full rounded-lg bg-[#9a6328] px-4 font-black text-white disabled:opacity-50"
            >
              {voucher.kind === "ve-mien-phi" ? "Cấp vé người lớn miễn phí" : "Đã trao quà cho khách"}
            </button>
          ) : null}
        </div>
      ) : null}
      {thongBao ? (
        <p
          role={thongBao.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${thongBao.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"}`}
        >
          {thongBao.text}
        </p>
      ) : null}
    </details>
  );
}

/**
 * Gắn số điện thoại khách vào phiếu vừa bán, để khách tích lượt đi mà không
 * phải tự quét. Nhân viên hỏi khách hai câu, tích đúng hai ô tách riêng.
 */
export function GanSoKhachQuay({ siteId, codes }: { siteId: string; codes: string[] }) {
  const [so, setSo] = useState("");
  const [dichVu, setDichVu] = useState(false);
  const [tiepThi, setTiepThi] = useState(false);
  const [thongBao, setThongBao] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [xong, setXong] = useState(false);
  const [pending, start] = useTransition();

  function gan() {
    setThongBao(null);
    start(async () => {
      const kq = await ganSoChoPhieuAction({ siteId, codes, phone: so, marketing: tiepThi });
      if (kq.ok) {
        setXong(true);
        setThongBao({ tone: "ok", text: kq.message });
      } else {
        setThongBao({ tone: "error", text: kq.message });
      }
    });
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-[#d8e0db] bg-[#f7f9f7] p-3 text-sm" data-testid="gan-so-khach-quay" data-chi="gan-so-khach" data-chi-loi="Hỏi số khách, tích ô đồng ý, bấm Gắn số vào vé.">
      <p className="font-black text-[#20342c]">Tích điểm cho khách</p>
      <p className="mt-1 text-xs leading-5 text-[#5c6f67]">
        Hỏi số điện thoại khách: vé gắn vào số ấy, đi lần nào tích lần ấy, 2 lượt có quà, 4 lượt vé miễn phí.
      </p>
      {xong ? null : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            gan();
          }}
        >
          <label className="block text-xs font-bold text-[#42574e]">
            Số điện thoại khách
            <input
              type="tel"
              inputMode="tel"
              value={so}
              onChange={(e) => setSo(e.target.value)}
              placeholder="09xx xxx xxx"
              className="mt-1 min-h-11 w-full rounded-lg border border-[#ccd8d1] bg-white px-3 text-base font-normal"
            />
          </label>
          <label className="flex gap-2 text-xs leading-5 text-[#20342c]">
            <input type="checkbox" checked={dichVu} onChange={(e) => setDichVu(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#183f34]" />
            Khách đồng ý dùng số này để giữ vé và tích điểm (bắt buộc)
          </label>
          <label className="flex gap-2 text-xs leading-5 text-[#20342c]">
            <input type="checkbox" checked={tiepThi} onChange={(e) => setTiepThi(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#183f34]" />
            Khách muốn nhận tin ưu đãi qua số này (không bắt buộc)
          </label>
          <button
            type="submit"
            disabled={pending || !dichVu || so.replace(/\D/g, "").length < 9}
            className="min-h-11 w-full rounded-lg bg-[#183f34] px-4 font-black text-white disabled:opacity-50"
          >
            Gắn số vào vé
          </button>
        </form>
      )}
      {thongBao ? (
        <p
          role={thongBao.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${thongBao.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"}`}
        >
          {thongBao.text}
        </p>
      ) : null}
    </div>
  );
}
