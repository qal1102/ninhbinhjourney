import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentErpUser, ErpAccessState } from "@/lib/erp/demo-session";

const repository = vi.hoisted(() => ({
  listWorkdays: vi.fn(),
  vietnamDateKey: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/erp/workday-repository", () => ({
  listWorkdays: repository.listWorkdays,
  vietnamDateKey: repository.vietnamDateKey,
}));

import {
  listWorkdayEmployeeOptions,
  listWorkdaysForUser,
} from "@/lib/erp/workday-view";
import { seasonalAccessWindow } from "@/lib/erp/demo-data";

const employeeUser: CurrentErpUser = {
  id: "employee-trang-an-01",
  username: "nv.trangan",
  name: "Đỗ Thị Lan",
  role: "employee",
  jobTitle: "Nhân viên đón khách",
  initialSiteIds: ["trang-an"],
  managedSiteIds: [],
  initialModuleIds: ["check-in-khach"],
  workforceProfile: {
    employmentType: "permanent",
    accessStartsAt: "2024-01-01T00:00:00+07:00",
    accessEndsAt: null,
    supervisorId: "manager-trang-an",
    primaryStation: "Cổng A",
    shiftLabel: "07:30–12:15",
    trainedModuleIds: ["check-in-khach"],
  },
  siteIds: ["trang-an"],
  moduleIdsBySite: {
    "trang-an": ["check-in-khach"],
  },
};

beforeEach(() => {
  repository.listWorkdays.mockReset();
  repository.vietnamDateKey.mockReset();
  repository.listWorkdays.mockResolvedValue([]);
  repository.vietnamDateKey.mockReturnValue("2026-07-29");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ERP workday scoped views", () => {
  it("queries only today's records inside the employee's permitted sites", async () => {
    await listWorkdaysForUser(employeeUser, ["trang-an", "tam-chuc"]);

    expect(repository.listWorkdays).toHaveBeenCalledWith({
      siteIds: ["trang-an"],
      businessDate: "2026-07-29",
      employeeAccountId: employeeUser.id,
      limit: 20,
    });
  });

  it("omits employees whose employment expired or whose site access was revoked", () => {
    vi.useFakeTimers();
    // Một ngày sau khi cửa sổ quyền mùa vụ khép lại — tính từ chính cửa sổ đó,
    // không chép cứng ngày. Trước đây dòng này là "2026-09-01", đúng hôm hợp
    // đồng mùa vụ hết hạn theo mốc seed; cửa sổ nay tự trượt nên một ngày cố
    // định sẽ rơi vào trong cửa sổ và bài mất hẳn ý nghĩa (ERP-SMOKE-02).
    vi.setSystemTime(
      new Date(Date.parse(seasonalAccessWindow().accessEndsAt) + 24 * 60 * 60 * 1000),
    );
    const access: ErpAccessState = {
      version: 1,
      employees: {
        "employee-trang-an-01": {
          siteIds: [],
          moduleIdsBySite: {},
        },
        "employee-trang-an-02": {
          siteIds: ["trang-an"],
          moduleIdsBySite: {
            "trang-an": ["suc-chua"],
          },
        },
        "employee-trang-an-seasonal-01": {
          siteIds: ["trang-an"],
          moduleIdsBySite: {
            "trang-an": ["check-in-khach"],
          },
        },
      },
      audit: [],
    };

    const options = listWorkdayEmployeeOptions(access, ["trang-an"]);

    expect(options.map((employee) => employee.id)).toEqual([
      "employee-trang-an-02",
    ]);
  });
});
