"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCounterPriceAction } from "@/app/erp/actions";
import {
  COUNTER_PRODUCTS,
  COUNTER_PRODUCT_LABELS,
  formatVnd,
  validateCounterPriceInput,
  type CounterProduct,
} from "@/domain/erp-counter-sale";
import type { CounterPriceBoard, CounterPriceBoardSite } from "@/lib/erp/counter-sale-repository";

function ngayVietNam(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function gioVietNam(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** Máy chủ nhận hẹn giá trước tối đa 365 ngày. */
function ngayCuoiHenGia(today: string) {
  const homNay = Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(homNay) ? undefined : new Date(homNay + 365 * 86_400_000).toISOString().slice(0, 10);
}

function SiteCard({ site, today }: { site: CounterPriceBoardSite; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [product, setProduct] = useState<CounterProduct>("adult");
  const [priceText, setPriceText] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const price = Number(priceText.replace(/[^0-9]/g, ""));
  const hienTai = (p: CounterProduct) => site.prices.find((item) => item.product === p) ?? null;
  // Lịch sử xếp theo ngày áp dụng rồi lần đặt mới trước. Cùng loại vé, cùng
  // ngày áp dụng mà đặt hai lần thì lần sau thay lần trước.
  const daThay = new Set<string>();
  const daGap = new Set<string>();
  for (const row of site.history) {
    const khoa = `${row.product}|${row.effectiveFrom}`;
    if (daGap.has(khoa)) daThay.add(row.priceListId);
    daGap.add(khoa);
  }
  // Những lần hẹn giá chưa tới ngày: quầy chưa thấy, giám đốc cần thấy.
  const sapToi = site.history
    .filter((row) => row.effectiveFrom > today && !daThay.has(row.priceListId))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  function moSua(p: CounterProduct) {
    setProduct(p);
    setPriceText(String(hienTai(p)?.unitPriceVnd ?? ""));
    setEffectiveFrom(today);
    setNote("");
    setMessage(null);
    setEditing(true);
  }

  function luu() {
    if (pending) return;
    const kiem = validateCounterPriceInput({
      unitPriceVnd: priceText.trim() === "" ? Number.NaN : price,
      effectiveFrom,
      today,
    });
    if (!kiem.ok) {
      setMessage({ tone: "error", text: kiem.reason });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const ketQua = await setCounterPriceAction({
        siteId: site.siteId,
        product,
        unitPriceVnd: price,
        effectiveFrom,
        note,
      });
      setMessage({ tone: ketQua.ok ? "ok" : "error", text: ketQua.message });
      if (ketQua.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const giaCu = hienTai(product)?.unitPriceVnd ?? null;

  return (
    <section
      aria-labelledby={`gia-${site.siteId}`}
      className="flex flex-col rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 id={`gia-${site.siteId}`} className="text-xl font-black text-[#20342c]">
        {site.siteName}
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {COUNTER_PRODUCTS.map((p) => {
          const gia = hienTai(p);
          return (
            <div key={p} className="rounded-xl bg-[#f3f6f4] p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-[#5c6f67]">
                {COUNTER_PRODUCT_LABELS[p]}
              </dt>
              <dd className="mt-1">
                <span className="block text-3xl font-black tabular-nums text-[#183f34]">
                  {gia ? (gia.unitPriceVnd === 0 ? "Miễn phí" : formatVnd(gia.unitPriceVnd)) : "Chưa có giá"}
                </span>
                <span className="mt-1 block text-xs text-[#6e7b75]">
                  {gia ? `Áp từ ${ngayVietNam(gia.effectiveFrom)}` : "Quầy chưa bán được loại vé này"}
                </span>
                <button
                  type="button"
                  onClick={() => moSua(p)}
                  className="mt-3 min-h-10 rounded-lg border border-[#183f34] bg-white px-3 text-sm font-black text-[#183f34]"
                >
                  Sửa giá {COUNTER_PRODUCT_LABELS[p].toLowerCase()}
                </button>
              </dd>
            </div>
          );
        })}
      </dl>

      {sapToi.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-[#5d5037]">
          {sapToi.map((row) => (
            <li key={row.priceListId} className="rounded-lg bg-[#fff8eb] px-3 py-2">
              Hẹn giá mới: <strong>{COUNTER_PRODUCT_LABELS[row.product]}</strong>{" "}
              <strong className="tabular-nums">{formatVnd(row.unitPriceVnd)}</strong> từ {ngayVietNam(row.effectiveFrom)}
            </li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            luu();
          }}
          className="mt-4 space-y-3 rounded-xl border border-[#ccd8d1] bg-[#f8faf8] p-4"
        >
          <fieldset>
            <legend className="text-xs font-black text-[#5c6f67]">Loại vé</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {COUNTER_PRODUCTS.map((p) => (
                <label
                  key={p}
                  className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-black ${
                    product === p ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`san-pham-${site.siteId}`}
                    checked={product === p}
                    onChange={() => {
                      setProduct(p);
                      setPriceText(String(hienTai(p)?.unitPriceVnd ?? ""));
                    }}
                    className="sr-only"
                  />
                  {COUNTER_PRODUCT_LABELS[p]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`gia-moi-${site.siteId}`} className="text-xs font-black text-[#5c6f67]">
                Giá mới một vé (đồng)
              </label>
              <input
                id={`gia-moi-${site.siteId}`}
                inputMode="numeric"
                autoComplete="off"
                value={priceText === "" ? "" : new Intl.NumberFormat("vi-VN").format(price)}
                onChange={(event) => setPriceText(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ví dụ: 250.000"
                className="mt-1 min-h-11 w-full rounded-lg border border-[#ccd8d1] bg-white px-3 text-lg font-black tabular-nums text-[#183f34]"
              />
            </div>
            <div>
              <label htmlFor={`ap-tu-${site.siteId}`} className="text-xs font-black text-[#5c6f67]">
                Áp dụng từ ngày
              </label>
              <input
                id={`ap-tu-${site.siteId}`}
                type="date"
                min={today}
                max={ngayCuoiHenGia(today)}
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-[#ccd8d1] bg-white px-3 text-base font-bold text-[#20342c]"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`ly-do-${site.siteId}`} className="text-xs font-black text-[#5c6f67]">
              Lý do đổi giá (ghi vào nhật ký)
            </label>
            <textarea
              id={`ly-do-${site.siteId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ví dụ: giá mùa lễ hội Tràng An"
              className="mt-1 w-full rounded-lg border border-[#ccd8d1] bg-white p-2 text-sm"
            />
          </div>

          {priceText !== "" && giaCu !== null && price !== giaCu ? (
            <p className="text-sm text-[#42574e]">
              {COUNTER_PRODUCT_LABELS[product]}: <span className="tabular-nums">{formatVnd(giaCu)}</span> →{" "}
              <strong className="tabular-nums">{formatVnd(price)}</strong>
              {effectiveFrom === today ? ", áp ngay cho phiếu bán tiếp theo." : `, từ ${ngayVietNam(effectiveFrom)}.`}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 flex-1 rounded-lg bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {pending ? "Đang lưu…" : "Lưu giá mới"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setMessage(null);
              }}
              className="min-h-11 rounded-lg border border-[#ccd8d1] bg-white px-4 text-sm font-black text-[#42574e]"
            >
              Thôi
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${
            message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-bold text-[#42574e]">
          Lịch sử đặt giá ({site.history.length.toLocaleString("vi-VN")} lần gần nhất)
        </summary>
        {site.history.length === 0 ? (
          <p className="mt-2 text-[#6e7b75]">Chưa có lần đặt giá nào.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[#5c6f67]">
                <tr>
                  <th className="py-2 pr-3 font-black">Áp từ</th>
                  <th className="py-2 pr-3 font-black">Loại vé</th>
                  <th className="py-2 pr-3 text-right font-black">Giá</th>
                  <th className="py-2 pr-3 font-black">Lúc đặt</th>
                  <th className="py-2 font-black">Người đặt, lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8] text-[#33443d]">
                {site.history.map((row) => (
                  <tr key={row.priceListId} className={daThay.has(row.priceListId) ? "text-[#8a958f]" : undefined}>
                    <td className="py-2 pr-3 whitespace-nowrap">{ngayVietNam(row.effectiveFrom)}</td>
                    <td className="py-2 pr-3">{COUNTER_PRODUCT_LABELS[row.product]}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                      {daThay.has(row.priceListId) ? <s>{formatVnd(row.unitPriceVnd)}</s> : formatVnd(row.unitPriceVnd)}
                      {daThay.has(row.priceListId) ? <span className="block font-normal">đã đặt lại</span> : null}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{gioVietNam(row.createdAt)}</td>
                    <td className="py-2">
                      {row.createdByName || "Hệ thống"}
                      {row.note ? <span className="block text-[#6e7b75]">{row.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}

/**
 * QA-ERP-POS-05 — giám đốc tự sửa giá vé quầy của bốn cơ sở. Giá mới chỉ áp
 * cho phiếu bán từ ngày áp dụng; phiếu đã bán giữ đúng giá lúc bán vì mỗi
 * dòng phiếu chép giá vào chính nó.
 */
export function CounterPriceBoardView({ board, today }: { board: CounterPriceBoard; today: string }) {
  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">Giám đốc</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Bảng giá vé quầy</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Giá đặt ở đây là giá nhân viên quầy thấy khi ra đơn. Đổi giá không làm thay đổi phiếu đã bán: mỗi phiếu
          giữ đúng giá lúc bán. Muốn hẹn giá cho mùa lễ, chọn ngày áp dụng về sau; quầy chỉ thấy giá mới từ ngày
          đó. Mỗi lần đặt ghi tên người đặt và lý do vào nhật ký.
        </p>
      </header>

      {board.available ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {board.sites.map((site) => (
            <SiteCard key={site.siteId} site={site} today={today} />
          ))}
        </div>
      ) : (
        <p role="status" className="rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
          {board.message}
        </p>
      )}
    </div>
  );
}
