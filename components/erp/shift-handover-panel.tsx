"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ErpSite } from "@/domain/erp";
import {
  INITIAL_SHIFT_HANDOVER_STATE,
  decideShiftHandoverAction,
  submitShiftHandoverAction,
  type ShiftHandoverActionState,
} from "@/app/erp/shift-handover-actions";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type { ShiftHandover } from "@/lib/erp/shift-handover-repository";

type Colleague = { id: string; name: string; jobTitle: string };

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  handovers: readonly ShiftHandover[];
  colleagues: readonly Colleague[];
  businessDate: string;
};

const STATUS_LABELS: Record<ShiftHandover["status"], string> = {
  submitted: "Chờ người nhận xác nhận",
  accepted: "Đã nhận ca",
  disputed: "Người nhận từ chối",
};

const STATUS_TONE: Record<ShiftHandover["status"], string> = {
  submitted: "bg-[#fff0ce] text-[#77531c]",
  accepted: "bg-[#dff1e8] text-[#246249]",
  disputed: "bg-[#ffe4de] text-[#934336]",
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function Message({ state }: { state: ShiftHandoverActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${
        state.status === "error"
          ? "bg-[#fff0eb] text-[#91483a]"
          : "bg-[#e3f2eb] text-[#245e48]"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  name,
  value,
  tone = "primary",
}: {
  children: React.ReactNode;
  name?: string;
  value?: string;
  tone?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60 ${
        tone === "danger" ? "bg-[#a94e3f] text-white" : "bg-[#183f34] text-white"
      }`}
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

function HandoverForm({
  site,
  colleagues,
  businessDate,
}: {
  site: ErpSite;
  colleagues: readonly Colleague[];
  businessDate: string;
}) {
  const [state, action] = useActionState(
    submitShiftHandoverAction,
    INITIAL_SHIFT_HANDOVER_STATE,
  );
  return (
    <details className="rounded-2xl border border-[#ccd9d3] bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Bàn giao ca · {site.shortName}
        </p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">
          Giao ca cho người tiếp theo, có ký nhận
        </h2>
      </summary>
      <form action={action} className="border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6">
        <input type="hidden" name="siteId" value={site.id} />
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Ngày làm việc
            <input
              name="businessDate"
              type="date"
              required
              defaultValue={businessDate}
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Ca
            <input
              name="shiftLabel"
              required
              defaultValue="Ca sáng 07:00–12:00"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Vị trí
            <input
              name="stationCode"
              required
              defaultValue="GATE-A"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Người nhận ca
            <select
              name="incomingAccountId"
              required
              defaultValue=""
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            >
              <option value="" disabled>
                Chọn người nhận…
              </option>
              {colleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>
                  {colleague.name} · {colleague.jobTitle}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Tiền mặt đếm được (đ)
            <input
              name="cashCountedVnd"
              type="number"
              min={0}
              step={1}
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Theo hệ thống phải có (đ)
            <input
              name="cashExpectedVnd"
              type="number"
              min={0}
              step={1}
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068] md:col-span-2">
            Sự cố còn mở (mã, cách nhau bằng dấu phẩy)
            <input
              name="openIncidentCodes"
              placeholder="INC-TA-071, INC-TA-069"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068] md:col-span-2 xl:col-span-3">
            Thiết bị, tài sản cần lưu ý
            <input
              name="equipmentNote"
              placeholder="Máy quét cổng B chập chờn, đã báo kỹ thuật"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
          Nội dung bàn giao
          <textarea
            name="handoverNote"
            required
            minLength={4}
            maxLength={2_000}
            rows={2}
            className="min-w-0 rounded-xl border border-[#ced8d1] bg-white p-3 text-sm font-medium"
          />
        </label>
        <div className="mt-4">
          <SubmitButton>Gửi bàn giao</SubmitButton>
        </div>
        <Message state={state} />
      </form>
    </details>
  );
}

function DecisionForm({
  handover,
  siteId,
}: {
  handover: ShiftHandover;
  siteId: string;
}) {
  const [state, action] = useActionState(
    decideShiftHandoverAction,
    INITIAL_SHIFT_HANDOVER_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="handoverId" value={handover.id} />
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="expectedVersion" value={handover.version} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Ghi chú khi nhận ca (bắt buộc nếu từ chối)
        <textarea
          name="note"
          rows={2}
          maxLength={2_000}
          className="min-w-0 rounded-xl border border-[#ced8d1] bg-white p-3 text-sm font-medium"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton name="decision" value="accept">
          Nhận ca
        </SubmitButton>
        <SubmitButton name="decision" value="dispute" tone="danger">
          Từ chối nhận
        </SubmitButton>
      </div>
      <Message state={state} />
    </form>
  );
}

export function ShiftHandoverPanel({
  site,
  user,
  handovers,
  colleagues,
  businessDate,
}: Props) {
  return (
    <section className="space-y-4">
      <HandoverForm site={site} colleagues={colleagues} businessDate={businessDate} />

      {handovers.length === 0 ? (
        <p className="rounded-2xl border border-[#d8e0db] bg-white p-5 text-sm text-[#7b8881]">
          Chưa có phiếu bàn giao nào tại {site.shortName}.
        </p>
      ) : (
        <ul className="space-y-3">
          {handovers.map((handover) => (
            <li
              key={handover.id}
              className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-[#20342c]">
                    {handover.shiftLabel} · {handover.stationCode}
                  </p>
                  <p className="text-sm text-[#6e7b75]">
                    {handover.businessDate} · {handover.outgoingDisplayName} →{" "}
                    {handover.incomingDisplayName}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_TONE[handover.status]}`}
                >
                  {STATUS_LABELS[handover.status]}
                </span>
              </div>

              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-[#7b8881]">Tiền mặt đếm được</dt>
                  <dd className="mt-1 font-black text-[#30443b]">
                    {formatVnd(handover.cashCountedVnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7b8881]">Chênh lệch</dt>
                  <dd
                    className={`mt-1 font-black ${
                      handover.cashDifferenceVnd === 0
                        ? "text-[#246249]"
                        : "text-[#934336]"
                    }`}
                  >
                    {formatVnd(handover.cashDifferenceVnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7b8881]">Sự cố còn mở</dt>
                  <dd className="mt-1 font-black text-[#30443b]">
                    {handover.openIncidentCodes.length
                      ? handover.openIncidentCodes.join(", ")
                      : "Không có"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7b8881]">Thiết bị</dt>
                  <dd className="mt-1 text-[#30443b]">
                    {handover.equipmentNote || "Không có ghi chú"}
                  </dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-xs text-[#7b8881]">Nội dung bàn giao</dt>
                  <dd className="mt-1 text-[#30443b]">{handover.handoverNote}</dd>
                </div>
                {handover.decisionNote ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <dt className="text-xs text-[#7b8881]">Ghi chú người nhận</dt>
                    <dd className="mt-1 text-[#30443b]">{handover.decisionNote}</dd>
                  </div>
                ) : null}
              </dl>

              {/* Only the person taking the shift on can close it. Otherwise
                  "bàn giao" means nothing -- the outgoing leader would be
                  signing their own record. */}
              {handover.status === "submitted" &&
              handover.incomingAccountId === user.id ? (
                <DecisionForm handover={handover} siteId={site.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
