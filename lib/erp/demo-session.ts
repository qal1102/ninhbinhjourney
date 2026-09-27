import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { type ErpModuleId, type ErpSiteId } from "@/domain/erp";
import { canAccountSignIn } from "@/domain/erp-account-roles";
import { tinhQuyenHieuLuc, vaiTuPhieuCap } from "@/domain/quyen-hieu-luc";
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
  type ErpRegistryAccount,
} from "./account-registry-repository";
import { dungTaiKhoanHieuLuc, type TaiKhoanHieuLuc } from "./tai-khoan-hieu-luc";

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

/**
 * T14b — danh tính tối thiểu để đổi phiên và ghi nhật ký, tra ở **cả hai** kho.
 *
 * Trước đây mọi bước của tính năng xem thử đều đi qua `findDemoErpAccountById`,
 * nên một tài khoản do giám đốc tạo trên `/erp/tai-khoan` sẽ bị từ chối với
 * "Không tìm thấy tài khoản để xem thử" — kể cả khi nó đã hiện trong danh sách
 * chọn. Danh sách và hành động phải nhìn cùng một nguồn, nếu không màn hình chỉ
 * là hình vẽ.
 *
 * Không nới quyền: tài khoản không đăng nhập được (`suspended`/`revoked`) hoặc
 * không giữ vai trò nghiệp vụ nào đều trả `null` như trước.
 */
type SwitchIdentity = {
  id: string;
  name: string;
  role: DemoErpAccount["role"];
};

async function resolveSwitchIdentity(
  accountId: string | undefined,
): Promise<SwitchIdentity | null> {
  if (!accountId) return null;
  const demo = findDemoErpAccountById(accountId);
  if (demo) return { id: demo.id, name: demo.name, role: demo.role };
  const registry = await getRegistryAccount(accountId).catch(() => null);
  if (!registry || !canAccountSignIn(registry.status)) return null;
  const role = vaiTuPhieuCap(registry.grants);
  if (!role) return null;
  return { id: registry.accountId, name: registry.displayName, role };
}

async function resolveActingAs(
  directorAccountId: string | undefined,
): Promise<CurrentErpUser["actingAs"]> {
  const director = await resolveSwitchIdentity(directorAccountId);
  return director
    ? { directorId: director.id, directorName: director.name }
    : undefined;
}

/**
 * Dựng người dùng hiện hành từ một tài khoản đã tính quyền. Mọi phiên đều qua
 * đây, dù đăng nhập bằng email (Supabase Auth) hay bằng tài khoản mẫu, nên
 * cấp hay thu hồi vai trên màn Tài khoản & phân quyền có hiệu lực ngay ở lượt
 * tải trang kế tiếp của người đó. Luật quyền nằm ở `domain/quyen-hieu-luc.ts`.
 */
function nguoiDungTu(
  taiKhoan: TaiKhoanHieuLuc,
  opts: { authUserId?: string; actingAs?: CurrentErpUser["actingAs"] },
): CurrentErpUser {
  const { quyen, demo, registry } = taiKhoan;
  const quanLyCoSo = taiKhoan.role === "director" || taiKhoan.role === "manager";
  return {
    id: taiKhoan.id,
    username: demo?.username ?? registry.accountId,
    usernameAliases: demo?.usernameAliases,
    name: taiKhoan.name,
    role: taiKhoan.role,
    jobTitle: taiKhoan.jobTitle,
    initialSiteIds: quyen.siteIds,
    managedSiteIds: quanLyCoSo ? quyen.siteIds : [],
    initialModuleIds: demo?.initialModuleIds ?? [],
    workforceProfile: demo?.workforceProfile,
    siteIds: quyen.siteIds,
    moduleIdsBySite: quyen.moduleIdsBySite,
    actingAs: opts.actingAs,
    // Xem thử thì không được bắt đổi mật khẩu: đó là mật khẩu của người khác.
    mustChangePassword: opts.authUserId ? registry.mustChangePassword : false,
    authUserId: opts.authUserId,
  };
}

/**
 * Sổ tài khoản không đọc được thì lùi về hồ sơ mẫu, cùng một luật quyền, để
 * một lần kho chập chờn không khoá cả công ty ngoài cửa. Chỉ tài khoản mẫu có
 * đường lùi này; người tạo mới chỉ có trong sổ nên lúc ấy chờ kho trả lời.
 */
