import "server-only";

import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  appRoleFromRegistryRole,
  isErpAccountStatus,
  isErpRegistryRole,
  registryRoleFromAppRole,
  type ErpAccountStatus,
  type ErpRegistryRole,
} from "@/domain/erp-account-roles";
import { DEMO_ERP_ACCOUNTS } from "@/lib/erp/demo-data";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export type ErpRoleGrant = {
  role: ErpRegistryRole;
  /** `null` means every site — the registry's own way of saying "toàn vùng". */
  siteId: ErpSiteId | null;
};

export type ErpRegistryAccount = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  employmentType: string;
  status: ErpAccountStatus;
  /** True once this account is wired to a real Supabase Auth user (T6b). */
  hasAuthUser: boolean;
  email: string | null;
  /** True until the person signs in and sets their own password. */
  mustChangePassword: boolean;
  grants: ErpRoleGrant[];
};

export type ErpAccountAdminEvent = {
  id: string;
  actorAccountId: string;
  targetAccountId: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export class AccountRegistryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AccountRegistryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new AccountRegistryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new AccountRegistryError(
      "Kho tài khoản chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-account-registry-server" },
    },
  });
}

function registryError(operation: string, error: unknown) {
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) return new AccountRegistryError(businessMessage);
  return new AccountRegistryError(
    `Kho tài khoản chưa hoàn tất bước ${operation}.`,
    { cause: error },
  );
}

/**
 * Demo-cookie mode has no registry table, so the shipped accounts stand in for
 * one. Everything is `active` and grants come from the org chart, which is
 * exactly the pre-T6 behaviour — the point of the fallback is that local dev
 * and the unit suite keep working, not that it models suspension.
 */
function demoRegistry(): ErpRegistryAccount[] {
  return DEMO_ERP_ACCOUNTS.map((account) => {
    const registryRole = registryRoleFromAppRole(account.role);
    const sites =
      account.role === "manager"
        ? account.managedSiteIds
        : account.role === "employee"
          ? account.initialSiteIds
          : [];
    const grants: ErpRoleGrant[] = sites.length
      ? sites.map((siteId) => ({ role: registryRole, siteId }))
      : [{ role: registryRole, siteId: null }];
    if (account.role === "director") {
      grants.push({ role: "system-admin", siteId: null });
    }
    return {
      accountId: account.id,
      displayName: account.name,
      jobTitle: account.jobTitle,
      employmentType: account.role === "employee" ? "permanent" : "management",
      status: "active" as const,
      hasAuthUser: false,
      email: null,
      // Demo-cookie mode has no Supabase Auth session to change a password
      // in, so there is nothing to force here.
      mustChangePassword: false,
      grants,
    };
  });
}

async function readSupabaseRegistry(): Promise<ErpRegistryAccount[]> {
  const client = createAdminClient();
  const accounts = await client
    .from("erp_account_registry")
    .select(
      "account_id, display_name, job_title, employment_type, status, auth_user_id, email, must_change_password",
    )
    .eq("tenant_id", TENANT_ID)
    .order("account_id", { ascending: true });
  if (accounts.error) throw registryError("đọc danh sách tài khoản", accounts.error);

  const assignments = await client
    .from("erp_account_role_assignments")
    .select("account_id, role, site_id, status, effective_from, effective_until")
    .eq("tenant_id", TENANT_ID)
    .eq("status", "active");
  if (assignments.error) {
    throw registryError("đọc phân vai trò", assignments.error);
  }

  const now = Date.now();
  const grantsByAccount = new Map<string, ErpRoleGrant[]>();
  for (const row of assignments.data ?? []) {
    const role = String(row.role);
    if (!isErpRegistryRole(role)) continue;
    // The database can hold a grant that has not started or has already
    // lapsed; `erp_account_has_active_role` filters on both, so reading has to
    // agree with it or the screen would promise access the RPCs refuse.
    if (row.effective_from && Date.parse(String(row.effective_from)) > now) continue;
    if (row.effective_until && Date.parse(String(row.effective_until)) <= now) continue;
    const siteId = row.site_id
      ? (SITE_SLUG_BY_UUID.get(String(row.site_id)) ?? null)
      : null;
    if (row.site_id && !siteId) continue;
    const accountId = String(row.account_id);
    const list = grantsByAccount.get(accountId) ?? [];
    list.push({ role, siteId });
    grantsByAccount.set(accountId, list);
  }

  return (accounts.data ?? []).map((row) => {
    const status = String(row.status);
    return {
      accountId: String(row.account_id),
      displayName: String(row.display_name),
      jobTitle: String(row.job_title),
      employmentType: String(row.employment_type),
      status: isErpAccountStatus(status) ? status : "revoked",
      hasAuthUser: row.auth_user_id !== null,
      email: row.email === null ? null : String(row.email),
      mustChangePassword: Boolean(row.must_change_password),
      grants: grantsByAccount.get(String(row.account_id)) ?? [],
    };
  });
}

