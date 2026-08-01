import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  getCurrentErpUser: vi.fn(),
  progressIncidentByEmployee: vi.fn(),
  reportIncidentFromCamera: vi.fn(),
  revalidatePath: vi.fn(),
  transitionIncidentByManager: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-data", () => ({
  findDemoErpAccountById: vi.fn(),
  findDemoErpAccountByUsername: vi.fn(),
  getEmployeeAssignableModuleIds: vi.fn(),
  isDemoErpAccountActive: vi.fn(),
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  clearErpSession: vi.fn(),
  endRoleSwitch: vi.fn(),
  getCurrentErpUser: doubles.getCurrentErpUser,
  setErpSession: vi.fn(),
  startRoleSwitch: vi.fn(),
}));

vi.mock("@/lib/erp/role-switch-audit-repository", () => ({
  recordRoleSwitch: vi.fn(),
}));

vi.mock("@/lib/erp/staff-access-repository", () => ({
  getAccessState: vi.fn(),
  updateEmployeeAccessGrant: vi.fn(),
}));

const { MockAttendanceRepositoryConflictError } = vi.hoisted(() => ({
  MockAttendanceRepositoryConflictError: class extends Error {},
}));

vi.mock("@/lib/erp/attendance-repository", () => ({
  AttendanceRepositoryConflictError: MockAttendanceRepositoryConflictError,
  recordAttendanceEvent: vi.fn(),
}));

const { MockIncidentRepositoryConflictError } = vi.hoisted(() => ({
  MockIncidentRepositoryConflictError: class extends Error {},
}));

const { MockIncidentRepositoryError } = vi.hoisted(() => ({
  MockIncidentRepositoryError: class extends Error {},
}));

vi.mock("@/lib/erp/incident-repository", () => ({
  IncidentRepositoryConflictError: MockIncidentRepositoryConflictError,
  IncidentRepositoryError: MockIncidentRepositoryError,
  progressIncidentByEmployee: doubles.progressIncidentByEmployee,
  reportIncidentFromCamera: doubles.reportIncidentFromCamera,
  transitionIncidentByManager: doubles.transitionIncidentByManager,
}));

const { MockFieldReportRepositoryError } = vi.hoisted(() => ({
  MockFieldReportRepositoryError: class extends Error {},
}));

vi.mock("@/lib/erp/field-report-repository", () => ({
  FieldReportRepositoryError: MockFieldReportRepositoryError,
  submitFieldReport: vi.fn(),
}));

const { MockGateScanRepositoryError } = vi.hoisted(() => ({
  MockGateScanRepositoryError: class extends Error {},
}));

vi.mock("@/lib/erp/gate-scan-repository", () => ({
  GateScanRepositoryError: MockGateScanRepositoryError,
  recordGateScan: vi.fn(),
}));

import {
  progressIncidentAction,
  reportIncidentFromCameraAction,
  transitionIncidentAction,
} from "@/app/erp/actions";

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
  siteIds: ["trang-an", "tam-chuc"] as const,
  moduleIdsBySite: {},
};

const employeeUser = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: { "trang-an": ["su-co"] as const },
};

const acknowledgedIncident = {
  id: "INC-TA-071",
  siteId: "trang-an" as const,
  status: "acknowledged" as const,
  escalated: true,
  assigneeId: null,
};

const verificationIncident = {
  id: "INC-TA-069",
  siteId: "trang-an" as const,
  status: "verification" as const,
  escalated: false,
  assigneeId: employeeUser.id,
};

beforeEach(() => {
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.accountCanAccessModule.mockReturnValue(true);
});

describe("transitionIncidentAction", () => {
  it("rejects actors who are not a manager", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await transitionIncidentAction({
      incidentId: "INC-TA-071",
      siteId: "trang-an",
    });
    expect(result).toEqual({
      success: false,
      message: "Bạn không có quyền xử lý sự cố tại cơ sở này.",
    });
    expect(doubles.transitionIncidentByManager).not.toHaveBeenCalled();
  });

  it("rejects a site outside the manager's managed scope", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessSite.mockReturnValue(false);
    const result = await transitionIncidentAction({
      incidentId: "INC-TA-071",
      siteId: "trang-an",
    });
    expect(result.success).toBe(false);
    expect(doubles.transitionIncidentByManager).not.toHaveBeenCalled();
  });

  it("rejects an invalid site id before touching the repository", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await transitionIncidentAction({
      incidentId: "INC-TA-071",
      siteId: "not-a-real-site",
    });
    expect(result).toEqual({ success: false, message: "Cơ sở không hợp lệ." });
    expect(doubles.transitionIncidentByManager).not.toHaveBeenCalled();
  });

  it("transitions the incident and revalidates the module page on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.transitionIncidentByManager.mockResolvedValue({
      ...acknowledgedIncident,
      status: "acknowledged",
    });
    const result = await transitionIncidentAction({
      incidentId: "INC-TA-071",
      siteId: "trang-an",
    });
    expect(doubles.transitionIncidentByManager).toHaveBeenCalledWith({
      incidentId: "INC-TA-071",
      siteId: "trang-an",
      actorId: managerUser.id,
      actorName: managerUser.name,
    });
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/su-co");
  });

  it("surfaces a conflict error as a plain failure message, not a thrown error", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.transitionIncidentByManager.mockRejectedValue(
      new MockIncidentRepositoryConflictError("Hồ sơ đã đóng, không thể chuyển trạng thái tiếp."),
    );
    const result = await transitionIncidentAction({
      incidentId: "INC-TA-064",
      siteId: "trang-an",
    });
    expect(result).toEqual({
      success: false,
      message: "Hồ sơ đã đóng, không thể chuyển trạng thái tiếp.",
    });
  });
});

