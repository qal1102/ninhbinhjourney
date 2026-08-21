"use client";

import { useEffect, useRef, useState } from "react";
import type { PackageCatalogItem } from "@/content/packages";
import { getOrCreateCustomerAnonymousId } from "@/lib/customer-data/browser-tracking";

type HoldResult = {
  order: { id: string; code: string };
  hold: { id: string; status: string; expires_at: string };
  amount: { total_vnd: number; currency: "VND" };
  slots: Array<{
    slotId: string;
    siteId: string;
    startsAt: string;
    endsAt: string;
    capacitySource: "estimate" | "customer" | "measured";
    thresholdVersion: number;
  }>;
};

type ConfirmationResult = {
  order: { id: string; code: string; status: "confirmed" };
  payment: { id: string; status: "succeeded"; mode: "simulation" };
  tickets: Array<{
    ticketId: string;
    ticketCode: string;
    siteId: string;
    validOn: string;
    entriesAllowed: number;
    status: string;
  }>;
};

const SOURCE_LABEL = {
  estimate: "Ước tính vận hành T11a",
  customer: "Số liệu doanh nghiệp cung cấp",
  measured: "Số liệu đã đo",
} as const;

function localIsoDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Kho đặt chỗ chưa phản hồi. Hãy thử lại.");
  }
  return payload;
}

