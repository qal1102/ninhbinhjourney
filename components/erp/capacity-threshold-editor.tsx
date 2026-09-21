"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateCapacityThresholdAction } from "@/app/erp/capacity-actions";
import type { ErpSiteId } from "@/domain/erp";
import {
  calculateEffectiveCapacity,
  type CapacityModel,
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
  const [capacityModel, setCapacityModel] = useState<CapacityModel>(
    threshold.capacityModel,
  );
  const [staticCapacity, setStaticCapacity] = useState(
    threshold.staticCapacity === null ? "" : String(threshold.staticCapacity),
  );
  const [safetyFactor, setSafetyFactor] = useState(
    String(threshold.safetyFactor),
  );
  const isStatic = capacityModel === "static";
  // Xem trước bằng đúng phép tính mà PostgreSQL dùng cho cột sinh
  // `effective_capacity`. Xem trước một công thức khác với công thức lưu là
  // dựng hai nguồn sự thật cho cùng một con số.
  const preview = calculateEffectiveCapacity({
    capacityModel,
    vehicleCount: Number(vehicleCount),
    seatsPerVehicle: Number(seatsPerVehicle),
    roundTripMinutes: Number(roundTripMinutes),
    staticCapacity: staticCapacity === "" ? null : Number(staticCapacity),
    safetyFactor: Number(safetyFactor),
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
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Cách tính công suất
            <select
              name="capacityModel"
              value={capacityModel}
              onChange={(event) =>
                setCapacityModel(event.target.value as CapacityModel)
              }
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            >
              <option value="round-trip">Quay vòng</option>
              <option value="static">Sức chứa tĩnh</option>
            </select>
            {/* Ví dụ để ngoài ô chọn, không nhét vào nhãn lựa chọn. Đo trên
                production 21/09: nhãn "Quay vòng (thuyền, xe điện, bến)" rộng
                223px trong một ô 259px, tức bị cắt mất đúng phần đang giải
                thích. Ô chọn không phải chỗ viết chú thích. */}
            <span className="mt-1 block text-xs font-normal text-[#7c8882]">
              Quay vòng: thuyền, xe điện, bến. Tĩnh: bãi đỗ, khu chờ, cứu hộ.
            </span>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
            Hệ số an toàn (0–1)
            <input
              name="safetyFactor"
              type="number"
              min="0.001"
              max="1"
              step="0.001"
              required
              value={safetyFactor}
              onChange={(event) => setSafetyFactor(event.target.value)}
              className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
            />
          </label>
        </div>

        {isStatic ? (
          <div className="mt-3">
            <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
              Số chỗ tĩnh
              <input
                name="staticCapacity"
                type="number"
                min="1"
                max="100000"
                required
                value={staticCapacity}
                onChange={(event) => setStaticCapacity(event.target.value)}
                className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
              />
            </label>
            {/* Ba ô vòng quay vẫn phải gửi lên vì cột dưới cơ sở dữ liệu là NOT
                NULL, nhưng với mô hình tĩnh chúng không mô tả gì — nên giấu đi
                thay vì mời người dùng điền một con số vô nghĩa rồi tưởng nó có ý
                nghĩa. */}
            <input type="hidden" name="vehicleCount" value={vehicleCount} />
            <input type="hidden" name="seatsPerVehicle" value={seatsPerVehicle} />
            <input type="hidden" name="roundTripMinutes" value={roundTripMinutes} />
          </div>
        ) : (
          <input type="hidden" name="staticCapacity" value="" />
        )}

        <div className={`mt-3 grid min-w-0 gap-3 sm:grid-cols-3 ${isStatic ? "hidden" : ""}`}>
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
          <span className="mt-1 block text-xs font-medium text-[#4d6b5d]">
            {isStatic
              ? `Sức chứa tĩnh ${staticCapacity || 0} × hệ số ${safetyFactor || 0}`
              : `${vehicleCount || 0} × ${seatsPerVehicle || 0} × 60 ÷ ${roundTripMinutes || 0} × hệ số ${safetyFactor || 0}`}
            . Đây là con số dùng để bán vé và để cảnh báo quá tải.
          </span>
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
