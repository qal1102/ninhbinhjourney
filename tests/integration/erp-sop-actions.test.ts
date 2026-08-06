import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  decideSopOpeningAssessment: vi.fn(),
  getCurrentErpUser: vi.fn(),
  revalidatePath: vi.fn(),
  submitSopOpeningAssessment: vi.fn(),
}));

const { MockSopRepositoryError } = vi.hoisted(() => ({
  MockSopRepositoryError: class extends Error {},
}));

vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));
vi.mock("@/lib/erp/sop-repository", () => ({
  decideSopOpeningAssessment: doubles.decideSopOpeningAssessment,
  SopRepositoryError: MockSopRepositoryError,
  submitSopOpeningAssessment: doubles.submitSopOpeningAssessment,
}));

import {
  decideSopOpeningAssessmentAction,
  submitSopOpeningAssessmentAction,
} from "@/app/erp/sop-actions";

const initialState = { status: "idle" as const, message: "" };
const managerUser = {
  id: "manager-tam-chuc",
  name: "Trần Đức Long",
  role: "manager" as const,
  siteIds: ["tam-chuc"] as const,
  moduleIdsBySite: { "tam-chuc": ["sop-dien-tap"] as const },
};
const directorUser = {
  id: "director-001",
  name: "Nguyễn Minh Anh",
  role: "director" as const,
  siteIds: ["tam-chuc"] as const,
  moduleIdsBySite: { "tam-chuc": ["sop-dien-tap"] as const },
};

function submitForm() {
  const form = new FormData();
  form.set("siteId", "tam-chuc");
  form.set("businessDate", "2026-08-07");
  form.set("expectedVersion", "0");
  form.set("idempotencyKey", "submit-key-0001");
  form.append("itemId", "82000000-0000-4000-8000-000000000001");
  form.set("result:82000000-0000-4000-8000-000000000001", "pass");
  form.set("note:82000000-0000-4000-8000-000000000001", "");
  form.set(
    "evidence:82000000-0000-4000-8000-000000000001",
    "Biên bản đầu ca số 01",
  );
  return form;
}

function decisionForm() {
  const form = new FormData();
  form.set("siteId", "tam-chuc");
  form.set("assessmentId", "83000000-0000-4000-8000-000000000001");
  form.set("expectedVersion", "1");
  form.set("decision", "go");
  form.set("decisionNote", "Các hạng mục trọng yếu đều đạt.");
  form.set("riskAcceptance", "");
  form.set("idempotencyKey", "decision-key-0001");
  return form;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) double.mockReset();
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
});

describe("submitSopOpeningAssessmentAction", () => {
  it("uses the authenticated manager identity", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await submitSopOpeningAssessmentAction(
      initialState,
      submitForm(),
    );
    expect(result.status).toBe("success");
    expect(doubles.submitSopOpeningAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "tam-chuc",
        actorAccountId: managerUser.id,
        actorDisplayName: managerUser.name,
        expectedVersion: 0,
      }),
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/erp/tam-chuc/sop-dien-tap",
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp");
  });

  it("does not let a director act as the checklist maker", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await submitSopOpeningAssessmentAction(
      initialState,
      submitForm(),
    );
    expect(result.status).toBe("error");
    expect(doubles.submitSopOpeningAssessment).not.toHaveBeenCalled();
  });

  it("rejects a manager outside the granted module", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessModule.mockReturnValue(false);
    const result = await submitSopOpeningAssessmentAction(
      initialState,
      submitForm(),
    );
    expect(result.status).toBe("error");
    expect(doubles.submitSopOpeningAssessment).not.toHaveBeenCalled();
  });
});

describe("decideSopOpeningAssessmentAction", () => {
  it("uses the authenticated director identity", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await decideSopOpeningAssessmentAction(
      initialState,
      decisionForm(),
    );
    expect(result.status).toBe("success");
    expect(doubles.decideSopOpeningAssessment).toHaveBeenCalledWith({
      assessmentId: "83000000-0000-4000-8000-000000000001",
      actorAccountId: directorUser.id,
      actorDisplayName: directorUser.name,
      expectedVersion: 1,
      decision: "go",
      decisionNote: "Các hạng mục trọng yếu đều đạt.",
      riskAcceptance: "",
      idempotencyKey: "decision-key-0001",
    });
  });

  it("does not let the manager decide their own submission", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await decideSopOpeningAssessmentAction(
      initialState,
      decisionForm(),
    );
    expect(result.status).toBe("error");
    expect(doubles.decideSopOpeningAssessment).not.toHaveBeenCalled();
  });

  it("surfaces a database business refusal", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.decideSopOpeningAssessment.mockRejectedValue(
      new MockSopRepositoryError("Không thể chọn GO khi còn mục trọng yếu."),
    );
    const result = await decideSopOpeningAssessmentAction(
      initialState,
      decisionForm(),
    );
    expect(result).toEqual({
      status: "error",
      message: "Không thể chọn GO khi còn mục trọng yếu.",
    });
  });
});
