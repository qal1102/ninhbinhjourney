import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpSiteId,
} from "@/domain/erp";
import {
  DEMO_ERP_ACCOUNTS,
  getEmployeeAssignableModuleIds,
} from "@/lib/erp/demo-data";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const ACCESS_COOKIE = "nbj-erp-demo-access";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

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

export type UpdateEmployeeAccessInput = {
  employeeId: string;
  /** Site the actor is currently managing from; also the audit context. */
  siteContextId: ErpSiteId;
  /** True to grant `siteContextId` + `moduleIds`, false to revoke it. */
  siteActive: boolean;
  moduleIds: ErpModuleId[];
  actorId: string;
  actorRole: "manager" | "director";
};

export class StaffAccessRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StaffAccessRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new StaffAccessRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new StaffAccessRepositoryError(
      "Kho dữ liệu phân quyền nhân viên chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-staff-access-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new StaffAccessRepositoryError(
    `Kho dữ liệu phân quyền nhân viên chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

// --- demo-cookie mode -------------------------------------------------

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

function createDefaultAccessState(): ErpAccessState {
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

async function readCookieState(): Promise<ErpAccessState> {
  const store = await cookies();
  return sanitizeAccessState(decodeSigned<ErpAccessState>(store.get(ACCESS_COOKIE)?.value));
}

async function writeCookieState(state: ErpAccessState) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function updateInCookie(input: UpdateEmployeeAccessInput) {
  const state = await readCookieState();
  state.employees[input.employeeId] = {
    siteIds: input.siteActive ? [input.siteContextId] : [],
    moduleIdsBySite: input.siteActive
      ? { [input.siteContextId]: input.moduleIds }
      : {},
  };
  const auditEvent: ErpAuditEvent = {
    id: crypto.randomUUID(),
    actorId: input.actorId,
    action: input.siteActive ? "employee.access.updated" : "employee.site.revoked",
    targetId: input.employeeId,
    siteId: input.siteContextId,
    createdAt: new Date().toISOString(),
  };
  state.audit.push(auditEvent);
  state.audit = state.audit.slice(-30);
  await writeCookieState(state);
  return { employeeAccess: state.employees[input.employeeId], auditEvent };
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

async function readSupabaseState(): Promise<ErpAccessState> {
  const client = createAdminClient();
  const accessResult = await client
    .from("erp_employee_access")
    .select("employee_account_id, site_id, module_ids")
    .eq("tenant_id", TENANT_ID);
  if (accessResult.error) {
    throw repositoryError("đọc phân quyền nhân viên", accessResult.error);
  }
  const employees: Record<string, EmployeeAccess> = {};
  for (const row of accessResult.data ?? []) {
    const siteId = siteSlugFromUuid(row.site_id);
    employees[row.employee_account_id as string] = siteId
      ? {
          siteIds: [siteId],
          moduleIdsBySite: { [siteId]: (row.module_ids ?? []) as ErpModuleId[] },
        }
      : { siteIds: [], moduleIdsBySite: {} };
  }

  const auditResult = await client
    .from("erp_employee_access_audit")
    .select("id, actor_account_id, action, employee_account_id, site_id, created_at")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: true })
    .limit(30);
  if (auditResult.error) {
    throw repositoryError("đọc nhật ký phân quyền", auditResult.error);
  }
  const audit: ErpAuditEvent[] = (auditResult.data ?? [])
    .map((row) => {
      const siteId = siteSlugFromUuid(row.site_id);
      if (!siteId) return null;
      return {
        id: row.id as string,
        actorId: row.actor_account_id as string,
        action: row.action as string,
        targetId: row.employee_account_id as string,
        siteId,
        createdAt: row.created_at as string,
      };
    })
    .filter((event): event is ErpAuditEvent => event !== null);

  return { version: 1, employees, audit };
}

async function updateInSupabase(input: UpdateEmployeeAccessInput) {
  const client = createAdminClient();
  const result = await client.rpc("erp_update_employee_access", {
    p_tenant_id: TENANT_ID,
    p_employee_account_id: input.employeeId,
    p_site_context_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteContextId],
    p_site_active: input.siteActive,
    p_module_ids: input.siteActive ? input.moduleIds : [],
    p_actor_account_id: input.actorId,
    p_actor_role: input.actorRole,
  });
  if (result.error) {
    throw repositoryError("cập nhật phân quyền nhân viên", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    site_id: string | null;
    module_ids: string[];
  };
  const siteId = siteSlugFromUuid(row.site_id);
  const employeeAccess: EmployeeAccess = siteId
    ? { siteIds: [siteId], moduleIdsBySite: { [siteId]: row.module_ids as ErpModuleId[] } }
    : { siteIds: [], moduleIdsBySite: {} };
  const auditEvent: ErpAuditEvent = {
    id: crypto.randomUUID(),
    actorId: input.actorId,
    action: input.siteActive ? "employee.access.updated" : "employee.site.revoked",
    targetId: input.employeeId,
    siteId: input.siteContextId,
    createdAt: new Date().toISOString(),
  };
  return { employeeAccess, auditEvent };
}

// --- public API -----------------------------------------------------------

export async function getAccessState(): Promise<ErpAccessState> {
  if (readMode() === "supabase") return readSupabaseState();
  return readCookieState();
}

export async function updateEmployeeAccessGrant(input: UpdateEmployeeAccessInput) {
  if (readMode() === "supabase") return updateInSupabase(input);
  return updateInCookie(input);
}
