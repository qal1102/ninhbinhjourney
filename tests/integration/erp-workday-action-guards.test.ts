import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createWorkdayAssignment,
  transitionWorkday,
  type WorkdayActor,
  type WorkdayEvidence,
  type WorkdayRecord,
} from "@/domain/erp-workday";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  createWorkday: vi.fn(),
  findDemoErpAccountById: vi.fn(),
  getAccessState: vi.fn(),
  getCurrentErpUser: vi.fn(),
  getEmployeeAssignableModuleIds: vi.fn(),
  getWorkday: vi.fn(),
  isDemoErpAccountActive: vi.fn(),
  recordWorkdayLocation: vi.fn(),
  removeWorkdayEvidence: vi.fn(),
  revalidatePath: vi.fn(),
  saveWorkdayTransition: vi.fn(),
  uploadWorkdayEvidence: vi.fn(),
  verifyWorkdayLocation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-data", () => ({
  findDemoErpAccountById: doubles.findDemoErpAccountById,
  getEmployeeAssignableModuleIds: doubles.getEmployeeAssignableModuleIds,
  isDemoErpAccountActive: doubles.isDemoErpAccountActive,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getAccessState: doubles.getAccessState,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/workday-repository", () => ({
  createWorkday: doubles.createWorkday,
  getWorkday: doubles.getWorkday,
  recordWorkdayLocation: doubles.recordWorkdayLocation,
  removeWorkdayEvidence: doubles.removeWorkdayEvidence,
  saveWorkdayTransition: doubles.saveWorkdayTransition,
  uploadWorkdayEvidence: doubles.uploadWorkdayEvidence,
  verifyWorkdayLocation: doubles.verifyWorkdayLocation,
  WorkdayRepositoryConflictError: class extends Error {},
  WorkdayRepositoryError: class extends Error {},
}));

import {
  assignWorkdayAction,
  checkInWorkdayAction,
  reviewWorkdayAction,
  submitWorkdayAction,
  updateWorkdayProgressAction,
} from "@/app/erp/workday-actions";

const manager: WorkdayActor = {
  id: "manager-trang-an",
  name: "Lê Hoàng Nam",
  role: "manager",
};

const employee: WorkdayActor = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee",
};

const employeeAccount = {
  ...employee,
  username: "nv.trangan",
  jobTitle: "Nhân viên đón khách",
  password: "test-only",
  initialSiteIds: ["trang-an"] as const,
  managedSiteIds: [] as const,
  initialModuleIds: ["check-in-khach"] as const,
  workforceProfile: {
    employmentType: "permanent" as const,
    accessStartsAt: "2024-01-01T00:00:00+07:00",
    accessEndsAt: null,
    supervisorId: manager.id,
    primaryStation: "Cổng A",
    shiftLabel: "07:30–12:15",
    trainedModuleIds: ["check-in-khach"] as const,
  },
};

const employeeUser = {
  ...employeeAccount,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {
    "trang-an": ["check-in-khach"] as const,
  },
};

const managerUser = {
  ...manager,
  username: "ql.trangan",
  jobTitle: "Quản lý Tràng An",
  initialSiteIds: ["trang-an"] as const,
  managedSiteIds: ["trang-an"] as const,
  initialModuleIds: [] as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {
    "trang-an": ["check-in-khach"] as const,
  },
};

const photo: WorkdayEvidence = {
  id: "photo-action-guard",
  kind: "photo",
  fileName: "cong-a.jpg",
  storagePath:
    "trang-an/employee-trang-an-01/workday-action-guard/photo-action-guard.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 12,
  sha256: "a".repeat(64),
  uploadedAt: "2026-07-29T03:00:00.000Z",
  uploadedBy: employee.id,
  capturedAt: "2026-07-29T03:00:00.000Z",
  latitude: 20.25245,
  longitude: 105.91755,
  accuracy: 12,
  distanceMeters: 0,
  siteVerified: true,
};

function assignedRecord(businessDate = "2026-07-29") {
  return createWorkdayAssignment({
    id: `workday-action-guard-${businessDate}`,
    code: `WD-TA-${businessDate.replaceAll("-", "")}`,
    siteId: "trang-an",
    businessDate,
    employee,
    manager,
    moduleId: "check-in-khach",
    station: "Cổng A",
    shiftLabel: "07:30–12:15",
    taskTitle: "Xác thực đoàn tại cổng",
    instructions: "Kiểm tra mã đoàn và số khách trước khi qua cổng.",
    priority: "high",
    dueAt: `${businessDate}T11:00:00.000Z`,
    evidenceRequired: true,
    idempotencyKey: `assign-action-guard-${businessDate}`,
    createdAt: `${businessDate}T00:15:00.000Z`,
    auditEventId: `audit-assign-${businessDate}`,
  });
}

function checkedInRecord() {
  return transitionWorkday(assignedRecord(), {
    type: "employee.check-in",
    actor: employee,
    latitude: 20.25245,
    longitude: 105.91755,
    accuracy: 12,
    at: "2026-07-29T00:30:00.000Z",
    auditEventId: "audit-check-in-action-guard",
  });
}

function submittedRecord(): WorkdayRecord {
  return transitionWorkday(checkedInRecord(), {
    type: "employee.submit",
    actor: employee,
    note: "Đã hoàn tất xác thực đoàn tại cổng.",
    evidence: photo,
    at: "2026-07-29T02:30:00.000Z",
    auditEventId: "audit-submit-action-guard",
  });
}