async function nguoiDungMauDuPhong(
  demo: DemoErpAccount,
  actingAs: CurrentErpUser["actingAs"],
): Promise<CurrentErpUser> {
  const access = await getAccessState().catch(() => ({ employees: {} as Record<string, { moduleIdsBySite: Partial<Record<ErpSiteId, ErpModuleId[]>> }> }));
  const quyen = tinhQuyenHieuLuc({
    role: demo.role,
    coSoDuocCap: demo.role === "manager" ? demo.managedSiteIds : demo.initialSiteIds,
    viecDaGiao: demo.role === "employee" ? access.employees[demo.id]?.moduleIdsBySite : undefined,
    conHieuLuc: isDemoErpAccountActive(demo),
  });
  return {
    id: demo.id,
    username: demo.username,
    usernameAliases: demo.usernameAliases,
    name: demo.name,
    role: demo.role,
    jobTitle: demo.jobTitle,
    initialSiteIds: demo.initialSiteIds,
    managedSiteIds: demo.managedSiteIds,
    initialModuleIds: demo.initialModuleIds,
    workforceProfile: demo.workforceProfile,
    siteIds: quyen.siteIds,
    moduleIdsBySite: quyen.moduleIdsBySite,
    actingAs,
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

export async function getCurrentErpUser(): Promise<CurrentErpUser | null> {
  // T6b: một tài khoản đã gắn Supabase Auth thì đăng nhập bằng lối ấy. Xét
  // trước và theo luật riêng: phiên Auth không khớp tài khoản đang hoạt động
  // nào thì KHÔNG rơi xuống cookie mẫu bên dưới, kẻo người lạ dùng chung trình
  // duyệt thừa hưởng danh tính cookie đang giữ.
  const authUser = await getSupabaseAuthUser();
  if (authUser) {
    const registryAccount = await getRegistryAccountByAuthUserId(authUser.id).catch(
      () => null,
    );
    if (!registryAccount || !canAccountSignIn(registryAccount.status)) return null;
    const taiKhoan = dungTaiKhoanHieuLuc(registryAccount, await getAccessState());
    return taiKhoan ? nguoiDungTu(taiKhoan, { authUserId: authUser.id }) : null;
  }

  const store = await cookies();
  const session = decodeSigned<SessionPayload>(store.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt <= Date.now()) return null;
  const actingAs = await resolveActingAs(session.actingAsFor);

  let registry: ErpRegistryAccount | null | undefined;
  try {
    registry = await getRegistryAccount(session.userId);
  } catch {
    registry = undefined;
  }
  if (registry) {
    // Khoá tài khoản phải có hiệu lực ở mọi lượt tải trang, không chỉ ở cửa
    // đăng nhập, kẻo người bị khoá làm tiếp tới khi cookie hết hạn.
    if (!canAccountSignIn(registry.status)) return null;
    const taiKhoan = dungTaiKhoanHieuLuc(registry, await getAccessState());
    return taiKhoan ? nguoiDungTu(taiKhoan, { actingAs }) : null;
  }
  // Không đọc được sổ, hoặc sổ chưa có dòng của tài khoản mẫu này.
  const demo = findDemoErpAccountById(session.userId);
  return demo ? nguoiDungMauDuPhong(demo, actingAs) : null;
}

export function isRoleSwitchEnabled() {
  return process.env.ERP_DEMO_ROLE_SWITCH === "true";
}

export type RoleSwitchResult = {
  director: SwitchIdentity;
  target: SwitchIdentity;
  /** The account being viewed before this switch, when hopping role to role. */
  previous: SwitchIdentity | null;
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
  const director = await resolveSwitchIdentity(session.actingAsFor ?? session.userId);
  if (!director || director.role !== "director") {
    throw new Error("Chỉ tài khoản giám đốc mới dùng được tính năng này.");
  }
  const previous = session.actingAsFor
    ? await resolveSwitchIdentity(session.userId)
    : null;
  const target = await resolveSwitchIdentity(targetUserId);
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
  const director = await resolveSwitchIdentity(session.actingAsFor);
  const target = await resolveSwitchIdentity(session.userId);
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
