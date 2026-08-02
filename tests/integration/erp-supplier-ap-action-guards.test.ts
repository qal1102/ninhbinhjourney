import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SupplierApInvoice,
  SupplierApSupplier,
} from "@/domain/erp-supplier-ap";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  decideSupplierException: vi.fn(),
  escalateSupplierInvoice: vi.fn(),
  getCurrentErpUser: vi.fn(),
  getSupplierInvoice: vi.fn(),
  listSupplierAp: vi.fn(),
  prepareSupplierInvoiceJournal: vi.fn(),
  resubmitSupplierInvoice: vi.fn(),
  revalidatePath: vi.fn(),
  reviewSupplierInvoiceJournal: vi.fn(),
  submitSupplierInvoice: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/supplier-ap-repository", () => ({
  SupplierApRepositoryConfigurationError: class extends Error {},
  SupplierApRepositoryConflictError: class extends Error {},
  SupplierApRepositoryError: class extends Error {},
  decideSupplierException: doubles.decideSupplierException,
  escalateSupplierInvoice: doubles.escalateSupplierInvoice,
  getSupplierInvoice: doubles.getSupplierInvoice,
  listSupplierAp: doubles.listSupplierAp,
  prepareSupplierInvoiceJournal: doubles.prepareSupplierInvoiceJournal,
  resubmitSupplierInvoice: doubles.resubmitSupplierInvoice,
  reviewSupplierInvoiceJournal: doubles.reviewSupplierInvoiceJournal,
  submitSupplierInvoice: doubles.submitSupplierInvoice,
}));

import {
  decideSupplierExceptionAction,
  escalateSupplierInvoiceAction,
  prepareSupplierInvoiceJournalAction,
  reviewSupplierInvoiceJournalAction,
  submitSupplierInvoiceAction,
  type SupplierApActionState,
} from "@/app/erp/supplier-ap-actions";

const SUPPLIER_ID = "10000000-0000-4000-8000-000000000010";
const INVOICE_ID = "10000000-0000-4000-8000-000000000101";
const JOURNAL_ID = "10000000-0000-4000-8000-000000000201";

const previous: SupplierApActionState = {
  status: "idle",
  message: "",
};

const manager = {
  id: "manager-001",
  name: "Quản lý Tràng An",
  role: "manager",
  siteIds: ["trang-an"],
  moduleIdsBySite: {
    "trang-an": ["doi-tac-nha-cung-ung"],
  },
};

const accountant = {
  id: "accountant-001",
  name: "Kế toán viên",
  role: "accountant",
  siteIds: ["trang-an"],
  moduleIdsBySite: {
    "trang-an": ["doi-tac-nha-cung-ung", "tai-chinh-doi-soat"],
  },
};

const chiefAccountant = {
  id: "chief-accountant-001",
  name: "Kế toán trưởng",
  role: "chief-accountant",
  siteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
  moduleIdsBySite: {
    "trang-an": ["doi-tac-nha-cung-ung", "tai-chinh-doi-soat"],
  },
};

const director = {
  id: "director-001",
  name: "Giám đốc",
  role: "director",
  siteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
  moduleIdsBySite: {
    "trang-an": ["doi-tac-nha-cung-ung", "tai-chinh-doi-soat"],
  },
};

const supplier: SupplierApSupplier = {
  id: SUPPLIER_ID,
  siteId: "trang-an",
  code: "NCC-TA-001",
  name: "Công ty Dịch vụ Tràng An",
  taxCode: "0101234567",
  paymentTermsDays: 30,
  status: "active",
};

