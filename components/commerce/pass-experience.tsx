"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import type { Booking, Pass } from "@/domain/models";
import { SupabasePassService } from "@/services/supabase/pass-service";

type CachedSnapshot = {
  snapshot: { pass: Pass; booking: Booking };
  fetchedAt: string;
};

export function PassExperience({ token }: { token: string }) {
  const service = useMemo(() => new SupabasePassService(), []);
  const [data, setData] = useState<CachedSnapshot | null>(null);
  const [source, setSource] = useState<"live" | "cached" | "none">("none");
  const [message, setMessage] = useState("Đang đồng bộ QR Pass…");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    const cacheKey = `nbj-last-pass:${token.slice(-12)}`;
    void service
      .getByToken({ token })
      .then((result) => {
        if (!active) return;
        setData(result);
        setSource("live");
        setMessage("");
        localStorage.setItem(cacheKey, JSON.stringify(result));
      })
      .catch((error) => {
        if (!active) return;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            setData(JSON.parse(cached) as CachedSnapshot);
            setSource("cached");
            setMessage(
              "Đang hiển thị trạng thái đã lưu gần nhất. Không thể redeem offline; hãy đồng bộ lại tại cổng.",
            );
            return;
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
        setMessage(error instanceof Error ? error.message : "Pass unavailable.");
      });
    return () => {
      active = false;
    };
  }, [service, token]);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(`${window.location.origin}/pass/${token}`, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#151A17", light: "#F4F0E7" },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#151a17] p-5 text-white">
        <p role="status">{message}</p>
      </main>
    );
  }

  const remaining = data.snapshot.pass.entitlements.reduce(
    (total, entitlement) =>
      total + entitlement.quantity - entitlement.redeemedQuantity,
    0,
  );

  return (
    <main className="min-h-screen bg-[#151a17] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
              Ninh Bình QR Pass
            </p>
            <h1 className="font-display mt-2 text-4xl sm:text-6xl">
              {data.snapshot.booking.code}
            </h1>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              source === "live"
                ? "bg-[#2f7657]"
                : "bg-[#8a6b38] text-[#fff7e9]"
            }`}
          >
            {source === "live" ? "Live · synchronized" : "Cached · read-only"}
          </span>
        </div>
        {message ? (
          <p className="mt-5 rounded-2xl border border-[#e7c78d]/25 bg-[#e7c78d]/8 p-4 text-sm leading-6">
            {message}
          </p>
        ) : null}
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-3xl bg-[#f4f0e7] p-5 text-[#151a17]">
            {qrDataUrl ? (
              // The QR encodes only this opaque pass URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR code containing only the opaque Ninh Bình Pass URL"
                className="aspect-square w-full rounded-2xl"
              />
            ) : (
              <div className="grid aspect-square place-items-center">
                Đang tạo QR…
              </div>
            )}
            <p className="mt-4 text-center font-mono text-sm">
              Token hint · {data.snapshot.pass.tokenHint}
            </p>
          </section>
          <section className="rounded-3xl border border-white/12 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/55">Pass status</p>
                <p className="font-display mt-1 text-3xl capitalize">
                  {data.snapshot.pass.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/55">Remaining</p>
                <p className="font-display mt-1 text-3xl">{remaining}</p>
              </div>
            </div>
            <div className="mt-7 space-y-3">
              {data.snapshot.pass.entitlements.map((entitlement) => (
                <article
                  key={entitlement.id}
                  className="rounded-2xl bg-white/7 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold">
                        {"siteName" in entitlement
                          ? String(entitlement.siteName)
                          : entitlement.siteId}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Entitlement {entitlement.id.slice(0, 8)}
                      </p>
                    </div>
                    <p className="font-display text-xl">
                      {entitlement.redeemedQuantity}/{entitlement.quantity}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <dl className="mt-7 grid gap-4 border-t border-white/12 pt-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-white/48">Guest</dt>
                <dd className="mt-1 font-bold">
                  {data.snapshot.booking.customerDisplayName}
                </dd>
              </div>
              <div>
                <dt className="text-white/48">Visit date</dt>
                <dd className="mt-1 font-bold">
                  {data.snapshot.booking.visitDate}
                </dd>
              </div>
              <div>
                <dt className="text-white/48">Party</dt>
                <dd className="mt-1 font-bold">
                  {data.snapshot.booking.partySize} người
                </dd>
              </div>
              <div>
                <dt className="text-white/48">Last synchronized</dt>
                <dd className="mt-1 font-bold">
                  {new Date(data.fetchedAt).toLocaleString("vi-VN")}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
