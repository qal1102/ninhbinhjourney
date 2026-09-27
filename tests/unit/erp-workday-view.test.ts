import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentErpUser, ErpAccessState } from "@/lib/erp/demo-session";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

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

  it("lấy người từ danh bạ theo sổ tài khoản, bỏ người bị thu hồi cơ sở hoặc hết hạn", () => {
    // Cơ sở do sổ tài khoản quyết (`siteIds` của danh bạ), không còn do kho
    // module. Người thời vụ hết hạn hợp đồng thì danh bạ đánh `active: false`.
    const nguoi = (
      accountId: string,
      siteIds: ErpStaffDirectoryEntry["siteIds"],
      active = true,
    ): ErpStaffDirectoryEntry => ({
      accountId,
      displayName: accountId,
      jobTitle: "Nhân viên",
      role: "employee",
      siteIds,
      active,
      grantableModuleIds: [],
      hasTrainingRecord: false,
      hasAuthUser: false,
      email: null,
      username: null,
    });
    const directory = [
      nguoi("employee-trang-an-01", []),
      nguoi("employee-trang-an-02", ["trang-an"]),
      nguoi("employee-trang-an-seasonal-01", ["trang-an"], false),
      nguoi("nguoi-moi-tao", ["trang-an"]),
      nguoi("employee-bai-dinh-01", ["bai-dinh"]),
    ];
    const access: ErpAccessState = {
      version: 1,
      employees: {
        "employee-trang-an-02": { siteIds: ["trang-an"], moduleIdsBySite: { "trang-an": ["suc-chua"] } },
      },
      audit: [],
    };

    const options = listWorkdayEmployeeOptions(access, ["trang-an"], directory);

    expect(options.map((employee) => employee.id)).toEqual(["employee-trang-an-02", "nguoi-moi-tao"]);
    expect(options[0].moduleIdsBySite["trang-an"]).toEqual(["suc-chua"]);
    // Người tạo mới chưa được giao việc riêng thì có bộ cơ bản, không trống trơn.
    expect(options[1].moduleIdsBySite["trang-an"]).toEqual(["bao-cao-hien-truong", "cham-cong"]);
  });
});