function assignmentForm() {
  const formData = new FormData();
  formData.set("siteId", "trang-an");
  formData.set("employeeId", employee.id);
  formData.set("templateId", "ta-gate-group-checkin");
  formData.set("priority", "normal");
  formData.set("dueTime", "18:00");
  return formData;
}

function evidenceForm(workday: WorkdayRecord) {
  const formData = new FormData();
  formData.set("workdayId", workday.id);
  formData.set("expectedVersion", String(workday.version));
  formData.set("idempotencyKey", "evidence-action-guard");
  formData.set("note", "Đã hoàn tất công việc được giao.");
  formData.set(
    "evidence",
    new File([new Uint8Array([1, 2, 3])], "cong-a.jpg", {
      type: "image/jpeg",
    }),
  );
  formData.set("capturedAt", "2026-07-29T03:00:00.000Z");
  formData.set("latitude", "20.25245");
  formData.set("longitude", "105.91755");
  formData.set("accuracy", "12");
  return formData;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-29T03:00:00.000Z"));
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.findDemoErpAccountById.mockReturnValue(employeeAccount);
  doubles.getAccessState.mockResolvedValue({
    version: 1,
    employees: {
      [employee.id]: {
        siteIds: ["trang-an"],
        moduleIdsBySite: {
          "trang-an": ["check-in-khach"],
        },
      },
    },
    audit: [],
  });
  doubles.getCurrentErpUser.mockResolvedValue(employeeUser);
  doubles.getEmployeeAssignableModuleIds.mockReturnValue([
    "check-in-khach",
  ]);
  doubles.getWorkday.mockResolvedValue(assignedRecord());
  doubles.isDemoErpAccountActive.mockReturnValue(true);
  doubles.removeWorkdayEvidence.mockResolvedValue(undefined);
  doubles.saveWorkdayTransition.mockImplementation(
    async (_current, next) => next,
  );
  doubles.uploadWorkdayEvidence.mockResolvedValue(photo);
  doubles.verifyWorkdayLocation.mockReturnValue({
    distanceMeters: 0,
    insideGeofence: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ERP workday server-action guards", () => {
  it("blocks an employee action against an old business date", async () => {
    doubles.getWorkday.mockResolvedValue(assignedRecord("2026-07-28"));

    const result = await checkInWorkdayAction({
      workdayId: "workday-action-guard-2026-07-28",
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      idempotencyKey: "old-workday-check-in",
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/ngày làm việc hiện tại/);
    expect(doubles.verifyWorkdayLocation).not.toHaveBeenCalled();
    expect(doubles.saveWorkdayTransition).not.toHaveBeenCalled();
  });

  it("rejects assignment to an employee whose employment is inactive", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.isDemoErpAccountActive.mockReturnValue(false);

    const result = await assignWorkdayAction(assignmentForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/nhân viên.*không hợp lệ/i);
    expect(doubles.getAccessState).not.toHaveBeenCalled();
    expect(doubles.createWorkday).not.toHaveBeenCalled();
  });

  it("rejects assignment after the employee's site access is revoked", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.getAccessState.mockResolvedValue({
      version: 1,
      employees: {
        [employee.id]: {
          siteIds: [],
          moduleIdsBySite: {},
        },
      },
      audit: [],
    });

    const result = await assignWorkdayAction(assignmentForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/chưa được cấp đúng cơ sở/);
    expect(doubles.createWorkday).not.toHaveBeenCalled();
  });

  it("fails closed for an invalid manager decision", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.getWorkday.mockResolvedValue(submittedRecord());
    const formData = new FormData();
    formData.set("workdayId", submittedRecord().id);
    formData.set("expectedVersion", String(submittedRecord().version));
    formData.set("decision", "reject");
    formData.set("note", "Từ chối không thuộc workflow.");

    const result = await reviewWorkdayAction(formData);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/chọn xác nhận hoàn thành/);
    expect(doubles.saveWorkdayTransition).not.toHaveBeenCalled();
  });

  it("keeps uploaded evidence when transition outcome is ambiguous", async () => {
    const workday = checkedInRecord();
    doubles.getWorkday.mockResolvedValue(workday);
    doubles.saveWorkdayTransition.mockRejectedValue(
      new Error("simulated ambiguous transition response"),
    );

    const result = await submitWorkdayAction(evidenceForm(workday));

    expect(result.success).toBe(false);
    expect(doubles.uploadWorkdayEvidence).toHaveBeenCalledOnce();
    expect(doubles.saveWorkdayTransition).toHaveBeenCalledOnce();
    expect(doubles.removeWorkdayEvidence).not.toHaveBeenCalled();
  });

  it("removes an uploaded object when validation fails before transition", async () => {
    const workday = checkedInRecord();
    doubles.getWorkday.mockResolvedValue(workday);
    const formData = evidenceForm(workday);
    formData.set("progressPercent", "0");

    const result = await updateWorkdayProgressAction(formData);

    expect(result.success).toBe(false);
    expect(doubles.uploadWorkdayEvidence).toHaveBeenCalledOnce();
    expect(doubles.saveWorkdayTransition).not.toHaveBeenCalled();
    expect(doubles.removeWorkdayEvidence).toHaveBeenCalledWith(
      photo.storagePath,
    );
  });
});
