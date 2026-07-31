import type { ErpModuleId, ErpRole } from "@/domain/erp";

export const ERP_ACCOUNTANT_MODULE_IDS: readonly ErpModuleId[] = [
  "ve-dat-cho",
  "bao-cao-hien-truong",
  "du-an-su-kien",
  "tai-san-bao-tri",
  "doi-tac-nha-cung-ung",
  "tai-chinh-doi-soat",
  "bao-cao",
] as const;

export type ErpCapability =
  | "finance.regional.read"
  | "accounting.document.verify"
  | "accounting.journal.prepare"
  | "accounting.journal.check"
  | "accounting.journal.post"
  | "accounting.journal.reverse"
  | "accounting.payment.prepare"
  | "accounting.period.lock"
  | "accounting.period.reopen"
  | "accounting.exception.approve"
  | "ap.source.submit"
  | "ap.invoice.review"
  | "ap.liability.prepare"
  | "ap.liability.check"
  | "ap.liability.post"
  | "ap.exception.decide"
  | "field.report.submit"
  | "ticket.shift.submit"
  | "ticket.shift.review"
  | "ticket.shift.reconcile"
  | "ticket.shift.exception.decide"
  | "commercial.quote.create"
  | "staff.access.manage"
  | "workday.execute"
  | "workday.assign"
  | "workday.review"
  | "project.work.update"
  | "project.work.accept"
  | "project.change.request"
  | "project.change.decide"
  | "project.settlement.record";

const ROLE_CAPABILITIES: Record<ErpRole, readonly ErpCapability[]> = {
  employee: [
    "field.report.submit",
    "ticket.shift.submit",
    "workday.execute",
    "project.work.update",
  ],
  manager: [
    "field.report.submit",
    "ticket.shift.review",
    "commercial.quote.create",
    "ap.source.submit",
    "staff.access.manage",
    "workday.assign",
    "workday.review",
    "project.work.update",
    "project.work.accept",
    "project.change.request",
  ],
  accountant: [
    "finance.regional.read",
    "accounting.document.verify",
    "accounting.journal.prepare",
    "accounting.payment.prepare",
    "ap.invoice.review",
    "ap.liability.prepare",
    "ticket.shift.reconcile",
    "project.settlement.record",
  ],
  "chief-accountant": [
    "finance.regional.read",
    "accounting.journal.check",
    "accounting.journal.post",
    "accounting.journal.reverse",
    "accounting.period.lock",
    "accounting.period.reopen",
    "ap.liability.check",
    "ap.liability.post",
  ],
  director: [
    "finance.regional.read",
    "accounting.exception.approve",
    "ap.exception.decide",
    "ticket.shift.exception.decide",
    "staff.access.manage",
    "project.work.accept",
    "project.change.decide",
  ],
};

export function hasErpCapability(
  role: ErpRole,
  capability: ErpCapability,
) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function canViewRegionalFinance(role: ErpRole) {
  return hasErpCapability(role, "finance.regional.read");
}

export function canSubmitFieldOperation(role: ErpRole) {
  return hasErpCapability(role, "field.report.submit");
}

export function canCreateCommercialQuote(role: ErpRole) {
  return hasErpCapability(role, "commercial.quote.create");
}

export function canSubmitTicketShift(role: ErpRole) {
  return hasErpCapability(role, "ticket.shift.submit");
}

export function canReviewTicketShift(role: ErpRole) {
  return hasErpCapability(role, "ticket.shift.review");
}

export function canReconcileTicketShift(role: ErpRole) {
  return hasErpCapability(role, "ticket.shift.reconcile");
}

export function canDecideTicketShiftException(role: ErpRole) {
  return hasErpCapability(role, "ticket.shift.exception.decide");
}

export function canManageStaffAccess(role: ErpRole) {
  return hasErpCapability(role, "staff.access.manage");
}

export function canExecuteWorkday(role: ErpRole) {
  return hasErpCapability(role, "workday.execute");
}

export function canAssignWorkday(role: ErpRole) {
  return hasErpCapability(role, "workday.assign");
}

export function canReviewWorkday(role: ErpRole) {
  return hasErpCapability(role, "workday.review");
}

export function canUpdateProjectWork(role: ErpRole) {
  return hasErpCapability(role, "project.work.update");
}

export function canAcceptProjectWork(role: ErpRole) {
  return hasErpCapability(role, "project.work.accept");
}

export function canRequestProjectChange(role: ErpRole) {
  return hasErpCapability(role, "project.change.request");
}

export function canDecideProjectChange(role: ErpRole) {
  return hasErpCapability(role, "project.change.decide");
}

export function canRecordProjectSettlement(role: ErpRole) {
  return hasErpCapability(role, "project.settlement.record");
}
