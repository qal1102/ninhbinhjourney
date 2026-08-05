import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountingJournal } from "@/domain/erp-accounting";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  changeAccountingPeriod: vi.fn(),
  getAccountingJournal: vi.fn(),
  getCurrentErpUser: vi.fn(),
  listAccountingJournals: vi.fn(),
  listShiftClosures: vi.fn(),
  prepareShiftCloseAccountingJournal: vi.fn(),
  revalidatePath: vi.fn(),
  reverseAccountingJournal: vi.fn(),
  reviewAccountingJournal: vi.fn(),
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

vi.mock("@/lib/erp/accounting-repository", () => ({
  AccountingRepositoryConfigurationError: class extends Error {},
  AccountingRepositoryConflictError: class extends Error {},
  AccountingRepositoryError: class extends Error {},
  accountingActorDuty: (role: string) =>
    role === "accountant"
      ? "accountant-maker"
      : role === "chief-accountant"
        ? "accounting-checker"
        : null,
  changeAccountingPeriod: doubles.changeAccountingPeriod,
  getAccountingJournal: doubles.getAccountingJournal,
  listAccountingJournals: doubles.listAccountingJournals,
  prepareShiftCloseAccountingJournal:
    doubles.prepareShiftCloseAccountingJournal,
  reverseAccountingJournal: doubles.reverseAccountingJournal,
  reviewAccountingJournal: doubles.reviewAccountingJournal,
}));

vi.mock("@/lib/erp/shift-close-repository", () => ({
  ShiftCloseRepositoryConfigurationError: class extends Error {},
  ShiftCloseRepositoryError: class extends Error {},
  listShiftClosures: doubles.listShiftClosures,
}));

import {
  changeAccountingPeriodAction,
  prepareShiftCloseAccountingJournalAction,
  reverseAccountingJournalAction,
  reviewAccountingJournalAction,
  type AccountingActionState,
} from "@/app/erp/accounting-actions";
import { AccountingRepositoryConfigurationError } from "@/lib/erp/accounting-repository";

const WORKFLOW_ID = "10000000-0000-4000-8000-000000000101";
const JOURNAL_ID = "10000000-0000-4000-8000-000000000201";
const REVERSAL_ID = "10000000-0000-4000-8000-000000000202";

const previous: AccountingActionState = {
  status: "idle",
  message: "",
};

const accountant = {
  id: "accountant-001",
  name: "Phạm Thu Trang",
  role: "accountant",
  siteIds: ["trang-an"],
  moduleIdsBySite: {
    "trang-an": ["tai-chinh-doi-soat"],
  },
};

const chiefAccountant = {
  id: "chief-accountant-001",
  name: "Nguyễn Hải Yến",
  role: "chief-accountant",
  siteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
  moduleIdsBySite: {
    "trang-an": ["tai-chinh-doi-soat"],
  },
};

const director = {
  id: "director-001",
  name: "Nguyễn Minh Anh",
  role: "director",
  siteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
  moduleIdsBySite: {
    "trang-an": ["tai-chinh-doi-soat"],
  },
};

const journal: AccountingJournal = {
  id: JOURNAL_ID,
  tenantId: "00000000-0000-4000-8000-000000000001",
  siteId: "trang-an",
  journalCode: "JV-20260729-001",
  sourceType: "shift-close",
  sourceWorkflowId: WORKFLOW_ID,
  sourceSupplierInvoiceId: null,
  sourceVersion: 3,
  businessDate: "2026-07-29",
  periodKey: "2026-07",
  status: "pending-checker",
  version: 1,
  makerAccountId: accountant.id,
  makerNote: "Đã đối chiếu đủ báo cáo ca.",
  checkerAccountId: null,
  checkerNote: null,
  submittedAt: "2026-07-29T02:00:00.000Z",
  approvedAt: null,
  postedAt: null,
  reversalOfJournalId: null,
  supersedesJournalId: null,
  createdAt: "2026-07-29T02:00:00.000Z",
  updatedAt: "2026-07-29T02:00:00.000Z",
  lines: [
    {
      id: "line-1",
      journalId: JOURNAL_ID,
      lineNumber: 1,
      accountCode: "1111",
      accountName: "Tiền mặt",
      debitVnd: 100_000,
      creditVnd: 0,
      dimensions: { siteId: "trang-an" },
    },
    {
      id: "line-2",
      journalId: JOURNAL_ID,
      lineNumber: 2,
      accountCode: "5111",
      accountName: "Doanh thu vé",
      debitVnd: 0,
      creditVnd: 100_000,
      dimensions: { siteId: "trang-an" },
    },
  ],
  auditTrail: [],
};