/**
 * Memoised per request. Session resolution alone asks for this twice (status
 * check, then site scope) and the shell asks again for the admin link; without
 * `cache` that is three round trips of two queries each on every page render,
 * for data that cannot change mid-request.
 */
export const listRegistryAccounts = cache(
  async (): Promise<ErpRegistryAccount[]> => {
    if (readMode() === "supabase") return readSupabaseRegistry();
    return demoRegistry();
  },
);

export async function getRegistryAccount(
  accountId: string,
): Promise<ErpRegistryAccount | null> {
  const accounts = await listRegistryAccounts();
  return accounts.find((account) => account.accountId === accountId) ?? null;
}

/**
 * Session resolution for a Supabase Auth-linked account starts from the
 * Auth user id, not the registry's own account id -- this is the one lookup
 * direction `listRegistryAccounts()` cannot serve, so it goes straight to
 * the table instead of scanning the cached list.
 */
export async function getRegistryAccountByAuthUserId(
  authUserId: string,
): Promise<ErpRegistryAccount | null> {
  if (readMode() !== "supabase") return null;
  const client = createAdminClient();
  const result = await client
    .from("erp_account_registry")
    .select("account_id")
    .eq("tenant_id", TENANT_ID)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (result.error) {
    throw registryError("tra cứu tài khoản theo phiên đăng nhập", result.error);
  }
  if (!result.data) return null;
  return getRegistryAccount(String(result.data.account_id));
}

/** Sites an account may open, derived from its active role grants. */
export function sitesFromGrants(account: ErpRegistryAccount): ErpSiteId[] {
  const all = ERP_SITES.map((site) => site.id);
  const sites = new Set<ErpSiteId>();
  for (const grant of account.grants) {
    if (grant.role === "system-admin") continue;
    if (appRoleFromRegistryRole(grant.role) === null) continue;
    if (grant.siteId === null) {
      for (const siteId of all) sites.add(siteId);
    } else {
      sites.add(grant.siteId);
    }
  }
  return all.filter((siteId) => sites.has(siteId));
}

export function hasSystemAdmin(account: ErpRegistryAccount | null): boolean {
  return Boolean(
    account?.grants.some((grant) => grant.role === "system-admin"),
  );
}

export async function listAccountAdminAudit(
  limit = 30,
): Promise<ErpAccountAdminEvent[]> {
  if (readMode() !== "supabase") return [];
  const client = createAdminClient();
  const result = await client
    .from("erp_account_admin_audit")
    .select("id, actor_account_id, target_account_id, action, detail, created_at")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) throw registryError("đọc nhật ký quản trị", result.error);
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    actorAccountId: String(row.actor_account_id),
    targetAccountId: String(row.target_account_id),
    action: String(row.action),
    detail: (row.detail ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }));
}

