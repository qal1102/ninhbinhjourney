"use client";

import { useActionState, useMemo, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  changeAccountingPeriodAction,
  prepareShiftCloseAccountingJournalAction,
  reviewAccountingJournalAction,
  reverseAccountingJournalAction,
} from "@/app/erp/accounting-actions";
import {
  type AccountingJournal,
  type AccountingJournalLine,
  type AccountingPeriod,
} from "@/domain/erp-accounting";
import { ERP_SITES, type ErpSite, type ErpSiteId } from "@/domain/erp";
import type {
  BankStatementLine,
  CashDeposit,
  CashDepositEligibleShift,
} from "@/domain/erp-cash-deposit";
import {
  SHIFT_CLOSE_MATERIALITY_VND,
  type ShiftCloseRecord,
} from "@/domain/erp-shift-close";
import type {
  SupplierApInvoice,
  SupplierApSupplier,
} from "@/domain/erp-supplier-ap";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { CashDepositReconciliationCenter } from "./cash-deposit-reconciliation-center";
import { ShiftCloseAccountingQueue } from "./shift-close-workflow";
import { SupplierApControlCenter } from "./supplier-ap-control-center";

const INITIAL_ACTION_STATE = {
  status: "idle",
  message: "",
} as const;

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

function journalTotal(lines: readonly AccountingJournalLine[]) {
  return lines.reduce(
    (totals, line) => ({
      debitVnd: totals.debitVnd + line.debitVnd,
      creditVnd: totals.creditVnd + line.creditVnd,
    }),
    { debitVnd: 0, creditVnd: 0 },
  );
}

function journalStatus(status: string) {
  if (status === "pending-checker") {
    return {
      label: "Chờ kế toán trưởng",
      tone: "bg-[#fff0ce] text-[#77531c]",
    };
  }
  if (status === "checker-returned") {
    return {
      label: "Trả về kế toán",
      tone: "bg-[#ffe5df] text-[#934336]",
    };
  }
  if (status === "posted") {
    return {
      label: "Đã ghi sổ",
      tone: "bg-[#dff1e8] text-[#246249]",
    };
  }
  return {
    label: "Bản nháp",
    tone: "bg-[#e3edf4] text-[#315f79]",
  };
}