function invoiceFixture(
  overrides: Partial<SupplierApInvoice> = {},
): SupplierApInvoice {
  return {
    id: INVOICE_ID,
    tenantId: "00000000-0000-4000-8000-000000000001",
    siteId: "trang-an",
    caseCode: "AP-TA-202607-001",
    paymentRequestedByAccountId: null,
    paymentRequestedAt: null,
    paymentMethod: null,
    paymentReference: null,
    paymentNote: null,
    paidByAccountId: null,
    paidAt: null,
    paidAmountVnd: null,
    supplier,
    requestReference: "DNM-TA-001",
    purchaseOrderReference: "PO-TA-001",
    contractReference: "HD-TA-001",
    purchaseOrderTotalVnd: 110_000_000,
    acceptanceReference: "NT-TA-001",
    acceptedTotalVnd: 110_000_000,
    invoiceSeries: "C26TAA",
    invoiceNumber: "0000101",
    invoiceDate: "2026-07-29",
    dueDate: "2026-08-28",
    netVnd: 100_000_000,
    vatVnd: 10_000_000,
    totalVnd: 110_000_000,
    currency: "VND",
    matchStatus: "matched",
    exceptionCodes: [],
    exceptionNote: null,
    exceptionApprovedByAccountId: null,
    exceptionApprovedAt: null,
    status: "ready-for-accounting",
    ownerRole: "accountant",
    version: 3,
    managerAccountId: manager.id,
    accountantAccountId: null,
    accountantNote: null,
    checkerAccountId: null,
    checkerNote: null,
    journalId: null,
    journalCode: null,
    journalVersion: null,
    journalStatus: null,
    journalLines: [],
    submittedAt: "2026-07-29T01:00:00.000Z",
    postedAt: null,
    createdAt: "2026-07-29T01:00:00.000Z",
    updatedAt: "2026-07-29T01:00:00.000Z",
    lines: [
      {
        id: "10000000-0000-4000-8000-000000000301",
        invoiceId: INVOICE_ID,
        lineNumber: 1,
        description: "Dịch vụ vận chuyển",
        quantity: 1,
        unitPriceVnd: 100_000_000,
        netVnd: 100_000_000,
        vatVnd: 10_000_000,
        expenseCategory: "transport-service",
        debitAccountCode: "6277",
        debitAccountName: "Chi phí dịch vụ mua ngoài",
        costCenter: "TRANG-AN",
        projectCode: null,
      },
    ],
    auditTrail: [],
    ...overrides,
  };
}

function submitForm() {
  const formData = new FormData();
  formData.set("siteId", "trang-an");
  formData.set("supplierId", SUPPLIER_ID);
  formData.set("requestReference", "DNM-TA-001");
  formData.set("purchaseOrderReference", "PO-TA-001");
  formData.set("contractReference", "HD-TA-001");
  formData.set("purchaseOrderTotalVnd", "110000000");
  formData.set("acceptanceReference", "NT-TA-001");
  formData.set("acceptedTotalVnd", "110000000");
  formData.set("invoiceSeries", "C26TAA");
  formData.set("invoiceNumber", "0000101");
  formData.set("invoiceDate", "2026-07-29");
  formData.set("dueDate", "2026-08-28");
  formData.set("netVnd", "100000000");
  formData.set("vatVnd", "10000000");
  formData.set("totalVnd", "110000000");
  formData.set("expenseCategory", "transport-service");
  formData.set("description", "Dịch vụ vận chuyển tháng 7");
  formData.set("costCenter", "TRANG-AN");
  formData.set("projectCode", "");
  formData.set("note", "Đã kiểm tra đủ hồ sơ nguồn.");
  return formData;
}

function prepareForm() {
  const formData = new FormData();
  formData.set("invoiceId", INVOICE_ID);
  formData.set("expectedVersion", "3");
  formData.set("note", "Đã kiểm tra hóa đơn và hồ sơ nguồn.");
  formData.set("actorAccountId", director.id);
  formData.set("amountVnd", "999999999999");
  formData.set("debitAccountCode", "1111");
  formData.set("creditAccountCode", "5111");
  formData.set("status", "posted");
  return formData;
}

function reviewForm(decision: "approve" | "return" = "approve") {
  const formData = new FormData();
  formData.set("invoiceId", INVOICE_ID);
  formData.set("expectedSourceVersion", "3");
  formData.set("expectedJournalVersion", "2");
  formData.set("decision", decision);
  formData.set(
    "note",
    decision === "approve"
      ? "Đã kiểm tra chứng từ và đồng ý ghi sổ."
      : "Bổ sung biên bản nghiệm thu.",
  );
  formData.set("actorAccountId", accountant.id);
  formData.set("amountVnd", "999999999999");
  formData.set("debitAccountCode", "1111");
  formData.set("creditAccountCode", "5111");
  return formData;
}

function directorDecisionForm() {
  const formData = new FormData();
  formData.set("invoiceId", INVOICE_ID);
  formData.set("expectedVersion", "3");
  formData.set("decision", "approve");
  formData.set("note", "Chấp thuận sai lệch theo hồ sơ đã xác minh.");
  return formData;
}

