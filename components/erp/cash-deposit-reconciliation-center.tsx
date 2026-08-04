"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  decideCashExceptionAction,
  matchCashDepositAction,
  recordBankStatementLineAction,
  reviewCashDepositJournalAction,
  submitCashDepositAction,
  type CashDepositActionState,
} from "@/app/erp/cash-deposit-actions";
import { ERP_SITES, type ErpSite, type ErpSiteId } from "@/domain/erp";
import {
  CASH_DEPOSIT_STATUS_LABELS,
  formatCashDifference,
  isCashDepositOverdue,
  type BankStatementLine,
  type CashDeposit,
  type CashDepositEligibleShift,
} from "@/domain/erp-cash-deposit";
import {
  canDecideCashException,
  canReviewCashDeposit,
  canSubmitCashDeposit,
} from "@/domain/erp-role-policy";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

const INITIAL_CASH_DEPOSIT_ACTION_STATE: CashDepositActionState = {
  status: "idle",
  message: "",
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function siteName(siteId: ErpSiteId) {
  return ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId;
}

function statusMeta(status: CashDeposit["status"]) {
  const values = {
    submitted: { className: "bg-[#e3edf4] text-[#315f79]" },
    exception: { className: "bg-[#ffe5df] text-[#934336]" },
    "accounting-review": { className: "bg-[#fff0ce] text-[#77531c]" },
    posted: { className: "bg-[#dff1e8] text-[#246249]" },
  } as const;
  return { label: CASH_DEPOSIT_STATUS_LABELS[status], ...values[status] };
}

function ActionMessage({ state }: { state: CashDepositActionState }) {
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

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

function SiteSelect({
  sites,
  value,
  onChange,
}: {
  sites: readonly ErpSite[];
  value: ErpSiteId;
  onChange: (siteId: ErpSiteId) => void;
}) {
  if (sites.length <= 1) {
    return <input type="hidden" name="siteId" value={value} />;
  }
  return (
    <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
      Cơ sở
      <select
        name="siteId"
        value={value}
        onChange={(event) => onChange(event.target.value as ErpSiteId)}
        className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.shortName}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitDepositForm({
  sites,
  eligibleShiftsBySite,
}: {
  sites: readonly ErpSite[];
  eligibleShiftsBySite: Readonly<Record<string, readonly CashDepositEligibleShift[]>>;
}) {
  const [state, action] = useActionState(
    submitCashDepositAction,
    INITIAL_CASH_DEPOSIT_ACTION_STATE,
  );
  const [siteId, setSiteId] = useState<ErpSiteId>(sites[0]?.id ?? "trang-an");
  const [selectedShiftIds, setSelectedShiftIds] = useState<readonly string[]>([]);
  const eligibleShifts = eligibleShiftsBySite[siteId] ?? [];
  function changeSite(next: ErpSiteId) {
    setSiteId(next);
    setSelectedShiftIds([]);
  }
  function toggleShift(id: string, checked: boolean) {
    setSelectedShiftIds((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }
  return (
    <details className="rounded-2xl border border-[#ccd9d3] bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Nộp quỹ
        </p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">
          Gộp ca đã chốt thành một lượt nộp quỹ
        </h2>
      </summary>
      <form
        action={action}
        className="grid gap-3 border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6"
      >
        <SiteSelect sites={sites} value={siteId} onChange={changeSite} />
        <fieldset className="grid gap-2">
          <legend className="text-xs font-bold text-[#5f7068]">
            Chọn ca đã chốt (tiền mặt tại quầy)
          </legend>
          {eligibleShifts.length === 0 ? (
            <p className="text-sm font-medium text-[#5f7068]">
              Chưa có ca nào đã chốt và còn tiền mặt chưa nộp quỹ tại{" "}
              {siteName(siteId)}.
            </p>
          ) : (
            eligibleShifts.map((shift) => (
              <label
                key={shift.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8e4] bg-white px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedShiftIds.includes(shift.id)}
                    onChange={(event) => toggleShift(shift.id, event.target.checked)}
                    className="size-4"
                  />
                  <span className="font-bold text-[#20342c]">{shift.shiftCode}</span>
                  <span className="text-[#5f7068]">
                    {formatDate(shift.businessDate)} · {shift.station}
                  </span>
                </span>
                <span className="font-black text-[#20342c]">
                  {formatVnd(shift.cashVnd)}
                </span>
              </label>
            ))
          )}
        </fieldset>
        <input type="hidden" name="shiftCloseIds" value={selectedShiftIds.join(",")} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Số tài khoản ngân hàng nhận tiền
            <input
              name="bankAccountRef"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Ghi chú
            <input
              name="note"
              required
              minLength={4}
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
            />
          </label>
        </div>
        <div>
          <SubmitButton>Ghi nhận đã nộp quỹ</SubmitButton>
        </div>
        <ActionMessage state={state} />
      </form>
    </details>
  );
}

function RecordStatementLineForm({ sites }: { sites: readonly ErpSite[] }) {
  const [state, action] = useActionState(
    recordBankStatementLineAction,
    INITIAL_CASH_DEPOSIT_ACTION_STATE,
  );
  const [siteId, setSiteId] = useState<ErpSiteId>(sites[0]?.id ?? "trang-an");
  return (
    <details className="rounded-2xl border border-[#ccd9d3] bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Sao kê ngân hàng
        </p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">
          Nhập tay một dòng sao kê
        </h2>
      </summary>
      <form
        action={action}
        className="grid gap-3 border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6 md:grid-cols-2"
      >
        <SiteSelect sites={sites} value={siteId} onChange={setSiteId} />
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Số tài khoản ngân hàng
          <input
            name="bankAccountRef"
            required
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Ngày sao kê
          <input
            name="statementDate"
            type="date"
            required
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Số tiền
          <input
            name="amountVnd"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Mã tham chiếu (nếu có)
          <input
            name="externalRef"
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#5f7068] md:col-span-2">
          Nội dung sao kê
          <input
            name="description"
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <div className="md:col-span-2">
          <SubmitButton>Ghi nhận dòng sao kê</SubmitButton>
        </div>
        <div className="md:col-span-2">
          <ActionMessage state={state} />
        </div>
      </form>
    </details>
  );
}

function MatchForm({
  deposit,
  candidateLines,
}: {
  deposit: CashDeposit;
  candidateLines: readonly BankStatementLine[];
}) {
  const [state, action] = useActionState(
    matchCashDepositAction,
    INITIAL_CASH_DEPOSIT_ACTION_STATE,
  );
  if (candidateLines.length === 0) {
    return (
      <p className="text-xs font-medium text-[#5f7068]">
        Chưa có dòng sao kê nào cùng số tài khoản {deposit.bankAccountRef} để đối khớp.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input type="hidden" name="siteId" value={deposit.siteId} />
      <input type="hidden" name="depositId" value={deposit.id} />
      <input type="hidden" name="expectedDepositVersion" value={deposit.version} />
      <select
        name="statementLineCandidate"
        required
        className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          const [id, version] = event.currentTarget.value.split("|");
          (form.elements.namedItem("statementLineId") as HTMLInputElement).value = id ?? "";
          (form.elements.namedItem("expectedLineVersion") as HTMLInputElement).value =
            version ?? "";
        }}
      >
        <option value="">— Chọn dòng sao kê —</option>
        {candidateLines.map((line) => (
          <option key={line.id} value={`${line.id}|${line.version}`}>
            {formatDate(line.statementDate)} · {formatVnd(line.amountVnd)}
            {line.description ? ` · ${line.description}` : ""}
          </option>
        ))}
      </select>
      <input type="hidden" name="statementLineId" />
      <input type="hidden" name="expectedLineVersion" />
      <input type="hidden" name="note" value="Đối khớp với sao kê ngân hàng." />
      <SubmitButton>Đối khớp</SubmitButton>
      <div className="sm:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function ExceptionDecisionForm({ deposit }: { deposit: CashDeposit }) {
  const [state, action] = useActionState(
    decideCashExceptionAction,
    INITIAL_CASH_DEPOSIT_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="siteId" value={deposit.siteId} />
      <input type="hidden" name="depositId" value={deposit.id} />
      <input type="hidden" name="expectedVersion" value={deposit.version} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Giải trình quyết định
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          className="min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 py-2 text-sm font-medium outline-none focus:border-[#4f806f]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="approve"
          value="true"
          className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
        >
          Duyệt chênh lệch, tiếp tục ghi sổ
        </button>
        <button
          type="submit"
          name="approve"
          value="false"
          className="min-h-11 rounded-xl border border-[#b9c8c1] bg-white px-4 text-sm font-black text-[#385047]"
        >
          Trả lại kế toán
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function JournalReviewForm({ deposit }: { deposit: CashDeposit }) {
  const [state, action] = useActionState(
    reviewCashDepositJournalAction,
    INITIAL_CASH_DEPOSIT_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="siteId" value={deposit.siteId} />
      <input type="hidden" name="depositId" value={deposit.id} />
      <input type="hidden" name="expectedDepositVersion" value={deposit.version} />
      {/* Journal version luôn = 1 ở lần chuẩn bị đầu tiên trong luồng này —
          bút toán được dựng và chuyển thẳng pending-checker trong cùng một
          bước với đối khớp/duyệt ngoại lệ, không có bước "checker-returned"
          quay lại tăng version trước khi tới đây. */}
      <input type="hidden" name="expectedJournalVersion" value={1} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Ghi chú kiểm tra
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          className="min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 py-2 text-sm font-medium outline-none focus:border-[#4f806f]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
        >
          Duyệt, ghi sổ
        </button>
        <button
          type="submit"
          name="decision"
          value="return"
          className="min-h-11 rounded-xl border border-[#b9c8c1] bg-white px-4 text-sm font-black text-[#385047]"
        >
          Trả lại kế toán
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function DepositCard({
  user,
  deposit,
  unmatchedLines,
}: {
  user: CurrentErpUser;
  deposit: CashDeposit;
  unmatchedLines: readonly BankStatementLine[];
}) {
  const meta = statusMeta(deposit.status);
  const overdue = isCashDepositOverdue(deposit);
  const candidateLines = unmatchedLines.filter(
    (line) => line.bankAccountRef === deposit.bankAccountRef,
  );
  return (
    <li className="rounded-2xl border border-[#e2e8e4] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#20342c]">{deposit.depositCode}</p>
          <p className="text-xs font-medium text-[#5f7068]">
            {siteName(deposit.siteId)} · {formatVnd(deposit.amountVnd)} · nộp{" "}
            {formatDate(deposit.submittedAt, true)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
          {meta.label}
        </span>
      </div>
      {deposit.status === "exception" ? (
        <p className="mt-2 text-xs font-bold text-[#934336]">
          {formatCashDifference(deposit.differenceVnd)}
          {overdue ? " — đã quá hạn xử lý" : ""}
          {deposit.exceptionDueAt
            ? ` · hạn ${formatDate(deposit.exceptionDueAt, true)}`
            : ""}
        </p>
      ) : null}
      <div className="mt-3">
        {deposit.status === "submitted" && canSubmitCashDeposit(user.role) ? (
          <MatchForm deposit={deposit} candidateLines={candidateLines} />
        ) : null}
        {deposit.status === "exception" && canDecideCashException(user.role) ? (
          <ExceptionDecisionForm deposit={deposit} />
        ) : null}
        {deposit.status === "accounting-review" && canReviewCashDeposit(user.role) ? (
          <JournalReviewForm deposit={deposit} />
        ) : null}
        {deposit.status === "posted" ? (
          <p className="text-xs font-medium text-[#5f7068]">
            Đã ghi sổ {formatDate(deposit.reconciledAt, true)} bởi{" "}
            {deposit.reconciledByAccountId}.
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function CashDepositReconciliationCenter({
  user,
  sites,
  eligibleShiftsBySite,
  deposits,
  unmatchedStatementLines,
  embedded = false,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  eligibleShiftsBySite: Readonly<Record<string, readonly CashDepositEligibleShift[]>>;
  deposits: readonly CashDeposit[];
  unmatchedStatementLines: readonly BankStatementLine[];
  embedded?: boolean;
}) {
  if (user.role === "employee" || user.role === "manager") {
    return null;
  }
  const body = (
    <div className="grid gap-4">
      {canSubmitCashDeposit(user.role) && sites.length > 0 ? (
        <>
          <SubmitDepositForm sites={sites} eligibleShiftsBySite={eligibleShiftsBySite} />
          <RecordStatementLineForm sites={sites} />
        </>
      ) : null}
      <div>
        <h3 className="text-sm font-black text-[#20342c]">
          Lượt nộp quỹ ({deposits.length})
        </h3>
        {deposits.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-[#ccd9d3] bg-white p-5 text-sm font-medium text-[#5f7068]">
            Chưa có lượt nộp quỹ nào.
          </p>
        ) : (
          <ul className="mt-2 grid gap-3">
            {deposits.map((deposit) => (
              <DepositCard
                key={deposit.id}
                user={user}
                deposit={deposit}
                unmatchedLines={unmatchedStatementLines}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <section className="grid gap-4">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Đối soát tiền mặt
        </p>
        <h2 className="text-2xl font-black text-[#20342c]">
          Nộp quỹ → ngân hàng → đối chiếu sao kê
        </h2>
      </header>
      {body}
    </section>
  );
}
