import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  decideProjectChangeRequest: vi.fn(),
  getCurrentErpUser: vi.fn(),
  recordProjectSettlement: vi.fn(),
  reportProjectBlocker: vi.fn(),
  revalidatePath: vi.fn(),
  submitProjectChangeRequest: vi.fn(),
  updateProjectWorkItem: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

const { MockProjectRepositoryConflictError } = vi.hoisted(() => ({
  MockProjectRepositoryConflictError: class extends Error {},
}));

vi.mock("@/lib/erp/project-repository", () => ({
  ProjectRepositoryConflictError: MockProjectRepositoryConflictError,
  decideProjectChangeRequest: doubles.decideProjectChangeRequest,
  recordProjectSettlement: doubles.recordProjectSettlement,
  reportProjectBlocker: doubles.reportProjectBlocker,
  submitProjectChangeRequest: doubles.submitProjectChangeRequest,
  updateProjectWorkItem: doubles.updateProjectWorkItem,
}));

import {
  decideProjectChangeRequestAction,
  recordProjectSettlementAction,
  reportProjectBlockerAction,
  submitProjectChangeRequestAction,
  updateProjectWorkItemAction,
} from "@/app/erp/project-actions";

const employeeUser = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: { "trang-an": ["du-an-su-kien"] as const },
};

const managerUser = {
  id: "manager-trang-an",
  name: "Lê Hoàng Nam",
  role: "manager" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {},
};

const directorUser = {
  id: "director-001",
  name: "Nguyễn Minh Anh",
  role: "director" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {},
};

const accountantUser = {
  id: "accountant-001",
  name: "Phạm Thu Trang",
  role: "accountant" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {},
};

beforeEach(() => {
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.accountCanAccessModule.mockReturnValue(true);
});

describe("updateProjectWorkItemAction", () => {
  it("rejects an actor without site/module access", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessModule.mockReturnValue(false);
    const result = await updateProjectWorkItemAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-041",
      nextStatus: "in-progress",
    });
    expect(result.success).toBe(false);
    expect(doubles.updateProjectWorkItem).not.toHaveBeenCalled();
  });

  it("rejects an invalid next status", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await updateProjectWorkItemAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-041",
      nextStatus: "cancelled",
    });
    expect(result).toEqual({ success: false, message: "Trạng thái không hợp lệ." });
    expect(doubles.updateProjectWorkItem).not.toHaveBeenCalled();
  });

  it("rejects a progress value outside 0-100", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await updateProjectWorkItemAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-041",
      nextStatus: "in-progress",
      progressPercent: 150,
    });
    expect(result).toEqual({ success: false, message: "Tiến độ phải trong khoảng 0-100." });
    expect(doubles.updateProjectWorkItem).not.toHaveBeenCalled();
  });

  it("updates the work item and revalidates the module page on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.updateProjectWorkItem.mockResolvedValue({ code: "EV-TA-041", status: "in-progress" });
    const result = await updateProjectWorkItemAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-041",
      nextStatus: "in-progress",
    });
    expect(doubles.updateProjectWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "trang-an",
        workItemCode: "EV-TA-041",
        actorId: managerUser.id,
        actorRole: "manager",
        nextStatus: "in-progress",
      }),
    );
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/du-an-su-kien");
  });

  it("surfaces a conflict error as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.updateProjectWorkItem.mockRejectedValue(
      new MockProjectRepositoryConflictError("Còn gói việc phụ thuộc chưa hoàn thành, chưa thể gửi nghiệm thu."),
    );
    const result = await updateProjectWorkItemAction({
      siteId: "trang-an",
      workItemCode: "EV-TC-021",
      nextStatus: "ready-for-acceptance",
    });
    expect(result).toEqual({
      success: false,
      message: "Còn gói việc phụ thuộc chưa hoàn thành, chưa thể gửi nghiệm thu.",
    });
  });
});

describe("reportProjectBlockerAction", () => {
  it("rejects a role without update capability (accountant)", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(accountantUser);
    const result = await reportProjectBlockerAction({ siteId: "trang-an", workItemCode: "EV-TA-038", reason: "Chờ vật tư" });
    expect(result.success).toBe(false);
    expect(doubles.reportProjectBlocker).not.toHaveBeenCalled();
  });

  it("reports a blocker and revalidates on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.reportProjectBlocker.mockResolvedValue({ code: "EV-TA-038", status: "blocked" });
    const result = await reportProjectBlockerAction({ siteId: "trang-an", workItemCode: "EV-TA-038", reason: "Chờ vật tư" });
    expect(result).toEqual({
      success: true,
      message: "EV-TA-038: đã báo chặn.",
      workItem: { code: "EV-TA-038", status: "blocked" },
    });
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/du-an-su-kien");
  });
});

