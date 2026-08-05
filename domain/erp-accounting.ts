import type { ErpSiteId } from "@/domain/erp";

export type AccountingJournalStatus =
  | "draft"
  | "pending-checker"
  | "checker-returned"
  | "posted";
export type AccountingReviewDecision = "approve" | "return";
export type AccountingPeriodStatus = "open" | "locked";
export type AccountingPeriodAction = "lock" | "reopen";
// "cash-deposit" (T10b) them vao day sau -- schema SQL (migration 034) da
// mo source_type nay tu truoc nhung type domain quen cap nhat theo, dung
// bay "hai nguon su that lech nhau" ma HANDOFF.md tu canh bao (o day la
// schema DB vs. type TypeScript, khong phai hai bang runtime).
export type AccountingSourceType = "shift-close" | "supplier-invoice" | "cash-deposit";

export type AccountingJournalLine = {
  id: string;
  journalId: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debitVnd: number;
  creditVnd: number;
  dimensions: Readonly<Record<string, string>>;
};

export type AccountingAuditEvent = {
  id: string;
  journalId: string | null;
  periodId: string | null;
  sequenceNumber: number;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorAccountId: string;
  actorRole: "accountant-maker" | "accounting-checker" | "system";
  note: string;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt: string;
};

export type AccountingJournal = {
  id: string;
  tenantId: string;
  siteId: ErpSiteId;
  journalCode: string;
  sourceType: AccountingSourceType;
  sourceWorkflowId: string | null;
  sourceSupplierInvoiceId: string | null;
  sourceVersion: number;
  businessDate: string;
  periodKey: string;
  status: AccountingJournalStatus;
  version: number;
  makerAccountId: string;
  makerNote: string;
  checkerAccountId: string | null;
  checkerNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  reversalOfJournalId: string | null;
  supersedesJournalId: string | null;
  createdAt: string;
  updatedAt: string;
  lines: readonly AccountingJournalLine[];
  auditTrail: readonly AccountingAuditEvent[];
};

export type AccountingPeriod = {
  id: string;
  tenantId: string;
  periodKey: string;
  startsOn: string;
  endsOn: string;
  status: AccountingPeriodStatus;
  version: number;
  lockedByAccountId: string | null;
  lockedAt: string | null;
  lockReason: string | null;
  reopenedByAccountId: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountingJournalCommand =
  | "prepare"
  | "submit"
  | "approve"
  | "return";

const JOURNAL_STATUSES: readonly AccountingJournalStatus[] = [
  "draft",
  "pending-checker",
  "checker-returned",
  "posted",
] as const;
const PERIOD_STATUSES: readonly AccountingPeriodStatus[] = [
  "open",
  "locked",
] as const;

function requireSafeMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + " phải là số tiền nguyên không âm.");
  }
}

function requireText(value: string, label: string) {
  if (!value.trim()) throw new Error(label + " không được để trống.");
}

export function accountingJournalTotals(
  lines: readonly Pick<AccountingJournalLine, "debitVnd" | "creditVnd">[],
) {
  return lines.reduce(
    (total, line) => {
      requireSafeMoney(line.debitVnd, "Số tiền ghi Nợ");
      requireSafeMoney(line.creditVnd, "Số tiền ghi Có");
      if (
        (line.debitVnd === 0 && line.creditVnd === 0) ||
        (line.debitVnd > 0 && line.creditVnd > 0)
      ) {
        throw new Error(
          "Mỗi dòng bút toán phải ghi đúng một bên Nợ hoặc Có với số tiền lớn hơn 0.",
        );
      }
      return {
        debitVnd: total.debitVnd + line.debitVnd,
        creditVnd: total.creditVnd + line.creditVnd,
      };
    },
    { debitVnd: 0, creditVnd: 0 },
  );
}

export function assertBalancedAccountingJournal(
  lines: readonly Pick<AccountingJournalLine, "debitVnd" | "creditVnd">[],
) {
  if (lines.length < 2) throw new Error("Bút toán phải có ít nhất hai dòng.");
  const totals = accountingJournalTotals(lines);
  if (totals.debitVnd !== totals.creditVnd) {
    throw new Error(
      "Bút toán chưa cân: Nợ " +
        totals.debitVnd +
        " đồng, Có " +
        totals.creditVnd +
        " đồng.",
    );
  }
  return totals;
}

