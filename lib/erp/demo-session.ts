import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpSiteId,
} from "@/domain/erp";
import {
  findDemoErpAccountById,
  isDemoErpAccountActive,
  type DemoErpAccount,
} from "./demo-data";
import { getAccessState } from "./staff-access-repository";

export type {
  EmployeeAccess,
  ErpAccessState,
  ErpAuditEvent,
} from "./staff-access-repository";
export type { AttendanceEvent, AttendanceState } from "./attendance-repository";

const SESSION_COOKIE = "nbj-erp-demo-session";
const SESSION_SECONDS = 60 * 60 * 12;

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

type SessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  /**
   * Present only while a director is viewing the system as another
   * account (V3 demo role switch). Holds the director's own account id so
   * the session can be handed back to them. The session's `userId` is the
   * account whose permissions actually apply meanwhile -- this is a real
   * session swap, not a UI-only role flag, so every existing permission
   * check in the app applies unmodified to whoever `userId` currently is.
   */
  actingAsFor?: string;
};

export type CurrentErpUser = Omit<DemoErpAccount, "password"> & {
  siteIds: ErpSiteId[];
  moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>>;
  actingAs?: { directorId: string; directorName: string };
};

function sign(payload: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function encodeSigned(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSigned<T>(input: string | undefined): T | null {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge,
  };
}

export async function setErpSession(userId: string) {
  const now = Date.now();
  const payload: SessionPayload = {
    userId,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSigned(payload), cookieOptions(SESSION_SECONDS));
}

export async function clearErpSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(0));
}

export async function getCurrentErpUser(): Promise<CurrentErpUser | null> {
  const store = await cookies();
  const session = decodeSigned<SessionPayload>(store.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt <= Date.now()) return null;
  const account = findDemoErpAccountById(session.userId);
  if (!account) return null;
  const safeAccount = {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    jobTitle: account.jobTitle,
    initialSiteIds: account.initialSiteIds,
    managedSiteIds: account.managedSiteIds,
    initialModuleIds: account.initialModuleIds,
    workforceProfile: account.workforceProfile,
  };
  const actingAs = session.actingAsFor
    ? (() => {
        const director = findDemoErpAccountById(session.actingAsFor!);
        return director ? { directorId: director.id, directorName: director.name } : undefined;
      })()
    : undefined;

  if (account.role === "director") {
    const allModules = ERP_MODULES.map((module) => module.id);
    return {
      ...safeAccount,
      siteIds: ERP_SITES.map((site) => site.id),
      moduleIdsBySite: Object.fromEntries(
        ERP_SITES.map((site) => [site.id, allModules]),
      ) as Record<ErpSiteId, ErpModuleId[]>,
      actingAs,
    };
  }

  if (account.role === "manager") {
    const allModules = ERP_MODULES.map((module) => module.id);
    return {
      ...safeAccount,
      siteIds: [...account.managedSiteIds],
      moduleIdsBySite: Object.fromEntries(
        account.managedSiteIds.map((siteId) => [siteId, allModules]),
      ) as Partial<Record<ErpSiteId, ErpModuleId[]>>,
      actingAs,
    };
  }

  if (
    account.role === "accountant" ||
    account.role === "chief-accountant"
  ) {
    return {
      ...safeAccount,
      siteIds: [...account.initialSiteIds],
      moduleIdsBySite: Object.fromEntries(
        account.initialSiteIds.map((siteId) => [
          siteId,
          [...account.initialModuleIds],
        ]),
      ) as Partial<Record<ErpSiteId, ErpModuleId[]>>,
      actingAs,
    };
  }

  if (!isDemoErpAccountActive(account)) {
    return { ...safeAccount, siteIds: [], moduleIdsBySite: {}, actingAs };
  }

  const access = await getAccessState();
  const employeeAccess = access.employees[account.id] ?? {
    siteIds: [],
    moduleIdsBySite: {},
  };
  return {
    ...safeAccount,
    siteIds: employeeAccess.siteIds,
    moduleIdsBySite: employeeAccess.moduleIdsBySite,
    actingAs,
  };
}

export function isRoleSwitchEnabled() {
  return process.env.ERP_DEMO_ROLE_SWITCH === "true";
}

export type RoleSwitchResult = {
  director: DemoErpAccount;
  target: DemoErpAccount;
};

/**
 * Swap the signed session's userId to `targetUserId`, keeping the real
 * director's id in `actingAsFor` so the session can be handed back. This is
 * a genuine session change, not a UI role flag: every existing
 * `accountCanAccessSite`/`accountCanAccessModule` check downstream of
 * `getCurrentErpUser()` applies to the target account exactly as if they
 * had logged in themselves, including being blocked wherever they would
 * normally be blocked. Only callable by an active director session, only
 * when `ERP_DEMO_ROLE_SWITCH=true`, and only from a session not already
 * mid-switch (must return to director first).
 */
export async function startRoleSwitch(targetUserId: string): Promise<RoleSwitchResult> {
  if (!isRoleSwitchEnabled()) {
    throw new Error("Tính năng xem theo vai trò đang tắt trên môi trường này.");
  }
  const store = await cookies();
  const session = decodeSigned<SessionPayload>(store.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }
  if (session.actingAsFor) {
    throw new Error("Đang xem theo vai trò khác — quay lại giám đốc trước khi đổi tiếp.");
  }
  const director = findDemoErpAccountById(session.userId);
  if (!director || director.role !== "director") {
    throw new Error("Chỉ tài khoản giám đốc mới dùng được tính năng này.");
  }
  const target = findDemoErpAccountById(targetUserId);
  if (!target || target.role === "director") {
    throw new Error("Không tìm thấy tài khoản để xem thử.");
  }
  const now = Date.now();
  const payload: SessionPayload = {
    userId: target.id,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
    actingAsFor: director.id,
  };
  store.set(SESSION_COOKIE, encodeSigned(payload), cookieOptions(SESSION_SECONDS));
  return { director, target };
}

/** Hand the session back to the real director, dropping `actingAsFor`. */
export async function endRoleSwitch(): Promise<RoleSwitchResult> {
  const store = await cookies();
  const session = decodeSigned<SessionPayload>(store.get(SESSION_COOKIE)?.value);
  if (!session || !session.actingAsFor) {
    throw new Error("Không đang xem theo vai trò khác.");
  }
  const director = findDemoErpAccountById(session.actingAsFor);
  const target = findDemoErpAccountById(session.userId);
  if (!director || !target) {
    throw new Error("Không tìm thấy tài khoản để quay lại.");
  }
  const now = Date.now();
  const payload: SessionPayload = {
    userId: director.id,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  };
  store.set(SESSION_COOKIE, encodeSigned(payload), cookieOptions(SESSION_SECONDS));
  return { director, target };
}

export function accountCanAccessSite(user: CurrentErpUser, siteId: ErpSiteId) {
  return user.siteIds.includes(siteId);
}

export function accountCanAccessModule(
  user: CurrentErpUser,
  siteId: ErpSiteId,
  moduleId: ErpModuleId,
) {
  return (
    accountCanAccessSite(user, siteId) &&
    (user.moduleIdsBySite[siteId] ?? []).includes(moduleId)
  );
}
