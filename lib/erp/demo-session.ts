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
};

export type CurrentErpUser = Omit<DemoErpAccount, "password"> & {
  siteIds: ErpSiteId[];
  moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>>;
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

  if (account.role === "director") {
    const allModules = ERP_MODULES.map((module) => module.id);
    return {
      ...safeAccount,
      siteIds: ERP_SITES.map((site) => site.id),
      moduleIdsBySite: Object.fromEntries(
        ERP_SITES.map((site) => [site.id, allModules]),
      ) as Record<ErpSiteId, ErpModuleId[]>,
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
    };
  }

  if (!isDemoErpAccountActive(account)) {
    return { ...safeAccount, siteIds: [], moduleIdsBySite: {} };
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
  };
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
