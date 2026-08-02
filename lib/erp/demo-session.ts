import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpSiteId,
} from "@/domain/erp";
import { appRoleFromRegistryRole, canAccountSignIn } from "@/domain/erp-account-roles";
import { ERP_ACCOUNTANT_MODULE_IDS } from "@/domain/erp-role-policy";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findDemoErpAccountById,
  isDemoErpAccountActive,
  type DemoErpAccount,
} from "./demo-data";
import { getAccessState } from "./staff-access-repository";
import {
  getRegistryAccount,
  getRegistryAccountByAuthUserId,
  sitesFromGrants,
  type ErpRegistryAccount,
} from "./account-registry-repository";

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
  /**
   * True only for a Supabase Auth session whose registry row still has
   * `must_change_password`. Legacy cookie sessions (T6b not yet reached this
   * account) are never forced -- there is no personal password to change
   * yet. `app/erp/page.tsx` and friends redirect to `/erp/doi-mat-khau`
   * whenever this is true, before anything else renders.
   */
  mustChangePassword?: boolean;
  /** Present only for a session resolved through Supabase Auth (T6b). */
  authUserId?: string;
};

const ROLE_PRECEDENCE: readonly DemoErpAccount["role"][] = [
  "director",
  "chief-accountant",
  "accountant",
  "manager",
  "employee",
];

/**
 * `system-admin` carries no business role of its own (see
 * domain/erp-account-roles.ts), so an account can hold it alongside exactly
 * one of the five below. Precedence only matters for the theoretical case of
 * more than one business grant on the same account; today's data never does
 * that.
 */
function deriveRoleFromGrants(
  account: ErpRegistryAccount,
): DemoErpAccount["role"] | null {
  const roles = new Set(
    account.grants
      .map((grant) => appRoleFromRegistryRole(grant.role))
      .filter((role): role is DemoErpAccount["role"] => role !== null),
  );
  return ROLE_PRECEDENCE.find((role) => roles.has(role)) ?? null;
}

/**
 * Builds a session purely from the registry + grant stores -- no read of
 * `demo-data.ts` at all. This is what makes a director-created account (one
 * that was never hand-written into that file) actually able to sign in and
 * see something: T6/T7 already let a director create the account and grant
 * it sites/modules, but until this function existed, `getCurrentErpUser()`
 * could only resolve an identity that also happened to live in source code.
 */
async function buildCurrentUserFromRegistry(
  account: ErpRegistryAccount,
  authUserId: string,
): Promise<CurrentErpUser | null> {
  const role = deriveRoleFromGrants(account);
  if (!role) return null;

  const grantedSites = sitesFromGrants(account);
  const base = {
    id: account.accountId,
    username: account.email ?? account.accountId,
    name: account.displayName,
    role,
    jobTitle: account.jobTitle,
    initialModuleIds: [] as ErpModuleId[],
    mustChangePassword: account.mustChangePassword,
    authUserId,
  };

  if (role === "director") {
    const allModules = ERP_MODULES.map((module) => module.id);
    return {
      ...base,
      siteIds: ERP_SITES.map((site) => site.id),
      managedSiteIds: ERP_SITES.map((site) => site.id),
      initialSiteIds: ERP_SITES.map((site) => site.id),
      moduleIdsBySite: Object.fromEntries(
        ERP_SITES.map((site) => [site.id, allModules]),
      ) as Record<ErpSiteId, ErpModuleId[]>,
    };
  }

  if (role === "manager" || role === "employee") {
    // Module access is always a grant (`erp_employee_access`), never a
    // default this function invents -- a director must hand out modules
    // explicitly, same as for every account created before T6b.
    const access = (await getAccessState()).employees[account.accountId];
    const siteIds = access?.siteIds.length ? access.siteIds : grantedSites;
    return {
      ...base,
      siteIds,
      // Kept equal to `siteIds` on purpose: `managedSiteIds` is what
      // workflow-actions.ts checks a manager's scope against, and it must
      // reflect the registry grant, not a stale org-chart constant.
      managedSiteIds: siteIds,
      initialSiteIds: siteIds,
      moduleIdsBySite: Object.fromEntries(
        siteIds.map((siteId) => [siteId, access?.moduleIdsBySite[siteId] ?? []]),
      ) as Partial<Record<ErpSiteId, ErpModuleId[]>>,
    };
  }

  // accountant / chief-accountant: cấp toàn vùng theo đúng vai trò, không
  // phải một danh sách module tự bịa.
  return {
    ...base,
    siteIds: grantedSites,
    managedSiteIds: grantedSites,
    initialSiteIds: grantedSites,
    moduleIdsBySite: Object.fromEntries(
      grantedSites.map((siteId) => [siteId, [...ERP_ACCOUNTANT_MODULE_IDS]]),
    ) as Partial<Record<ErpSiteId, ErpModuleId[]>>,
  };
}

