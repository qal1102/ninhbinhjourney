import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  docTaiKhoanHieuLuc: vi.fn(),
  getAccessState: vi.fn(),
  getCurrentErpUser: vi.fn(),
  isDemoErpAccountActive: vi.fn(),
  recordAttendanceEvent: vi.fn(),
  revalidatePath: vi.fn(),
  updateEmployeeAccessGrant: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-data", () => ({
  findDemoErpAccountByUsername: vi.fn(),
  isDemoErpAccountActive: doubles.isDemoErpAccountActive,
}));

// Người được giao việc đọc từ sổ tài khoản từ 28/09/2026.
vi.mock("@/lib/erp/tai-khoan-hieu-luc", () => ({
  docTaiKhoanHieuLuc: doubles.docTaiKhoanHieuLuc,
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

// TC-18: kho đoàn quầy phải được giả lập như mọi kho khác. Nó mở đầu bằng
// `import "server-only"`, đúng nếp chung của các kho trong dự án — mà gói ấy
// không tồn tại ngoài Next, nên để nó nạp thật là cả TỆP kiểm gãy từ lúc nạp,
// chưa chạy nổi một bài nào.
vi.mock("@/lib/erp/visitor-group-counter-repository", () => ({
  createCounterVisitorGroup: vi.fn(),
  // Lớp lỗi phải là lớp thật: `actions.ts` phân biệt lỗi bằng `instanceof`.
  CounterVisitorGroupRepositoryError: class extends Error {},
}));

// QA-ERP-POS-04/05: kho bán vé quầy cũng mở đầu bằng `import "server-only"`,
// nên phải giả lập cùng lý do như kho đoàn quầy ở trên.
vi.mock("@/lib/erp/counter-sale-repository", () => ({
  createCounterSale: vi.fn(),
  voidCounterSale: vi.fn(),
  setCounterPrice: vi.fn(),
  CounterSaleRepositoryError: class extends Error {},
}));

// TC-12: kho kiểm duyệt đánh giá cũng mở đầu bằng `import "server-only"`, nên
// phải giả lập cùng lý do như các kho ở trên.
vi.mock("@/lib/erp/visit-review-moderation-repository", () => ({
  hideVisitReview: vi.fn(),
  unhideVisitReview: vi.fn(),
  hideQuotaUsed: vi.fn(),
}));

// QA-P2-09: bộ đếm đăng nhập sai đọc `next/headers` và mở đầu bằng
// `import "server-only"`, nên cũng phải giả lập như các kho khác.
vi.mock("@/lib/erp/login-throttle", () => ({
  checkLoginThrottle: vi.fn(async () => ({ allowed: true })),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
}));

vi.mock("@/lib/erp/account-registry-repository", () => ({
  confirmPasswordChanged: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
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

/** Một tài khoản như `docTaiKhoanHieuLuc` trả về: vai và cơ sở theo sổ tài khoản. */
function taiKhoan(overrides: Partial<{
  id: string;
  role: "employee" | "manager" | "accountant";
  coSo: (string | null)[];
  daoTao: string[];
}> = {}) {
  return {
    id: overrides.id ?? employeeAccount.id,
    name: "Người thử",
    jobTitle: "Nhân viên",
    role: overrides.role ?? "employee",
    conHieuLuc: true,
    quyen: { siteIds: [], moduleIdsBySite: {} },
    viecDaDaoTao: overrides.daoTao ?? ["check-in-khach", "cham-cong"],
    registry: {
      grants: (overrides.coSo ?? ["trang-an"]).map((siteId) => ({ role: "employee", siteId })),
    },
  };
}

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
  doubles.docTaiKhoanHieuLuc.mockResolvedValue(taiKhoan());
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

  it("người chưa được giám đốc cấp cơ sở này thì chưa giao việc được", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.docTaiKhoanHieuLuc.mockResolvedValue(taiKhoan({ coSo: ["tam-chuc"] }));
    await expect(updateEmployeeAccessAction(accessForm())).rejects.toThrow(
      /chưa được cấp cơ sở này/i,
    );
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("người giám đốc vừa tạo (không có hồ sơ mẫu) vẫn nhận việc được", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    doubles.docTaiKhoanHieuLuc.mockResolvedValue(
      taiKhoan({ id: "nguyen-van-ba", daoTao: ["check-in-khach", "ve-dat-cho", "cham-cong"] }),
    );
    await updateEmployeeAccessAction(
      accessForm({ employeeId: "nguyen-van-ba", moduleIds: ["ve-dat-cho", "cham-cong"] }),
    );
    expect(doubles.updateEmployeeAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "nguyen-van-ba",
        siteContextId: "trang-an",
        siteActive: true,
        actorRole: "manager",
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

  it("không còn gỡ người khỏi cơ sở ở đây: ai thuộc cơ sở nào do màn Tài khoản & phân quyền quyết", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    await updateEmployeeAccessAction(accessForm({ siteActive: false }));
    expect(doubles.updateEmployeeAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({ siteActive: true, siteContextId: "trang-an" }),
    );
  });

  it("quản lý cơ sở không giao việc từng module: họ có mọi việc ở cơ sở mình", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.docTaiKhoanHieuLuc.mockResolvedValue(taiKhoan({ id: "manager-trang-an", role: "manager" }));
    await expect(
      updateEmployeeAccessAction(accessForm({ employeeId: "manager-trang-an" })),
    ).rejects.toThrow(/Quản lý cơ sở có mọi việc/);
    expect(doubles.updateEmployeeAccessGrant).not.toHaveBeenCalled();
  });

  it("rejects an unknown account and an account that is not an employee", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.docTaiKhoanHieuLuc.mockResolvedValue(null);
    await expect(
      updateEmployeeAccessAction(accessForm({ employeeId: "khong-co" })),
    ).rejects.toThrow(/không tìm thấy/i);
    doubles.docTaiKhoanHieuLuc.mockResolvedValue(taiKhoan({ id: "accountant-001", role: "accountant" }));
    await expect(
      updateEmployeeAccessAction(accessForm({ employeeId: "accountant-001" })),
    ).rejects.toThrow(/chỉ giao việc/i);
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
