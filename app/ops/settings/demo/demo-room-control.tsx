"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import type { DemoRole, InternalRole } from "@/domain/models";
import { SupabaseDemoRunService } from "@/services/supabase/demo-run-service";
import {
  subscribeToDemoRun,
  type RealtimeConnectionState,
} from "@/services/supabase/realtime";

type ActiveRoom = {
  id: string;
  label: string;
  status: string;
  expiresAt: string;
  visitorUrl: string;
  joinExpiresAt: string;
};

const previewRoles: DemoRole[] = [
  "visitor",
  "check-in-agent",
  "site-supervisor",
  "icc-operator",
  "finance",
  "content",
  "admin",
  "ritual-authority",
];

export function DemoRoomControl({
  operator,
}: {
  operator: { email: string | null; role: InternalRole; userId: string };
}) {
  const service = useMemo(() => new SupabaseDemoRunService(), []);
  const [label, setLabel] = useState("Ninh Bình client rehearsal");
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [qrImage, setQrImage] = useState({ visitorUrl: "", dataUrl: "" });
  const [previewRole, setPreviewRole] = useState<DemoRole>(operator.role);
  const [realtime, setRealtime] =
    useState<RealtimeConnectionState>("closed");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!room?.visitorUrl) return;
    let active = true;
    void QRCode.toDataURL(room.visitorUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#151A17", light: "#F4F0E7" },
    }).then((url) => {
      if (active) {
        setQrImage({ visitorUrl: room.visitorUrl, dataUrl: url });
      }
    });
    return () => {
      active = false;
    };
  }, [room?.visitorUrl]);

  useEffect(() => {
    if (!room) return;
    return subscribeToDemoRun({
      demoRunId: room.id,
      onChange: (table) => {
        setMessage(`Shared state updated: ${table.replaceAll("_", " ")}`);
      },
      onStatus: setRealtime,
    });
  }, [room]);

  async function startRoom() {
    setPending(true);
    setMessage("");
    try {
      const result = await service.createRun({
        label,
        sourceCode: "TRANGAN-WHARF-DEMO",
        expiresInMinutes: 120,
      });
      setRoom({
        ...result.run,
        visitorUrl: result.visitorUrl,
        joinExpiresAt: result.joinExpiresAt,
      });
      setRealtime("connecting");
      setMessage("Isolated demo room created. The visitor link is valid once.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setPending(false);
    }
  }

  async function copyVisitorLink() {
    if (!room) return;
    await navigator.clipboard.writeText(room.visitorUrl);
    setMessage("Visitor link copied. It expires shortly and can be used once.");
  }

  async function resetRoom() {
    if (!room) return;
    const accepted = window.confirm(
      "Reset only this demo room? Bookings, passes, incidents and audit entries created in this room will be removed.",
    );
    if (!accepted) return;
    setPending(true);
    try {
      await service.resetRun({ demoRunId: room.id });
      setMessage("This room was reset to deterministic capacity and reference state.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset room.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#59654b]">
              Authenticated presenter
            </p>
            <h2 className="font-display mt-2 text-3xl text-[#151a17]">
              Isolated demo room
            </h2>
          </div>
          <span className="rounded-full bg-[#214d3c] px-3 py-1 text-xs font-bold text-white">
            {operator.role}
          </span>
        </div>
        <dl className="mt-5 grid gap-3 rounded-xl bg-[#f4f0e7] p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#59654b]">Signed-in account</dt>
            <dd className="mt-1 font-semibold">{operator.email ?? "Named operator"}</dd>
          </div>
          <div>
            <dt className="text-[#59654b]">Data mode</dt>
            <dd className="mt-1 font-semibold">Supabase shared · RLS enforced</dd>
          </div>
        </dl>

        <label htmlFor="room-label" className="mt-6 block text-sm font-semibold">
          Rehearsal label
        </label>
        <input
          id="room-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          className="mt-2 min-h-12 w-full rounded-xl border border-[#d7d5cd] px-4 outline-none focus:border-[#214d3c]"
        />
        <button
          type="button"
          onClick={startRoom}
          disabled={pending || label.trim().length < 2}
          className="mt-4 min-h-12 rounded-full bg-[#214d3c] px-6 font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Working…" : "Start demo room"}
        </button>

        {room ? (
          <div className="mt-6 rounded-2xl border border-[#7d9b98]/40 bg-[#edf3f0] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{room.label}</p>
                <p className="mt-1 text-sm text-[#59654b]">
                  Expires {new Date(room.expiresAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    realtime === "connected" ? "bg-[#2f7657]" : "bg-[#c9812b]"
                  }`}
                />
                Realtime {realtime}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyVisitorLink}
                className="min-h-11 rounded-full border border-[#214d3c] px-4 font-semibold"
              >
                Copy visitor link
              </button>
              <a
                href={room.visitorUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-[#214d3c] px-4 font-semibold"
              >
                Pair visitor device
              </a>
              <button
                type="button"
                onClick={resetRoom}
                disabled={pending}
                className="min-h-11 rounded-full border border-[#b9413e]/45 px-4 font-semibold text-[#8f2f2c]"
              >
                Reset this demo room
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-xl bg-[#f4f0e7] p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-[#d7d5cd] bg-[#151a17] p-5 text-[#f4f0e7] sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#d8b77d]">
            Pairing QR · no PII
          </p>
          {room && qrImage.visitorUrl === room.visitorUrl ? (
            <>
              {/* The data URL is generated locally from an opaque, short-lived join URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImage.dataUrl}
                alt="Short-lived QR code to pair an anonymous visitor with this demo room"
                className="mx-auto mt-5 aspect-square w-full max-w-72 rounded-xl bg-[#f4f0e7] p-3"
              />
              <p className="mt-4 break-words text-xs leading-5 text-white/55">
                Source: TRANGAN-WHARF-DEMO · join token expires{" "}
                {new Date(room.joinExpiresAt).toLocaleTimeString("vi-VN")}
              </p>
            </>
          ) : (
            <div className="mt-5 grid aspect-square max-w-72 place-items-center rounded-xl border border-dashed border-white/20 text-center text-sm text-white/55">
              Start a room to issue one short-lived visitor QR.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5 sm:p-7">
          <label htmlFor="persona-preview" className="text-sm font-bold">
            Presenter persona preview
          </label>
          <select
            id="persona-preview"
            value={previewRole}
            onChange={(event) => setPreviewRole(event.target.value as DemoRole)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#d7d5cd] bg-white px-3"
          >
            {previewRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm leading-6 text-[#59654b]">
            Previewing <strong>{previewRole}</strong> navigation only. Effective
            authority remains the authenticated <strong>{operator.role}</strong>{" "}
            membership and PostgreSQL RLS outcome.
          </p>
        </section>
      </div>
    </div>
  );
}