export function CustomerBookingCheckout({
  packageItem,
}: {
  packageItem: PackageCatalogItem;
}) {
  const [partySize, setPartySize] = useState(packageItem.fixedPartySize ?? 2);
  const [visitDate, setVisitDate] = useState(() => packageItem.bookingStartDate ?? localIsoDate(1));
  const [hold, setHold] = useState<HoldResult | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pending, setPending] = useState<"hold" | "confirm" | null>(null);
  const [message, setMessage] = useState("");
  const holdRequestId = useRef(crypto.randomUUID());
  const paymentRequestId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!hold) return;
    const update = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(hold.hold.expires_at).getTime() - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

  function invalidateHold() {
    setHold(null);
    setConfirmation(null);
    setMessage("");
    holdRequestId.current = crypto.randomUUID();
    paymentRequestId.current = crypto.randomUUID();
  }

  async function createHold() {
    setPending("hold");
    setMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-booking-holds", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: holdRequestId.current,
          anonymous_id: anonymousId,
          product_id: packageItem.id,
          visit_date: visitDate,
          party_size: partySize,
        }),
      });
      const payload = await responsePayload(response) as HoldResult;
      setHold(payload);
      setConfirmation(null);
      paymentRequestId.current = crypto.randomUUID();
      setMessage("Đã giữ chỗ thật trong kho công suất. Thời hạn 15 phút bắt đầu từ lúc này.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể giữ chỗ lúc này.");
    } finally {
      setPending(null);
    }
  }

  async function confirmBooking() {
    if (!hold || remainingSeconds <= 0) return;
    setPending("confirm");
    setMessage("");
    try {
      const response = await fetch("/api/customer-booking-confirmations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_request_id: paymentRequestId.current,
          hold_id: hold.hold.id,
        }),
      });
      const payload = await responsePayload(response) as ConfirmationResult;
      setConfirmation(payload);
      setMessage("Đặt chỗ đã xác nhận. Vé bên dưới là vé T8 mà cổng vận hành đọc trực tiếp.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác nhận đặt chỗ lúc này.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1.05fr_0.78fr]">
      <section className="overflow-hidden rounded-[2rem] border border-[#d4d1c7] bg-white shadow-[0_24px_70px_rgba(24,63,52,0.08)]">
        <div className="border-b border-[#e5e1d8] bg-[#fbfaf6] p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
            Giữ chỗ trên công suất ERP
          </p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
            Chọn ngày. Chúng tôi giữ chỗ trong 15 phút.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-[#59654b]">
            Không cần tài khoản, tên, email hay số điện thoại. Phiên ẩn danh chỉ nối đơn với hành trình của bạn; không tự đăng ký nhận marketing.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#27362f]">
              Ngày trải nghiệm
              <input
                aria-label="Ngày trải nghiệm"
                type="date"
                value={visitDate}
                min={packageItem.bookingStartDate ?? localIsoDate(1)}
                max={packageItem.bookingEndDate ?? localIsoDate(90)}
                onChange={(event) => {
                  setVisitDate(event.target.value);
                  invalidateHold();
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal"
              />
            </label>
            <label className="text-sm font-bold text-[#27362f]">
              {packageItem.fixedPartySize ? "Sản phẩm" : "Số khách"}
              <input
                aria-label={packageItem.fixedPartySize ? "Sản phẩm cố định hai khách" : "Số khách"}
                type={packageItem.fixedPartySize ? "text" : "number"}
                min={packageItem.fixedPartySize ? undefined : 1}
                max={packageItem.fixedPartySize ? undefined : 20}
                value={partySize}
                onChange={(event) => {
                  setPartySize(Number(event.target.value));
                  invalidateHold();
                }}
                disabled={Boolean(packageItem.fixedPartySize)}
                className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal disabled:bg-[#f1efe8]"
              />
              {packageItem.fixedPartySize ? <span className="mt-2 block text-xs font-normal text-[#6b786f]">Bàn cố định cho hai khách</span> : null}
            </label>
          </div>

          <div className="mt-7 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
            <p className="font-extrabold">Thanh toán mô phỏng — không thu tiền</p>
            <p className="mt-2 text-sm leading-6">
              Hệ thống không hỏi số thẻ, tài khoản ngân hàng hay dữ liệu thanh toán thật. Nút xác nhận chỉ kiểm chứng vòng đời order → payment mô phỏng → vé T8.
            </p>
          </div>

          {hold ? (
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Các điểm đã khóa công suất</p>
                  <p className="mt-2 text-sm text-[#59654b]">Điểm không có ngưỡng T11a vẫn thuộc lịch trình nhưng không bị ghi nhận giả là đã giữ sức chứa.</p>
                </div>
                <div className="rounded-2xl bg-[#183f34] px-5 py-3 text-right text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Còn lại</p>
                  <p className="font-display mt-1 text-3xl text-[#e7c78d]">{formatCountdown(remainingSeconds)}</p>
                </div>
              </div>
              <ul className="mt-4 grid gap-3">
                {hold.slots.map((slot) => (
                  <li key={slot.slotId} className="rounded-2xl border border-[#dde1db] p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{new Date(slot.startsAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}</strong>
                      <span className="text-xs font-bold text-[#557568]">T11a v{slot.thresholdVersion}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#59654b]">{SOURCE_LABEL[slot.capacitySource]}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {message ? <p role="status" className="mt-6 rounded-xl bg-[#edf3ee] p-4 text-sm leading-6 text-[#274c40]">{message}</p> : null}
        </div>
      </section>

      <aside className="h-fit rounded-[2rem] bg-[#183f34] p-6 text-white shadow-[0_24px_70px_rgba(12,38,31,0.2)] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">Gói đã chọn</p>
        <h2 className="font-display mt-3 text-4xl leading-tight">{packageItem.name}</h2>
        <p className="mt-3 leading-7 text-white/65">{packageItem.durationLabel} · {packageItem.audience}</p>
        <dl className="mt-7 space-y-4 border-y border-white/15 py-5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-white/55">Đơn giá mỗi khách</dt><dd>{packageItem.demoPriceVnd.toLocaleString("vi-VN")} VND</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-white/55">Số khách</dt><dd>{partySize}</dd></div>
          <div className="flex justify-between gap-4 text-lg font-bold"><dt>Tổng</dt><dd className="text-[#e7c78d]">{(hold?.amount.total_vnd ?? packageItem.demoPriceVnd * Math.max(0, partySize)).toLocaleString("vi-VN")} VND</dd></div>
        </dl>

        {confirmation ? (
          <div className="mt-6" data-testid="customer-booking-confirmed">
            <p className="rounded-2xl bg-[#dceadd] p-4 font-bold text-[#183f34]">Đã xác nhận · {confirmation.order.code}</p>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">Vé T8 đã phát hành</p>
            <ul className="mt-3 space-y-3">
              {confirmation.tickets.map((ticket) => (
                <li key={ticket.ticketId} className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <code className="text-lg font-extrabold tracking-[0.08em] text-[#e7c78d]">{ticket.ticketCode}</code>
                  <p className="mt-2 text-sm text-white/62">{ticket.entriesAllowed} lượt vào · hiệu lực {new Date(`${ticket.validOn}T00:00:00`).toLocaleDateString("vi-VN")}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : !hold ? (
          <button
            type="button"
            onClick={createHold}
            disabled={pending !== null || partySize < 1 || partySize > 20 || !visitDate}
            className="mt-7 min-h-12 w-full rounded-full bg-[#f4f0e7] px-6 font-extrabold text-[#183f34] disabled:opacity-50"
          >
            {pending === "hold" ? "Đang khóa chỗ…" : "Giữ chỗ 15 phút"}
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmBooking}
            disabled={pending !== null || remainingSeconds <= 0}
            className="mt-7 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-50"
          >
            {pending === "confirm" ? "Đang phát hành vé…" : remainingSeconds <= 0 ? "Giữ chỗ đã hết hạn" : "Xác nhận thanh toán mô phỏng"}
          </button>
        )}
        <p className="mt-5 text-xs leading-5 text-white/45">Gửi lại cùng một yêu cầu không tạo thêm order, payment hay vé thứ hai.</p>
      </aside>
    </div>
  );
}
