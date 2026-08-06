"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateCapacityThresholdAction } from "@/app/erp/capacity-actions";
import type { ErpSiteId } from "@/domain/erp";
import {
  calculateHourlyCapacity,
  type CapacityThreshold,
} from "@/domain/erp-capacity";

type CapacityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_STATE: CapacityActionState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : "Lưu và ghi lịch sử"}
    </button>
  );
}

export function CapacityThresholdEditor({
  siteId,
  threshold,
}: {
  siteId: ErpSiteId;
  threshold: CapacityThreshold;
}) {
  const [state, action] = useActionState(
    updateCapacityThresholdAction,
    INITIAL_STATE,
  );
  const [vehicleCount, setVehicleCount] = useState(
    String(threshold.vehicleCount),
  );
  const [seatsPerVehicle, setSeatsPerVehicle] = useState(
    String(threshold.seatsPerVehicle),
  );
  const [roundTripMinutes, setRoundTripMinutes] = useState(
    String(threshold.roundTripMinutes),
  );
  const preview = calculateHourlyCapacity({
    vehicleCount: Number(vehicleCount),
    seatsPerVehicle: Number(seatsPerVehicle),
    roundTripMinutes: Number(roundTripMinutes),
  });

  return (
    <details className="rounded-xl border border-[#cbd8d2] bg-[#f7faf8]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[#315e4e]">
        Chỉnh giả định và nguồn
      </summary>
      <form action={action} className="border-t border-[#dce5e0] p-4">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="thresholdId" value={threshold.id} />
        <input
          type="hidden"
          name="expectedVersion"
          value={threshold.version}
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Phương tiện hoạt động
            <input
              name="vehicleCount"
              type="number"
              min="1"
              max="10000"
              required
              value={vehicleCount}
              onChange={(event) => setVehicleCount(event.target.value)}
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Chỗ / phương tiện
            <input
              name="seatsPerVehicle"
              type="number"
              min="1"
              max="500"
              required
              value={seatsPerVehicle}
              onChange={(event) => setSeatsPerVehicle(event.target.value)}
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Phút / vòng
            <input
              name="roundTripMinutes"
              type="number"
              min="1"
              max="1440"
              step="0.5"
              required
              value={roundTripMinutes}
              onChange={(event) => setRoundTripMinutes(event.target.value)}
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            />
          </label>
        </div>
        <p className="mt-3 rounded-lg bg-[#e7f0eb] px-3 py-2 text-sm font-bold text-[#285744]">
          Kết quả xem trước: {preview.toLocaleString("vi-VN")} khách/giờ
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Loại nguồn
            <select
              name="sourceKind"
              defaultValue={threshold.sourceKind}
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            >
              <option value="estimate">Ước lượng</option>
              <option value="customer">Khách cung cấp</option>
              <option value="measured">Đo thực tế</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Nguồn / giả định
            <textarea
              name="sourceNote"
              required
              minLength={8}
              maxLength={1000}
              defaultValue={threshold.sourceNote}
              rows={3}
              className="min-w-0 rounded-lg border border-[#cbd7d1] bg-white p-3 text-sm leading-6"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton />
          {state.status !== "idle" ? (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`text-sm font-bold ${
                state.status === "error" ? "text-[#994737]" : "text-[#28654d]"
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