export type UpsertAccountInput = {
  actorAccountId: string;
  accountId: string;
  displayName: string;
  jobTitle: string;
  employmentType: string;
  status: ErpAccountStatus;
};

export async function upsertRegistryAccount(input: UpsertAccountInput) {
  if (readMode() !== "supabase") {
    throw new AccountRegistryError(
      "Chế độ demo cục bộ không lưu được tài khoản. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_admin_upsert_account", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_account_id: input.accountId,
    p_display_name: input.displayName,
    p_job_title: input.jobTitle,
    p_employment_type: input.employmentType,
    p_status: input.status,
  });
  if (result.error) throw registryError("lưu tài khoản", result.error);
}

export async function setRegistryAccountStatus(input: {
  actorAccountId: string;
  accountId: string;
  status: ErpAccountStatus;
}) {
  if (readMode() !== "supabase") {
    throw new AccountRegistryError(
      "Chế độ demo cục bộ không đổi được trạng thái tài khoản. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_admin_set_account_status", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_account_id: input.accountId,
    p_status: input.status,
  });
  if (result.error) throw registryError("đổi trạng thái tài khoản", result.error);
}

export async function setRegistryRoleAssignment(input: {
  actorAccountId: string;
  accountId: string;
  role: ErpRegistryRole;
  siteId: ErpSiteId | null;
  active: boolean;
}) {
  if (readMode() !== "supabase") {
    throw new AccountRegistryError(
      "Chế độ demo cục bộ không đổi được phân vai trò. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_admin_set_role_assignment", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_account_id: input.accountId,
    p_role: input.role,
    p_site_id: input.siteId
      ? ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId]
      : null,
    p_active: input.active,
  });
  if (result.error) throw registryError("đổi phân vai trò", result.error);
}

/** 16 random characters from an alphabet with no visually ambiguous glyphs. */
export function generateTemporaryPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * Creates the real Supabase Auth user behind an account. This is the one
 * step in T6b that no SQL migration can do -- `auth.users` is written
 * through GoTrue's admin API, not a table a migration can insert into
 * safely. Returns the new auth user's id, to be handed straight to
 * `linkAuthUser`.
 */
export async function createAuthUserForAccount(input: {
  email: string;
  temporaryPassword: string;
  accountId: string;
}): Promise<string> {
  const client = createAdminClient();
  const result = await client.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
    user_metadata: { erp_account_id: input.accountId },
  });
  if (result.error || !result.data.user) {
    const alreadyRegistered = result.error?.message
      ?.toLowerCase()
      .includes("already been registered");
    throw new AccountRegistryError(
      alreadyRegistered
        ? "Email này đã được dùng cho một tài khoản đăng nhập khác."
        : "Không tạo được tài khoản đăng nhập trên Supabase Auth.",
      { cause: result.error ?? undefined },
    );
  }
  return result.data.user.id;
}

export async function linkAuthUser(input: {
  actorAccountId: string;
  accountId: string;
  authUserId: string;
  email: string;
}) {
  if (readMode() !== "supabase") {
    throw new AccountRegistryError(
      "Chế độ demo cục bộ không liên kết được đăng nhập thật. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_admin_link_auth_user", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_account_id: input.accountId,
    p_auth_user_id: input.authUserId,
    p_email: input.email,
  });
  if (result.error) throw registryError("liên kết đăng nhập", result.error);
}

/**
 * Called after `supabase.auth.updateUser({ password })` succeeds for the
 * signed-in session itself -- never on behalf of another account. The RPC
 * re-derives which registry row that is from the auth user id, so there is
 * no account id here for a caller to get wrong or spoof.
 */
export async function confirmPasswordChanged(authUserId: string) {
  const client = createAdminClient();
  const result = await client.rpc("erp_confirm_password_changed", {
    p_tenant_id: TENANT_ID,
    p_auth_user_id: authUserId,
  });
  if (result.error) {
    throw registryError("xác nhận đổi mật khẩu", result.error);
  }
}