function prepareForm() {
  const formData = new FormData();
  formData.set("workflowId", WORKFLOW_ID);
  formData.set("expectedSourceVersion", "3");
  formData.set("note", "Đã đối chiếu đủ báo cáo ca.");
  formData.set("actorAccountId", "director-001");
  formData.set("status", "posted");
  formData.set("amountVnd", "999999999999");
  return formData;
}

function reviewForm(decision: "approve" | "return" = "approve") {
  const formData = new FormData();
  formData.set("journalId", JOURNAL_ID);
  formData.set("expectedVersion", "1");
  formData.set("decision", decision);
  formData.set(
    "note",
    decision === "approve"
      ? "Đã kiểm tra và đồng ý ghi sổ."
      : "Bổ sung biên bản chốt quỹ.",
  );
  return formData;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) double.mockReset();
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.getCurrentErpUser.mockResolvedValue(accountant);
  doubles.listShiftClosures.mockResolvedValue([
    {
      id: WORKFLOW_ID,
      siteId: "trang-an",
      version: 3,
      status: "manager-approved",
    },
  ]);
  doubles.getAccountingJournal.mockResolvedValue(journal);
  doubles.listAccountingJournals.mockResolvedValue([]);
  doubles.prepareShiftCloseAccountingJournal.mockResolvedValue(journal);
  doubles.reviewAccountingJournal.mockResolvedValue({
    ...journal,
    status: "posted",
    version: 2,
  });
  doubles.reverseAccountingJournal.mockResolvedValue({
    ...journal,
    id: REVERSAL_ID,
    journalCode: "REV-JV-20260729-001",
    status: "posted",
    reversalOfJournalId: JOURNAL_ID,
  });
  doubles.changeAccountingPeriod.mockResolvedValue({
    id: "10000000-0000-4000-8000-000000000301",
    tenantId: journal.tenantId,
    periodKey: "2026-07",
    startsOn: "2026-07-01",
    endsOn: "2026-07-31",
    status: "locked",
    version: 2,
    lockedByAccountId: chiefAccountant.id,
    lockedAt: "2026-07-29T03:00:00.000Z",
    lockReason: "Đã hoàn tất checklist cuối kỳ.",
    reopenedByAccountId: null,
    reopenedAt: null,
    reopenReason: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-29T03:00:00.000Z",
  });
});

