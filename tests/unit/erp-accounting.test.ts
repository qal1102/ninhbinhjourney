import { describe, expect, it } from "vitest";
import {
  accountingJournalTotals,
  assertBalancedAccountingJournal,
  createAccountingReversal,
  isBalancedAccountingJournal,
  nextAccountingJournalStatus,
  nextAccountingPeriodStatus,
  type AccountingJournal,
} from "@/domain/erp-accounting";

const postedJournal: AccountingJournal = {
  id: "journal-original",
  tenantId: "tenant",
  siteId: "trang-an",
  journalCode: "JV-20260729-001",
  sourceType: "shift-close",
  sourceWorkflowId: "shift-close",
  sourceSupplierInvoiceId: null,
  sourceVersion: 4,
  businessDate: "2026-07-29",
  periodKey: "2026-07",
  status: "posted",
  version: 2,
  makerAccountId: "accountant-001",
  makerNote: "Đã đối chiếu đủ nguồn.",
  checkerAccountId: "chief-accountant-001",
  checkerNote: "Số liệu hợp lệ.",
  submittedAt: "2026-07-29T02:00:00.000Z",
  approvedAt: "2026-07-29T02:10:00.000Z",
  postedAt: "2026-07-29T02:10:00.000Z",
  reversalOfJournalId: null,
  supersedesJournalId: null,
  createdAt: "2026-07-29T02:00:00.000Z",
  updatedAt: "2026-07-29T02:10:00.000Z",
  lines: [
    {
      id: "line-1",
      journalId: "journal-original",
      lineNumber: 1,
      accountCode: "1111",
      accountName: "Tiền mặt",
      debitVnd: 90_000_000,
      creditVnd: 0,
      dimensions: { siteId: "trang-an" },
    },
    {
      id: "line-2",
      journalId: "journal-original",
      lineNumber: 2,
      accountCode: "5212",
      accountName: "Doanh thu hoàn lại",
      debitVnd: 10_000_000,
      creditVnd: 0,
      dimensions: { siteId: "trang-an" },
    },
    {
      id: "line-3",
      journalId: "journal-original",
      lineNumber: 3,
      accountCode: "5111",
      accountName: "Doanh thu vé",
      debitVnd: 0,
      creditVnd: 100_000_000,
      dimensions: { siteId: "trang-an" },
    },
  ],
  auditTrail: [],
};

describe("ERP accounting control plane", () => {
  it("accepts balanced VND journals and rejects malformed lines", () => {
    expect(accountingJournalTotals(postedJournal.lines)).toEqual({
      debitVnd: 100_000_000,
      creditVnd: 100_000_000,
    });
    expect(isBalancedAccountingJournal(postedJournal.lines)).toBe(true);
    expect(() =>
      assertBalancedAccountingJournal([
        postedJournal.lines[0],
        { ...postedJournal.lines[2], creditVnd: 99_000_000 },
      ]),
    ).toThrow(/chưa cân/);
    expect(() =>
      assertBalancedAccountingJournal([
        {
          ...postedJournal.lines[0],
          creditVnd: 1,
        },
        postedJournal.lines[2],
      ]),
    ).toThrow(/đúng một bên/);
  });

  it("creates a separate posted reversal without mutating the original", () => {
    const reversal = createAccountingReversal(postedJournal, {
      id: "journal-reversal",
      journalCode: "REV-JV-20260729-001",
      actorAccountId: "chief-accountant-001",
      reason: "Đảo bút toán để sửa mã nguồn thu.",
      now: "2026-07-29T03:00:00.000Z",
    });

    expect(reversal.status).toBe("posted");
    expect(reversal.reversalOfJournalId).toBe(postedJournal.id);
    expect(reversal.lines[0]).toMatchObject({
      debitVnd: 0,
      creditVnd: 90_000_000,
    });
    expect(reversal.lines[2]).toMatchObject({
      debitVnd: 100_000_000,
      creditVnd: 0,
    });
    expect(isBalancedAccountingJournal(reversal.lines)).toBe(true);
    expect(postedJournal.reversalOfJournalId).toBeNull();
  });

  it("enforces maker-checker and period state transitions", () => {
    expect(nextAccountingJournalStatus("draft", "submit")).toBe(
      "pending-checker",
    );
    expect(nextAccountingJournalStatus("pending-checker", "return")).toBe(
      "checker-returned",
    );
    expect(nextAccountingJournalStatus("checker-returned", "prepare")).toBe(
      "pending-checker",
    );
    expect(nextAccountingJournalStatus("pending-checker", "approve")).toBe(
      "posted",
    );
    expect(() =>
      nextAccountingJournalStatus("posted", "approve"),
    ).toThrow(/đang chờ kiểm tra/);
    expect(nextAccountingPeriodStatus("open", "lock")).toBe("locked");
    expect(nextAccountingPeriodStatus("locked", "reopen")).toBe("open");
  });
});
