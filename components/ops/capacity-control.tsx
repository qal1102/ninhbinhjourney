"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CapacitySlotRow } from "@/types/database.generated";
import { subscribeToDemoRun } from "@/services/supabase/realtime";

export function CapacityControl({
  slots,
  demoRunId,
  editable,
}: {
  slots: CapacitySlotRow[];
  demoRunId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");
  const [realtime, setRealtime] = useState("connecting");

  useEffect(
    () =>
      subscribeToDemoRun({
        demoRunId,
        onChange: (table) => {
          if (table === "capacity_slots") router.refresh();
        },
        onStatus: setRealtime,
      }),
    [demoRunId, router],
  );

  async function updateSlot(
    slot: CapacitySlotRow,
    input: { capacity: number; status: string },
  ) {
    setPendingId(slot.id);
    setMessage("");
    try {
      const response = await fetch(`/api/capacity/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Capacity update failed.");
      }
      setMessage(
        "Capacity saved, audited and published to the paired visitor room.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Capacity update failed.",
      );
    } finally {
      setPendingId("");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm">
        <p>
          Authorized changes affect new quotes immediately and cannot reduce
          capacity below existing reservations.
        </p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
          Realtime {realtime}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {slots.map((slot) => (
          <form
            key={slot.id}
            className="rounded-2xl border border-[#d7d5cd] bg-white p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void updateSlot(slot, {
                capacity: Number(form.get("capacity")),
                status: String(form.get("status")),
              });
            }}
          >
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-bold">Site {slot.site_id.slice(-4)}</p>
                <p className="mt-1 text-xs text-[#59654b]">
                  {slot.slot_date} · {slot.start_time.slice(0, 5)}–
                  {slot.end_time.slice(0, 5)}
                </p>
              </div>
              <p className="text-sm">
                {slot.reserved} reserved · {slot.checked_in} in
              </p>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-3">
              <label className="text-xs font-bold">
                Capacity
                <input
                  name="capacity"
                  type="number"
                  min={slot.reserved}
                  max={10000}
                  defaultValue={slot.capacity}
                  disabled={!editable}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-bold">
                Status
                <select
                  name="status"
                  defaultValue={slot.status}
                  disabled={!editable}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 text-sm font-normal"
                >
                  <option value="available">Available</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <button
                disabled={!editable || pendingId === slot.id}
                className="mt-6 min-h-11 rounded-full bg-[#183f34] px-4 text-sm font-bold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        ))}
      </div>
      {message ? (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
