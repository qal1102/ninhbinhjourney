"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BookingPayload = {
  booking: {
    code: string;
    status: string;
    visit_date: string;
    customer_display_name: string;
    masked_contact: string;
    party_size: number;
    total_vnd: number;
    currency: string;
  };
  lines: Array<{
    id: string;
    quantity: number;
    unit_price_vnd: number;
    total_vnd: number;
    ledger_type: string;
  }>;
  payment: {
    provider_intent_id: string;
    mode: string;
    status: string;
  } | null;
  pass: { id: string; token_hint: string; status: string } | null;
};

export function BookingConfirmation({ code }: { code: string }) {
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [passToken, setPassToken] = useState("");
  const [message, setMessage] = useState("Đang tải booking từ Supabase…");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token =
      hash.get("pass") ?? sessionStorage.getItem(`nbj-pass:${code}`) ?? "";
    if (token) {
      queueMicrotask(() => setPassToken(token));
      sessionStorage.setItem(`nbj-pass:${code}`, token);
    }
    void fetch(`/api/bookings/${encodeURIComponent(code)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as BookingPayload & {
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(data.error?.message ?? "Booking unavailable.");
        setPayload(data);
        setMessage("");
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Booking unavailable."),
      );
  }, [code]);

  if (!payload) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#183f34] p-5 text-white">
        <p role="status">{message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          Booking confirmed · Sandbox Payment
        </p>
        <h1 className="font-display mt-4 text-5xl leading-none text-[#183f34] sm:text-7xl">
          Hành trình đã có mã.
        </h1>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm text-[#59654b]">Booking code</p>
            <p className="font-display mt-2 break-all text-4xl text-[#183f34]">
              {payload.booking.code}
            </p>
            <dl className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-[#59654b]">Trạng thái</dt>
                <dd className="mt-1 font-bold">{payload.booking.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-[#59654b]">Ngày demo</dt>
                <dd className="mt-1 font-bold">{payload.booking.visit_date}</dd>
              </div>
              <div>
                <dt className="text-sm text-[#59654b]">Khách</dt>
                <dd className="mt-1 font-bold">
                  {payload.booking.customer_display_name} ·{" "}
                  {payload.booking.party_size} người
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[#59654b]">Liên hệ đã mask</dt>
                <dd className="mt-1 font-bold">
                  {payload.booking.masked_contact}
                </dd>
              </div>
            </dl>
            <div className="mt-7 rounded-2xl bg-[#f4f0e7] p-5">
              <p className="text-sm text-[#59654b]">Demonstration total</p>
              <p className="font-display mt-2 text-3xl">
                {payload.booking.total_vnd.toLocaleString("vi-VN")}{" "}
                {payload.booking.currency}
              </p>
              <p className="mt-2 text-xs text-[#7a725f]">
                Ledger: service-commerce · no real charge
              </p>
            </div>
          </section>
          <aside className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">
              QR Pass
            </p>
            <h2 className="font-display mt-3 text-3xl">
              {payload.pass?.status ?? "issuing"}
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Pass token không chứa tên, liên hệ, giá hoặc raw JSON. Text hint:{" "}
              <strong>{payload.pass?.token_hint ?? "—"}</strong>
            </p>
            {passToken ? (
              <Link
                href={`/pass/${encodeURIComponent(passToken)}`}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17]"
              >
                Mở QR Pass
              </Link>
            ) : (
              <p className="mt-7 rounded-xl border border-white/15 p-4 text-sm text-white/58">
                Token chỉ được trả ở lần checkout. Hãy mở Pass từ thiết bị đã
                xác nhận booking.
              </p>
            )}
            <p className="mt-5 text-xs text-white/42">
              Payment: {payload.payment?.status ?? "unknown"} ·{" "}
              {payload.payment?.mode ?? "simulation"}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
