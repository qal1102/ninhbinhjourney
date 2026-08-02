import { describe, expect, it, vi } from "vitest";
import { ERP_MODULES } from "@/domain/erp";
import type { ErpRegistryAccount } from "@/lib/erp/account-registry-repository";
import {
  buildStaffDirectory,
  selectRoleSwitchTargets,
} from "@/lib/erp/staff-directory";

// `server-only` là gói ảo do Next cung cấp lúc build, không tồn tại trong môi
// trường vitest — cùng cách xử lý như `erp-workday-view.test.ts`.
vi.mock("server-only", () => ({}));

function account(overrides: Partial<ErpRegistryAccount>): ErpRegistryAccount {
  return {
    accountId: "qa-account",
    displayName: "Người thử",
    jobTitle: "Nhân viên hiện trường",
    employmentType: "permanent",
    status: "active",
    hasAuthUser: false,
    email: null,
    mustChangePassword: false,
    phone: null,
    startedAt: null,
    grants: [{ role: "employee", siteId: "trang-an" }],
    ...overrides,
  };
}

describe("danh bạ nhân sự đọc từ registry", () => {
  it("đưa được một tài khoản chỉ tồn tại trong registry vào danh bạ", () => {
    // Đây chính là lỗi T14b: người do giám đốc tạo đăng nhập được nhưng không
    // hiện ra ở màn hình phân quyền, tức là tuyển xong không phân được việc.
    const directory = buildStaffDirectory([
      account({ accountId: "moi-tuyen-001", displayName: "Nguyễn Văn Mới" }),
    ]);

    expect(directory).toHaveLength(1);
    expect(directory[0].accountId).toBe("moi-tuyen-001");
    expect(directory[0].role).toBe("employee");
    expect(directory[0].siteIds).toEqual(["trang-an"]);
  });

  it("tài khoản chưa có hồ sơ đào tạo được mọi nghiệp vụ giao được cho nhân viên, và nói rõ là chưa có", () => {
    const [entry] = buildStaffDirectory([account({ accountId: "moi-tuyen-002" })]);
    const assignable = ERP_MODULES.filter((module) => module.employeeAssignable).map(
      (module) => module.id,
    );

    expect(entry.hasTrainingRecord).toBe(false);
    expect(entry.grantableModuleIds).toEqual(assignable);
    // Không được lặng lẽ cấp cả những module không giao cho nhân viên bao giờ.
    expect(entry.grantableModuleIds.length).toBeLessThan(ERP_MODULES.length);
  });

  it("tài khoản còn hồ sơ mẫu giữ nguyên giới hạn theo đào tạo", () => {
    // `employee-trang-an-01` có `workforceProfile.trainedModuleIds` trong
    // demo-data; danh bạ không được nới rộng nó.
    const [entry] = buildStaffDirectory([
      account({ accountId: "employee-trang-an-01" }),
    ]);

    expect(entry.hasTrainingRecord).toBe(true);
    expect(entry.grantableModuleIds.length).toBeGreaterThan(0);
    expect(entry.grantableModuleIds.length).toBeLessThan(
      ERP_MODULES.filter((module) => module.employeeAssignable).length,
    );
  });

  it("quản lý được phép nhận mọi nghiệp vụ", () => {
    const [entry] = buildStaffDirectory([
      account({
        accountId: "ql-001",
        grants: [{ role: "regional-manager", siteId: "tam-chuc" }],
      }),
    ]);

    expect(entry.role).toBe("manager");
    expect(entry.grantableModuleIds).toHaveLength(ERP_MODULES.length);
  });

  it("tài khoản bị khoá hoặc thu hồi không còn hoạt động", () => {
    for (const status of ["suspended", "revoked"] as const) {
      const [entry] = buildStaffDirectory([account({ status })]);
      expect(entry.active, status).toBe(false);
    }
  });

  it("tài khoản chỉ giữ system-admin không thuộc danh bạ nhân sự", () => {
    const directory = buildStaffDirectory([
      account({ grants: [{ role: "system-admin", siteId: null }] }),
    ]);
    expect(directory).toEqual([]);
  });
});

describe("danh sách xem thử của giám đốc", () => {
  const directory = buildStaffDirectory([
    account({ accountId: "gd-001", grants: [{ role: "director", siteId: null }] }),
    account({ accountId: "nv-001" }),
    account({ accountId: "nv-002", status: "suspended" }),
    account({
      accountId: "ql-001",
      grants: [{ role: "regional-manager", siteId: "tam-coc" }],
    }),
  ]);

  it("loại giám đốc, tài khoản đã khoá và chính tài khoản đang xem", () => {
    const targets = selectRoleSwitchTargets(directory, "ql-001");
    expect(targets.map((entry) => entry.accountId)).toEqual(["nv-001"]);
  });

  it("giữ lại tài khoản registry mới khi chưa xem thử ai", () => {
    const targets = selectRoleSwitchTargets(directory);
    expect(targets.map((entry) => entry.accountId).sort()).toEqual([
      "nv-001",
      "ql-001",
    ]);
  });
});
