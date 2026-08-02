import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation's real `redirect()` throws to unwind the request; a plain
// `vi.fn()` here would let execution fall through past a guard clause that
// depends on it never returning, silently masking a real bug as a passing
// test. `RedirectSignal` reproduces the "never returns" contract without
// depending on Next's App Router request context, which does not exist in
// plain vitest.
const { redirect } = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super(`REDIRECT:${url}`);
    }
  }
  return {
    redirect: vi.fn((url: string) => {
      throw new RedirectSignal(url);
    }),
  };
});

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/erp/demo-data", () => ({
  findDemoErpAccountById: vi.fn(),
  findDemoErpAccountByUsername: vi.fn(),
  getGrantableModuleIds: vi.fn(),
  isDemoErpAccountActive: vi.fn(),
}));

const { setErpSession, clearErpSession, getCurrentErpUser } = vi.hoisted(() => ({
  setErpSession: vi.fn(),
  clearErpSession: vi.fn(),
  getCurrentErpUser: vi.fn(),
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  clearErpSession,
  endRoleSwitch: vi.fn(),
  getCurrentErpUser,
  setErpSession,
  startRoleSwitch: vi.fn(),
}));

const { confirmPasswordChanged } = vi.hoisted(() => ({
  confirmPasswordChanged: vi.fn(),
}));

vi.mock("@/lib/erp/account-registry-repository", () => ({
  confirmPasswordChanged,
}));

const { signInWithPassword, signOut, updateUser } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut, updateUser },
  })),
}));

vi.mock("@/lib/erp/role-switch-audit-repository", () => ({
  recordRoleSwitch: vi.fn(),
}));
vi.mock("@/lib/erp/staff-access-repository", () => ({
  getAccessState: vi.fn(),
  updateEmployeeAccessGrant: vi.fn(),
}));
vi.mock("@/lib/erp/attendance-repository", () => ({
  AttendanceRepositoryConflictError: class extends Error {},
  recordAttendanceEvent: vi.fn(),
}));
vi.mock("@/lib/erp/incident-repository", () => ({
  IncidentRepositoryConflictError: class extends Error {},
  IncidentRepositoryError: class extends Error {},
  progressIncidentByEmployee: vi.fn(),
  reportIncidentFromCamera: vi.fn(),
  transitionIncidentByManager: vi.fn(),
}));
vi.mock("@/lib/erp/field-report-repository", () => ({
  FieldReportRepositoryError: class extends Error {},
  submitFieldReport: vi.fn(),
}));
vi.mock("@/lib/erp/gate-scan-repository", () => ({
  GATE_SCAN_RESULT_LABELS: {},
  GateScanRepositoryError: class extends Error {},
  searchTickets: vi.fn(),
  validateGateScan: vi.fn(),
}));

import {
  findDemoErpAccountByUsername,
  isDemoErpAccountActive,
} from "@/lib/erp/demo-data";
import {
  changePasswordErpAction,
  loginErpAction,
  logoutErpAction,
} from "@/app/erp/actions";

function formOf(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginErpAction", () => {
  it("redirects with error=missing when a field is blank", async () => {
    await expect(
      loginErpAction(formOf({ username: "", password: "" })),
    ).rejects.toMatchObject({ url: "/erp/login?error=missing" });
    expect(setErpSession).not.toHaveBeenCalled();
  });

  it("signs in through Supabase Auth when the identifier is an email", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      loginErpAction(
        formOf({ username: "long@donvi.vn", password: "secret123" }),
      ),
    ).rejects.toMatchObject({ url: "/erp" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "long@donvi.vn",
      password: "secret123",
    });
    // The email path must never fall back to the shared-password demo store.
    expect(findDemoErpAccountByUsername).not.toHaveBeenCalled();
    expect(setErpSession).not.toHaveBeenCalled();
  });

  it("rejects a bad Supabase Auth password without leaking which part was wrong", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await expect(
      loginErpAction(
        formOf({ username: "long@donvi.vn", password: "wrong" }),
      ),
    ).rejects.toMatchObject({ url: "/erp/login?error=invalid" });
    expect(setErpSession).not.toHaveBeenCalled();
  });

  it("still signs in a legacy account by shared role password", async () => {
    const account = { id: "manager-trang-an", password: "Quanly@2026" };
    vi.mocked(findDemoErpAccountByUsername).mockReturnValue(account as never);
    vi.mocked(isDemoErpAccountActive).mockReturnValue(true);
    await expect(
      loginErpAction(
        formOf({ username: "ql.trangan", password: "Quanly@2026" }),
      ),
    ).rejects.toMatchObject({ url: "/erp" });
    expect(setErpSession).toHaveBeenCalledWith("manager-trang-an");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("logoutErpAction", () => {
  it("clears both a Supabase Auth session and the legacy cookie unconditionally", async () => {
    await expect(logoutErpAction()).rejects.toMatchObject({
      url: "/erp/login",
    });
    expect(signOut).toHaveBeenCalled();
    expect(clearErpSession).toHaveBeenCalled();
  });
});

describe("changePasswordErpAction", () => {
  const idle = { status: "idle" as const, message: "" };

  it("refuses a password shorter than 8 characters", async () => {
    const result = await changePasswordErpAction(
      idle,
      formOf({ password: "short", confirmPassword: "short" }),
    );
    expect(result.status).toBe("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses when the two entries do not match", async () => {
    const result = await changePasswordErpAction(
      idle,
      formOf({ password: "longenough1", confirmPassword: "longenough2" }),
    );
    expect(result.status).toBe("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a session with no linked Supabase Auth user", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "manager-trang-an" });
    const result = await changePasswordErpAction(
      idle,
      formOf({ password: "longenough1", confirmPassword: "longenough1" }),
    );
    expect(result.status).toBe("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("confirms the password change and returns to /erp on success", async () => {
    getCurrentErpUser.mockResolvedValue({
      id: "manager-tam-chuc",
      authUserId: "auth-uuid-1",
    });
    updateUser.mockResolvedValue({ error: null });
    await expect(
      changePasswordErpAction(
        idle,
        formOf({ password: "longenough1", confirmPassword: "longenough1" }),
      ),
    ).rejects.toMatchObject({ url: "/erp" });
    expect(updateUser).toHaveBeenCalledWith({ password: "longenough1" });
    expect(confirmPasswordChanged).toHaveBeenCalledWith("auth-uuid-1");
  });

  it("does not clear the forced-change flag when Supabase Auth rejects the update", async () => {
    getCurrentErpUser.mockResolvedValue({
      id: "manager-tam-chuc",
      authUserId: "auth-uuid-1",
    });
    updateUser.mockResolvedValue({ error: { message: "weak password" } });
    const result = await changePasswordErpAction(
      idle,
      formOf({ password: "longenough1", confirmPassword: "longenough1" }),
    );
    expect(result.status).toBe("error");
    expect(confirmPasswordChanged).not.toHaveBeenCalled();
  });
});
