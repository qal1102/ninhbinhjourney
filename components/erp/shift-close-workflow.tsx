"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  decideShiftCloseExceptionAction,
  reconcileShiftCloseAction,
  resubmitShiftCloseAction,
  reviewShiftCloseAction,
  submitShiftCloseAction,
} from "@/app/erp/workflow-actions";
import type { ErpSite } from "@/domain/erp";
import {
  INITIAL_SHIFT_CLOSE_ACTION_STATE,
  type ShiftCloseActionState,
} from "@/domain/erp-shift-close-action-state";
import {
  SHIFT_CLOSE_MATERIALITY_VND,
  buildShiftCloseJournalProposal,
  filterShiftCloseQueue,
  journalProposalTotals,
  type ShiftCloseRecord,
} from "@/domain/erp-shift-close";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { DataOriginTag } from "./data-origin-tag";
import {
  SHIFT_CLOSE_STATUS_LABELS,
  SHIFT_CLOSE_STATUS_TONES,
} from "./shift-close-status";

type SiteWorkflowProps = {
  site: ErpSite;
  user: CurrentErpUser;
  records: readonly ShiftCloseRecord[];
};

type QueueProps = {
  records: readonly ShiftCloseRecord[];
  user: CurrentErpUser;
  materialOnly?: boolean;
};

const STATUS_LABELS = SHIFT_CLOSE_STATUS_LABELS;