/**
 * A missing/misconfigured Supabase environment or an anonymous request must
 * read as "no Auth session", not as an error -- that is exactly the signal
 * that falls through to the legacy cookie path below.
 */
async function getSupabaseAuthUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

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
    // Must cover both /erp/** (pages/actions) and /api/erp/** (the
    // assistant route) -- a cookie path of "/erp" does NOT match
    // "/api/erp/assistant" per RFC 6265 path-matching (the request path
    // has to start with the cookie path as a literal prefix; "/api/..."
    // does not start with "/erp"). Found by prod Playwright verification:
    // the bell and voice assistant were silently sending zero cookies to
    // their own API route and always falling back to the loading-failed
    // state.
    path: "/",
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

/**
 * T6. `erp_account_registry.status` is the switch that lets somebody be locked
 * out without a deploy. A registry that cannot be read must not lock everyone
 * out, so an unreachable store falls through to "allowed" — the same posture
 * every other read in this file takes, and the reason suspension is enforced
 * again inside the RPCs rather than only here.
 */
async function isRegistryAccountAllowedIn(accountId: string): Promise<boolean> {
  try {
    const account = await getRegistryAccount(accountId);
    if (!account) return true;
    return account.status === "active";
  } catch {
    return true;
  }
}

/**
 * T7 lets the registry decide which sites a manager runs. That is only safe
 * once migrations 025 and 027 have actually been applied: before 025 the
 * registry still holds the pre-V12 org chart, where one manager carried
 * `regional-manager` on all four sites, and obeying it would silently widen
 * that account's scope rather than narrow it.
 *
 * So the switch is explicit. Deploy the code, apply the migrations, then set
 * ERP_REGISTRY_SITE_SCOPE=true. Stopping between any two of those steps leaves
 * a working system, which is the rule this project broke last time.
 */
function isRegistrySiteScopeEnabled() {
  return process.env.ERP_REGISTRY_SITE_SCOPE === "true";
}

/** Sites the registry grants this account, empty when it cannot say. */
async function sitesForAccount(accountId: string): Promise<ErpSiteId[]> {
  if (!isRegistrySiteScopeEnabled()) return [];
  try {
    const account = await getRegistryAccount(accountId);
    return account ? sitesFromGrants(account) : [];
  } catch {
    return [];
  }
}

