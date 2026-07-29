import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpSiteId,
} from "@/domain/erp";
import {
  DEMO_ERP_ACCOUNTS,
  findDemoErpAccountById,
  getEmployeeAssignableModuleIds,
  isDemoErpAccountActive,
  type DemoErpAccount,
} from "./demo-data";

const SESSION_COOKIE = "nbj-erp-demo-session";
const ACCESS_COOKIE = "nbj-erp-demo-access";
const ATTENDANCE_COOKIE = "nbj-erp-demo-attendance";
const SESSION_SECONDS = 60 * 60 * 12;
const STATE_SECONDS = 60 * 60 * 24 * 30;

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

type SessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

export type EmployeeAccess = {
  siteIds: ErpSiteId[];
  moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>>;
};

export type ErpAuditEvent = {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  siteId: ErpSiteId;
  createdAt: string;
};

export type ErpAccessState = {
  version: 1;
  employees: Record<string, EmployeeAccess>;
  audit: ErpAuditEvent[];
};

export type AttendanceEvent = {
  id: string;
  userId: string;
  siteId: ErpSiteId;
  type: "check-in" | "check-out";
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: "gps" | "demo-location";
};

export type AttendanceState = {
  version: 1;
  events: AttendanceEvent[];
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

function isSiteId(value: string): value is ErpSiteId {
  return ERP_SITES.some((site) => site.id === value);
}

function isModuleId(value: string): value is ErpModuleId {
  return ERP_MODULES.some((module) => module.id === value);
}

function sanitizeAccessState(value: ErpAccessState | null): ErpAccessState {
  const fallback = createDefaultAccessState();
  if (!value || value.version !== 1 || typeof value.employees !== "object") {
    return fallback;
  }

  for (const account of DEMO_ERP_ACCOUNTS) {
    if (account.role !== "employee") continue;
    const candidate = value.employees[account.id];
    if (!candidate) continue;
    const trainedModules = new Set(getEmployeeAssignableModuleIds(account));
    const siteIds = candidate.siteIds.filter(isSiteId).slice(0, 1);
    const moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>> = {};
    for (const siteId of siteIds) {
      moduleIdsBySite[siteId] = (candidate.moduleIdsBySite[siteId] ?? [])
        .filter(isModuleId)
        .filter((moduleId) => trainedModules.has(moduleId))
        .filter((moduleId) => moduleId !== "nhan-su" && moduleId !== "bao-cao");
    }
    fallback.employees[account.id] = { siteIds, moduleIdsBySite };
  }

  fallback.audit = Array.isArray(value.audit) ? value.audit.slice(-30) : [];
  return fallback;
}

export function createDefaultAccessState(): ErpAccessState {
  const employees: Record<string, EmployeeAccess> = {};
  for (const account of DEMO_ERP_ACCOUNTS) {
    if (account.role !== "employee") continue;
    const moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>> = {};
    for (const siteId of account.initialSiteIds) {
      moduleIdsBySite[siteId] = [...account.initialModuleIds];
    }
    employees[account.id] = {
      siteIds: [...account.initialSiteIds],
      moduleIdsBySite,
    };
  }
  return { version: 1, employees, audit: [] };
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

export async function getAccessState() {
  const store = await cookies();
  return sanitizeAccessState(
    decodeSigned<ErpAccessState>(store.get(ACCESS_COOKIE)?.value),
  );
}

export async function setAccessState(state: ErpAccessState) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

export async function getAttendanceState(): Promise<AttendanceState> {
  const store = await cookies();
  const state = decodeSigned<AttendanceState>(store.get(ATTENDANCE_COOKIE)?.value);
  if (!state || state.version !== 1 || !Array.isArray(state.events)) {
    return createDefaultAttendanceState();
  }
  return { version: 1, events: state.events.slice(-80) };
}

function createDefaultAttendanceState(): AttendanceState {
  const schedule = [
    ["employee-trang-an-01", "trang-an", 7, 28],
    ["employee-trang-an-02", "trang-an", 7, 36],
    ["employee-trang-an-seasonal-01", "trang-an", 8, 2],
    ["employee-tam-chuc-01", "tam-chuc", 7, 19],
    ["employee-tam-coc-01", "tam-coc", 7, 42],
    ["employee-bai-dinh-01", "bai-dinh", 7, 31],
  ] as const;
  const events: AttendanceEvent[] = schedule.map(
    ([userId, siteId, hour, minute], index) => {
      const site = ERP_SITES.find((candidate) => candidate.id === siteId)!;
      const createdAt = new Date();
      createdAt.setHours(hour, minute, 0, 0);
      return {
        id: `seed-attendance-${index + 1}`,
        userId,
        siteId,
        type: "check-in",
        createdAt: createdAt.toISOString(),
        latitude: site.coordinates.latitude,
        longitude: site.coordinates.longitude,
        accuracy: 14 + index,
        source: "demo-location",
      };
    },
  );
  return { version: 1, events };
}

export async function setAttendanceState(state: AttendanceState) {
  const store = await cookies();
  store.set(
    ATTENDANCE_COOKIE,
    encodeSigned({ ...state, events: state.events.slice(-80) }),
    cookieOptions(STATE_SECONDS),
  );
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