const STATUS_TONES = SHIFT_CLOSE_STATUS_TONES;

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function ActionMessage({
  state,
}: {
  state: typeof INITIAL_SHIFT_CLOSE_ACTION_STATE;
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

function useApplySuccessfulRecord(
  state: ShiftCloseActionState,
  onRecordChanged: (record: ShiftCloseRecord) => void,
) {
  useEffect(() => {
    if (state.status === "success" && state.record) {
      onRecordChanged(state.record);
    }
  }, [onRecordChanged, state.record, state.status]);
}

function useLiveShiftCloseRecords(records: readonly ShiftCloseRecord[]) {
  const [localRecords, setLocalRecords] = useState<
    Record<string, ShiftCloseRecord>
  >({});

  const upsertRecord = useCallback((nextRecord: ShiftCloseRecord) => {
    setLocalRecords((current) => ({
      ...current,
      [nextRecord.id]: nextRecord,
    }));
  }, []);

  const currentRecords = useMemo(() => {
    const merged = new Map(records.map((record) => [record.id, record]));
    for (const record of Object.values(localRecords)) {
      const serverRecord = merged.get(record.id);
      if (!serverRecord || record.version > serverRecord.version) {
        merged.set(record.id, record);
      }
    }
    return [...merged.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }, [localRecords, records]);

  return [currentRecords, upsertRecord] as const;
}

function RecordFacts({ record }: { record: ShiftCloseRecord }) {
  const varianceTone =
    Math.abs(record.differenceVnd) <= SHIFT_CLOSE_MATERIALITY_VND
      ? "text-[#2d735b]"
      : "text-[#a24739]";
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Vé đã bán</dt>
        <dd className="mt-1 text-base font-black">{record.ticketsSold.toLocaleString("vi-VN")}</dd>
      </div>
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Doanh thu hệ thống</dt>
        <dd className="mt-1 font-black">{formatVnd(record.amounts.grossVnd)}</dd>
      </div>
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Tiền mặt</dt>
        <dd className="mt-1 font-black">{formatVnd(record.amounts.cashVnd)}</dd>
      </div>
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Thẻ/QR/chuyển khoản</dt>
        <dd className="mt-1 font-black">{formatVnd(record.amounts.cardVnd)}</dd>
      </div>
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Hoàn vé</dt>
        <dd className="mt-1 font-black">{formatVnd(record.amounts.refundVnd)}</dd>
      </div>
      <div className="rounded-lg bg-white p-3">
        <dt className="text-[#849089]">Chênh lệch tự tính</dt>
        <dd className={`mt-1 font-black ${varianceTone}`}>
          {record.differenceVnd > 0 ? "+" : ""}
          {formatVnd(record.differenceVnd)}
        </dd>
      </div>
    </dl>
  );
}

function AuditTimeline({ record }: { record: ShiftCloseRecord }) {
  return (
    <ol className="mt-3 space-y-3">
      {record.auditTrail.map((event) => (
        <li
          key={event.id}
          className="border-l-2 border-[#8eb4a5] pl-3 text-xs leading-5 text-[#607068]"
        >
          <p className="font-black text-[#33483f]">
            {STATUS_LABELS[event.toStatus]} · {event.actor.name}
          </p>
          <p>{formatTimestamp(event.at)}{event.note ? ` · ${event.note}` : ""}</p>
        </li>
      ))}
    </ol>
  );
}

function ShiftCloseDetails({
  record,
  action,
}: {
  record: ShiftCloseRecord;
  action?: React.ReactNode;
}) {
  return (
    // `group` + `group-open:` là khuôn đã dùng ở thanh nghiệp vụ máy tính
    // (`erp-desktop-navigation.tsx`); giữ cùng một khuôn để hàng chốt ca mở ra
    // đúng cảm giác quen thuộc.
    <details className="group overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm open:border-[#91aa9f]">
      <summary className="grid cursor-pointer list-none gap-3 p-4 [&::-webkit-details-marker]:hidden sm:grid-cols-[0.8fr_1.3fr_auto] sm:items-center sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black text-[#60736a]">{record.shiftCode}</p>
            <DataOriginTag origin={record.dataOrigin} />
          </div>
          <p className="mt-1 text-xs text-[#87928d]">{record.station} · {record.shiftLabel}</p>
        </div>
        <div>
          <p className="font-black text-[#293f35]">{record.submittedBy.name}</p>
          <p className="mt-1 text-xs text-[#74827b]">
            {record.ticketsSold.toLocaleString("vi-VN")} vé · {formatVnd(record.amounts.grossVnd)}
          </p>
        </div>
        {/* Hàng này là một `details` gập lại, mà `list-none` đã bỏ mất tam
            giác mặc định — nhìn vào chỉ thấy một dòng trạng thái đứng yên.
            Hồ sơ chờ giám đốc thì hai nút quyết định nằm bên trong, nên không
            có dấu hiệu mở là việc chính của giám đốc bị giấu. Thêm chữ và mũi
            tên để thấy ngay là bấm được. */}
        <span className="flex w-fit items-center gap-2">
          <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_TONES[record.status]}`}>
            {STATUS_LABELS[record.status]}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-[#5f7268]">
            <span className="group-open:hidden">
              {action ? "Mở để quyết định" : "Xem hồ sơ"}
            </span>
            <span className="hidden group-open:inline">Thu gọn</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180"
            >
              <path
                d="m4 6 4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </summary>
      <div className="border-t border-[#e5eae7] bg-[#f8faf8] p-4 sm:p-5">
        <RecordFacts record={record} />
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 text-sm leading-6 text-[#5f6f67]">
            <p><strong>Ngày nghiệp vụ:</strong> {record.businessDate}</p>
            <p><strong>Mã hạch toán:</strong> {record.financeCode}</p>
            <p><strong>Bàn giao:</strong> {record.note}</p>
          </div>
          <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
            <h3 className="text-sm font-black text-[#30443b]">Nhật ký hồ sơ</h3>
            <AuditTimeline record={record} />
          </div>
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </details>
  );
}

function EmployeeSubmissionForm({
  site,
  onRecordChanged,
}: {
  site: ErpSite;
  onRecordChanged: (record: ShiftCloseRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(
    submitShiftCloseAction,
    INITIAL_SHIFT_CLOSE_ACTION_STATE,
  );
  useApplySuccessfulRecord(state, onRecordChanged);
  const [amounts, setAmounts] = useState({
    grossVnd: "79400000",
    refundVnd: "0",
    cashVnd: "32000000",
    cardVnd: "47400000",
  });
  const difference = useMemo(() => {
    const gross = Number(amounts.grossVnd) || 0;
    const refund = Number(amounts.refundVnd) || 0;
    const cash = Number(amounts.cashVnd) || 0;
    const card = Number(amounts.cardVnd) || 0;
    return cash + card - (gross - refund);
  }, [amounts]);

  function amountInput(
    name: keyof typeof amounts,
    label: string,
  ) {
    return (
      <label className="text-xs font-bold text-[#617169]">
        {label}
        <input
          required
          name={name}
          inputMode="numeric"
          pattern="[0-9]+"
          value={amounts[name]}
          onChange={(event) =>
            setAmounts((current) => ({
              ...current,
              [name]: event.target.value.replace(/\D/g, ""),
            }))
          }
          className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 text-sm font-bold text-[#293f35]"
        />
      </label>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
      <input type="hidden" name="siteId" value={site.id} />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#8a5e30]">Bàn giao cuối ca</p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">Gửi chốt vé và tiền thu</h2>
        </div>
        <p className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
          Math.abs(difference) <= SHIFT_CLOSE_MATERIALITY_VND
            ? "bg-[#dff1e8] text-[#246249]"
            : "bg-[#ffe5df] text-[#934336]"
        }`}>
          Chênh lệch: {difference > 0 ? "+" : ""}{formatVnd(difference)}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#6c7973]">
        Nhập số nguồn; hệ thống tự tính chênh lệch và chuyển đúng người xử lý.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-bold text-[#617169]">
          Số vé đã bán
          <input required name="ticketsSold" inputMode="numeric" pattern="[0-9]+" defaultValue="462" className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 text-sm font-bold text-[#293f35]" />
        </label>
        {amountInput("grossVnd", "Doanh thu trên hệ thống")}
        {amountInput("cashVnd", "Tiền mặt kiểm đếm")}
        {amountInput("cardVnd", "Thẻ/QR/chuyển khoản")}
        {amountInput("refundVnd", "Tiền hoàn vé")}
        <label className="text-xs font-bold text-[#617169]">
          Mã hạch toán
          <input required name="financeCode" defaultValue={`OPS-${site.id.toUpperCase()}-SHIFT`} className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 text-sm font-bold text-[#293f35]" />
        </label>
      </div>
      <label className="mt-3 block text-xs font-bold text-[#617169]">
        Nội dung bàn giao
        <textarea required name="note" rows={3} defaultValue="Đã kiểm đếm vé, tiền và giao dịch điện tử; bàn giao đủ chứng từ ca." className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm" />
      </label>
      <button disabled={pending} type="submit" className="mt-3 min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white disabled:opacity-60">
        {pending ? "Đang gửi…" : "Gửi quản lý xác nhận"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function ManagerReview({
  record,
  onRecordChanged,
}: {
  record: ShiftCloseRecord;
  onRecordChanged: (record: ShiftCloseRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(
    reviewShiftCloseAction,
    INITIAL_SHIFT_CLOSE_ACTION_STATE,
  );
  useApplySuccessfulRecord(state, onRecordChanged);
  return (
    <form action={formAction} className="rounded-xl border border-[#d9e1dc] bg-white p-4">
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="expectedVersion" value={record.version} />
      <label className="text-xs font-bold text-[#617169]">
        Ghi chú kiểm tra
        <textarea name="note" rows={2} placeholder="Kết quả kiểm quỹ, POS/QR và chứng từ ca" className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm" />
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button disabled={pending} name="decision" value="approve" className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">
          Xác nhận & chuyển kế toán
        </button>
        <button disabled={pending} name="decision" value="return" className="min-h-11 rounded-xl border border-[#d4a69b] bg-white px-4 text-sm font-black text-[#8f493b] disabled:opacity-60">
          Trả nhân viên bổ sung
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function EmployeeResubmission({
  record,
  onRecordChanged,
}: {
  record: ShiftCloseRecord;
  onRecordChanged: (record: ShiftCloseRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(
    resubmitShiftCloseAction,
    INITIAL_SHIFT_CLOSE_ACTION_STATE,
  );
  useApplySuccessfulRecord(state, onRecordChanged);

  return (
    <form action={formAction} className="rounded-xl border border-[#e3c6ba] bg-white p-4">
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="expectedVersion" value={record.version} />
      <p className="rounded-xl bg-[#fff3ee] px-3 py-2 text-sm leading-6 text-[#86493e]">
        <strong>Quản lý yêu cầu:</strong>{" "}
        {record.managerReview?.note || "Bổ sung thông tin bàn giao trước khi gửi lại."}
      </p>
      <label className="mt-3 block text-xs font-bold text-[#617169]">
        Nội dung đã bổ sung
        <textarea
          required
          name="note"
          rows={3}
          minLength={4}
          placeholder="Nêu rõ chứng từ, giải trình hoặc thông tin đã bổ sung"
          className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm"
        />
      </label>
      <button
        disabled={pending}
        type="submit"
        className="mt-3 min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60"
      >
        {pending ? "Đang gửi lại…" : "Gửi lại quản lý"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function EmployeeResubmissionStatus({ record }: { record: ShiftCloseRecord }) {
  return (
    <p
      role="status"
      className="rounded-xl bg-[#e3f2eb] px-4 py-3 text-sm font-bold leading-6 text-[#245e48]"
    >
      {record.shiftCode} đã bổ sung và gửi lại quản lý xác nhận. Hồ sơ đang chờ
      quản lý kiểm tra.
    </p>
  );
}

function AccountantReview({
  record,
  onRecordChanged,
}: {
  record: ShiftCloseRecord;
  onRecordChanged: (record: ShiftCloseRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(
    reconcileShiftCloseAction,
    INITIAL_SHIFT_CLOSE_ACTION_STATE,
  );
  useApplySuccessfulRecord(state, onRecordChanged);
  const proposal = buildShiftCloseJournalProposal(record);
  const totals = journalProposalTotals(proposal);
  const canAct = [
    "manager-approved",
    "accounting-review",
    "director-approved",
    "director-rejected",
  ].includes(record.status);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-[#d9e1dc] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">Bút toán đề nghị</h3>
          <span className="text-xs font-bold text-[#35705a]">Nợ = Có · {formatVnd(totals.debitVnd)}</span>
        </div>
        <div className="mt-3 divide-y divide-[#e8ece9]">
          {proposal.map((line) => (
            <div key={`${line.account}-${line.label}`} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2 text-xs">
              <strong>{line.account}</strong>
              <span className="text-[#68776f]">{line.label}</span>
              <span className="font-black">{line.debitVnd ? `Nợ ${formatVnd(line.debitVnd)}` : `Có ${formatVnd(line.creditVnd)}`}</span>
            </div>
          ))}
        </div>
      </div>
      {canAct ? (
        <form action={formAction} className="rounded-xl border border-[#d9e1dc] bg-white p-4">
          <input type="hidden" name="recordId" value={record.id} />
          <input type="hidden" name="expectedVersion" value={record.version} />
          <label className="block text-xs font-bold text-[#617169]">
            Kết quả đối soát
            <textarea name="note" rows={3} placeholder="Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý" className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 text-sm" />
          </label>
          <div className="mt-3 grid gap-2">
            {record.status === "manager-approved" ? (
              <button disabled={pending} name="decision" value="review" className="min-h-11 rounded-xl bg-[#315f79] px-4 text-sm font-black text-white disabled:opacity-60">Nhận kiểm tra hồ sơ</button>
            ) : null}
            {record.status === "accounting-review" || record.status === "director-approved" ? (
              <Link href={`/erp/finance?source=${record.id}`} className="grid min-h-11 place-items-center rounded-xl bg-[#183f34] px-4 text-center text-sm font-black text-white">
                Lập bút toán và gửi kế toán trưởng
              </Link>
            ) : null}
            {record.status !== "director-approved" && Math.abs(record.differenceVnd) > SHIFT_CLOSE_MATERIALITY_VND ? (
              <button disabled={pending} name="decision" value="escalate" className="min-h-11 rounded-xl bg-[#a94e3f] px-4 text-sm font-black text-white disabled:opacity-60">Chuyển giám đốc quyết định</button>
            ) : null}
            <button disabled={pending} name="decision" value="return" className="min-h-11 rounded-xl border border-[#d4a69b] px-4 text-sm font-black text-[#8f493b] disabled:opacity-60">Trả quản lý bổ sung</button>
          </div>
          <ActionMessage state={state} />
        </form>
      ) : (
        <p className="rounded-xl bg-[#eef3f0] p-4 text-sm font-bold text-[#5d6e66]">
          {record.status === "exception-pending-director"
            ? "Đang chờ quyết định ngoại lệ của giám đốc."
            : "Hồ sơ đã được kế toán trưởng duyệt và ghi sổ; lịch sử được giữ nguyên."}
        </p>
      )}
    </div>
  );
}

function DirectorDecision({
  record,
  onRecordChanged,
}: {
  record: ShiftCloseRecord;
  onRecordChanged: (record: ShiftCloseRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(
    decideShiftCloseExceptionAction,
    INITIAL_SHIFT_CLOSE_ACTION_STATE,
  );
  useApplySuccessfulRecord(state, onRecordChanged);
  return (
    <form action={formAction} className="rounded-xl border border-[#e1c5b9] bg-white p-4">
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="expectedVersion" value={record.version} />
      <label className="text-xs font-bold text-[#6d5b50]">
        Ý kiến quyết định
        <textarea required name="note" rows={3} placeholder="Phương án xử lý, điều kiện và người chịu trách nhiệm tiếp theo" className="mt-1 w-full rounded-xl border border-[#d7c7bd] p-3 text-sm" />
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button disabled={pending} name="decision" value="approve" className="min-h-11 rounded-xl bg-[#3f3524] px-4 text-sm font-black text-white disabled:opacity-60">Duyệt phương án ngoại lệ</button>
        <button disabled={pending} name="decision" value="reject" className="min-h-11 rounded-xl border border-[#c99d8f] px-4 text-sm font-black text-[#8f493b] disabled:opacity-60">Trả kế toán làm rõ</button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function ShiftCloseSiteWorkflow({ site, user, records }: SiteWorkflowProps) {
  const [currentRecords, upsertRecord] = useLiveShiftCloseRecords(records);
  const visible = filterShiftCloseQueue(currentRecords, {
    role: user.role,
    siteIds: [site.id],
    actorId: user.id,
  });
  const pendingForManager = visible.filter((record) => record.status === "submitted");

  return (
    <section className="space-y-4" aria-label="Quy trình chốt ca vé">
      {user.role === "employee" ? (
        <EmployeeSubmissionForm site={site} onRecordChanged={upsertRecord} />
      ) : null}
      {user.role === "manager" ? (
        <div className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Hàng đợi quản lý</p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">{pendingForManager.length} ca chờ xác nhận</h2>
          <p className="mt-2 text-sm text-[#6d7a73]">Quản lý chỉ duyệt hoặc trả hồ sơ nhân viên; không nhập thay số cuối ca.</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {visible.map((record) => (
          <ShiftCloseDetails
            key={record.id}
            record={record}
            action={
              user.role === "manager" && record.status === "submitted"
                ? (
                    <ManagerReview
                      record={record}
                      onRecordChanged={upsertRecord}
                    />
                  )
                : user.role === "employee" &&
                    record.status === "manager-returned"
                  ? (
                      <EmployeeResubmission
                        record={record}
                        onRecordChanged={upsertRecord}
                      />
                    )
                  : user.role === "employee" &&
                      record.status === "submitted" &&
                      record.auditTrail.filter(
                        (event) => event.action === "employee.submit",
                      ).length > 1
                    ? <EmployeeResubmissionStatus record={record} />
                : undefined
            }
          />
        ))}
        {/* Khối rỗng này trước đây chỉ là một câu lửng "Không có ca nào trong
            hàng đợi hiện tại." — không tiêu đề, không lý do, không lối đi
            tiếp. Giám đốc mở màn hình vé thấy đúng một dòng chữ treo giữa
            trang thì kết luận màn hình hỏng, trong khi thật ra hàng việc của
            họ chỉ nhận hồ sơ đã chuyển cấp. Nói rõ vì sao rỗng, và chỉ chỗ
            xem toàn bộ ca của cơ sở. */}
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-8 text-sm text-[#75817b]">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Hàng chốt ca của bạn
            </p>
            <p className="mt-2 text-base font-black text-[#2d4138]">
              {user.role === "employee"
                ? "Bạn chưa có hồ sơ chốt ca nào."
                : "Không có ca nào chờ bạn xử lý."}
            </p>
            <p className="mt-2 leading-6">
              {user.role === "employee"
                ? "Hồ sơ bạn gửi lúc cuối ca sẽ hiện ngay tại đây, kèm trạng thái duyệt của quản lý."
                : `Hàng này chỉ hiện hồ sơ đang chờ chính tài khoản của bạn. Ca đã gửi, đã duyệt hoặc đang chờ người khác tại ${site.shortName} xem ở màn hình đối soát.`}
            </p>
            {user.role === "employee" ? null : (
              <Link
                href={`/erp/${site.id}/tai-chinh-doi-soat`}
                className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#c3d2cb] px-4 text-sm font-black text-[#2c463c] transition hover:border-[#8fa99f] hover:bg-[#f5f8f6]"
              >
                Mở đối soát cuối ca {site.shortName} →
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ShiftCloseAccountingQueue({
  records,
  user,
  materialOnly = false,
}: QueueProps) {
  const [currentRecords, upsertRecord] = useLiveShiftCloseRecords(records);
  const visible = filterShiftCloseQueue(currentRecords, {
    role: user.role,
    siteIds: user.siteIds,
    actorId: user.id,
  }).filter(
    (record) =>
      !materialOnly ||
      (Math.abs(record.differenceVnd) > SHIFT_CLOSE_MATERIALITY_VND &&
        record.status !== "director-approved" &&
        record.status !== "director-rejected"),
  );
  const actionable = visible.filter((record) =>
    ["manager-approved", "accounting-review", "director-approved", "director-rejected"].includes(record.status),
  ).length;
  return (
    <section className="space-y-3" aria-label="Đối soát chốt ca dùng chung">
      <div className="rounded-2xl border border-[#cbdad3] bg-[#f5faf7] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Từ vận hành sang kế toán</p>
        <h2 className="mt-2 text-2xl font-black text-[#20342c]">{actionable} {materialOnly ? "ca chênh lệch cần chuyển cấp" : "ca cần xử lý"}</h2>
        <p className="mt-2 text-sm leading-6 text-[#68776f]">{materialOnly ? "Chỉ ca vượt ngưỡng mới cần kế toán chuyển giám đốc quyết định trước khi lập bút toán." : "Cùng một mã hồ sơ, số nguồn và lịch sử được giữ xuyên nhân viên, quản lý, kế toán và giám đốc."}</p>
      </div>
      {visible.map((record) => (
        <ShiftCloseDetails
          key={record.id}
          record={record}
          action={(
            <AccountantReview
              record={record}
              onRecordChanged={upsertRecord}
            />
          )}
        />
      ))}
      {visible.length === 0 && !materialOnly ? (
        <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">Chưa có ca đã được quản lý duyệt.</p>
      ) : null}
    </section>
  );
}

export function ShiftCloseDirectorQueue({ records, user }: QueueProps) {
  const [currentRecords, upsertRecord] = useLiveShiftCloseRecords(records);
  const pending = filterShiftCloseQueue(currentRecords, {
    role: user.role,
    siteIds: user.siteIds,
    actorId: user.id,
  }).filter((record) => record.status === "exception-pending-director");
  return (
    <div className="space-y-3">
      {pending.map((record) => (
        <ShiftCloseDetails
          key={record.id}
          record={record}
          action={(
            <DirectorDecision
              record={record}
              onRecordChanged={upsertRecord}
            />
          )}
        />
      ))}
    </div>
  );
}
