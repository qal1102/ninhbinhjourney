"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCapacityThresholdAction } from "@/app/erp/capacity-actions";
import type { ErpSiteId } from "@/domain/erp";
import {
  CAPACITY_BOTTLENECK_LABELS,
  calculateEffectiveCapacity,
  type CapacityBottleneckKind,
  type CapacityModel,
} from "@/domain/erp-capacity";

/**
 * TC-01. Thêm điểm nghẽn cho một cơ sở.
 *
 * Khách hàng yêu cầu công suất mỗi khung giờ là **MIN của mọi điểm nghẽn** —
 * bến thuyền, cổng soát vé, bãi đỗ, khu chờ, tổ cứu hộ. Phép MIN đó đã chạy từ
 * lâu, nhưng mỗi cơ sở chỉ có **đúng một** ngưỡng vì sản phẩm không có màn hình
 * nào tạo thêm. Đây là màn hình đó.
 */

type CapacityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_STATE: CapacityActionState = { status: "idle", message: "" };

const BOTTLENECK_KINDS = Object.keys(
  CAPACITY_BOTTLENECK_LABELS,
) as CapacityBottleneckKind[];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang thêm…" : "Thêm điểm nghẽn"}
    </button>
  );
}

const inputClass =
  "min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm";
const labelClass = "grid gap-1 text-xs font-bold text-[#5d6f66]";

export function CapacityThresholdCreate({ siteId }: { siteId: ErpSiteId }) {
  const [state, action] = useActionState(
    createCapacityThresholdAction,
    INITIAL_STATE,
  );
  const [capacityModel, setCapacityModel] = useState<CapacityModel>("round-trip");
  const [vehicleCount, setVehicleCount] = useState("1");
  const [seatsPerVehicle, setSeatsPerVehicle] = useState("1");
  const [roundTripMinutes, setRoundTripMinutes] = useState("60");
  const [staticCapacity, setStaticCapacity] = useState("");
  const [safetyFactor, setSafetyFactor] = useState("1");
  const isStatic = capacityModel === "static";
  const preview = calculateEffectiveCapacity({
    capacityModel,
    vehicleCount: Number(vehicleCount),
    seatsPerVehicle: Number(seatsPerVehicle),
    roundTripMinutes: Number(roundTripMinutes),
    staticCapacity: staticCapacity === "" ? null : Number(staticCapacity),
    safetyFactor: Number(safetyFactor),
  });

  return (
    <details className="rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-[#315e4e]">
        Thêm một điểm nghẽn tại cơ sở này
      </summary>
      <form action={action} className="border-t border-[#e4eae7] p-5">
        <p className="mb-4 text-sm leading-6 text-[#697770]">
          Sức chứa bán ra của một khung giờ lấy theo <strong>điểm nghẽn thấp
          nhất</strong>. Thêm đủ các điểm nghẽn thật — bến thuyền, cổng vé, bãi
          đỗ, khu chờ, tổ cứu hộ — thì con số mới phản ánh đúng hiện trường.
        </p>
        <input type="hidden" name="siteId" value={siteId} />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Mã điểm nghẽn
            <input
              name="thresholdCode"
              type="text"
              required
              minLength={4}
              maxLength={40}
              pattern="[A-Za-z0-9\-]+"
              placeholder="TC-PARK-01"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Tên điểm nghẽn
            <input
              name="bottleneckName"
              type="text"
              required
              minLength={3}
              maxLength={160}
              placeholder="Bãi đỗ xe khách"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Loại điểm nghẽn
            <select name="bottleneckKind" defaultValue="boat-pier" className={inputClass}>
              {BOTTLENECK_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {CAPACITY_BOTTLENECK_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Cách tính công suất
            <select
              name="capacityModel"
              value={capacityModel}
              onChange={(event) =>
                setCapacityModel(event.target.value as CapacityModel)
              }
              className={inputClass}
            >
              <option value="round-trip">Quay vòng (thuyền, xe điện, bến)</option>
              <option value="static">Sức chứa tĩnh (bãi đỗ, khu chờ, cứu hộ)</option>
            </select>
          </label>
        </div>

        {isStatic ? (
          <div className="mt-3">
            <label className={labelClass}>
              Số chỗ tĩnh
              <input
                name="staticCapacity"
                type="number"
                min="1"
                max="100000"
                required
                value={staticCapacity}
                onChange={(event) => setStaticCapacity(event.target.value)}
                className={inputClass}
              />
            </label>
            {/* Ba ô vòng quay vẫn phải gửi lên vì cột dưới cơ sở dữ liệu là NOT
                NULL. Với mô hình tĩnh chúng không mô tả gì nên không mời người
                dùng điền — điền một con số vô nghĩa rồi tưởng nó có nghĩa còn
                tệ hơn là bỏ trống. */}
            <input type="hidden" name="vehicleCount" value="1" />
            <input type="hidden" name="seatsPerVehicle" value="1" />
            <input type="hidden" name="roundTripMinutes" value="60" />
          </div>
        ) : (
          <>
            <input type="hidden" name="staticCapacity" value="" />
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Phương tiện hoạt động
                <input
                  name="vehicleCount"
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={vehicleCount}
                  onChange={(event) => setVehicleCount(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Chỗ / phương tiện
                <input
                  name="seatsPerVehicle"
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={seatsPerVehicle}
                  onChange={(event) => setSeatsPerVehicle(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
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
                  className={inputClass}
                />
              </label>
            </div>
          </>
        )}

        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[0.5fr_0.5fr_1fr]">
          <label className={labelClass}>
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
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Loại nguồn
            <select name="sourceKind" defaultValue="estimate" className={inputClass}>
              <option value="estimate">Ước lượng</option>
              <option value="customer">Khách cung cấp</option>
              <option value="measured">Đo thực tế</option>
            </select>
          </label>
          <label className={labelClass}>
            Nguồn / giả định
            <textarea
              name="sourceNote"
              required
              minLength={8}
              maxLength={1000}
              rows={2}
              placeholder="Ghi rõ số này lấy từ đâu, ai xác nhận, ngày nào."
              className="min-w-0 rounded-lg border border-[#cbd7d1] bg-white p-3 text-sm leading-6"
            />
          </label>
        </div>

        <p className="mt-3 rounded-lg bg-[#e7f0eb] px-3 py-2 text-sm font-bold text-[#285744]">
          Kết quả xem trước: {preview.toLocaleString("vi-VN")} khách/giờ
        </p>

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
