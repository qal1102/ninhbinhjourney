"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  decideSopOpeningAssessmentAction,
  submitSopOpeningAssessmentAction,
} from "@/app/erp/sop-actions";
import type { ErpSiteId } from "@/domain/erp";
import type {
  SopOpeningAssessment,
  SopOpeningItem,
} from "@/domain/erp-sop";

type SopActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_STATE: SopActionState = { status: "idle", message: "" };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: SopActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm font-bold ${
        state.status === "error" ? "text-[#994737]" : "text-[#28654d]"
      }`}
    >
      {state.message}
    </p>
  );
}

export function SopOpeningSubmissionForm({
  siteId,
  businessDate,
  items,
  assessment,
}: {
  siteId: ErpSiteId;
  businessDate: string;
  items: SopOpeningItem[];
  assessment: SopOpeningAssessment | null;
}) {
  const [state, action] = useActionState(
    submitSopOpeningAssessmentAction,
    INITIAL_STATE,
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const existingByItem = new Map(
    (assessment?.results ?? []).map((result) => [result.itemId, result]),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="businessDate" value={businessDate} />
      <input
        type="hidden"
        name="expectedVersion"
        value={assessment?.version ?? 0}
      />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {items.map((item) => {
        const existing = existingByItem.get(item.id);
        return (
          <fieldset
            key={item.id}
            className="rounded-2xl border border-[#dce4e0] bg-white p-4 sm:p-5"
          >
            <input type="hidden" name="itemId" value={item.id} />
            <legend className="px-1 text-sm font-black text-[#2f493e]">
              {item.sortOrder}. {item.title}
            </legend>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className="rounded-full bg-[#edf3f0] px-2.5 py-1 text-[#49675a]">
                {item.sopCode}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 ${
                  item.isCritical
                    ? "bg-[#ffebe7] text-[#943c2d]"
                    : "bg-[#f0f2f1] text-[#637169]"
                }`}
              >
                {item.isCritical ? "Trọng yếu" : "Hỗ trợ"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#64736c]">
              {item.operationalSummary}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[0.65fr_1.35fr]">
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
                Kết quả
                <select
                  name={`result:${item.id}`}
                  defaultValue={existing?.result ?? ""}
                  required
                  className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
                >
                  <option value="" disabled>
                    Chọn kết quả
                  </option>
                  <option value="pass">Đạt</option>
                  <option value="fail">Không đạt</option>
                  {!item.isCritical ? (
                    <option value="not-applicable">Không áp dụng</option>
                  ) : null}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
                Ghi chú xử lý
                <input
                  name={`note:${item.id}`}
                  defaultValue={existing?.note ?? ""}
                  maxLength={1200}
                  placeholder="Bắt buộc khi không đạt hoặc không áp dụng"
                  className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
                />
              </label>
            </div>
            <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">
              Tham chiếu bằng chứng (tuỳ chọn)
              <input
                name={`evidence:${item.id}`}
                defaultValue={existing?.evidenceReference ?? ""}
                maxLength={1000}
                placeholder="Mã biên bản, ảnh hiện trường hoặc kênh đã thử"
                className="min-h-11 min-w-0 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
              />
            </label>
          </fieldset>
        );
      })}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton
          label={assessment ? "Gửi lại sau khắc phục" : "Gửi giám đốc quyết định"}
          pendingLabel="Đang gửi checklist…"
        />
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function SopOpeningDecisionForm({
  siteId,
  assessment,
  criticalFailures,
}: {
  siteId: ErpSiteId;
  assessment: SopOpeningAssessment;
  criticalFailures: number;
}) {
  const [state, action] = useActionState(
    decideSopOpeningAssessmentAction,
    INITIAL_STATE,
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [decision, setDecision] = useState<"go" | "no-go" | "risk-accepted">(
    criticalFailures > 0 ? "no-go" : "go",
  );

  return (
    <form action={action} className="rounded-2xl border border-[#dac8a1] bg-[#fffaf0] p-4 sm:p-5">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="assessmentId" value={assessment.id} />
      <input type="hidden" name="expectedVersion" value={assessment.version} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <h3 className="text-lg font-black text-[#4a3a22]">Quyết định mở cửa</h3>
      <p className="mt-1 text-sm leading-6 text-[#75664b]">
        Người quyết định khác người gửi. Mục trọng yếu chưa đạt sẽ chặn GO ở
        máy chủ, không chỉ trên giao diện.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-[#685a40]">
          Kết luận
          <select
            name="decision"
            value={decision}
            onChange={(event) =>
              setDecision(event.target.value as typeof decision)
            }
            className="min-h-11 rounded-lg border border-[#d7c49d] bg-white px-3 text-sm"
          >
            <option value="go" disabled={criticalFailures > 0}>
              GO · cho phép mở cửa
            </option>
            <option value="no-go">NO-GO · chưa mở cửa</option>
            {criticalFailures > 0 ? (
              <option value="risk-accepted">
                Chấp nhận rủi ro bằng văn bản
              </option>
            ) : null}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#685a40]">
          Lý do quyết định
          <input
            name="decisionNote"
            required
            minLength={8}
            maxLength={2000}
            className="min-h-11 min-w-0 rounded-lg border border-[#d7c49d] bg-white px-3 text-sm"
          />
        </label>
      </div>
      {decision === "risk-accepted" ? (
        <label className="mt-3 grid gap-1 text-xs font-bold text-[#8b4437]">
          Văn bản chấp nhận rủi ro · tối thiểu 40 ký tự
          <textarea
            name="riskAcceptance"
            required
            minLength={40}
            maxLength={4000}
            rows={4}
            placeholder="Nêu rõ rủi ro, phạm vi, biện pháp giảm thiểu và người chịu trách nhiệm."
            className="min-w-0 rounded-lg border border-[#dba99f] bg-white p-3 text-sm leading-6"
          />
        </label>
      ) : (
        <input type="hidden" name="riskAcceptance" value="" />
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton label="Ghi quyết định" pendingLabel="Đang ghi quyết định…" />
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
