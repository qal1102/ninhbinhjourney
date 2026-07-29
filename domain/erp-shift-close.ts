import type { ErpRole, ErpSiteId } from "@/domain/erp";

export const SHIFT_CLOSE_MATERIALITY_VND = 1_000;

export type ShiftCloseStatus =
  | "submitted"
  | "manager-returned"
  | "manager-approved"
  | "accounting-review"
  | "posted"
  | "exception-pending-director"
  | "director-approved"
  | "director-rejected";

export type ShiftCloseAmounts = {
  grossVnd: number;
  refundVnd: number;
  cashVnd: number;
  cardVnd: number;
};

export type ShiftCloseActor = {
  id: string;
  name: string;
  role: ErpRole;
};

export type ShiftCloseAuditEvent = {
  id: string;
  action: ShiftCloseAction["type"];
  actor: ShiftCloseActor;
  fromStatus: ShiftCloseStatus | null;
  toStatus: ShiftCloseStatus;
  note: string;
  at: string;
};

export type ShiftCloseReview = {
  actor: ShiftCloseActor;
  decision: string;
  note: string;
  at: string;
};

export type ShiftCloseRecord = {
  id: string;
  shiftCode: string;
  idempotencyKey: string;
  siteId: ErpSiteId;
  businessDate: string;
  station: string;
  shiftLabel: string;
  shiftStartedAt: string;
  shiftEndedAt: string;
  ticketsSold: number;
  financeCode: string;
  note: string;
  status: ShiftCloseStatus;
  amounts: ShiftCloseAmounts;
  differenceVnd: number;
  submittedBy: ShiftCloseActor;
  submittedAt: string;
  managerReview?: ShiftCloseReview;
  accountingReview?: ShiftCloseReview & { journalReference?: string };
  directorDecision?: ShiftCloseReview;
  updatedAt: string;
  version: number;
  auditTrail: ShiftCloseAuditEvent[];
};

export type CreateShiftCloseSubmissionInput = {
  id: string;
  shiftCode: string;
  idempotencyKey: string;
  siteId: ErpSiteId;
  businessDate: string;
  station: string;
  shiftLabel: string;
  shiftStartedAt: string;
  shiftEndedAt: string;
  ticketsSold: number;
  financeCode: string;
  note: string;
  amounts: ShiftCloseAmounts;
  actor: ShiftCloseActor;
  now: string;
  auditEventId: string;
};

export type ShiftCloseAction =
  | {
      type: "employee.submit";
      actor: ShiftCloseActor;
      note: string;
      now: string;
      auditEventId: string;
    }
  | {
      type: "manager.review";
      decision: "approve" | "return";
      actor: ShiftCloseActor;
      note: string;
      now: string;
      auditEventId: string;
    }
  | {
      type: "accountant.reconcile";
      decision: "review" | "post" | "escalate" | "return";
      actor: ShiftCloseActor;
      note: string;
      journalReference?: string;
      now: string;
      auditEventId: string;
    }
  | {
      type: "director.decide";
      decision: "approve" | "reject";
      actor: ShiftCloseActor;
      note: string;
      now: string;
      auditEventId: string;
    };

export type ShiftCloseJournalLine = {
  account: string;
  label: string;
  debitVnd: number;
  creditVnd: number;
};

const SHIFT_CLOSE_STATUSES: readonly ShiftCloseStatus[] = [
  "submitted",
  "manager-returned",
  "manager-approved",
  "accounting-review",
  "posted",
  "exception-pending-director",
  "director-approved",
  "director-rejected",
] as const;

function requireText(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} không được để trống.`);
}

function requireTimestamp(value: string, label: string) {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} không hợp lệ.`);
  }
}

function requireMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} phải là số tiền nguyên không âm.`);
  }
}

function requireActor(actor: ShiftCloseActor, role: ErpRole) {
  if (actor.role !== role) {
    throw new Error(`Vai trò ${actor.role} không được thực hiện bước này.`);
  }
  requireText(actor.id, "Mã người thực hiện");
  requireText(actor.name, "Tên người thực hiện");
}

function requireNote(note: string, label: string) {
  if (note.trim().length < 4) {
    throw new Error(`${label} phải có ít nhất 4 ký tự.`);
  }
}

export function computeShiftCloseDifference(amounts: ShiftCloseAmounts) {
  requireMoney(amounts.grossVnd, "Doanh thu trên hệ thống");
  requireMoney(amounts.refundVnd, "Tiền hoàn");
  requireMoney(amounts.cashVnd, "Tiền mặt");
  requireMoney(amounts.cardVnd, "Thẻ/chuyển khoản");
  if (amounts.refundVnd > amounts.grossVnd) {
    throw new Error("Tiền hoàn không được lớn hơn doanh thu trên hệ thống.");
  }
  return amounts.cashVnd + amounts.cardVnd - (amounts.grossVnd - amounts.refundVnd);
}

export function createShiftCloseSubmission(
  input: CreateShiftCloseSubmissionInput,
): ShiftCloseRecord {
  requireActor(input.actor, "employee");
  requireText(input.id, "Mã hồ sơ");
  requireText(input.shiftCode, "Mã ca");
  requireText(input.idempotencyKey, "Khóa chống gửi trùng");
  requireText(input.station, "Quầy/trạm");
  requireText(input.shiftLabel, "Khung ca");
  requireText(input.financeCode, "Mã hạch toán");
  requireText(input.note, "Nội dung bàn giao");
  requireTimestamp(input.shiftStartedAt, "Giờ bắt đầu ca");
  requireTimestamp(input.shiftEndedAt, "Giờ kết thúc ca");
  requireTimestamp(input.now, "Thời điểm gửi");
  if (Date.parse(input.shiftEndedAt) < Date.parse(input.shiftStartedAt)) {
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu ca.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new Error("Ngày nghiệp vụ không hợp lệ.");
  }
  if (!Number.isSafeInteger(input.ticketsSold) || input.ticketsSold < 0) {
    throw new Error("Số vé phải là số nguyên không âm.");
  }

  const differenceVnd = computeShiftCloseDifference(input.amounts);
  const audit: ShiftCloseAuditEvent = {
    id: input.auditEventId,
    action: "employee.submit",
    actor: input.actor,
    fromStatus: null,
    toStatus: "submitted",
    note: input.note.trim(),
    at: input.now,
  };

  return {
    id: input.id,
    shiftCode: input.shiftCode.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    siteId: input.siteId,
    businessDate: input.businessDate,
    station: input.station.trim(),
    shiftLabel: input.shiftLabel.trim(),
    shiftStartedAt: input.shiftStartedAt,
    shiftEndedAt: input.shiftEndedAt,
    ticketsSold: input.ticketsSold,
    financeCode: input.financeCode.trim(),
    note: input.note.trim(),
    status: "submitted",
    amounts: { ...input.amounts },
    differenceVnd,
    submittedBy: { ...input.actor },
    submittedAt: input.now,
    updatedAt: input.now,
    version: 1,
    auditTrail: [audit],
  };
}

function nextStatus(record: ShiftCloseRecord, action: ShiftCloseAction) {
  if (action.type === "employee.submit") {
    requireActor(action.actor, "employee");
    if (action.actor.id !== record.submittedBy.id) {
      throw new Error("Nhân viên chỉ được gửi lại hồ sơ của mình.");
    }
    if (record.status !== "manager-returned") {
      throw new Error("Chỉ hồ sơ được quản lý trả lại mới có thể gửi lại.");
    }
    return "submitted" as const;
  }

  if (action.type === "manager.review") {
    requireActor(action.actor, "manager");
    if (record.status !== "submitted") {
      throw new Error("Quản lý chỉ duyệt hồ sơ đang chờ xác nhận.");
    }
    if (action.decision === "return") {
      requireNote(action.note, "Lý do trả lại");
      return "manager-returned" as const;
    }
    return "manager-approved" as const;
  }

  if (action.type === "accountant.reconcile") {
    requireActor(action.actor, "accountant");
    const reviewable: readonly ShiftCloseStatus[] = [
      "manager-approved",
      "accounting-review",
      "director-approved",
      "director-rejected",
    ];
    if (!reviewable.includes(record.status)) {
      throw new Error("Hồ sơ chưa tới bước kế toán hoặc đã kết thúc.");
    }
    if (action.decision === "review") return "accounting-review" as const;
    if (action.decision === "return") {
      requireNote(action.note, "Lý do trả lại");
      return "manager-returned" as const;
    }
    if (action.decision === "escalate") {
      requireNote(action.note, "Giải trình ngoại lệ");
      if (Math.abs(record.differenceVnd) <= SHIFT_CLOSE_MATERIALITY_VND) {
        throw new Error("Hồ sơ không vượt ngưỡng để chuyển giám đốc.");
      }
      return "exception-pending-director" as const;
    }
    requireText(action.journalReference ?? "", "Số bút toán");
    if (
      Math.abs(record.differenceVnd) > SHIFT_CLOSE_MATERIALITY_VND &&
      record.status !== "director-approved"
    ) {
      throw new Error("Chênh lệch vượt ngưỡng phải được giám đốc quyết định trước khi ghi sổ.");
    }
    return "posted" as const;
  }

  requireActor(action.actor, "director");
  if (record.status !== "exception-pending-director") {
    throw new Error("Giám đốc chỉ xử lý ngoại lệ đã được kế toán chuyển cấp.");
  }
  requireNote(action.note, "Ý kiến quyết định");
  return action.decision === "approve"
    ? ("director-approved" as const)
    : ("director-rejected" as const);
}

export function transitionShiftClose(
  record: ShiftCloseRecord,
  action: ShiftCloseAction,
): ShiftCloseRecord {
  requireTimestamp(action.now, "Thời điểm thao tác");
  requireText(action.auditEventId, "Mã nhật ký");
  const toStatus = nextStatus(record, action);
  const event: ShiftCloseAuditEvent = {
    id: action.auditEventId,
    action: action.type,
    actor: { ...action.actor },
    fromStatus: record.status,
    toStatus,
    note: action.note.trim(),
    at: action.now,
  };
  const next: ShiftCloseRecord = {
    ...record,
    status: toStatus,
    updatedAt: action.now,
    version: record.version + 1,
    auditTrail: [...record.auditTrail, event],
  };

  if (action.type === "manager.review") {
    next.managerReview = {
      actor: { ...action.actor },
      decision: action.decision,
      note: action.note.trim(),
      at: action.now,
    };
  } else if (action.type === "accountant.reconcile") {
    next.accountingReview = {
      actor: { ...action.actor },
      decision: action.decision,
      note: action.note.trim(),
      at: action.now,
      journalReference: action.journalReference?.trim() || undefined,
    };
  } else if (action.type === "director.decide") {
    next.directorDecision = {
      actor: { ...action.actor },
      decision: action.decision,
      note: action.note.trim(),
      at: action.now,
    };
  }
  return next;
}

export function filterShiftCloseQueue(
  records: readonly ShiftCloseRecord[],
  scope: {
    role: ErpRole;
    siteIds: readonly ErpSiteId[];
    actorId?: string;
  },
) {
  const siteIds = new Set(scope.siteIds);
  return records
    .filter((record) => siteIds.has(record.siteId))
    .filter((record) => {
      if (scope.role === "employee") {
        return record.submittedBy.id === scope.actorId;
      }
      if (scope.role === "manager") return true;
      if (scope.role === "accountant") {
        return [
          "manager-approved",
          "accounting-review",
          "posted",
          "exception-pending-director",
          "director-approved",
          "director-rejected",
        ].includes(record.status);
      }
      return [
        "exception-pending-director",
        "director-approved",
        "director-rejected",
      ].includes(record.status);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function buildShiftCloseJournalProposal(
  record: Pick<ShiftCloseRecord, "amounts" | "differenceVnd">,
): ShiftCloseJournalLine[] {
  const lines: ShiftCloseJournalLine[] = [];
  if (record.amounts.cashVnd) {
    lines.push({
      account: "1111",
      label: "Tiền mặt tại quầy",
      debitVnd: record.amounts.cashVnd,
      creditVnd: 0,
    });
  }
  if (record.amounts.cardVnd) {
    lines.push({
      account: "1121",
      label: "Thẻ, QR và chuyển khoản",
      debitVnd: record.amounts.cardVnd,
      creditVnd: 0,
    });
  }
  if (record.amounts.refundVnd) {
    lines.push({
      account: "5212",
      label: "Doanh thu hoàn/giảm trong ca",
      debitVnd: record.amounts.refundVnd,
      creditVnd: 0,
    });
  }
  if (record.differenceVnd < 0) {
    lines.push({
      account: "1388",
      label: "Chênh lệch thiếu chờ xử lý",
      debitVnd: Math.abs(record.differenceVnd),
      creditVnd: 0,
    });
  }
  lines.push({
    account: "5111",
    label: "Doanh thu vé theo báo cáo ca",
    debitVnd: 0,
    creditVnd: record.amounts.grossVnd,
  });
  if (record.differenceVnd > 0) {
    lines.push({
      account: "3388",
      label: "Chênh lệch thừa chờ xử lý",
      debitVnd: 0,
      creditVnd: record.differenceVnd,
    });
  }
  return lines;
}

export function journalProposalTotals(lines: readonly ShiftCloseJournalLine[]) {
  return lines.reduce(
    (total, line) => ({
      debitVnd: total.debitVnd + line.debitVnd,
      creditVnd: total.creditVnd + line.creditVnd,
    }),
    { debitVnd: 0, creditVnd: 0 },
  );
}

export function isBalancedJournalProposal(
  lines: readonly ShiftCloseJournalLine[],
) {
  const totals = journalProposalTotals(lines);
  return totals.debitVnd === totals.creditVnd;
}

export function isShiftCloseStatus(value: unknown): value is ShiftCloseStatus {
  return (
    typeof value === "string" &&
    SHIFT_CLOSE_STATUSES.includes(value as ShiftCloseStatus)
  );
}

export function parseShiftCloseRecord(value: unknown): ShiftCloseRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ShiftCloseRecord>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.shiftCode !== "string" ||
    typeof candidate.idempotencyKey !== "string" ||
    typeof candidate.siteId !== "string" ||
    typeof candidate.businessDate !== "string" ||
    typeof candidate.station !== "string" ||
    typeof candidate.shiftLabel !== "string" ||
    typeof candidate.shiftStartedAt !== "string" ||
    typeof candidate.shiftEndedAt !== "string" ||
    typeof candidate.ticketsSold !== "number" ||
    typeof candidate.financeCode !== "string" ||
    typeof candidate.note !== "string" ||
    !isShiftCloseStatus(candidate.status) ||
    !candidate.amounts ||
    typeof candidate.differenceVnd !== "number" ||
    !candidate.submittedBy ||
    typeof candidate.submittedAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.version !== "number" ||
    !Array.isArray(candidate.auditTrail)
  ) {
    return null;
  }
  try {
    computeShiftCloseDifference(candidate.amounts);
  } catch {
    return null;
  }
  return candidate as ShiftCloseRecord;
}
