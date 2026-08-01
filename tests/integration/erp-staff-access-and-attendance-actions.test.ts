import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  findDemoErpAccountById: vi.fn(),
  getAccessState: vi.fn(),
  getCurrentErpUser: vi.fn(),
  getGrantableModuleIds: vi.fn(),
  isDemoErpAccountActive: vi.fn(),
  recordAttendanceEvent: vi.fn(),
  revalidatePath: vi.fn(),
  updateEmployeeAccessGrant: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-data", () => ({
  findDemoErpAccountById: doubles.findDemoErpAccountById,
  findDemoErpAccountByUsername: vi.fn(),
  getGrantableModuleIds: doubles.getGrantableModuleIds,
  isDemoErpAccountActive: doubles.isDemoErpAccountActive,
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
  getAccessState: doubles.getAccessState,
  updateEmployeeAccessGrant: doubles.updateEmployeeAccessGrant,
}));

const { MockAttendanceRepositoryConflictError } = vi.hoisted(() => ({
  MockAttendanceRepositoryConflictError: class extends Error {},
}));

vi.mock("@/lib/erp/attendance-repository", () => ({
  AttendanceRepositoryConflictError: MockAttendanceRepositoryConflictError,
  recordAttendanceEvent: doubles.recordAttendanceEvent,
}));

const { MockIncidentRepositoryConflictError } = vi.hoisted(() => ({
  MockIncidentRepositoryConflictError: class extends Error {},
}));

vi.mock("@/lib/erp/incident-repository", () => ({
  IncidentRepositoryConflictError: MockIncidentRepositoryConflictError,
  IncidentRepositoryError: MockIncidentRepositoryConflictError,
  progressIncidentByEmployee: vi.fn(),
  reportIncidentFromCamera: vi.fn(),
  transitionIncidentByManager: vi.fn(),
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
  recordAttendanceAction,
  updateEmployeeAccessAction,
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

const employeeAccount = {
  id: "employee-trang-an-01",
  role: "employee" as const,
};

const managerAccount = {
  id: "manager-trang-an",
  role: "manager" as const,
  managedSiteIds: ["trang-an"] as const,
};

const employeeUser = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: { "trang-an": ["cham-cong"] as const },
};

function accessForm(overrides: Partial<{
  siteId: string;
  employeeId: string;
  siteActive: boolean;
  moduleIds: string[];
}> = {}) {
  const formData = new FormData();
  formData.set("siteId", overrides.siteId ?? "trang-an");
  formData.set("employeeId", overrides.employeeId ?? employeeAccount.id);
  if (overrides.siteActive ?? true) formData.set("siteActive", "on");
  for (const moduleId of overrides.moduleIds ?? ["check-in-khach", "nhan-su"]) {
    formData.append("moduleIds", moduleId);
  }
  return formData;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.findDemoErpAccountById.mockReturnValue(employeeAccount);
  doubles.getGrantableModuleIds.mockReturnValue([
    "check-in-khach",
    "cham-cong",
  ]);
  doubles.getAccessState.mockResolvedValue({
    version: 1,
    employees: {},
    audit: [],
  });
  doubles.updateEmployeeAccessGrant.mockResolvedValue({
    employeeAccess: { siteIds: ["trang-an"], moduleIdsBySite: {} },
    auditEvent: {
      id: "audit-1",
      actorId: managerUser.id,
      action: "employee.access.updated",
      targetId: employeeAccount.id,
      siteId: "trang-an",
      createdAt: "2026-07-31T00:00:00.000Z",
    },
  });
});

describe("updateEmployeeAccessAction", () => {
  it("rejects actors who are not manager or director", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    await expect(updateEmployeeAccessAction(accessForm())).rejects.toThrow(
      /không có quyền/i,
    );
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("rejects a site outside the actor's managed scope", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.accountCanAccessSite.mockReturnValue(false);
    await expect(updateEmployeeAccessAction(accessForm())).rejects.toThrow(
      /ngoài phạm vi/i,
    );
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("rejects reassigning an employee already assigned to another site when the actor is a manager", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.getAccessState.mockResolvedValue({
      version: 1,
      employees: {
        [employeeAccount.id]: {
          siteIds: ["tam-chuc"],
          moduleIdsBySite: { "tam-chuc": ["check-in-khach"] },
        },
      },
      audit: [],
    });
    await expect(updateEmployeeAccessAction(accessForm())).rejects.toThrow(
      /cơ sở khác/i,
    );
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("allows a director to override an employee already assigned to another site", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.getAccessState.mockResolvedValue({
      version: 1,
      employees: {
        [employeeAccount.id]: {
          siteIds: ["tam-chuc"],
          moduleIdsBySite: { "tam-chuc": ["check-in-khach"] },
        },
      },
      audit: [],
    });
    await updateEmployeeAccessAction(accessForm({ siteId: "trang-an" }));
    expect(doubles.updateEmployeeAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: employeeAccount.id,
        siteContextId: "trang-an",
        siteActive: true,
        actorId: directorUser.id,
        actorRole: "director",
      }),
    );
  });

  it("only forwards trained, employee-assignable modules and drops the rest", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    // "nhan-su" is not employeeAssignable and is not a trained module here,
    // so it must be dropped even though the form submitted it.
    await updateEmployeeAccessAction(
      accessForm({ moduleIds: ["check-in-khach", "nhan-su", "cham-cong"] }),
    );
    const call = doubles.updateEmployeeAccessGrant.mock.calls[0][0];
    expect(call.moduleIds.sort()).toEqual(["check-in-khach", "cham-cong"].sort());
    expect(call.moduleIds).not.toContain("nhan-su");
  });

  it("revokes the site by passing siteActive=false and an empty module list", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    await updateEmployeeAccessAction(accessForm({ siteActive: false }));
    expect(doubles.updateEmployeeAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({ siteActive: false, siteContextId: "trang-an" }),
    );
  });

  // --- V14: managers are permissioned through this same grant --------------

  it("lets a director set a site manager's module grant", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.findDemoErpAccountById.mockReturnValue(managerAccount);
    doubles.getGrantableModuleIds.mockReturnValue(["nhan-su", "su-co", "bao-cao"]);
    await updateEmployeeAccessAction(
      accessForm({
        employeeId: managerAccount.id,
        moduleIds: ["nhan-su", "su-co"],
      }),
    );
    const call = doubles.updateEmployeeAccessGrant.mock.calls[0][0];
    expect(call.employeeId).toBe(managerAccount.id);
    expect(call.actorRole).toBe("director");
    // "nhan-su" is not employeeAssignable, but a manager may absolutely hold
    // it -- the employee-only floor must not apply here.
    expect(call.moduleIds.sort()).toEqual(["nhan-su", "su-co"].sort());
  });

  it("blocks a manager from editing any manager's grant, including their own", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.findDemoErpAccountById.mockReturnValue(managerAccount);
    await expect(
      updateEmployeeAccessAction(accessForm({ employeeId: managerAccount.id })),
    ).rejects.toThrow(/chỉ giám đốc/i);
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("blocks granting a manager modules on a site they do not manage", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.findDemoErpAccountById.mockReturnValue(managerAccount);
    await expect(
      updateEmployeeAccessAction(
        accessForm({ employeeId: managerAccount.id, siteId: "tam-chuc" }),
      ),
    ).rejects.toThrow(/không phụ trách/i);
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("rejects an account that is neither employee nor manager", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.findDemoErpAccountById.mockReturnValue({
      id: "accountant-001",
      role: "accountant" as const,
    });
    await expect(
      updateEmployeeAccessAction(accessForm({ employeeId: "accountant-001" })),
    ).rejects.toThrow(/không tìm thấy/i);
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });
});

