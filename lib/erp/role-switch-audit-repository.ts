import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpRole } from "@/domain/erp";

const AUDIT_COOKIE = "nbj-erp-demo-role-switch-audit";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const MAX_ENTRIES = 20;

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type RoleSwitchAction = "started" | "ended";

export type RoleSwitchAuditEvent = {
  id: string;
  directorId: string;
  directorName: string;
  targetId: string;
  targetName: string;
  targetRole: ErpRole;
  action: RoleSwitchAction;
  createdAt: string;
};

export type RecordRoleSwitchInput = {
  directorId: string;
  directorName: string;
  targetId: string;
  targetName: string;
  targetRole: ErpRole;
  action: RoleSwitchAction;
};

export class RoleSwitchAuditRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RoleSwitchAuditRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new RoleSwitchAuditRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new RoleSwitchAuditRepositoryError(
      "Kho dữ liệu nhật ký chuyển vai trò chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-role-switch-audit-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new RoleSwitchAuditRepositoryError(
    `Kho dữ liệu nhật ký chuyển vai trò chưa hoàn tất bước ${operation}.`,
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

async function recordInCookie(input: RecordRoleSwitchInput): Promise<RoleSwitchAuditEvent> {
  const store = await cookies();
  const existing = decodeSigned<RoleSwitchAuditEvent[]>(store.get(AUDIT_COOKIE)?.value) ?? [];
  const event: RoleSwitchAuditEvent = {
    id: crypto.randomUUID(),
    directorId: input.directorId,
    directorName: input.directorName,
    targetId: input.targetId,
    targetName: input.targetName,
    targetRole: input.targetRole,
    action: input.action,
    createdAt: new Date().toISOString(),
  };
  const next = [...existing, event].slice(-MAX_ENTRIES);
  store.set(AUDIT_COOKIE, encodeSigned(next), cookieOptions(STATE_SECONDS));
  return event;
}

async function listInCookie(limit: number): Promise<RoleSwitchAuditEvent[]> {
  const store = await cookies();
  const existing = decodeSigned<RoleSwitchAuditEvent[]>(store.get(AUDIT_COOKIE)?.value) ?? [];
  return [...existing].reverse().slice(0, limit);
}

// --- supabase mode ------------------------------------------------------

function rowToEvent(row: Record<string, unknown>): RoleSwitchAuditEvent {
  return {
    id: row.id as string,
    directorId: row.director_account_id as string,
    directorName: row.director_name as string,
    targetId: row.target_account_id as string,
    targetName: row.target_name as string,
    targetRole: row.target_role as ErpRole,
    action: row.action as RoleSwitchAction,
    createdAt: row.created_at as string,
  };
}

async function recordInSupabase(input: RecordRoleSwitchInput): Promise<RoleSwitchAuditEvent> {
  const client = createAdminClient();
  const result = await client.rpc("erp_record_role_switch", {
    p_tenant_id: TENANT_ID,
    p_director_account_id: input.directorId,
    p_director_name: input.directorName,
    p_target_account_id: input.targetId,
    p_target_name: input.targetName,
    p_target_role: input.targetRole,
    p_action: input.action,
  });
  if (result.error) {
    throw repositoryError("ghi nhật ký chuyển vai trò", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  return rowToEvent(row);
}

async function listInSupabase(limit: number): Promise<RoleSwitchAuditEvent[]> {
  const client = createAdminClient();
  const result = await client
    .from("erp_role_switch_audit")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) {
    throw repositoryError("đọc nhật ký chuyển vai trò", result.error);
  }
  return (result.data ?? []).map(rowToEvent);
}

// --- public API -----------------------------------------------------------

export async function recordRoleSwitch(
  input: RecordRoleSwitchInput,
): Promise<RoleSwitchAuditEvent> {
  if (readMode() === "supabase") return recordInSupabase(input);
  return recordInCookie(input);
}

export async function listRecentRoleSwitches(
  limit = 10,
): Promise<RoleSwitchAuditEvent[]> {
  if (readMode() === "supabase") return listInSupabase(limit);
  return listInCookie(limit);
}
