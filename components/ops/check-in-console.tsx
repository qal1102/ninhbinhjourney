"use client";

import { useRef, useState } from "react";

type InspectionResult = {
  ok: boolean;
  code: string;
  passId?: string;
  passStatus?: string;
  bookingCode?: string;
  partySize?: number;
  entitlements?: Array<{
    id: string;
    siteId: string;
    siteName: string;
    quantity: number;
    redeemedQuantity: number;
    remaining: number;
  }>;
};

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (input?: {
  formats?: string[];
}) => BarcodeDetectorLike;

export function CheckInConsole({
  latestBookingCode,
  showDemoScan,
}: {
  latestBookingCode?: string;
  showDemoScan: boolean;
}) {
  const [lookupKind, setLookupKind] = useState<
    "pass-token" | "booking-code"
  >("booking-code");
  const [lookupValue, setLookupValue] = useState("");
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [redemption, setRedemption] = useState<{
    ok: boolean;
    code: string;
    redeemed_at?: string;
    original_actor_user_id?: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function inspect(value = lookupValue, kind = lookupKind) {
    setPending(true);
    setInspection(null);
    setRedemption(null);
    setMessage("");
    try {
      const response = await fetch("/api/check-in/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupValue: value, lookupKind: kind }),
      });
      const payload = (await response.json()) as {
        result?: InspectionResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error?.message ?? "Pass inspection failed.");
      }
      setInspection(payload.result);
      setMessage(
        payload.result.code === "VALID"
          ? "Valid — ready to redeem"
          : payload.result.code === "ALREADY_REDEEMED"
            ? "Already redeemed"
            : payload.result.code === "EXPIRED"
              ? "Expired"
              : payload.result.code === "CANCELLED"
                ? "Cancelled"
                : "Invalid or unknown",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Pass inspection failed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function redeem() {
    const entitlement = inspection?.entitlements?.find(
      (item) => item.remaining > 0,
    );
    if (!inspection?.ok || !entitlement) {
      setMessage("No remaining entitlement for this site.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/check-in/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupValue,
          lookupKind,
          siteId: entitlement.siteId,
          entitlementId: entitlement.id,
          quantity: entitlement.remaining,
          idempotencyKey,
        }),
      });
      const payload = (await response.json()) as {
        result?: {
          ok: boolean;
          code: string;
          redeemed_at?: string;
          original_actor_user_id?: string;
        };
        error?: { message?: string };
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error?.message ?? "Redemption failed.");
      }
      setRedemption(payload.result);
      setMessage(
        payload.result.ok
          ? "Redeemed successfully"
          : payload.result.code === "ALREADY_REDEEMED"
            ? "Already redeemed"
            : payload.result.code === "NO_ENTITLEMENT"
              ? "No remaining entitlement for this site"
              : payload.result.code,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Redemption failed.");
    } finally {
      setPending(false);
    }
  }

  async function startCamera() {
    const Detector = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia || !Detector) {
      setMessage(
        "Camera QR scanning is unsupported here. Manual token and booking code remain fully available.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const found = await detector.detect(videoRef.current);
      const raw = found[0]?.rawValue;
      if (raw) {
        const token = raw.split("/pass/")[1]?.split(/[?#]/)[0];
        if (token) {
          const decoded = decodeURIComponent(token);
          setLookupKind("pass-token");
          setLookupValue(decoded);
          await inspect(decoded, "pass-token");
        }
      } else {
        setMessage("No QR detected. Keep the complete manual fallback below.");
      }
    } catch {
      setMessage(
        "Camera permission was denied or unavailable. Manual token and booking code remain fully available.",
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-2xl bg-[#151a17] p-5 text-white sm:p-7">
        <h2 className="font-display text-2xl">Camera scanner</h2>
        <div className="mt-5 overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full object-cover"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={startCamera}
            disabled={cameraActive}
            className="min-h-11 rounded-full bg-[#d58c35] px-5 font-bold text-[#151a17]"
          >
            Start camera
          </button>
          {cameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="min-h-11 rounded-full border border-white/20 px-5 font-bold"
            >
              Stop
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-white/55">
          Camera is requested only after this action. Denial never blocks the
          manual flow.
        </p>
      </section>

      <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5 sm:p-7">
        <h2 className="font-display text-2xl">Manual fallback</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-[13rem_1fr]">
          <label className="text-sm font-bold">
            Lookup type
            <select
              value={lookupKind}
              onChange={(event) =>
                setLookupKind(
                  event.target.value as "pass-token" | "booking-code",
                )
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
            >
              <option value="booking-code">Booking code</option>
              <option value="pass-token">Pass token</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Code or opaque token
            <input
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#c9ccc5] px-4 font-mono font-normal"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => inspect()}
            disabled={pending || lookupValue.trim().length < 3}
            className="min-h-11 rounded-full bg-[#183f34] px-5 font-bold text-white disabled:opacity-40"
          >
            Validate
          </button>
          {showDemoScan ? (
            <button
            type="button"
            onClick={() => {
              if (!latestBookingCode) {
                setMessage("Create a visitor booking in this room first.");
                return;
              }
              setLookupKind("booking-code");
              setLookupValue(latestBookingCode);
              void inspect(latestBookingCode, "booking-code");
            }}
            className="min-h-11 rounded-full border border-[#183f34] px-5 font-bold"
            >
              Run demo scan
            </button>
          ) : null}
        </div>

        {inspection ? (
          <div className="mt-6 rounded-2xl bg-[#f4f0e7] p-5">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
                  {inspection.code}
                </p>
                <p className="font-display mt-2 text-2xl">
                  {inspection.bookingCode ?? "Unknown"}
                </p>
              </div>
              <p className="text-sm">
                Party {inspection.partySize ?? "—"} ·{" "}
                {inspection.passStatus ?? "unknown"}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {(inspection.entitlements ?? []).map((item) => (
                <p key={item.id} className="rounded-xl bg-white p-3 text-sm">
                  {item.siteName} · {item.remaining} remaining
                </p>
              ))}
            </div>
            {inspection.ok ? (
              <button
                type="button"
                onClick={redeem}
                disabled={pending}
                className="mt-5 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold"
              >
                Redeem first remaining entitlement
              </button>
            ) : null}
          </div>
        ) : null}
        {redemption?.code === "ALREADY_REDEEMED" ? (
          <p className="mt-4 text-xs text-[#59654b]">
            Original: {redemption.redeemed_at ?? "recorded"} · actor{" "}
            {redemption.original_actor_user_id ?? "recorded"}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 rounded-xl bg-[#edf3f0] p-4 font-bold" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