describe("recordAttendanceAction", () => {
  const gpsInput = {
    siteId: "trang-an",
    type: "check-in" as const,
    latitude: 20.25245,
    longitude: 105.91755,
    accuracy: 12,
  };

  it("fails closed when there is no active session", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(null);
    const result = await recordAttendanceAction(gpsInput);
    expect(result.success).toBe(false);
    expect(doubles.recordAttendanceEvent).not.toHaveBeenCalled();
  });

  it("rejects when the device is outside the site geofence", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    const result = await recordAttendanceAction({
      ...gpsInput,
      latitude: 21.5,
      longitude: 106.5,
    });
    expect(result.success).toBe(false);
    expect(doubles.recordAttendanceEvent).not.toHaveBeenCalled();
  });

  it("records a real check-in through the repository on the happy path", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.recordAttendanceEvent.mockResolvedValue({
      id: "evt-1",
      userId: employeeUser.id,
      siteId: "trang-an",
      type: "check-in",
      createdAt: "2026-07-31T00:00:00.000Z",
      latitude: gpsInput.latitude,
      longitude: gpsInput.longitude,
      accuracy: gpsInput.accuracy,
      source: "gps",
    });
    const result = await recordAttendanceAction(gpsInput);
    expect(result.success).toBe(true);
    expect(doubles.recordAttendanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: employeeUser.id,
        siteId: "trang-an",
        type: "check-in",
      }),
    );
  });

  it("surfaces a repository conflict (e.g. already checked in) as a failed result, not a thrown error", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
    doubles.recordAttendanceEvent.mockRejectedValue(
      new MockAttendanceRepositoryConflictError("Bạn đã vào ca; hãy chấm ra trước."),
    );
    const result = await recordAttendanceAction(gpsInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/đã vào ca/i);
    }
  });
});
