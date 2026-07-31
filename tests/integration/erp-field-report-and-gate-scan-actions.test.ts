import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  getCurrentErpUser: vi.fn(),
  recordGateScan: vi.fn(),
  revalidatePath: vi.fn(),
  submitFieldReport: vi.fn(),
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
  getCurrentErpUser: doubles.getCurrentErpUser,
  setErpSession: vi.fn(),
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

vi.mock("@/lib/erp/incident-repository", () => ({
  IncidentRepositoryConflictError: MockIncidentRepositoryConflictError,
  progressIncidentByEmployee: vi.fn(),
  transitionIncidentByManager: vi.fn(),
}));

const { MockFieldReportRepositoryError } = vi.hoisted(() => ({
  MockFieldReportRepositoryError: class extends Error {},
}));

vi.mock("@/lib/erp/field-report-repository", () => ({
  FieldReportRepositoryError: MockFieldReportRepositoryError,
  submitFieldReport: doubles.submitFieldReport,
}));

const { MockGateScanRepositoryError } = vi.hoisted(() => ({
  MockGateScanRepositoryError: class extends Error {},
}));

vi.mock("@/lib/erp/gate-scan-repository", () => ({
  GateScanRepositoryError: MockGateScanRepositoryError,
  recordGateScan: doubles.recordGateScan,
}));

import {
  recordGateScanAction,
  submitFieldReportAction,
} from "@/app/erp/actions";

const employeeUser = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {
    "trang-an": ["bao-cao-hien-truong", "check-in-khach"] as const,
  },
};

const accountantUser = {
  id: "accountant-01",
  name: "Kế toán viên",
  role: "accountant" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: { "trang-an": ["bao-cao-hien-truong"] as const },
};

function reportForm(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData();
  formData.set("siteId", overrides.siteId ?? "trang-an");
  formData.set("area", overrides.area ?? "Cổng bán vé A");
  formData.set("category", overrides.category ?? "Đầu ca");
  formData.set("task", overrides.task ?? "Kiểm tra máy quét");
  formData.set("note", overrides.note ?? "Đã kiểm tra xong.");
  formData.set("financeCode", overrides.financeCode ?? "OPS-GATE-A");
  formData.set("progress", overrides.progress ?? "100");
  if (overrides.skipFile !== "true") {
    formData.set("evidence", new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));
  }
  return formData;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.accountCanAccessModule.mockReturnValue(true);
});

describe("submitFieldReportAction", () => {
  it("rejects a role without field.report.submit capability", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(accountantUser);
    const result = await submitFieldReportAction(reportForm());
    expect(result).toEqual({
      success: false,
      message: "Bạn không có quyền gửi báo cáo tại cơ sở này.",
    });
    expect(doubles.submitFieldReport).not.toHaveBeenCalled();
  });

  it("rejects a site outside the actor's scope", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.accountCanAccessSite.mockReturnValue(false);
    const result = await submitFieldReportAction(reportForm());
    expect(result.success).toBe(false);
    expect(doubles.submitFieldReport).not.toHaveBeenCalled();
  });

  it("rejects when no photo is attached", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    const result = await submitFieldReportAction(reportForm({ skipFile: "true" }));
    expect(result).toEqual({
      success: false,
      message: "Vui lòng chọn ảnh hiện trường.",
    });
    expect(doubles.submitFieldReport).not.toHaveBeenCalled();
  });

  it("rejects an invalid progress value", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    const result = await submitFieldReportAction(reportForm({ progress: "60" }));
    expect(result).toEqual({ success: false, message: "Tiến độ không hợp lệ." });
    expect(doubles.submitFieldReport).not.toHaveBeenCalled();
  });

  it("submits the report and revalidates the module page on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.submitFieldReport.mockResolvedValue({
      id: "IMG-0852",
      siteId: "trang-an",
      area: "Cổng bán vé A",
      category: "Đầu ca",
      task: "Kiểm tra máy quét",
      employeeName: employeeUser.name,
      progress: 100,
      status: "Chờ quản lý xác nhận",
      note: "Đã kiểm tra xong.",
      financeCode: "OPS-GATE-A",
      imageUrl: "https://signed.example/photo.jpg",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const result = await submitFieldReportAction(reportForm());
    expect(doubles.submitFieldReport).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "trang-an",
        employeeAccountId: employeeUser.id,
        employeeName: employeeUser.name,
        progress: 100,
      }),
    );
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/bao-cao-hien-truong");
  });

  it("surfaces a repository error as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.submitFieldReport.mockRejectedValue(
      new MockFieldReportRepositoryError("Ảnh phải là JPEG, PNG, WebP hoặc HEIC và không vượt quá 5 MB."),
    );
    const result = await submitFieldReportAction(reportForm());
    expect(result).toEqual({
      success: false,
      message: "Ảnh phải là JPEG, PNG, WebP hoặc HEIC và không vượt quá 5 MB.",
    });
  });
});

describe("recordGateScanAction", () => {
  it("rejects when the actor lacks check-in-khach module access", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.accountCanAccessModule.mockReturnValue(false);
    const result = await recordGateScanAction({ siteId: "trang-an", code: "QR-NB-82431" });
    expect(result.success).toBe(false);
    expect(doubles.recordGateScan).not.toHaveBeenCalled();
  });

  it("rejects a code shorter than 6 characters before touching the repository", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    const result = await recordGateScanAction({ siteId: "trang-an", code: "AB1" });
    expect(result).toEqual({ success: false, message: "Mã QR không hợp lệ." });
    expect(doubles.recordGateScan).not.toHaveBeenCalled();
  });

  it("records the scan and revalidates the module page on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.recordGateScan.mockResolvedValue({
      id: "scan-1",
      siteId: "trang-an",
      code: "QR-NB-82431",
      scannedByName: employeeUser.name,
      scannedAt: "2026-08-01T00:00:00.000Z",
    });
    const result = await recordGateScanAction({ siteId: "trang-an", code: "qr-nb-82431" });
    expect(doubles.recordGateScan).toHaveBeenCalledWith({
      siteId: "trang-an",
      code: "QR-NB-82431",
      actorId: employeeUser.id,
      actorName: employeeUser.name,
    });
    expect(result.success).toBe(true);
    expect(doubles.revalidatePath).toHaveBeenCalledWith("/erp/trang-an/check-in-khach");
  });

  it("surfaces a repository error as a plain failure message", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.recordGateScan.mockRejectedValue(new MockGateScanRepositoryError("Mã QR không hợp lệ."));
    const result = await recordGateScanAction({ siteId: "trang-an", code: "QR-NB-82431" });
    expect(result).toEqual({ success: false, message: "Mã QR không hợp lệ." });
  });
});