export function isBalancedAccountingJournal(
  lines: readonly Pick<AccountingJournalLine, "debitVnd" | "creditVnd">[],
) {
  try {
    assertBalancedAccountingJournal(lines);
    return true;
  } catch {
    return false;
  }
}

export function nextAccountingJournalStatus(
  status: AccountingJournalStatus,
  command: AccountingJournalCommand,
): AccountingJournalStatus {
  if (command === "prepare") {
    if (status !== "checker-returned") {
      throw new Error("Chỉ bút toán bị kế toán trưởng trả lại mới được lập lại.");
    }
    return "pending-checker";
  }
  if (command === "submit") {
    if (status !== "draft") {
      throw new Error("Chỉ bút toán nháp mới được trình kế toán trưởng.");
    }
    return "pending-checker";
  }
  if (status !== "pending-checker") {
    throw new Error("Kế toán trưởng chỉ xử lý bút toán đang chờ kiểm tra.");
  }
  return command === "approve" ? "posted" : "checker-returned";
}

export function nextAccountingPeriodStatus(
  status: AccountingPeriodStatus,
  action: AccountingPeriodAction,
): AccountingPeriodStatus {
  if (action === "lock") {
    if (status !== "open") throw new Error("Kỳ kế toán này đã khóa.");
    return "locked";
  }
  if (status !== "locked") {
    throw new Error("Chỉ kỳ đã khóa mới có thể mở lại.");
  }
  return "open";
}

export function createAccountingReversal(
  original: AccountingJournal,
  input: {
    id: string;
    journalCode: string;
    actorAccountId: string;
    reason: string;
    now: string;
  },
): AccountingJournal {
  if (original.status !== "posted") {
    throw new Error("Chỉ bút toán đã ghi sổ mới được lập bút toán đảo.");
  }
  if (original.reversalOfJournalId) {
    throw new Error("Không được đảo tiếp một bút toán đảo.");
  }
  requireText(input.id, "Mã bút toán đảo");
  requireText(input.journalCode, "Số bút toán đảo");
  requireText(input.actorAccountId, "Người thực hiện");
  if (input.reason.trim().length < 4) {
    throw new Error("Lý do đảo bút toán phải có ít nhất 4 ký tự.");
  }
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error("Thời điểm đảo bút toán không hợp lệ.");
  }
  assertBalancedAccountingJournal(original.lines);

  const lines = original.lines.map<AccountingJournalLine>((line) => ({
    ...line,
    id: input.id + ":line:" + line.lineNumber,
    journalId: input.id,
    debitVnd: line.creditVnd,
    creditVnd: line.debitVnd,
  }));
  assertBalancedAccountingJournal(lines);

  return {
    ...original,
    id: input.id,
    journalCode: input.journalCode.trim(),
    status: "posted",
    version: 1,
    makerAccountId: input.actorAccountId.trim(),
    makerNote: input.reason.trim(),
    checkerAccountId: input.actorAccountId.trim(),
    checkerNote: input.reason.trim(),
    submittedAt: input.now,
    approvedAt: input.now,
    postedAt: input.now,
    reversalOfJournalId: original.id,
    supersedesJournalId: null,
    createdAt: input.now,
    updatedAt: input.now,
    lines,
    auditTrail: [
      {
        id: input.id + ":audit:1",
        journalId: input.id,
        periodId: null,
        sequenceNumber: 1,
        eventType: "journal.reversed",
        fromStatus: null,
        toStatus: "posted",
        actorAccountId: input.actorAccountId.trim(),
        actorRole: "accounting-checker",
        note: input.reason.trim(),
        metadata: { reversalOfJournalId: original.id },
        occurredAt: input.now,
      },
    ],
  };
}

export function isAccountingJournalStatus(
  value: unknown,
): value is AccountingJournalStatus {
  return (
    typeof value === "string" &&
    JOURNAL_STATUSES.includes(value as AccountingJournalStatus)
  );
}

export function isAccountingPeriodStatus(
  value: unknown,
): value is AccountingPeriodStatus {
  return (
    typeof value === "string" &&
    PERIOD_STATUSES.includes(value as AccountingPeriodStatus)
  );
}