describe("progressIncidentAction", () => {
  it("rejects actors who are not an employee", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await progressIncidentAction({
      incidentId: "INC-TA-069",
      siteId: "trang-an",
    });
    expect(result).toEqual({
      success: false,
      message: "Bạn không có quyền cập nhật sự cố này.",
    });
    expect(doubles.progressIncidentByEmployee).not.toHaveBeenCalled();
  });

  it("rejects when the employee lacks module access at the site", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.accountCanAccessModule.mockReturnValue(false);
    const result = await progressIncidentAction({
      incidentId: "INC-TA-069",
      siteId: "trang-an",
    });
    expect(result.success).toBe(false);
    expect(doubles.progressIncidentByEmployee).not.toHaveBeenCalled();
  });

  it("reports progress and revalidates the module page on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.progressIncidentByEmployee.mockResolvedValue(verificationIncident);
    const result = await progressIncidentAction({
      incidentId: "INC-TA-069",
      siteId: "trang-an",
    });
    expect(doubles.progressIncidentByEmployee).toHaveBeenCalledWith({
      incidentId: "INC-TA-069",
      siteId: "trang-an",
      actorId: employeeUser.id,
      actorName: employeeUser.name,
    });
    expect(result).toEqual({
      success: true,
      message: "INC-TA-069: đã chuyển quản lý xác minh.",
      incident: verificationIncident,
    });
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/su-co");
  });

  it("surfaces a conflict error (not assigned / already closed) as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.progressIncidentByEmployee.mockRejectedValue(
      new MockIncidentRepositoryConflictError("Hồ sơ này không được giao cho bạn."),
    );
    const result = await progressIncidentAction({
      incidentId: "INC-TA-064",
      siteId: "trang-an",
    });
    expect(result).toEqual({
      success: false,
      message: "Hồ sơ này không được giao cho bạn.",
    });
  });
});

describe("reportIncidentFromCameraAction", () => {
  const cameraInput = {
    siteId: "trang-an",
    cameraName: "CAM 02",
    zone: "Bến thuyền 01",
    note: "Mật độ tăng nhanh trong 8 phút",
    peopleCount: 42,
    cameraStatus: "attention" as const,
  };

  it("rejects an accountant/chief-accountant (no camera-ai role is meant to reach this)", async () => {
    doubles.getCurrentErpUser.mockResolvedValue({
      id: "accountant-001",
      name: "Trần Bích Ngọc",
      role: "accountant" as const,
      siteIds: ["trang-an"] as const,
      moduleIdsBySite: { "trang-an": ["su-co"] as const },
    });
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(result).toEqual({
      success: false,
      message: "Bạn không có quyền tạo hồ sơ sự cố tại cơ sở này.",
    });
    expect(doubles.reportIncidentFromCamera).not.toHaveBeenCalled();
  });

  it("rejects a site outside the actor's access", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessSite.mockReturnValue(false);
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(result.success).toBe(false);
    expect(doubles.reportIncidentFromCamera).not.toHaveBeenCalled();
  });

  it("rejects when the actor lacks module access to Sự cố at the site", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessModule.mockReturnValue(false);
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(result.success).toBe(false);
    expect(doubles.reportIncidentFromCamera).not.toHaveBeenCalled();
  });

  it("rejects an invalid site id before touching the repository", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await reportIncidentFromCameraAction({
      ...cameraInput,
      siteId: "not-a-real-site",
    });
    expect(result).toEqual({ success: false, message: "Cơ sở không hợp lệ." });
    expect(doubles.reportIncidentFromCamera).not.toHaveBeenCalled();
  });

  it("creates the incident and revalidates the module page, with a manager-worded success message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.reportIncidentFromCamera.mockResolvedValue({
      ...acknowledgedIncident,
      id: "INC-TA-CAM20260801120000",
      status: "reported",
    });
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(doubles.reportIncidentFromCamera).toHaveBeenCalledWith({
      siteId: "trang-an",
      actorId: managerUser.id,
      actorName: managerUser.name,
      actorRole: "manager",
      cameraName: "CAM 02",
      zone: "Bến thuyền 01",
      note: "Mật độ tăng nhanh trong 8 phút",
      peopleCount: 42,
      cameraStatus: "attention",
    });
    expect(result).toEqual({
      success: true,
      message:
        "Đã tạo phiếu hiện trường: hồ sơ INC-TA-CAM20260801120000 đã được tạo trong module Sự cố.",
      incident: expect.objectContaining({ id: "INC-TA-CAM20260801120000" }),
    });
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/su-co");
  });

  it("uses a director-worded success message for a director actor", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.reportIncidentFromCamera.mockResolvedValue({
      ...acknowledgedIncident,
      id: "INC-TA-CAM20260801120001",
      status: "reported",
    });
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain("Đã giao quản lý kiểm tra");
    }
  });

  it("surfaces a repository error as a plain failure message, not a thrown error", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.reportIncidentFromCamera.mockRejectedValue(
      new MockIncidentRepositoryError("Kho dữ liệu sự cố chưa hoàn tất bước tạo hồ sơ sự cố từ camera."),
    );
    const result = await reportIncidentFromCameraAction(cameraInput);
    expect(result).toEqual({
      success: false,
      message: "Kho dữ liệu sự cố chưa hoàn tất bước tạo hồ sơ sự cố từ camera.",
    });
  });
});