function escalateForm() {
  const formData = new FormData();
  formData.set("invoiceId", INVOICE_ID);
  formData.set("expectedVersion", "3");
  formData.set(
    "note",
    "Đã xác minh phần phát sinh và tác động ngân sách.",
  );
  return formData;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) double.mockReset();
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.getCurrentErpUser.mockResolvedValue(accountant);
  doubles.getSupplierInvoice.mockResolvedValue(invoiceFixture());
  doubles.listSupplierAp.mockResolvedValue({
    suppliers: [supplier],
    invoices: [],
  });
  doubles.submitSupplierInvoice.mockResolvedValue(invoiceFixture());
  doubles.prepareSupplierInvoiceJournal.mockResolvedValue(
    invoiceFixture({
      status: "accounting-review",
      ownerRole: "chief-accountant",
      version: 4,
      accountantAccountId: accountant.id,
      journalId: JOURNAL_ID,
      journalCode: "AP-TA-202607-001",
      journalVersion: 1,
      journalStatus: "pending-checker",
    }),
  );
  doubles.reviewSupplierInvoiceJournal.mockResolvedValue(
    invoiceFixture({
      status: "posted",
      ownerRole: "none",
      version: 4,
      accountantAccountId: accountant.id,
      checkerAccountId: chiefAccountant.id,
      journalId: JOURNAL_ID,
      journalCode: "AP-TA-202607-001",
      journalVersion: 3,
      journalStatus: "posted",
    }),
  );
  doubles.decideSupplierException.mockResolvedValue(invoiceFixture());
  doubles.escalateSupplierInvoice.mockResolvedValue(
    invoiceFixture({
      status: "director-exception",
      ownerRole: "director",
      version: 4,
      matchStatus: "exception",
      exceptionCodes: [
        "invoice-over-purchase-order",
        "invoice-over-acceptance",
      ],
    }),
  );
});