export async function getCurrentErpUser(): Promise<CurrentErpUser | null> {
  // T6b: an account whose registry row is linked to a real Supabase Auth
  // user signs in that way from here on. Checked first, and on its own
  // terms -- a Supabase session that resolves to no active registry account
  // must NOT fall through to the legacy cookie below, or a stranger with a
  // valid Auth session on a shared browser could inherit whatever demo
  // identity that cookie happened to hold.
  const authUser = await getSupabaseAuthUser();
  if (authUser) {
    const registryAccount = await getRegistryAccountByAuthUserId(authUser.id).catch(
      () => null,
    );
    if (!registryAccount || !canAccountSignIn(registryAccount.status)) return null;
    return buildCurrentUserFromRegistry(registryAccount, authUser.id);
  }

  const store = await cookies();
  const session = decodeSigned<SessionPayload>(store.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt <= Date.now()) return null;
  const account = findDemoErpAccountById(session.userId);
  if (!account) return null;
  // T6: suspension has to bite on every request, not only at the login form,
  // or a suspended person keeps working until their cookie expires.
  if (!(await isRegistryAccountAllowedIn(account.id))) return null;
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

  // V14: a manager's site scope still comes from the org chart
  // (`managedSiteIds`), but their modules now come from the same grant store
  // employees use. Before this, managers were handed `ERP_MODULES` outright
  // and the whole permission story only really applied to employees (L13).
  if (account.role === "manager") {
    const managerAccess = (await getAccessState()).employees[account.id];
    // T7: which sites a manager runs is a grant, not a constant. The org chart
    // in demo-data.ts is only the starting point now -- a director widening
    // someone's scope adds a row, and that row has to be what the app obeys,
    // or the account-management screen would be theatre.
    const grantedSites = await sitesForAccount(account.id);
    const siteIds = grantedSites.length
      ? grantedSites
      : [...account.managedSiteIds];
    return {
      ...safeAccount,
      siteIds,
      // Found alongside T6b: this used to stay `account.managedSiteIds` from
      // demo-data.ts even when `siteIds` above had already been widened by a
      // registry grant, so a manager given an extra site through
      // `/erp/tai-khoan` could see it in the nav yet still get
      // "Hồ sơ nằm ngoài cơ sở bạn quản lý" from workflow-actions.ts, which
      // checks `managedSiteIds` specifically. `managedSiteIds` has to mean
      // the same scope `siteIds` does, or the two checks disagree about the
      // same account -- the exact failure mode mục 3 of HANDOFF.md is about.
      managedSiteIds: siteIds,
      moduleIdsBySite: Object.fromEntries(
        siteIds.map((siteId) => [
          siteId,
          managerAccess?.moduleIdsBySite[siteId] ?? [],
        ]),
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
  /** The account being viewed before this switch, when hopping role to role. */
  previous: DemoErpAccount | null;
};

/**
 * Swap the signed session's userId to `targetUserId`, keeping the real
 * director's id in `actingAsFor` so the session can be handed back. This is
 * a genuine session change, not a UI role flag: every existing
 * `accountCanAccessSite`/`accountCanAccessModule` check downstream of
 * `getCurrentErpUser()` applies to the target account exactly as if they
 * had logged in themselves, including being blocked wherever they would
 * normally be blocked. Only callable when `ERP_DEMO_ROLE_SWITCH=true`, and
 * only for a session whose real owner is a director.
 *
 * T4: hopping straight from one role to another is allowed. The old rule --
 * return to the director between every pair -- doubled the clicks in the one
 * activity this feature exists for, comparing what two roles see of the same
 * screen. `actingAsFor` still names the real director throughout, so the
 * session can always be handed back and every hop is still attributable.
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
  // Mid-switch the session's own userId is the impersonated account, so the
  // real owner is whoever `actingAsFor` names.
  const director = findDemoErpAccountById(session.actingAsFor ?? session.userId);
  if (!director || director.role !== "director") {
    throw new Error("Chỉ tài khoản giám đốc mới dùng được tính năng này.");
  }
  const previous = session.actingAsFor
    ? (findDemoErpAccountById(session.userId) ?? null)
    : null;
  const target = findDemoErpAccountById(targetUserId);
  if (!target || target.role === "director") {
    throw new Error("Không tìm thấy tài khoản để xem thử.");
  }
  if (target.id === session.userId) {
    throw new Error("Đang xem đúng tài khoản này rồi.");
  }
  const now = Date.now();
  const payload: SessionPayload = {
    userId: target.id,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
    actingAsFor: director.id,
  };
  store.set(SESSION_COOKIE, encodeSigned(payload), cookieOptions(SESSION_SECONDS));
  return { director, target, previous };
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
  return { director, target, previous: null };
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
