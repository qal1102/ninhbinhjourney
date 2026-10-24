"use client";

import { useState, useTransition } from "react";
import { datUuDaiRiengAction, lichSuCongTyAction } from "@/app/erp/ve-doan-actions";
import {
  bacUuDai,
  formatVnd,
  type TravelCompanyHistoryRow,
  type TravelCompanyStanding,
} from "@/domain/erp-counter-sale";

function gio(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(d);
}

/**
 * Công ty lữ hành (12/10/2026, chủ dự án: "công ty này năm nay đã hợp tác bao
 * nhiêu… lịch sử giao dịch… có nằm trong diện ưu đãi không").
 */
export function CongTyLuHanhWorkspace({
  congTy: banDau,
  laGiamDoc,
  tenCoSo,
}: {
  congTy: TravelCompanyStanding[];
  laGiamDoc: boolean;
  /** Mã cơ sở trong kho → tên ngắn, để đọc lịch sử. */
  tenCoSo: Record<string, string>;
}) {
  const [congTy, setCongTy] = useState(banDau);
  const [moId, setMoId] = useState<string | null>(null);
  const [lichSu, setLichSu] = useState<Record<string, TravelCompanyHistoryRow[]>>({});
  const [loi, setLoi] = useState("");
  const [pending, startTransition] = useTransition();
  const tongDoan = congTy.reduce((n, c) => n + c.groupsThisYear, 0);
  const tongTien = congTy.reduce((n, c) => n + c.revenueThisYearVnd, 0);

  function mo(id: string) {
    const next = moId === id ? null : id;
    setMoId(next);
    if (next && !lichSu[next]) {
      void lichSuCongTyAction(next).then((rows) => setLichSu((cu) => ({ ...cu, [next]: rows })));
    }
  }

  function datUuDai(id: string, giaTri: string) {
    setLoi("");
    const percent = giaTri === "" ? null : Number(giaTri);
    startTransition(async () => {
      const kq = await datUuDaiRiengAction({ companyId: id, percent });
      if (kq.ok) setCongTy((cu) => cu.map((c) => (c.id === id ? kq.company : c)));
      else setLoi(kq.message);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8" data-chi="cong-ty-lu-hanh">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6d5ca]">Vé đoàn · năm nay</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl">Công ty lữ hành</h1>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["Công ty", String(congTy.length)],
            ["Đoàn đã đi", tongDoan.toLocaleString("vi-VN")],
            ["Tiền vé đoàn", formatVnd(tongTien)],
          ].map(([nhan, giaTri]) => (
            <div key={nhan} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-3">
              <p className="text-xs text-white/55">{nhan}</p>
              <p className="mt-1 text-lg font-black sm:text-2xl">{giaTri}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[#c3ded4]">
          Ưu đãi theo số đoàn đã trả trong năm: từ 5 đoàn 5%, từ 10 đoàn 8%, từ 20 đoàn 10%. Giám đốc đặt được mức riêng
          cho từng công ty (0 tới 50%), mức riêng thay cho bậc. Công ty mới thêm ngay ở quầy, ô Vé đoàn.
        </p>
      </section>

      {loi ? (
        <p role="alert" className="rounded-xl bg-[#fdeceb] px-4 py-3 text-sm font-bold text-[#8b3d31]">
          {loi}
        </p>
      ) : null}

      {congTy.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#c7d2cc] p-6 text-sm text-[#6d7c75]">
          Chưa có công ty nào. Ở màn Vé & đặt chỗ của một cơ sở, ô Vé đoàn, bấm &quot;+ Công ty mới&quot; khi bán vé cho một đoàn.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="danh-sach-cong-ty">
          {congTy.map((c) => {
            const bac = bacUuDai(c.groupsThisYear);
            const dangMo = moId === c.id;
            return (
              <li key={c.id} className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => mo(c.id)}
                  aria-expanded={dangMo}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[#f8faf8]"
                >
                  <span className="min-w-0">
                    <span className="block text-lg font-black text-[#20342c]">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-[#6e7b75]">
                      {c.taxCode ? `MST ${c.taxCode}` : "Chưa có mã số thuế"}
                      {c.contactName ? ` · ${c.contactName}` : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 font-bold text-[#35594b]">{c.groupsThisYear} đoàn năm nay</span>
                      <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 font-bold text-[#35594b]">{c.guestsThisYear.toLocaleString("vi-VN")} khách</span>
                      <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 font-bold text-[#35594b]">{formatVnd(c.revenueThisYearVnd)}</span>
                      <span className={`rounded-full px-2 py-0.5 font-black ${c.discountPercent > 0 ? "bg-[#fff0ce] text-[#77531c]" : "bg-[#f1f3f2] text-[#6e7b75]"}`}>
                        Ưu đãi {c.discountPercent}%{c.specialDiscountPercent !== null ? " (riêng)" : ""}
                      </span>
                    </span>
                  </span>
                  <span aria-hidden="true" className={`text-xl font-black text-[#8a968f] transition-transform motion-reduce:transition-none ${dangMo ? "rotate-90" : ""}`}>›</span>
                </button>
                {dangMo ? (
                  <div className="space-y-4 border-t border-[#edf0ee] bg-[#f8faf8] p-4">
                    <p className="text-xs text-[#5c6f67]">
                      {c.specialDiscountPercent === null
                        ? bac.mocKe
                          ? `Bậc ${bac.phanTram}%. Thêm ${bac.mocKe - c.groupsThisYear} đoàn nữa trong năm thì lên bậc kế.`
                          : "Đang ở bậc cao nhất, 10%."
                        : `Đang áp mức riêng ${c.specialDiscountPercent}% (bậc theo số đoàn là ${c.tierPercent}%).`}{" "}
                      Tổng từ trước tới nay {c.groupsAllTime} đoàn{c.lastGroupAt ? `, gần nhất ${gio(c.lastGroupAt)}` : ""}.
                      {c.invoiceEmail ? ` Hoá đơn gửi ${c.invoiceEmail}.` : ""}
                      {c.address ? ` Địa chỉ: ${c.address}.` : ""}
                    </p>
                    {laGiamDoc ? (
                      <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#20342c]">
                        Ưu đãi riêng
                        <select
                          defaultValue={c.specialDiscountPercent === null ? "" : String(c.specialDiscountPercent)}
                          onChange={(e) => datUuDai(c.id, e.target.value)}
                          disabled={pending}
                          className="min-h-11 rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm"
                        >
                          <option value="">Theo bậc số đoàn</option>
                          {[0, 3, 5, 8, 10, 12, 15, 20, 25, 30].map((pt) => (
                            <option key={pt} value={pt}>
                              {pt}%
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div>
                      <h3 className="text-sm font-black text-[#30443b]">Lịch sử vé đoàn</h3>
                      {!lichSu[c.id] ? (
                        <p className="mt-2 text-xs text-[#849089]">Đang đọc…</p>
                      ) : lichSu[c.id].length === 0 ? (
                        <p className="mt-2 text-xs text-[#849089]">Chưa có đoàn nào.</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-[#e7ece9] rounded-xl border border-[#e3e9e5] bg-white text-xs">
                          {lichSu[c.id].map((row) => (
                            <li key={row.saleCode} className="flex flex-wrap items-center justify-between gap-2 p-3">
                              <span className="min-w-0">
                                <span className="font-mono font-bold">{row.saleCode}</span> · {gio(row.soldAt)} ·{" "}
                                {tenCoSo[row.siteUuid] ?? "—"} · {row.guests} khách · {row.groupLeaderName}
                                {row.invoiceRequested ? " · có hoá đơn" : ""}
                              </span>
                              <span className="font-black tabular-nums">
                                {row.status === "voided" ? <span className="text-[#8b3d31]">Đã huỷ</span> : formatVnd(row.totalVnd)}
                                {row.discountVnd > 0 && row.status !== "voided" ? (
                                  <span className="ml-1 font-normal text-[#849089]">(giảm {formatVnd(row.discountVnd)})</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
