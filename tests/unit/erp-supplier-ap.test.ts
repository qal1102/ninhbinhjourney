import { describe, expect, it } from "vitest";
import {
  canActOnSupplierAp,
  evaluateSupplierApMatch,
  supplierApLiabilityProposal,
  type SupplierApInvoice,
} from "@/domain/erp-supplier-ap";

const baseMatch = {
  supplierTaxCode: "0101234567",
  purchaseOrderReference: "PO-TC-2026-018",
  purchaseOrderTotalVnd: 220_000_000,
  acceptanceReference: "NT-TC-2026-018",
  acceptedTotalVnd: 220_000_000,
  invoiceDate: "2026-07-20",
  dueDate: "2026-08-19",
  netVnd: 200_000_000,
  vatVnd: 20_000_000,
  totalVnd: 220_000_000,
  today: "2026-07-29",
} as const;

function invoice(
  patch: Partial<SupplierApInvoice> = {},
): SupplierApInvoice {
  return {
    id: "87000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000001",
    siteId: "tam-chuc",
    caseCode: "AP-TC-202607-018",
    paymentRequestedByAccountId: null,
    paymentRequestedAt: null,
    paymentMethod: null,
    paymentReference: null,
    paymentNote: null,
    paidByAccountId: null,
    paidAt: null,
    paidAmountVnd: null,
    supplier: {
      id: "86000000-0000-4000-8000-000000000001",
      siteId: "tam-chuc",
      code: "NCC-TC-018",
      name: "Vận tải Minh Long",
      taxCode: "0101234567",
      paymentTermsDays: 30,
      status: "active",
    },
    requestReference: "PR-TC-2026-018",
    purchaseOrderReference: "PO-TC-2026-018",
    contractReference: "HD-TC-2026-018",
    purchaseOrderTotalVnd: 220_000_000,
    acceptanceReference: "NT-TC-2026-018",
    acceptedTotalVnd: 220_000_000,
    invoiceSeries: "1C26TML",
    invoiceNumber: "000018",
    invoiceDate: "2026-07-20",
    dueDate: "2026-08-19",
    netVnd: 200_000_000,
    vatVnd: 20_000_000,
    totalVnd: 220_000_000,
    currency: "VND",
    matchStatus: "matched",
    exceptionCodes: [],
    exceptionNote: null,
    exceptionApprovedByAccountId: null,
    exceptionApprovedAt: null,
    status: "ready-for-accounting",
    ownerRole: "accountant",
    version: 1,
    managerAccountId: "manager-trang-an",
    accountantAccountId: null,
    accountantNote: null,
    checkerAccountId: null,
    checkerNote: null,
    journalId: null,
    journalCode: null,
    journalVersion: null,
    journalStatus: null,
    journalLines: [],
    submittedAt: "2026-07-29T08:00:00.000Z",
    postedAt: null,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
    lines: [
      {
        id: "87100000-0000-4000-8000-000000000001",
        invoiceId: "87000000-0000-4000-8000-000000000001",
        lineNumber: 1,
        description: "Dịch vụ xe trung chuyển tháng 7",
        quantity: 1,
        unitPriceVnd: 200_000_000,
        netVnd: 200_000_000,
        vatVnd: 20_000_000,
        expenseCategory: "transport-service",
        debitAccountCode: "6277",
        debitAccountName: "Chi phí dịch vụ mua ngoài",
        costCenter: "TC-VANHANH",
        projectCode: null,
      },
    ],
    auditTrail: [],
    ...patch,
  };
}

describe("supplier AP matching", () => {
  it("accepts an invoice that stays within both PO and acceptance", () => {
    expect(evaluateSupplierApMatch(baseMatch)).toEqual({
      status: "matched",
      exceptionCodes: [],
    });
  });

  it("returns every actionable exception to the source owner", () => {
    const result = evaluateSupplierApMatch({
      ...baseMatch,
      supplierTaxCode: "ABC",
      acceptanceReference: "",
      acceptedTotalVnd: 150_000_000,
      netVnd: 205_000_000,
    });
    expect(result.status).toBe("exception");
    expect(result.exceptionCodes).toEqual(
      expect.arrayContaining([
        "missing-acceptance",
        "invalid-supplier-tax-code",
        "invoice-total-mismatch",
        "invoice-over-acceptance",
      ]),
    );
  });

  it("applies a configured monetary tolerance without hiding larger overruns", () => {
    expect(
      evaluateSupplierApMatch({
        ...baseMatch,
        purchaseOrderTotalVnd: 219_500_000,
        acceptedTotalVnd: 219_500_000,
        toleranceVnd: 500_000,
      }).status,
    ).toBe("matched");
    expect(
      evaluateSupplierApMatch({
        ...baseMatch,
        purchaseOrderTotalVnd: 219_499_999,
        acceptedTotalVnd: 219_499_999,
        toleranceVnd: 500_000,
      }).exceptionCodes,
    ).toEqual(
      expect.arrayContaining([
        "invoice-over-purchase-order",
        "invoice-over-acceptance",
      ]),
    );
  });
});

describe("supplier AP liability proposal", () => {
  it("creates balanced expense, input VAT and payable lines from trusted source", () => {
    const proposal = supplierApLiabilityProposal(invoice());
    expect(proposal.map((line) => line.accountCode)).toEqual([
      "6277",
      "1331",
      "331",
    ]);
    expect(
      proposal.reduce((total, line) => total + line.debitVnd, 0),
    ).toBe(220_000_000);
    expect(
      proposal.reduce((total, line) => total + line.creditVnd, 0),
    ).toBe(220_000_000);
    expect(proposal[0]?.dimensions).toMatchObject({
      supplierCode: "NCC-TC-018",
      purchaseOrderReference: "PO-TC-2026-018",
      acceptanceReference: "NT-TC-2026-018",
    });
  });

  it("refuses to prepare a journal from an unmatched invoice", () => {
    expect(() =>
      supplierApLiabilityProposal(
        invoice({
          status: "match-exception",
          ownerRole: "manager",
          matchStatus: "exception",
          exceptionCodes: ["missing-acceptance"],
        }),
      ),
    ).toThrow(/khớp PO/);
  });
});

describe("supplier AP ownership", () => {
  it("exposes each action only to the current owner role", () => {
    expect(canActOnSupplierAp("accountant", invoice())).toBe(true);
    expect(canActOnSupplierAp("manager", invoice())).toBe(false);
    expect(
      canActOnSupplierAp(
        "accountant",
        invoice({
          status: "match-exception",
          ownerRole: "accountant",
          matchStatus: "exception",
          exceptionCodes: ["invoice-over-purchase-order"],
        }),
      ),
    ).toBe(true);
    expect(
      canActOnSupplierAp(
        "accountant",
        invoice({
          status: "match-exception",
          ownerRole: "manager",
          matchStatus: "exception",
          exceptionCodes: ["missing-acceptance"],
        }),
      ),
    ).toBe(false);
    expect(
      canActOnSupplierAp(
        "chief-accountant",
        invoice({
          status: "accounting-review",
          ownerRole: "chief-accountant",
        }),
      ),
    ).toBe(true);
    expect(
      canActOnSupplierAp(
        "director",
        invoice({
          status: "director-exception",
          ownerRole: "director",
        }),
      ),
    ).toBe(true);
  });
});