describe("ERP supplier AP server-action guards", () => {
  it("escalates only a monetary exception already routed to the accountant", async () => {
    doubles.getSupplierInvoice.mockResolvedValue(
      invoiceFixture({
        status: "match-exception",
        ownerRole: "manager",
        matchStatus: "exception",
        exceptionCodes: ["invoice-over-purchase-order"],
      }),
    );

    const blocked = await escalateSupplierInvoiceAction(
      previous,
      escalateForm(),
    );
    expect(blocked.status).toBe("error");
    expect(blocked.message).toContain("chưa được chuyển cho kế toán");
    expect(doubles.escalateSupplierInvoice).not.toHaveBeenCalled();

    doubles.getSupplierInvoice.mockResolvedValue(
      invoiceFixture({
        status: "match-exception",
        ownerRole: "accountant",
        matchStatus: "exception",
        exceptionCodes: [
          "invoice-over-purchase-order",
          "invoice-over-acceptance",
        ],
      }),
    );
    const allowed = await escalateSupplierInvoiceAction(
      previous,
      escalateForm(),
    );

    expect(allowed.status).toBe("success");
    expect(doubles.escalateSupplierInvoice).toHaveBeenCalledWith(
      INVOICE_ID,
      3,
      expect.objectContaining({
        actorAccountId: accountant.id,
        note: "Đã xác minh phần phát sinh và tác động ngân sách.",
      }),
    );
  });

  it("blocks an expired session before loading or mutating an invoice", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(null);

    const result = await prepareSupplierInvoiceJournalAction(
      previous,
      prepareForm(),
    );

    expect(result.status).toBe("error");
    expect(doubles.getSupplierInvoice).not.toHaveBeenCalled();
    expect(doubles.prepareSupplierInvoiceJournal).not.toHaveBeenCalled();
  });

  it("blocks a role without the liability-preparation capability", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(manager);

    const result = await prepareSupplierInvoiceJournalAction(
      previous,
      prepareForm(),
    );

    expect(result.status).toBe("error");
    expect(doubles.getSupplierInvoice).not.toHaveBeenCalled();
    expect(doubles.prepareSupplierInvoiceJournal).not.toHaveBeenCalled();
  });

  it("blocks a manager outside the requested site before supplier lookup", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(manager);
    doubles.accountCanAccessSite.mockReturnValue(false);

    const result = await submitSupplierInvoiceAction(previous, submitForm());

    expect(result.status).toBe("error");
    expect(doubles.listSupplierAp).not.toHaveBeenCalled();
    expect(doubles.submitSupplierInvoice).not.toHaveBeenCalled();
  });

  it("rejects a supplier record belonging to another site", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(manager);
    doubles.listSupplierAp.mockResolvedValue({
      suppliers: [
        {
          ...supplier,
          siteId: "tam-chuc",
        },
      ],
      invoices: [],
    });

    const result = await submitSupplierInvoiceAction(previous, submitForm());

    expect(result.status).toBe("error");
    expect(doubles.submitSupplierInvoice).not.toHaveBeenCalled();
  });

  it("lets an accountant prepare only the trusted-source liability command", async () => {
    const result = await prepareSupplierInvoiceJournalAction(
      previous,
      prepareForm(),
    );

    expect(result.status).toBe("success");
    expect(doubles.prepareSupplierInvoiceJournal).toHaveBeenCalledOnce();
    expect(doubles.prepareSupplierInvoiceJournal).toHaveBeenCalledWith(
      INVOICE_ID,
      3,
      expect.objectContaining({
        actorAccountId: accountant.id,
        idempotencyKey: expect.stringMatching(
          /^ap:prepare-supplier-invoice:[0-9a-f]{48}$/,
        ),
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    const command =
      doubles.prepareSupplierInvoiceJournal.mock.calls[0][2];
    expect(command).not.toHaveProperty("amountVnd");
    expect(command).not.toHaveProperty("debitAccountCode");
    expect(command).not.toHaveProperty("creditAccountCode");
    expect(command).not.toHaveProperty("status");
    expect(doubles.reviewSupplierInvoiceJournal).not.toHaveBeenCalled();
    expect(doubles.decideSupplierException).not.toHaveBeenCalled();
  });

  it("lets only the chief accountant review and ignores client-supplied posting data", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);
    doubles.getSupplierInvoice.mockResolvedValue(
      invoiceFixture({
        status: "accounting-review",
        ownerRole: "chief-accountant",
        accountantAccountId: accountant.id,
        journalId: JOURNAL_ID,
        journalCode: "AP-TA-202607-001",
        journalVersion: 2,
        journalStatus: "pending-checker",
      }),
    );

    const result = await reviewSupplierInvoiceJournalAction(
      previous,
      reviewForm(),
    );

    expect(result.status).toBe("success");
    expect(doubles.reviewSupplierInvoiceJournal).toHaveBeenCalledOnce();
    expect(doubles.reviewSupplierInvoiceJournal).toHaveBeenCalledWith(
      INVOICE_ID,
      3,
      2,
      "approve",
      expect.objectContaining({
        actorAccountId: chiefAccountant.id,
        idempotencyKey: expect.stringMatching(
          /^ap:review-supplier-invoice:[0-9a-f]{48}$/,
        ),
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    const command =
      doubles.reviewSupplierInvoiceJournal.mock.calls[0][4];
    expect(command).not.toHaveProperty("amountVnd");
    expect(command).not.toHaveProperty("debitAccountCode");
    expect(command).not.toHaveProperty("creditAccountCode");
    expect(doubles.prepareSupplierInvoiceJournal).not.toHaveBeenCalled();
    expect(doubles.decideSupplierException).not.toHaveBeenCalled();
  });

  it("routes a director decision only to the exception-decision repository action", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(director);
    doubles.getSupplierInvoice.mockResolvedValue(
      invoiceFixture({
        status: "director-exception",
        ownerRole: "director",
        matchStatus: "exception",
        exceptionCodes: [
          "invoice-over-purchase-order",
          "invoice-over-acceptance",
        ],
      }),
    );

    const result = await decideSupplierExceptionAction(
      previous,
      directorDecisionForm(),
    );

    expect(result.status).toBe("success");
    expect(doubles.decideSupplierException).toHaveBeenCalledWith(
      INVOICE_ID,
      3,
      "approve",
      expect.objectContaining({
        actorAccountId: director.id,
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(doubles.prepareSupplierInvoiceJournal).not.toHaveBeenCalled();
    expect(doubles.reviewSupplierInvoiceJournal).not.toHaveBeenCalled();
    expect(doubles.submitSupplierInvoice).not.toHaveBeenCalled();
  });
});
