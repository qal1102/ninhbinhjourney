import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkdayAssignment } from "@/domain/erp-workday";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  getCurrentErpUser: vi.fn(),
  getWorkday: vi.fn(),
  recordWorkdayLocation: vi.fn(),
  revalidatePath: vi.fn(),
  saveWorkdayTransition: vi.fn(),
  verifyWorkdayLocation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getAccessState: vi.fn(),
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/workday-repository", () => ({
  createWorkday: vi.fn(),
  getWorkday: doubles.getWorkday,
  recordWorkdayLocation: doubles.recordWorkdayLocation,
  removeWorkdayEvidence: vi.fn(),
  saveWorkdayTransition: doubles.saveWorkdayTransition,
  uploadWorkdayEvidence: vi.fn(),
  verifyWorkdayLocation: doubles.verifyWorkdayLocation,
  WorkdayRepositoryConflictError: class extends Error {},
  WorkdayRepositoryError: class extends Error {},
}));

import { checkInWorkdayAction } from "@/app/erp/workday-actions";

function assignedRecord() {
  return createWorkdayAssignment({
    id: "workday-checkin-fallback",
    code: "WD-TA-20260729-FALLBACK",
    siteId: "trang-an",
    businessDate: "2026-07-29",
    employee: {
      id: "employee-trang-an-01",
      name: "Đỗ Thị Lan",
      role: "employee",
    },
    manager: {
      id: "manager-trang-an",
      name: "Lê Hoàng Nam",
      role: "manager",
    },
    moduleId: "check-in-khach",
    station: "Cổng A",
    shiftLabel: "07:30–12:15",
    taskTitle: "Xác thực đoàn TA-018",
    instructions: "Kiểm tra quyền lợi trước khi cho đoàn qua cổng.",
    priority: "high",
    dueAt: "2026-07-29T10:30:00.000Z",
    evidenceRequired: true,
    idempotencyKey: "assign-workday-fallback",
    createdAt: "2026-07-29T00:15:00.000Z",
    auditEventId: "audit-assign-fallback",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.getCurrentErpUser.mockResolvedValue({
    id: "employee-trang-an-01",
    name: "Đỗ Thị Lan",
    role: "employee",
    siteIds: ["trang-an"],
    managedSiteIds: [],
  });
  doubles.getWorkday.mockResolvedValue(assignedRecord());
  doubles.verifyWorkdayLocation.mockReturnValue({
    distanceMeters: 7,
    insideGeofence: true,
  });
  doubles.saveWorkdayTransition.mockImplementation(
    async (_current, next) => next,
  );
});

describe("ERP workday check-in fallback", () => {
  it("keeps a committed check-in successful when the secondary location event fails", async () => {
    doubles.recordWorkdayLocation.mockRejectedValue(
      new Error("simulated location-event outage"),
    );

    const result = await checkInWorkdayAction({
      workdayId: "workday-checkin-fallback",
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      idempotencyKey: "checkin-fallback-test",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.record).toMatchObject({
      status: "checked-in",
      checkInLocation: {
        latitude: 20.25245,
        longitude: 105.91755,
        accuracy: 12,
      },
      latestLocation: {
        workdayId: "workday-checkin-fallback",
        employeeAccountId: "employee-trang-an-01",
        latitude: 20.25245,
        longitude: 105.91755,
        accuracy: 12,
        distanceMeters: 7,
        insideGeofence: true,
      },
    });
    expect(result.message).toContain("Đã vào ca và lưu vị trí check-in");
    expect(doubles.saveWorkdayTransition).toHaveBeenCalledOnce();
    expect(doubles.recordWorkdayLocation).toHaveBeenCalledOnce();
    expect(doubles.revalidatePath).toHaveBeenCalled();
  });
});
