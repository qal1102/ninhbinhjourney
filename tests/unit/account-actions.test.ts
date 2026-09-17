import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  getRegistryAccount: vi.fn(),
  hasSystemAdmin: vi.fn(),
  listRegistryAccounts: vi.fn(),
  upsertRegistryAccount: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/erp/demo-session", () => ({ getCurrentErpUser: mocks.user }));
vi.mock("@/lib/erp/account-registry-repository", () => {
  class AccountRegistryError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AccountRegistryError";
    }
  }
  return {
    AccountRegistryError,
    getRegistryAccount: mocks.getRegistryAccount,
    hasSystemAdmin: mocks.hasSystemAdmin,
    listRegistryAccounts: mocks.listRegistryAccounts,
    upsertRegistryAccount: mocks.upsertRegistryAccount,
    // Not exercised by these tests, but the module under test imports them.
    AuthEmailAlreadyRegisteredError: AccountRegistryError,
    createAuthUserForAccount: vi.fn(),
    deleteAuthUser: vi.fn(),
    findLoginByEmail: vi.fn(),
    generateTemporaryPassword: vi.fn(),
    getLinkedAuthUserId: vi.fn(),
    linkAuthUser: vi.fn(),
    markLoginPasswordReset: vi.fn(),
    setAuthUserPassword: vi.fn(),
    unlinkAuthUser: vi.fn(),
    setRegistryAccountStatus: vi.fn(),
    setRegistryRoleAssignment: vi.fn(),
  };
});

import { upsertAccountAction } from "@/app/erp/account-actions";

const initial = { status: "idle" as const, message: "" };

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function accountForm(displayName: string) {
  return formData({
    displayName,
    jobTitle: "Nhân viên đón khách",
    employmentType: "permanent",
    status: "active",
  });
}

/** Thửng ra một tài khoản đăng ký đã có, chỉ cần đúng accountId cho phép tính "taken". */
function existingAccount(accountId: string) {
  return {
    accountId,
    displayName: accountId,
    jobTitle: "",
    employmentType: "permanent",
    status: "active" as const,
    hasAuthUser: false,
    email: null,
    mustChangePassword: false,
    phone: null,
    startedAt: null,
    grants: [],
  };
}

describe("ERP-UX-06c: máy tự đặt mã tài khoản", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "system-admin-01", role: "director", mustChangePassword: false });
    mocks.getRegistryAccount.mockResolvedValue({ grants: [{ role: "system-admin", siteId: null }] });
    mocks.hasSystemAdmin.mockReturnValue(true);
    mocks.listRegistryAccounts.mockResolvedValue([]);
    mocks.upsertRegistryAccount.mockResolvedValue(undefined);
  });

  it("bỏ dấu tiếng Việt đúng cách để ra mã đăng nhập", async () => {
    const state = await upsertAccountAction(initial, accountForm("Nguyễn Văn Ba"));
    expect(state.status).toBe("success");
    expect(state.message).toContain("nguyen-van-ba");
    expect(mocks.upsertRegistryAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "nguyen-van-ba", displayName: "Nguyễn Văn Ba" }),
    );
  });

  it("trùng tên thì mã thứ hai có hậu tố, không ghi đè tài khoản đang dùng mã đó", async () => {
    mocks.listRegistryAccounts.mockResolvedValue([existingAccount("nguyen-van-ba")]);
    const state = await upsertAccountAction(initial, accountForm("Nguyễn Văn Ba"));
    expect(state.status).toBe("success");
    expect(state.message).toContain("nguyen-van-ba-2");
    expect(mocks.upsertRegistryAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "nguyen-van-ba-2" }),
    );
    // Chưa từng gọi upsert với mã trùng "nguyen-van-ba" -- không có lượt ghi
    // đè nào lên tài khoản đã tồn tại.
    expect(mocks.upsertRegistryAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "nguyen-van-ba" }),
    );
  });

  it("gồm cả tài khoản đã ngưng/thu hồi khi tính mã nào đang dùng", async () => {
    mocks.listRegistryAccounts.mockResolvedValue([
      { ...existingAccount("tran-thi-hoa"), status: "suspended" as const },
    ]);
    const state = await upsertAccountAction(initial, accountForm("Trần Thị Hoa"));
    expect(state.status).toBe("success");
    // Mã của người đã nghỉ ("tran-thi-hoa") không được tái sử dụng.
    expect(mocks.upsertRegistryAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "tran-thi-hoa-2" }),
    );
  });

  it("đọc danh sách mã đang dùng hỏng thì dừng lại, không gọi upsert", async () => {
    mocks.listRegistryAccounts.mockRejectedValue(new Error("Kho tài khoản chưa hoàn tất bước đọc danh sách tài khoản."));
    const state = await upsertAccountAction(initial, accountForm("Nguyễn Văn Ba"));
    expect(state.status).toBe("error");
    expect(mocks.upsertRegistryAccount).not.toHaveBeenCalled();
  });

  it("tên chỉ gồm ký tự lạ vẫn sinh ra mã hợp lệ (dùng mã dự phòng)", async () => {
    const state = await upsertAccountAction(initial, accountForm("!!! ??? ###"));
    expect(state.status).toBe("success");
    expect(mocks.upsertRegistryAccount).toHaveBeenCalledTimes(1);
    const [[call]] = mocks.upsertRegistryAccount.mock.calls;
    expect(call.accountId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(call.accountId.length).toBeGreaterThanOrEqual(2);
    expect(call.accountId.length).toBeLessThanOrEqual(100);
  });

  it("không cho người không có quyền quản trị hệ thống tạo tài khoản", async () => {
    mocks.hasSystemAdmin.mockReturnValue(false);
    const state = await upsertAccountAction(initial, accountForm("Nguyễn Văn Ba"));
    expect(state.status).toBe("error");
    expect(mocks.upsertRegistryAccount).not.toHaveBeenCalled();
  });
});
