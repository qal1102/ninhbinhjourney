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
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/staff-access-repository", () => ({
  getAccessState: vi.fn(),
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

function currentVietnamDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function assignedRecord() {
  const businessDate = currentVietnamDate();
  return createWorkdayAssignment({
    id: "workday-checkin-fallback",
    code: `WD-TA-${businessDate.replaceAll("-", "")}-FALLBACK`,
    siteId: "trang-an",
    businessDate,
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
    dueAt: new Date(`${businessDate}T10:30:00+07:00`).toISOString(),
    evidenceRequired: true,
    idempotencyKey: "assign-workday-fallback",
    createdAt: new Date(`${businessDate}T07:15:00+07:00`).toISOString(),
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
