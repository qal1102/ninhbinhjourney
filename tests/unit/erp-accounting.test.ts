import { describe, expect, it } from "vitest";
import {
  ERP_ACCOUNTING_CASES,
  journalTotals,
  type AccountingCaseCategory,
} from "@/domain/erp-accounting";

describe("ERP accounting workbench data", () => {
  it("covers every core accounting queue", () => {
    const categories = new Set<AccountingCaseCategory>(
      ERP_ACCOUNTING_CASES.map((item) => item.category),
    );

    expect(categories).toEqual(new Set<AccountingCaseCategory>([
      "revenue",
      "payable",
      "expense",
      "payroll",
      "asset",
      "invoice",
      "close",
    ]));
  });

  it("keeps every proposed journal balanced", () => {
    for (const item of ERP_ACCOUNTING_CASES.filter((entry) => entry.journal.length > 0)) {
      const totals = journalTotals(item);
      expect(totals.debitMillion, item.id).toBeCloseTo(totals.creditMillion, 5);
      expect(totals.debitMillion, item.id).toBeGreaterThan(0);
    }
  });

  it("gives each case enough evidence and audit context to inspect", () => {
    const ids = ERP_ACCOUNTING_CASES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of ERP_ACCOUNTING_CASES) {
      expect(item.owner, item.id).not.toBe(item.checker);
      expect(item.source.length, item.id).toBeGreaterThan(8);
      expect(item.documents.length + item.missingDocuments.length, item.id).toBeGreaterThan(0);
      expect(item.dimensions.length, item.id).toBeGreaterThanOrEqual(4);
      expect(item.timeline.length, item.id).toBeGreaterThanOrEqual(2);
    }
  });
});