describe("submitProjectChangeRequestAction", () => {
  it("rejects actors who are not a manager", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await submitProjectChangeRequestAction({
      siteId: "trang-an",
      kind: "budget",
      summary: "Tăng ngân sách sân khấu",
      proposedBudgetBillion: 15,
    });
    expect(result.success).toBe(false);
    expect(doubles.submitProjectChangeRequest).not.toHaveBeenCalled();
  });

  it("rejects an invalid kind", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await submitProjectChangeRequestAction({
      siteId: "trang-an",
      kind: "other",
      summary: "Test",
    });
    expect(result).toEqual({ success: false, message: "Loại yêu cầu không hợp lệ." });
  });

  it("rejects an empty summary", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await submitProjectChangeRequestAction({
      siteId: "trang-an",
      kind: "scope",
      summary: "   ",
    });
    expect(result).toEqual({ success: false, message: "Vui lòng nhập nội dung yêu cầu." });
  });

  it("submits the request and revalidates on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.submitProjectChangeRequest.mockResolvedValue({ id: "cr-1", status: "pending" });
    const result = await submitProjectChangeRequestAction({
      siteId: "trang-an",
      kind: "budget",
      summary: "Tăng ngân sách sân khấu",
      proposedBudgetBillion: 15,
    });
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/du-an-su-kien");
  });
});

describe("decideProjectChangeRequestAction", () => {
  it("rejects actors who are not a director", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await decideProjectChangeRequestAction({
      siteId: "trang-an",
      changeRequestId: "cr-1",
      decision: "approved",
    });
    expect(result.success).toBe(false);
    expect(doubles.decideProjectChangeRequest).not.toHaveBeenCalled();
  });

  it("decides the request and revalidates on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.decideProjectChangeRequest.mockResolvedValue({ id: "cr-1", status: "approved" });
    const result = await decideProjectChangeRequestAction({
      siteId: "trang-an",
      changeRequestId: "cr-1",
      decision: "approved",
    });
    expect(result).toEqual({
      success: true,
      message: "Đã duyệt yêu cầu đổi phạm vi.",
      changeRequest: { id: "cr-1", status: "approved" },
    });
  });

  it("surfaces a conflict error (already decided) as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.decideProjectChangeRequest.mockRejectedValue(
      new MockProjectRepositoryConflictError("Yêu cầu này đã được xử lý."),
    );
    const result = await decideProjectChangeRequestAction({
      siteId: "trang-an",
      changeRequestId: "cr-1",
      decision: "rejected",
    });
    expect(result).toEqual({ success: false, message: "Yêu cầu này đã được xử lý." });
  });
});

describe("recordProjectSettlementAction", () => {
  it("rejects actors who are not an accountant", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await recordProjectSettlementAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-038",
      amountBillion: 1.2,
      note: "Đã thanh toán",
      financeCode: "OPS-STAGE",
    });
    expect(result.success).toBe(false);
    expect(doubles.recordProjectSettlement).not.toHaveBeenCalled();
  });

  it("rejects an invalid amount", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(accountantUser);
    const result = await recordProjectSettlementAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-038",
      amountBillion: 0,
      note: "Đã thanh toán",
      financeCode: "OPS-STAGE",
    });
    expect(result).toEqual({ success: false, message: "Số tiền quyết toán không hợp lệ." });
  });

  it("records the settlement and revalidates on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(accountantUser);
    doubles.recordProjectSettlement.mockResolvedValue({ id: "st-1", amountBillion: 1.2 });
    const result = await recordProjectSettlementAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-038",
      amountBillion: 1.2,
      note: "Đã thanh toán",
      financeCode: "OPS-STAGE",
    });
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/du-an-su-kien");
  });

  it("surfaces a conflict error (not eligible) as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(accountantUser);
    doubles.recordProjectSettlement.mockRejectedValue(
      new MockProjectRepositoryConflictError("Gói việc chưa đủ điều kiện quyết toán."),
    );
    const result = await recordProjectSettlementAction({
      siteId: "trang-an",
      workItemCode: "EV-TA-041",
      amountBillion: 1,
      note: "note",
      financeCode: "OPS-1",
    });
    expect(result).toEqual({ success: false, message: "Gói việc chưa đủ điều kiện quyết toán." });
  });
});
