"use client";

import { useMemo, useState } from "react";
import type { PackageCatalogItem } from "@/content/packages";
import type { Quote } from "@/domain/models";
import { SupabaseBookingService } from "@/services/supabase/booking-service";

export function CheckoutExperience({
  packageItem,
  itineraryId,
}: {
  packageItem: PackageCatalogItem;
  itineraryId?: string;
}) {
  const service = useMemo(() => new SupabaseBookingService(), []);
  const [displayName, setDisplayName] = useState("Khách Demo Ninh Bình");
  const [contactKind, setContactKind] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState(
    "guest.ninhbinh@example.test",
  );
  const [partySize, setPartySize] = useState(3);
  const [visitDate, setVisitDate] = useState("2026-08-15");
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function requestQuote() {
    setPending(true);
    setMessage("");
    try {
      const nextQuote = await service.quote({
        itineraryId,
        productSelections: [
          { productId: packageItem.id, quantity: partySize },
        ],
        visitDate,
        partySize,
      });
      setQuote(nextQuote);
      setMessage(
        "Đã có báo giá. Hệ thống vừa kiểm tra chỗ trống và giá minh họa.",
      );
    } catch (error) {
      setQuote(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo báo giá lúc này.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmBooking() {
    if (!quote || !consent) return;
    setPending(true);
    setMessage("");
    try {
      const result = await service.createBooking({
        quoteId: quote.id,
        customerDisplayName: displayName,
        contactKind,
        contactValue,
        consent: true,
        idempotencyKey,
      });
      sessionStorage.setItem(
        `nbj-pass:${result.booking.code}`,
        result.pass.token,
      );
      window.location.assign(
        `/booking/${encodeURIComponent(result.booking.code)}#pass=${encodeURIComponent(result.pass.token)}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể xác nhận đặt chỗ minh họa.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_0.72fr]">
      <section className="rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm sm:p-8">
        <p className="rounded-xl border border-[#c68f48]/35 bg-[#fff7e9] p-4 text-sm font-bold text-[#78551e]">
          Thanh toán mô phỏng — không thu tiền thật. Không nhập số thẻ, tài
          khoản ngân hàng hoặc dữ liệu thanh toán thật.
        </p>
        <h2 className="font-display mt-7 text-3xl text-[#183f34]">
          Đặt chỗ nhanh, không cần tài khoản
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold sm:col-span-2">
            Tên hiển thị giả lập
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] px-4 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Loại liên hệ
            <select
              value={contactKind}
              onChange={(event) => {
                const kind = event.target.value as "email" | "phone";
                setContactKind(kind);
                setContactValue(
                  kind === "email"
                    ? "guest.ninhbinh@example.test"
                    : "+84 900 000 000",
                );
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] bg-white px-4 font-normal"
            >
              <option value="email">Email</option>
              <option value="phone">Điện thoại</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Liên hệ giả lập
            <input
              type={contactKind === "email" ? "email" : "tel"}
              value={contactValue}
              onChange={(event) => setContactValue(event.target.value)}
              maxLength={160}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] px-4 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Số khách
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(event) => {
                setPartySize(Number(event.target.value));
                setQuote(null);
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] px-4 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Ngày demo
            <input
              type="date"
              value={visitDate}
              min="2026-08-15"
              max="2026-08-15"
              onChange={(event) => {
                setVisitDate(event.target.value);
                setQuote(null);
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] px-4 font-normal"
            />
          </label>
        </div>
        <fieldset className="mt-6 rounded-2xl border border-[#d7d5cd] p-5">
          <legend className="px-2 text-sm font-bold">Phương thức demo</legend>
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked
              readOnly
              className="mt-1 h-5 w-5 accent-[#183f34]"
            />
            <span>
              <strong className="block">Cổng thanh toán mô phỏng</strong>
              <span className="mt-1 block text-sm leading-6 text-[#59654b]">
                Toàn bộ quy trình được mô phỏng và có ghi lại để kiểm chứng.
                Không kết nối tới mạng lưới thanh toán thật.
              </span>
            </span>
          </label>
        </fieldset>
        <label className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f4f0e7] p-4 text-sm leading-6">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1 h-5 w-5 accent-[#183f34]"
          />
          Tôi xác nhận đây là dữ liệu khách giả lập cho mục đích minh họa, và
          đồng ý lưu thông tin liên hệ tối thiểu cho luồng này.
        </label>
      </section>

      <aside className="h-fit rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">
          Dữ liệu minh họa
        </p>
        <h2 className="font-display mt-3 text-3xl">{packageItem.name}</h2>
        <dl className="mt-6 space-y-4 border-y border-white/15 py-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-white/58">Đơn giá demo</dt>
            <dd>{packageItem.demoPriceVnd.toLocaleString("vi-VN")} VND</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/58">Số khách</dt>
            <dd>{partySize}</dd>
          </div>
        </dl>
        {quote ? (
          <div className="mt-6 rounded-2xl bg-white/8 p-5">
            <p className="text-sm text-white/58">Tổng cộng đã tính</p>
            <p className="font-display mt-2 text-3xl text-[#e7c78d]">
              {quote.totalVnd.toLocaleString("vi-VN")} VND
            </p>
            <p className="mt-2 text-xs text-white/48">
              Hết hạn {new Date(quote.expiresAt).toLocaleTimeString("vi-VN")}
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-white/20 p-5 text-sm leading-6 text-white/58">
            Báo giá sẽ hiện ở đây sau khi hệ thống kiểm tra ngày và chỗ trống.
          </p>
        )}
        {!quote ? (
          <button
            type="button"
            onClick={requestQuote}
            disabled={pending || partySize < 1 || partySize > 20}
            className="mt-6 min-h-12 w-full rounded-full bg-[#f4f0e7] px-6 font-extrabold text-[#183f34] disabled:opacity-50"
          >
            {pending ? "Đang kiểm tra…" : "Xem báo giá"}
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmBooking}
            disabled={pending || !consent}
            className="mt-6 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-50"
          >
            {pending ? "Đang xác nhận…" : "Xác nhận đặt chỗ minh họa"}
          </button>
        )}
        {message ? (
          <p className="mt-4 rounded-xl bg-white/8 p-4 text-sm leading-6" role="status">
            {message}
          </p>
        ) : null}
        <p className="mt-5 text-xs leading-5 text-white/42">
          Nhấn lặp lại cũng không tạo thêm một đặt chỗ thứ hai.
        </p>
      </aside>
    </div>
  );
}