describe("ERP accounting server-action guards", () => {
  it("derives maker identity, idempotency and request hash on the server", async () => {
    const result = await prepareShiftCloseAccountingJournalAction(
      previous,
      prepareForm(),
    );

    expect(result.status).toBe("success");
    expect(
      doubles.prepareShiftCloseAccountingJournal,
    ).toHaveBeenCalledOnce();
    const command =
      doubles.prepareShiftCloseAccountingJournal.mock.calls[0][2];
    expect(command.actorAccountId).toBe(accountant.id);
    expect(command.idempotencyKey).toMatch(
      /^acct:prepare-shift-close:[0-9a-f]{48}$/,
    );
    expect(command.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(command).not.toHaveProperty("amountVnd");
    expect(command).not.toHaveProperty("status");
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp");
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/finance");
  });

  it("enforces maker-checker separation before calling the repository", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);
    doubles.getAccountingJournal.mockResolvedValue({
      ...journal,
      makerAccountId: chiefAccountant.id,
    });

    const result = await reviewAccountingJournalAction(
      previous,
      reviewForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/Người lập không được tự kiểm tra/);
    expect(doubles.reviewAccountingJournal).not.toHaveBeenCalled();
  });

  it("allows the chief accountant to approve and atomically post", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);

    const result = await reviewAccountingJournalAction(
      previous,
      reviewForm("approve"),
    );

    expect(result.status).toBe("success");
    expect(doubles.reviewAccountingJournal).toHaveBeenCalledWith(
      JOURNAL_ID,
      1,
      "approve",
      expect.objectContaining({
        actorAccountId: chiefAccountant.id,
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("denies director access to checker duties", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(director);

    const result = await reviewAccountingJournalAction(
      previous,
      reviewForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/Chỉ kế toán trưởng/);
    expect(doubles.getAccountingJournal).not.toHaveBeenCalled();
    expect(doubles.reviewAccountingJournal).not.toHaveBeenCalled();
  });

  it("permits reversal and period lock only for the checker duty", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);
    const reversalForm = new FormData();
    reversalForm.set("journalId", JOURNAL_ID);
    reversalForm.set("expectedVersion", "1");
    reversalForm.set("reason", "Đảo để sửa mã nguồn thu.");

    const reversed = await reverseAccountingJournalAction(
      previous,
      reversalForm,
    );
    expect(reversed.status).toBe("success");
    expect(doubles.reverseAccountingJournal).toHaveBeenCalledOnce();

    const periodForm = new FormData();
    periodForm.set("periodKey", "2026-07");
    periodForm.set("expectedVersion", "1");
    periodForm.set("action", "lock");
    periodForm.set("reason", "Đã hoàn tất checklist cuối kỳ.");
    const locked = await changeAccountingPeriodAction(
      previous,
      periodForm,
    );
    expect(locked.status).toBe("success");
    expect(doubles.changeAccountingPeriod).toHaveBeenCalledOnce();
  });

  it("allows the chief accountant to reverse a cash-deposit sourced journal", async () => {
    // T10b mo rong: hoan but tung chi cho shift-close, gio dung chung mot
    // cong voi cash-deposit (xem accounting-actions.ts). AP van bi chan --
    // xem bai test ngay duoi.
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);
    doubles.getAccountingJournal.mockResolvedValue({
      ...journal,
      sourceType: "cash-deposit",
      sourceWorkflowId: null,
      status: "posted",
    });
    const reversalForm = new FormData();
    reversalForm.set("journalId", JOURNAL_ID);
    reversalForm.set("expectedVersion", "1");
    reversalForm.set("reason", "Sai lượt nộp quỹ, đảo để nộp lại đúng số.");

    const result = await reverseAccountingJournalAction(previous, reversalForm);

    expect(result.status).toBe("success");
    expect(doubles.reverseAccountingJournal).toHaveBeenCalledOnce();
  });

  it("still refuses to reverse a supplier-invoice sourced journal", async () => {
    // AP chua mo duong hoan but -- luong cong no NCC dung "da tra" lam
    // trang thai cuoi, chua co dac ta cho dao but toan da tra. Mo som se
    // tao mot duong sua so ngoai dac ta.
    doubles.getCurrentErpUser.mockResolvedValue(chiefAccountant);
    doubles.getAccountingJournal.mockResolvedValue({
      ...journal,
      sourceType: "supplier-invoice",
      sourceWorkflowId: null,
      sourceSupplierInvoiceId: "invoice-001",
      status: "posted",
    });
    const reversalForm = new FormData();
    reversalForm.set("journalId", JOURNAL_ID);
    reversalForm.set("expectedVersion", "1");
    reversalForm.set("reason", "Thử đảo bút toán công nợ NCC.");

    const result = await reverseAccountingJournalAction(previous, reversalForm);

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/chưa mở ở luồng này/);
    expect(doubles.reverseAccountingJournal).not.toHaveBeenCalled();
  });

  it("fails closed when production persistence is unavailable", async () => {
    doubles.prepareShiftCloseAccountingJournal.mockRejectedValue(
      new AccountingRepositoryConfigurationError(
        "SUPABASE_SECRET_KEY missing",
      ),
    );

    const result = await prepareShiftCloseAccountingJournalAction(
      previous,
      prepareForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/chưa được cấu hình đủ/);
    expect(result.message).not.toContain("SUPABASE_SECRET_KEY");
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });
});
