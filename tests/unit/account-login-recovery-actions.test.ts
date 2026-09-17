import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A15-ACC-01 — audit 15/09/2026, TK-01 → TK-04.
 *
 * Cấp đăng nhập đi qua hai hệ thống không chung giao dịch (Supabase Auth và
 * registry). Mỗi bài dưới đây là một chỗ từng kẹt không có đường ra.
 */

const mocks = vi.hoisted(() => {
  class AccountRegistryError extends Error {
    constructor(message: string, options?: ErrorOptions) {
      super(message, options);
      this.name = "AccountRegistryError";
    }
  }
  class AuthEmailAlreadyRegisteredError extends AccountRegistryError {
    constructor() {
      super("Email này đã có người dùng đăng nhập.");
      this.name = "AuthEmailAlreadyRegisteredError";
    }
  }
  return {
    AccountRegistryError,
    AuthEmailAlreadyRegisteredError,
    user: vi.fn(),
    getRegistryAccount: vi.fn(),
    hasSystemAdmin: vi.fn(),
    createAuthUserForAccount: vi.fn(),
    deleteAuthUser: vi.fn(),
    findLoginByEmail: vi.fn(),
    generateTemporaryPassword: vi.fn(),
    getLinkedAuthUserId: vi.fn(),
    linkAuthUser: vi.fn(),
    markLoginPasswordReset: vi.fn(),
    setAuthUserPassword: vi.fn(),
    unlinkAuthUser: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/erp/demo-session", () => ({ getCurrentErpUser: mocks.user }));
vi.mock("@/lib/erp/account-registry-repository", () => ({
  AccountRegistryError: mocks.AccountRegistryError,
  AuthEmailAlreadyRegisteredError: mocks.AuthEmailAlreadyRegisteredError,
  createAuthUserForAccount: mocks.createAuthUserForAccount,
  deleteAuthUser: mocks.deleteAuthUser,
  findLoginByEmail: mocks.findLoginByEmail,
  generateTemporaryPassword: mocks.generateTemporaryPassword,
  getLinkedAuthUserId: mocks.getLinkedAuthUserId,
  getRegistryAccount: mocks.getRegistryAccount,
  hasSystemAdmin: mocks.hasSystemAdmin,
  linkAuthUser: mocks.linkAuthUser,
  listRegistryAccounts: vi.fn(),
  markLoginPasswordReset: mocks.markLoginPasswordReset,
  setAuthUserPassword: mocks.setAuthUserPassword,
  setRegistryAccountStatus: vi.fn(),
  setRegistryRoleAssignment: vi.fn(),
  unlinkAuthUser: mocks.unlinkAuthUser,
  upsertRegistryAccount: vi.fn(),
}));

import {
  grantLoginAction,
  resetLoginPasswordAction,
  unlinkLoginAction,
} from "@/app/erp/account-actions";

const initial = { status: "idle" as const, message: "" };
const ADMIN = "system-admin-01";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.user.mockResolvedValue({ id: ADMIN, role: "director" });
  mocks.getRegistryAccount.mockResolvedValue({ grants: [{ role: "system-admin", siteId: null }] });
  mocks.hasSystemAdmin.mockReturnValue(true);
  mocks.generateTemporaryPassword.mockReturnValue("Tam-Thoi-9999xyz");
  mocks.createAuthUserForAccount.mockResolvedValue("auth-moi");
  mocks.linkAuthUser.mockResolvedValue(undefined);
  mocks.deleteAuthUser.mockResolvedValue(undefined);
  mocks.setAuthUserPassword.mockResolvedValue(undefined);
  mocks.markLoginPasswordReset.mockResolvedValue(undefined);
});

describe("A15-ACC-01 — cấp đăng nhập", () => {
  const grant = () => grantLoginAction(initial, form({ accountId: "nv-ba", email: "ba@donvi.vn" }));

  it("thành công thì trả mật khẩu tạm ở ô riêng, không nhét vào câu thông báo", async () => {
    const state = await grant();
    expect(state).toMatchObject({ status: "success", temporaryPassword: "Tam-Thoi-9999xyz" });
    expect(state.message).not.toContain("Tam-Thoi-9999xyz");
    expect(mocks.linkAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({ actorAccountId: ADMIN, accountId: "nv-ba", authUserId: "auth-moi" }),
    );
  });

  it("TK-01: nối registry hỏng thì xoá ngược người dùng Auth vừa tạo rồi mới báo lỗi", async () => {
    mocks.linkAuthUser.mockRejectedValue(new mocks.AccountRegistryError("Kho tài khoản chưa hoàn tất bước liên kết đăng nhập."));
    const state = await grant();
    expect(state.status).toBe("error");
    expect(state.temporaryPassword).toBeUndefined();
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("auth-moi");
  });

  it("TK-01: xoá ngược cũng hỏng thì vẫn báo đúng lỗi nối, không nuốt lỗi gốc", async () => {
    mocks.linkAuthUser.mockRejectedValue(new mocks.AccountRegistryError("Kho tài khoản chưa hoàn tất bước liên kết đăng nhập."));
    mocks.deleteAuthUser.mockRejectedValue(new Error("mạng đứt"));
    const state = await grant();
    expect(state).toMatchObject({ status: "error", message: "Kho tài khoản chưa hoàn tất bước liên kết đăng nhập." });
  });

  it("TK-01/TK-02: gặp người dùng Auth mồ côi do chính ERP tạo thì dùng lại với mật khẩu mới", async () => {
    mocks.createAuthUserForAccount.mockRejectedValue(new mocks.AuthEmailAlreadyRegisteredError());
    mocks.findLoginByEmail.mockResolvedValue({ authUserId: "auth-mo-coi", linkedAccountId: null, createdForAccountId: "nv-ba" });
    const state = await grant();
    expect(state).toMatchObject({ status: "success", temporaryPassword: "Tam-Thoi-9999xyz" });
    expect(mocks.setAuthUserPassword).toHaveBeenCalledWith("auth-mo-coi", "Tam-Thoi-9999xyz");
    expect(mocks.linkAuthUser).toHaveBeenCalledWith(expect.objectContaining({ authUserId: "auth-mo-coi" }));
  });

  it("dùng lại mồ côi mà nối vẫn hỏng thì KHÔNG xoá người dùng không do lượt này tạo", async () => {
    mocks.createAuthUserForAccount.mockRejectedValue(new mocks.AuthEmailAlreadyRegisteredError());
    mocks.findLoginByEmail.mockResolvedValue({ authUserId: "auth-mo-coi", linkedAccountId: null, createdForAccountId: "nv-ba" });
    mocks.linkAuthUser.mockRejectedValue(new mocks.AccountRegistryError("hỏng"));
    await grant();
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("TK-02: email đã gắn chính tài khoản này thì chỉ lối Cấp lại mật khẩu, không nói 'tài khoản khác'", async () => {
    mocks.createAuthUserForAccount.mockRejectedValue(new mocks.AuthEmailAlreadyRegisteredError());
    mocks.findLoginByEmail.mockResolvedValue({ authUserId: "auth-cu", linkedAccountId: "nv-ba", createdForAccountId: "nv-ba" });
    const state = await grant();
    expect(state.status).toBe("error");
    expect(state.message).toContain("chính tài khoản này");
    expect(state.message).toContain("Cấp lại mật khẩu tạm");
    expect(mocks.setAuthUserPassword).not.toHaveBeenCalled();
  });

  it("email đang gắn tài khoản khác thì nói rõ tài khoản nào, không đổi mật khẩu của người ta", async () => {
    mocks.createAuthUserForAccount.mockRejectedValue(new mocks.AuthEmailAlreadyRegisteredError());
    mocks.findLoginByEmail.mockResolvedValue({ authUserId: "auth-khac", linkedAccountId: "ql-hai", createdForAccountId: "ql-hai" });
    const state = await grant();
    expect(state.message).toContain("ql-hai");
    expect(mocks.setAuthUserPassword).not.toHaveBeenCalled();
    expect(mocks.linkAuthUser).not.toHaveBeenCalled();
  });

  it("người dùng Auth không do ERP tạo thì không bao giờ bị chiếm", async () => {
    mocks.createAuthUserForAccount.mockRejectedValue(new mocks.AuthEmailAlreadyRegisteredError());
    mocks.findLoginByEmail.mockResolvedValue({ authUserId: "auth-ngoai", linkedAccountId: null, createdForAccountId: null });
    const state = await grant();
    expect(state.status).toBe("error");
    expect(mocks.setAuthUserPassword).not.toHaveBeenCalled();
    expect(mocks.linkAuthUser).not.toHaveBeenCalled();
  });
});

describe("A15-ACC-01 — cấp lại mật khẩu tạm (TK-04)", () => {
  const reset = (accountId = "nv-ba") => resetLoginPasswordAction(initial, form({ accountId }));

  it("đổi mật khẩu bên Auth trước, ghi nhận vào hệ thống sau, rồi mới hiện mật khẩu", async () => {
    mocks.getLinkedAuthUserId.mockResolvedValue("auth-cu");
    const state = await reset();
    expect(state).toMatchObject({ status: "success", temporaryPassword: "Tam-Thoi-9999xyz" });
    expect(mocks.setAuthUserPassword).toHaveBeenCalledWith("auth-cu", "Tam-Thoi-9999xyz");
    expect(mocks.markLoginPasswordReset).toHaveBeenCalledWith({ actorAccountId: ADMIN, accountId: "nv-ba" });
    expect(mocks.setAuthUserPassword.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markLoginPasswordReset.mock.invocationCallOrder[0],
    );
  });

  it("Auth không nhận mật khẩu mới thì không ghi Nhật ký là đã cấp lại", async () => {
    mocks.getLinkedAuthUserId.mockResolvedValue("auth-cu");
    mocks.setAuthUserPassword.mockRejectedValue(new mocks.AccountRegistryError("Supabase Auth chưa nhận mật khẩu mới."));
    const state = await reset();
    expect(state.status).toBe("error");
    expect(mocks.markLoginPasswordReset).not.toHaveBeenCalled();
  });

  it("ghi nhận hỏng sau khi Auth đã đổi thì không lộ mật khẩu và bảo bấm lại", async () => {
    mocks.getLinkedAuthUserId.mockResolvedValue("auth-cu");
    mocks.markLoginPasswordReset.mockRejectedValue(new Error("hỏng"));
    const state = await reset();
    expect(state.status).toBe("error");
    expect(state.temporaryPassword).toBeUndefined();
    expect(state.message).toContain("Cấp lại mật khẩu tạm");
  });

  it("chưa cấp đăng nhập thì không có gì để cấp lại", async () => {
    mocks.getLinkedAuthUserId.mockResolvedValue(null);
    const state = await reset();
    expect(state.status).toBe("error");
    expect(mocks.setAuthUserPassword).not.toHaveBeenCalled();
  });

  it("không tự cấp lại mật khẩu của chính mình", async () => {
    const state = await reset(ADMIN);
    expect(state.status).toBe("error");
    expect(mocks.getLinkedAuthUserId).not.toHaveBeenCalled();
  });

  it("người không có quyền quản trị hệ thống bị chặn trước khi chạm Auth", async () => {
    mocks.hasSystemAdmin.mockReturnValue(false);
    const state = await reset();
    expect(state.status).toBe("error");
    expect(mocks.setAuthUserPassword).not.toHaveBeenCalled();
  });
});

describe("A15-ACC-01 — gỡ đăng nhập (TK-03)", () => {
  const unlink = (values: Record<string, string>) => unlinkLoginAction(initial, form(values));

  it("gỡ nối trong registry trước, rồi xoá người dùng bên Auth", async () => {
    mocks.unlinkAuthUser.mockResolvedValue("auth-cu");
    const state = await unlink({ accountId: "nv-ba", confirm: "yes" });
    expect(state.status).toBe("success");
    expect(mocks.unlinkAuthUser).toHaveBeenCalledWith({ actorAccountId: ADMIN, accountId: "nv-ba" });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("auth-cu");
    expect(mocks.unlinkAuthUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteAuthUser.mock.invocationCallOrder[0]);
  });

  it("xoá bên Auth hỏng thì vẫn báo đã gỡ (người đó hết vào được) và nói rõ phần còn sót", async () => {
    mocks.unlinkAuthUser.mockResolvedValue("auth-cu");
    mocks.deleteAuthUser.mockRejectedValue(new Error("mạng đứt"));
    const state = await unlink({ accountId: "nv-ba", confirm: "yes" });
    expect(state.status).toBe("success");
    expect(state.message).toContain("chưa xoá được");
  });

  it("chưa đánh dấu ô xác nhận thì không gỡ", async () => {
    const state = await unlink({ accountId: "nv-ba" });
    expect(state.status).toBe("error");
    expect(mocks.unlinkAuthUser).not.toHaveBeenCalled();
  });

  it("không tự gỡ đăng nhập của chính mình", async () => {
    const state = await unlink({ accountId: ADMIN, confirm: "yes" });
    expect(state.status).toBe("error");
    expect(mocks.unlinkAuthUser).not.toHaveBeenCalled();
  });
});
