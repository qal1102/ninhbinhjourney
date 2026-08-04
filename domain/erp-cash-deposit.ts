import type { ErpSiteId } from "@/domain/erp";

export type CashDepositStatus =
  | "submitted"
  | "exception"
  | "accounting-review"
  | "posted";

export const CASH_DEPOSIT_STATUS_LABELS: Readonly<
  Record<CashDepositStatus, string>
> = Object.freeze({
  submitted: "Đã nộp, chờ đối khớp",
  exception: "Lệch số, chờ giải trình",
  "accounting-review": "Chờ kế toán trưởng ghi sổ",
  posted: "Đã ghi sổ",
});

export type BankStatementLineStatus = "unmatched" | "matched";

export const BANK_STATEMENT_LINE_STATUS_LABELS: Readonly<
  Record<BankStatementLineStatus, string>
> = Object.freeze({
  unmatched: "Chưa khớp",
  matched: "Đã khớp",
});

export type CashDepositEligibleShift = {
  id: string;
  shiftCode: string;
  businessDate: string;
  station: string;
  cashVnd: number;
};

export type CashDeposit = {
  id: string;
  siteId: ErpSiteId;
  depositCode: string;
  status: CashDepositStatus;
  amountVnd: number;
  bankAccountRef: string;
  note: string;
  submittedByAccountId: string;
  submittedAt: string;
  shiftCloseIds: readonly string[];
  statementLineId: string | null;
  differenceVnd: number;
  matchedByAccountId: string | null;
  matchedAt: string | null;
  exceptionOwnerAccountId: string | null;
  exceptionDueAt: string | null;
  exceptionNote: string | null;
  exceptionDecidedByAccountId: string | null;
  exceptionDecidedAt: string | null;
  exceptionDecision: "approved" | "returned-to-maker" | null;
  journalId: string | null;
  reconciledByAccountId: string | null;
  reconciledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type BankStatementLine = {
  id: string;
  siteId: ErpSiteId;
  source: "manual" | "bank-api";
  bankAccountRef: string;
  statementDate: string;
  amountVnd: number;
  description: string;
  externalRef: string;
  status: BankStatementLineStatus;
  matchedDepositId: string | null;
  enteredByAccountId: string;
  enteredAt: string;
  version: number;
};

/**
 * Ngưỡng SLA cho một lượt nộp bị lệch số so với sao kê — phải có người giải
 * trình trong khoảng thời gian này. Hằng số demo, phải cấu hình theo chính
 * sách nội bộ khi triển khai thật (đúng cảnh báo ở
 * docs/reference/ERP_ACCOUNTING_REQUIREMENTS_VI.md §2), không đóng cứng
 * vĩnh viễn.
 */
export const CASH_EXCEPTION_SLA_HOURS = 24;

export function isCashDepositOverdue(
  deposit: Pick<CashDeposit, "status" | "exceptionDueAt">,
  now: Date = new Date(),
): boolean {
  if (deposit.status !== "exception" || !deposit.exceptionDueAt) return false;
  return new Date(deposit.exceptionDueAt).getTime() < now.getTime();
}

export function formatCashDifference(differenceVnd: number): string {
  if (differenceVnd === 0) return "Khớp đúng số";
  const abs = Math.abs(differenceVnd).toLocaleString("vi-VN");
  return differenceVnd > 0
    ? `Ngân hàng nhận thiếu ${abs} đ so với báo cáo ca`
    : `Ngân hàng nhận thừa ${abs} đ so với báo cáo ca`;
}