function ActionMessage({
  state,
}: {
  state: {
    status: "idle" | "success" | "error";
    message: string;
  };
}) {
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
  children: ReactNode;
  name?: string;
  value?: string;
  tone?: "primary" | "danger" | "secondary";
}) {
  const { pending } = useFormStatus();
  const style =
    tone === "danger"
      ? "bg-[#a94e3f] text-white"
      : tone === "secondary"
        ? "border border-[#bac8c1] bg-white text-[#385047]"
        : "bg-[#183f34] text-white";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60 ${style}`}
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

function PrepareJournalForm({ record }: { record: ShiftCloseRecord }) {
  const [state, action] = useActionState(
    prepareShiftCloseAccountingJournalAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e1e7e3] pt-4">
      <input type="hidden" name="workflowId" value={record.id} />
      <input
        type="hidden"
        name="expectedSourceVersion"
        value={record.version}
      />
      <label className="block text-xs font-bold text-[#617169]">
        Ghi chú kiểm tra nguồn
        <textarea
          name="note"
          required
          minLength={4}
          maxLength={500}
          rows={2}
          defaultValue="Đã kiểm tra báo cáo ca, nguồn thanh toán và chênh lệch bàn giao."
          className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm font-medium outline-none focus:border-[#4f806f]"
        />
      </label>
      <div className="mt-3">
        <SubmitButton>Lập bút toán và gửi kiểm tra</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function ReviewJournalForm({ journal }: { journal: AccountingJournal }) {
  const [state, action] = useActionState(
    reviewAccountingJournalAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form
      action={action}
      className="rounded-xl border border-[#d7e0db] bg-white p-4"
    >
      <input type="hidden" name="journalId" value={journal.id} />
      <input type="hidden" name="expectedVersion" value={journal.version} />
      <label className="block text-xs font-bold text-[#617169]">
        Kết luận kiểm tra
        <textarea
          name="note"
          required
          minLength={4}
          maxLength={500}
          rows={3}
          placeholder="Nêu nguồn đã đối chiếu, sai lệch nếu có và căn cứ quyết định."
          className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm outline-none focus:border-[#4f806f]"
        />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SubmitButton name="decision" value="approve">
          Duyệt và ghi sổ
        </SubmitButton>
        <SubmitButton name="decision" value="return" tone="danger">
          Trả kế toán bổ sung
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function ReverseJournalForm({ journal }: { journal: AccountingJournal }) {
  const [state, action] = useActionState(
    reverseAccountingJournalAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form
      action={action}
      className="rounded-xl border border-[#ead6d0] bg-[#fffaf8] p-4"
    >
      <input type="hidden" name="journalId" value={journal.id} />
      <input type="hidden" name="expectedVersion" value={journal.version} />
      <label className="block text-xs font-bold text-[#704d43]">
        Lý do đảo bút toán
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          rows={2}
          placeholder="Nêu sai sót, chứng từ thay thế và hướng xử lý tiếp theo."
          className="mt-1 w-full rounded-xl border border-[#dfc5bd] bg-white p-3 text-sm outline-none"
        />
      </label>
      <div className="mt-3">
        <SubmitButton tone="danger">Tạo bút toán đảo</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function PeriodControl({ period }: { period: AccountingPeriod }) {
  const [state, action] = useActionState(
    changeAccountingPeriodAction,
    INITIAL_ACTION_STATE,
  );
  const isOpen = period.status === "open";
  return (
    <form
      action={action}
      className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="periodKey" value={period.periodKey} />
      <input type="hidden" name="expectedVersion" value={period.version} />
      <input type="hidden" name="action" value={isOpen ? "lock" : "reopen"} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
            Kỳ {period.periodKey}
          </p>
          <h2 className="mt-1 text-xl font-black text-[#203a30]">
            {isOpen ? "Đang mở ghi sổ" : "Đã khóa ghi sổ"}
          </h2>
          <p className="mt-1 text-xs text-[#7b8882]">
            {formatDate(period.startsOn)} – {formatDate(period.endsOn)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            isOpen
              ? "bg-[#dff1e8] text-[#246249]"
              : "bg-[#edf0ee] text-[#607068]"
          }`}
        >
          {isOpen ? "Mở" : "Đã khóa"}
        </span>
      </div>
      <label className="mt-4 block text-xs font-bold text-[#617169]">
        {isOpen ? "Căn cứ khóa kỳ" : "Lý do mở lại kỳ"}
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          rows={2}
          placeholder={
            isOpen
              ? "Xác nhận các đối soát và hồ sơ cần thiết đã hoàn tất."
              : "Nêu sai sót cần điều chỉnh và người chịu trách nhiệm."
          }
          className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm outline-none focus:border-[#4f806f]"
        />
      </label>
      <div className="mt-3">
        <SubmitButton tone={isOpen ? "primary" : "danger"}>
          {isOpen ? "Khóa kỳ" : "Mở lại kỳ"}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

type LedgerAccount = {
  accountCode: string;
  accountName: string;
  debitVnd: number;
  creditVnd: number;
};

function TrialBalance({
  journals,
}: {
  journals: readonly AccountingJournal[];
}) {
  const rows = useMemo(() => {
    const accounts = new Map<string, LedgerAccount>();
    for (const journal of journals) {
      if (journal.status !== "posted") continue;
      for (const line of journal.lines) {
        const current = accounts.get(line.accountCode) ?? {
          accountCode: line.accountCode,
          accountName: line.accountName,
          debitVnd: 0,
          creditVnd: 0,
        };
        current.debitVnd += line.debitVnd;
        current.creditVnd += line.creditVnd;
        accounts.set(line.accountCode, current);
      }
    }
    return [...accounts.values()].sort((left, right) =>
      left.accountCode.localeCompare(right.accountCode, "vi"),
    );
  }, [journals]);
  const totals = rows.reduce(
    (value, row) => ({
      debitVnd: value.debitVnd + row.debitVnd,
      creditVnd: value.creditVnd + row.creditVnd,
    }),
    { debitVnd: 0, creditVnd: 0 },
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
      <div className="border-b border-[#e2e8e4] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Sổ tài khoản
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#20342c]">
              Cân đối phát sinh đã ghi sổ
            </h2>
            <p className="mt-1 text-sm text-[#6d7a73]">
              Tổng Nợ và tổng Có phải bằng nhau trên toàn bộ bút toán.
            </p>
          </div>
          <p className="text-sm font-black text-[#2e6752]">
            {formatVnd(totals.debitVnd)} / {formatVnd(totals.creditVnd)}
          </p>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="divide-y divide-[#e7ece9] md:hidden">
            {rows.map((row) => (
              <article key={row.accountCode} className="space-y-3 px-5 py-4">
                <div>
                  <p className="text-sm font-black text-[#294238]">
                    {row.accountCode} · {row.accountName}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-[#f5f8f6] p-3">
                    <dt className="text-[#6c7b74]">Phát sinh Nợ</dt>
                    <dd className="mt-1 break-words font-black text-[#2d4138]">
                      {formatVnd(row.debitVnd)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#f5f8f6] p-3">
                    <dt className="text-[#6c7b74]">Phát sinh Có</dt>
                    <dd className="mt-1 break-words font-black text-[#2d4138]">
                      {formatVnd(row.creditVnd)}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs font-black text-[#48675a]">
                  Chênh lệch {formatVnd(row.debitVnd - row.creditVnd)}
                </p>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f8f6] text-xs uppercase tracking-[0.08em] text-[#6c7b74]">
              <tr>
                <th className="px-5 py-3">Tài khoản</th>
                <th className="px-5 py-3">Tên tài khoản</th>
                <th className="px-5 py-3 text-right">Phát sinh Nợ</th>
                <th className="px-5 py-3 text-right">Phát sinh Có</th>
                <th className="px-5 py-3 text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ece9]">
              {rows.map((row) => (
                <tr key={row.accountCode}>
                  <td className="px-5 py-3 font-black text-[#294238]">
                    {row.accountCode}
                  </td>
                  <td className="px-5 py-3 text-[#5f6f67]">
                    {row.accountName}
                  </td>
                  <td className="px-5 py-3 text-right font-bold">
                    {formatVnd(row.debitVnd)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold">
                    {formatVnd(row.creditVnd)}
                  </td>
                  <td className="px-5 py-3 text-right font-black text-[#48675a]">
                    {formatVnd(row.debitVnd - row.creditVnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-[#75817b]">
          Chưa có bút toán nào được kế toán trưởng ghi sổ.
        </p>
      )}
    </section>
  );
}

function JournalCard({
  journal,
  user,
  defaultOpen,
  hasReversal,
}: {
  journal: AccountingJournal;
  user: CurrentErpUser;
  defaultOpen?: boolean;
  hasReversal: boolean;
}) {
  const status = journalStatus(journal.status);
  const totals = journalTotal(journal.lines);
  const sourceLabel = journal.reversalOfJournalId
    ? "Đảo bút toán"
    : journal.sourceType === "supplier-invoice"
      ? "Hóa đơn nhà cung cấp"
      : "Doanh thu ca";
  const sourceReference =
    journal.sourceType === "supplier-invoice"
      ? journal.sourceSupplierInvoiceId
      : journal.sourceWorkflowId;
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm open:border-[#8eaa9e]"
    >
      <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[0.7fr_1.2fr_0.8fr_auto] sm:items-center sm:p-5">
        <div>
          <p className="text-xs font-black text-[#65776e]">
            {journal.journalCode}
          </p>
          <p className="mt-1 text-xs text-[#87928d]">
            {siteName(journal.siteId)}
          </p>
        </div>
        <div>
          <p className="font-black text-[#293f35]">
            {sourceLabel} · {formatDate(journal.businessDate)}
          </p>
          <p className="mt-1 break-all text-xs text-[#74827b]">
            Nguồn {sourceReference ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#7c8882]">Tổng phát sinh</p>
          <p className="mt-1 font-black text-[#2d4138]">
            {formatVnd(totals.debitVnd)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${status.tone}`}
          >
            {status.label}
          </span>
          {hasReversal ? (
            <span className="rounded-full bg-[#edf0ee] px-2.5 py-1 text-[11px] font-black text-[#607068]">
              Đã có bút toán đảo
            </span>
          ) : null}
        </div>
      </summary>
      <div className="border-t border-[#e5eae7] bg-[#f8faf8] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-[#30443b]">Định khoản</h3>
              <span
                className={`text-xs font-black ${
                  totals.debitVnd === totals.creditVnd
                    ? "text-[#35705a]"
                    : "text-[#a34a3c]"
                }`}
              >
                Nợ {formatVnd(totals.debitVnd)} · Có{" "}
                {formatVnd(totals.creditVnd)}
              </span>
            </div>
            <div className="mt-3 divide-y divide-[#e8ece9]">
              {journal.lines.map((line) => (
                <div
                  key={line.id}
                  className="grid gap-1 py-3 text-xs sm:grid-cols-[auto_1fr_auto_auto] sm:gap-3"
                >
                  <strong>{line.accountCode}</strong>
                  <span className="text-[#68776f]">{line.accountName}</span>
                  <span className="font-bold">
                    Nợ {formatVnd(line.debitVnd)}
                  </span>
                  <span className="font-bold">
                    Có {formatVnd(line.creditVnd)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-3">
            <dl className="grid gap-2 rounded-xl border border-[#dfe6e2] bg-white p-4 text-xs">
              <div>
                <dt className="text-[#7a8781]">Kế toán lập</dt>
                <dd className="mt-1 font-black">{journal.makerAccountId}</dd>
                <dd className="mt-1 leading-5 text-[#67766f]">
                  {journal.makerNote}
                </dd>
              </div>
              <div className="border-t border-[#e7ece9] pt-3">
                <dt className="text-[#7a8781]">Kế toán trưởng kiểm tra</dt>
                <dd className="mt-1 font-black">
                  {journal.checkerAccountId ?? "Chưa kiểm tra"}
                </dd>
                {journal.checkerNote ? (
                  <dd className="mt-1 leading-5 text-[#67766f]">
                    {journal.checkerNote}
                  </dd>
                ) : null}
              </div>
              <div className="border-t border-[#e7ece9] pt-3">
                <dt className="text-[#7a8781]">Mốc xử lý</dt>
                <dd className="mt-1 leading-5 text-[#53645c]">
                  Gửi kiểm tra: {formatDate(journal.submittedAt, true)}
                  <br />
                  Ghi sổ: {formatDate(journal.postedAt, true)}
                </dd>
              </div>
            </dl>
            {user.role === "chief-accountant" &&
            journal.sourceType === "shift-close" &&
            journal.status === "pending-checker" ? (
              <ReviewJournalForm journal={journal} />
            ) : null}
            {/* Hoan but mo cho ca chot ca lan nop quy tien mat -- dung chung
                mot RPC erp_accounting_reverse_journal (xem accounting-actions.ts).
                AP (supplier-invoice) chua mo, giu dung pham vi da chan o server action. */}
            {user.role === "chief-accountant" &&
            (journal.sourceType === "shift-close" || journal.sourceType === "cash-deposit") &&
            journal.status === "posted" &&
            !journal.reversalOfJournalId &&
            !hasReversal ? (
              <ReverseJournalForm journal={journal} />
            ) : null}
          </aside>
        </div>
      </div>
    </details>
  );
}

export function AccountingControlCenter({
  user,
  shiftClosures,
  journals,
  periods,
  supplierApInvoices,
  supplierApSuppliers,
  cashSites,
  cashDeposits,
  cashUnmatchedStatementLines,
  cashEligibleShiftsBySite,
  initialSourceId,
}: {
  user: CurrentErpUser;
  shiftClosures: readonly ShiftCloseRecord[];
  journals: readonly AccountingJournal[];
  periods: readonly AccountingPeriod[];
  supplierApInvoices: readonly SupplierApInvoice[];
  supplierApSuppliers: readonly SupplierApSupplier[];
  cashSites: readonly ErpSite[];
  cashDeposits: readonly CashDeposit[];
  cashUnmatchedStatementLines: readonly BankStatementLine[];
  cashEligibleShiftsBySite: Readonly<Record<string, readonly CashDepositEligibleShift[]>>;
  initialSourceId?: string;
}) {
  const journalBySource = new Map<string, AccountingJournal>();
  for (const journal of [...journals]
    .filter(
      (item) =>
        item.sourceType === "shift-close" &&
        Boolean(item.sourceWorkflowId) &&
        !item.reversalOfJournalId,
    )
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))) {
    if (journal.sourceWorkflowId) {
      journalBySource.set(journal.sourceWorkflowId, journal);
    }
  }
  const eligibleSources = shiftClosures.filter((record) => {
    if (
      ![
        "manager-approved",
        "accounting-review",
        "director-approved",
      ].includes(record.status)
    ) {
      return false;
    }
    if (
      Math.abs(record.differenceVnd) > SHIFT_CLOSE_MATERIALITY_VND &&
      record.status !== "director-approved"
    ) {
      return false;
    }
    const current = journalBySource.get(record.id);
    return !current || current.status === "checker-returned";
  });
  const materialExceptions = shiftClosures.filter(
    (record) =>
      Math.abs(record.differenceVnd) > SHIFT_CLOSE_MATERIALITY_VND &&
      ["manager-approved", "accounting-review"].includes(record.status),
  );
  const pendingCount = journals.filter(
    (journal) =>
      journal.sourceType === "shift-close" &&
      journal.status === "pending-checker",
  ).length;
  const returnedCount = journals.filter(
    (journal) =>
      journal.sourceType === "shift-close" &&
      journal.status === "checker-returned",
  ).length;
  const posted = journals.filter((journal) => journal.status === "posted");
  const postedTotal = posted.reduce(
    (total, journal) => total + journalTotal(journal.lines).debitVnd,
    0,
  );
  const reversalTargets = new Set(
    journals
      .map((journal) => journal.reversalOfJournalId)
      .filter((value): value is string => Boolean(value)),
  );
  const postedSiteCount = new Set(posted.map((journal) => journal.siteId)).size;
  const reversalCount = posted.filter((journal) =>
    Boolean(journal.reversalOfJournalId),
  ).length;
  const overviewMetrics: readonly (readonly [string, string, string])[] =
    user.role === "director"
      ? [
          ["Đã ghi sổ", String(posted.length), "bút toán có nguồn"],
          ["Tổng phát sinh Nợ", formatVnd(postedTotal), "trên số đã ghi nhận"],
          ["Địa điểm có phát sinh", String(postedSiteCount), "địa điểm"],
          ["Bút toán đảo", String(reversalCount), "điều chỉnh đã ghi nhận"],
        ]
      : [
          [
            user.role === "accountant"
              ? "Nguồn đủ điều kiện"
              : "Chờ kiểm tra",
            String(
              user.role === "accountant" ? eligibleSources.length : pendingCount,
            ),
            "hồ sơ ca",
          ],
          ["Bị trả bổ sung", String(returnedCount), "bút toán ca"],
          ["Đã ghi sổ", String(posted.length), "bút toán có nguồn"],
          ["Tổng phát sinh Nợ", formatVnd(postedTotal), "trên số đã ghi nhận"],
        ];
  const roleTitle =
    user.role === "chief-accountant"
      ? "Kiểm soát & sổ cái"
      : user.role === "director"
        ? "Tài chính đã ghi nhận"
        : "Đối soát & lập bút toán";

  return (
    <div className="min-w-0 space-y-5">
      <header className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white shadow-xl shadow-[#173f34]/10 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9d5ca]">
          Tài chính & báo cáo · toàn vùng
        </p>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-display text-4xl sm:text-6xl">{roleTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
              {user.role === "chief-accountant"
                ? "Kiểm tra độc lập, ghi sổ, đảo bút toán và kiểm soát kỳ kế toán."
                : user.role === "director"
                  ? "Theo dõi số đã ghi sổ và mở từng bút toán về đúng ca nguồn."
                  : "Nhận số từ ca đã duyệt, đối chiếu nguồn và chuyển kế toán trưởng kiểm tra."}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-[#e4efeb]">
            {user.name} · {user.jobTitle}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {overviewMetrics.map(([label, value, note]) => (
          <article
            key={label}
            className="min-w-0 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="text-xs text-[#6e7b75]">{label}</p>
            <p className="mt-2 break-words text-2xl font-black text-[#203a30] sm:text-3xl">
              {value}
            </p>
            <p className="mt-2 text-xs text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      <div id="supplier-payables" className="scroll-mt-24">
        <SupplierApControlCenter
          user={user}
          invoices={supplierApInvoices}
          suppliers={supplierApSuppliers}
          embedded
        />
      </div>

      <div id="cash-deposits" className="scroll-mt-24">
        <div className="rounded-2xl border border-[#cbdad3] bg-[#f5faf7] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Đối soát tiền mặt
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Nộp quỹ → ngân hàng → đối chiếu sao kê
          </h2>
        </div>
        <div className="mt-4">
          <CashDepositReconciliationCenter
            user={user}
            sites={cashSites}
            eligibleShiftsBySite={cashEligibleShiftsBySite}
            deposits={cashDeposits}
            unmatchedStatementLines={cashUnmatchedStatementLines}
            embedded
          />
        </div>
      </div>

      {user.role === "accountant" && materialExceptions.length > 0 ? (
        <ShiftCloseAccountingQueue
          records={shiftClosures}
          user={user}
          materialOnly
        />
      ) : null}

      {user.role === "accountant" ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-[#cbdad3] bg-[#f5faf7] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Hàng lập bút toán
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              {eligibleSources.length} ca đã đủ điều kiện
            </h2>
          </div>
          {eligibleSources.map((record) => (
            <article
              key={record.id}
              id={`source-${record.id}`}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                initialSourceId === record.id
                  ? "border-[#b99143] ring-4 ring-[#f1ddb2]/50"
                  : "border-[#d8e0db]"
              }`}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-[#293f35]">
                      {record.shiftCode}
                    </h3>
                    <span className="rounded-full bg-[#e7e6f4] px-2.5 py-1 text-[11px] font-black text-[#5c5486]">
                      {siteName(record.siteId)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#64736c]">
                    {record.station} · {record.shiftLabel} ·{" "}
                    {record.ticketsSold.toLocaleString("vi-VN")} vé
                  </p>
                  <p className="mt-1 text-xs text-[#7c8882]">
                    Mã hạch toán {record.financeCode} · phiên bản{" "}
                    {record.version}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-[#7c8882]">Doanh thu hệ thống</p>
                  <p className="mt-1 text-xl font-black text-[#203a30]">
                    {formatVnd(record.amounts.grossVnd)}
                  </p>
                  <p
                    className={`mt-1 text-xs font-black ${
                      record.differenceVnd
                        ? "text-[#9a4b3d]"
                        : "text-[#34715b]"
                    }`}
                  >
                    Chênh lệch {formatVnd(record.differenceVnd)}
                  </p>
                </div>
              </div>
              <PrepareJournalForm record={record} />
            </article>
          ))}
          {eligibleSources.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">
              Chưa có ca nào đã đối soát đủ điều kiện lập bút toán.
            </p>
          ) : null}
        </section>
      ) : null}

      {user.role === "chief-accountant" && periods.length ? (
        <section className="grid gap-3 xl:grid-cols-2">
          {periods.slice(0, 2).map((period) => (
            <PeriodControl key={period.id} period={period} />
          ))}
        </section>
      ) : null}

      <TrialBalance journals={journals} />

      <section className="space-y-3" aria-label="Sổ nhật ký kế toán">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Sổ nhật ký
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              {journals.length} bút toán có nguồn
            </h2>
          </div>
          <p className="text-xs font-bold text-[#718078]">
            Mới cập nhật trước · mở từng dòng để kiểm tra
          </p>
        </div>
        {journals.map((journal) => (
          <JournalCard
            key={journal.id}
            journal={journal}
            user={user}
            hasReversal={reversalTargets.has(journal.id)}
            defaultOpen={
              journal.status === "pending-checker" ||
              (journal.sourceType === "shift-close" &&
                journal.sourceWorkflowId === initialSourceId)
            }
          />
        ))}
        {journals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-12 text-center text-sm text-[#75817b]">
            Chưa có bút toán. Kế toán bắt đầu từ một ca đã được quản lý duyệt.
          </p>
        ) : null}
      </section>
    </div>
  );
}
