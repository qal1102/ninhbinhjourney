"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateCode, ACCOUNT_CODE_SHAPE } from "@/domain/auto-code";
import { isErpSiteId } from "@/domain/erp";
import {
  appRoleFromRegistryRole,
  ERP_REGISTRY_ROLE_LABELS,
  isErpAccountStatus,
  isErpRegistryRole,
  type ErpRegistryRole,
} from "@/domain/erp-account-roles";
import { vaiCanCoSo } from "@/domain/quyen-hieu-luc";
import type { ErpSiteId } from "@/domain/erp";
import {
  AccountRegistryError,
  AuthEmailAlreadyRegisteredError,
  createAuthUserForAccount,
  deleteAuthUser,
  findLoginByEmail,
  generateTemporaryPassword,
  getLinkedAuthUserId,
  getRegistryAccount,
  hasSystemAdmin,
  linkAuthUser,
  markLoginPasswordReset,
  setAuthUserPassword,
  unlinkAuthUser,
  listRegistryAccounts,
  setRegistryAccountStatus,
  setRegistryRoleAssignment,
  upsertRegistryAccount,
} from "@/lib/erp/account-registry-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

// Not exported: a "use server" file may only export async functions. This
// object export was undetected locally because /erp/tai-khoan's own build
// happened not to trip the check, but ModuleWorkspace imports every module's
// workspace component unconditionally, so account-administration.tsx (and
// this file behind it) ends up bundled into the SAME server-action chunk as
// every other ERP module -- including ones with no relation to accounts at
// all. A crash here surfaces as "A 'use server' file can only export async
// functions" on any POST from any module page, not just this one. See
// app/erp/actions.ts for where this pattern first broke `next build`
// locally; this instance only broke at runtime on production, because the
// bad chunk is resolved lazily when an action actually gets invoked.
type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
  /**
   * One-time temporary password, kept out of `message` so the screen can hide
   * it once copied (A15-ACC-01, audit TK-05). It still travels once in this
   * action's response: there is no out-of-band channel to send it through.
   */
  temporaryPassword?: string;
};

/**
 * Every action here re-checks `system-admin` against the registry rather than
 * trusting the session's role. Creating accounts and granting roles is the one
 * power that can manufacture every other power, so the check has to read the
 * same source the database RPCs read — which enforce it a second time, on
 * purpose.
 */
async function requireSystemAdmin() {
  const user = await getCurrentErpUser();
  if (!user) throw new AccountRegistryError("Phiên đăng nhập đã hết hạn.");
  const registryAccount = await getRegistryAccount(user.id);
  if (!hasSystemAdmin(registryAccount)) {
    throw new AccountRegistryError(
      "Chỉ tài khoản có quyền quản trị hệ thống mới thao tác được ở đây.",
    );
  }
  return user;
}

function errorState(error: unknown): AccountActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Không thể xử lý yêu cầu lúc này." };
}

function revalidateAccounts() {
  revalidatePath("/erp");
  revalidatePath("/erp/tai-khoan");
}

const AccountSchema = z.object({
  displayName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự.").max(120),
  jobTitle: z.string().trim().min(2, "Chức danh phải có ít nhất 2 ký tự.").max(160),
  employmentType: z.enum([
    "permanent",
    "seasonal",
    "management",
    "finance",
    "executive",
  ]),
});

const VAI_NGHIEP_VU = ["employee", "regional-manager", "accountant-maker", "accounting-checker", "director"] as const;

/**
 * Vai nào phải gắn một cơ sở, vai nào chỉ cấp toàn vùng. Trước 28/09 màn hình
 * nhận mọi kiểu ghép, kể cả "Nhân viên · Toàn vùng" (một nhân viên thấy cả bốn
 * cơ sở) hay "Giám đốc · Tam Cốc".
 */
function kiemVaiVaCoSo(role: ErpRegistryRole, siteId: ErpSiteId | null) {
  const can = vaiCanCoSo(role);
  if (can === "bat-buoc" && siteId === null) {
    throw new AccountRegistryError(`Vai ${ERP_REGISTRY_ROLE_LABELS[role]} phải chọn một cơ sở cụ thể.`);
  }
  if (can === "toan-vung" && siteId !== null) {
    throw new AccountRegistryError(`Vai ${ERP_REGISTRY_ROLE_LABELS[role]} chỉ cấp toàn vùng.`);
  }
}

function docCoSo(value: FormDataEntryValue | null): ErpSiteId | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  if (!isErpSiteId(text)) throw new AccountRegistryError("Cơ sở không hợp lệ.");
  return text;
}

/**
 * Email đăng nhập. Để trống thì dùng một địa chỉ nội bộ theo mã tài khoản:
 * người ấy đăng nhập bằng chính mã tài khoản, không ai phải có email công ty.
 * Supabase Auth tạo người dùng với `email_confirm: true` nên không có thư nào
 * được gửi tới địa chỉ này.
 */
function emailDangNhap(accountId: string, email: FormDataEntryValue | null): string {
  const text = String(email ?? "").trim();
  if (text === "") return `${accountId}@taikhoan.ninhbinhjourney.vn`;
  const parsed = z.string().email("Email không hợp lệ.").safeParse(text);
  if (!parsed.success) throw new AccountRegistryError("Email không hợp lệ.");
  return parsed.data.toLowerCase();
}

// Mã tài khoản chỉ do máy sinh (xem domain/auto-code.ts), không còn ô nhập
// tay nào cho nó — nhưng vẫn chốt lại đúng ràng buộc cũ ở đây, phòng khi
// generateCode có sinh lệch (ví dụ shape bị đổi sai ở một chỗ khác) thì lỗi
// hiện ra ngay, chứ không âm thầm lưu một mã sai định dạng xuống kho.
const GeneratedAccountIdSchema = z
  .string()
  .min(2, "Mã tài khoản phải có ít nhất 2 ký tự.")
  .max(100, "Mã tài khoản quá dài.")
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "Mã tài khoản chỉ dùng chữ thường, số và dấu gạch ngang.",
  );

/**
 * Tạo tài khoản trong một bước: hồ sơ, vai, cơ sở, đăng nhập. Trước 28/09 là
 * ba bước ở ba chỗ, và tài khoản tạo xong nằm đó "chưa cấp vai trò nào, chưa
 * đăng nhập được" cho tới khi ai đó nhớ làm nốt.
 *
 * Ba bước ghi vào hai hệ thống, không chung một giao dịch được. Hỏng giữa
 * chừng thì nói rõ bước nào xong, bước nào chưa; tài khoản đã tạo vẫn nằm
 * trong danh sách để làm nốt bước còn lại ở thẻ của người đó.
 */
export async function upsertAccountAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  let accountId = "";
  let buoc = "tạo tài khoản";
  try {
    const actor = await requireSystemAdmin();
    const input = AccountSchema.parse({
      displayName: formData.get("displayName"),
      jobTitle: formData.get("jobTitle"),
      employmentType: formData.get("employmentType"),
    });
    const role = String(formData.get("role") ?? "");
    if (!(VAI_NGHIEP_VU as readonly string[]).includes(role)) {
      throw new AccountRegistryError("Chọn vai trò cho người này.");
    }
    const vai = role as (typeof VAI_NGHIEP_VU)[number];
    const siteId = docCoSo(formData.get("siteId"));
    kiemVaiVaCoSo(vai, siteId);

    // upsertRegistryAccount ghi đè lặng lẽ nếu trùng mã — vì vậy PHẢI đọc
    // trước toàn bộ mã đang dùng (gồm cả tài khoản đã ngưng/thu hồi) rồi mới
    // sinh mã mới. Đọc hỏng thì dừng, không đoán liều một mã.
    const existingAccounts = await listRegistryAccounts();
    // Chạm trần 1.000 dòng mỗi lượt đọc thì danh sách có thể đã bị cắt; một mã
    // nằm ở phần bị cắt trông như còn trống. Dừng và nói ra, đừng đoán.
    if (existingAccounts.length >= 1000) {
      throw new Error(
        "Danh sách tài khoản đã chạm mức đọc tối đa nên chưa chắc đủ. Chưa tự đặt mã được lúc này, xin báo đội kỹ thuật.",
      );
    }
    accountId = GeneratedAccountIdSchema.parse(
      generateCode(input.displayName, existingAccounts.map((account) => account.accountId), ACCOUNT_CODE_SHAPE),
    );
    const email = emailDangNhap(accountId, formData.get("email"));
    await upsertRegistryAccount({ actorAccountId: actor.id, accountId, ...input, status: "active" });

    buoc = "cấp vai trò";
    await setRegistryRoleAssignment({ actorAccountId: actor.id, accountId, role: vai, siteId, active: true });

    buoc = "cấp đăng nhập";
    const temporaryPassword = await capDangNhap(actor.id, accountId, email);

    revalidateAccounts();
    return {
      status: "success",
      message: `Đã tạo tài khoản cho ${input.displayName}. Tên đăng nhập: ${accountId}. Gửi mật khẩu tạm dưới đây riêng cho người này; họ đổi mật khẩu ngay lần đăng nhập đầu tiên.`,
      temporaryPassword,
    };
  } catch (error) {
    if (accountId && buoc !== "tạo tài khoản") {
      revalidateAccounts();
      const loi = errorState(error).message;
      return {
        status: "error",
        message: `Đã tạo tài khoản ${accountId} nhưng chưa ${buoc} được: ${loi} Mời bạn làm nốt ở thẻ của người này bên dưới.`,
      };
    }
    return errorState(error);
  }
}

export async function setAccountStatusAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const accountId = String(formData.get("accountId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!accountId || !isErpAccountStatus(status)) {
      throw new Error("Trạng thái tài khoản không hợp lệ.");
    }
    await setRegistryAccountStatus({
      actorAccountId: actor.id,
      accountId,
      status,
    });
    revalidateAccounts();
    return {
      status: "success",
      message:
        status === "active"
          ? `Đã mở lại tài khoản ${accountId}.`
          : `Đã khoá tài khoản ${accountId}.`,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function setRoleAssignmentAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const accountId = String(formData.get("accountId") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const siteValue = String(formData.get("siteId") ?? "").trim();
    const active = String(formData.get("active") ?? "") === "true";
    if (!accountId || !isErpRegistryRole(role)) {
      throw new Error("Vai trò không hợp lệ.");
    }
    // Ô trống là "toàn vùng" — cách sổ tài khoản ghi quyền kế toán và giám đốc.
    const siteId = docCoSo(siteValue);
    if (active) {
      kiemVaiVaCoSo(role, siteId);
      // Một người chỉ giữ một vai nghiệp vụ. Cấp thêm vai thứ hai thì vai rộng
      // hơn lặng lẽ thắng, và màn hình nói một đằng quyền chạy một nẻo.
      if (appRoleFromRegistryRole(role) !== null) {
        const target = await getRegistryAccount(accountId);
        const vaiKhac = target?.grants.find(
          (grant) => grant.role !== role && appRoleFromRegistryRole(grant.role) !== null,
        );
        if (vaiKhac) {
          throw new AccountRegistryError(
            `${accountId} đang giữ vai ${ERP_REGISTRY_ROLE_LABELS[vaiKhac.role]}. Thu hồi vai ấy trước rồi mới cấp vai mới.`,
          );
        }
      }
    } else if (accountId === actor.id && role === "director") {
      throw new AccountRegistryError("Không tự thu hồi vai Giám đốc của chính mình được.");
    }
    await setRegistryRoleAssignment({
      actorAccountId: actor.id,
      accountId,
      role,
      siteId,
      active,
    });
    revalidateAccounts();
    return {
      status: "success",
      message: active
        ? `Đã cấp vai trò cho ${accountId}.`
        : `Đã thu hồi vai trò của ${accountId}.`,
    };
  } catch (error) {
    return errorState(error);
  }
}


/**
 * T6b: the one step that turns a registry row into an account someone can
 * actually sign into. Creates the real `auth.users` row (only the Supabase
 * Auth admin API can do that -- no migration can), links it, and returns a
 * one-time temporary password for the system-admin to relay out of band.
 * There is no email delivery here on purpose: this project has no
 * transactional-email sender, and bolting one on to mail a password is a
 * bigger, separate decision than this action should make. Whoever holds the
 * temporary password must change it before doing anything else -- enforced by
 * `must_change_password` and the `/erp/doi-mat-khau` redirect.
 *
 * A15-ACC-01 (audit 15/09/2026, TK-01/TK-02): the two steps live in two
 * systems and cannot share a transaction, so each failure has a way back.
 * - Linking fails after this call created the Auth user: that user is
 *   deleted again before the error is shown.
 * - Auth already has this email: look it up instead of guessing. An orphan
 *   this ERP created earlier (a grant that died between the two steps, or a
 *   cleanup that failed) is reused with a fresh password; an email already
 *   wired to this or another account gets a message that says which; an Auth
 *   user this ERP never created is left alone.
 */
async function capDangNhap(actorId: string, accountId: string, email: string): Promise<string> {
  const input = { accountId, email };
  const actor = { id: actorId };
  const temporaryPassword = generateTemporaryPassword();
  let authUserId: string;
  let createdHere = false;
  try {
    authUserId = await createAuthUserForAccount({
      accountId: input.accountId,
      email: input.email,
      temporaryPassword,
    });
    createdHere = true;
  } catch (error) {
    if (!(error instanceof AuthEmailAlreadyRegisteredError)) throw error;
    const existing = await findLoginByEmail({ actorAccountId: actor.id, email: input.email });
    if (!existing) throw error;
    if (existing.linkedAccountId === input.accountId) {
      throw new AccountRegistryError(
        "Email này đã là email đăng nhập của chính tài khoản này. Cần mật khẩu mới thì bấm “Cấp lại mật khẩu tạm”.",
      );
    }
    if (existing.linkedAccountId) {
      throw new AccountRegistryError(
        `Email này đang dùng để đăng nhập cho tài khoản ${existing.linkedAccountId}. Chọn email khác, hoặc gỡ đăng nhập ở tài khoản đó trước.`,
      );
    }
    if (!existing.createdForAccountId) {
      // Not created by this ERP: never take over an Auth user it does not own.
      throw new AccountRegistryError(
        "Email này đã có người dùng đăng nhập không do hệ thống quản lý tạo ra. Chọn email khác, hoặc nhờ người quản trị Supabase kiểm tra trước.",
      );
    }
    await setAuthUserPassword(existing.authUserId, temporaryPassword);
    authUserId = existing.authUserId;
  }

  try {
    await linkAuthUser({
      actorAccountId: actor.id,
      accountId: input.accountId,
      authUserId,
      email: input.email,
    });
  } catch (error) {
    if (createdHere) {
      try {
        await deleteAuthUser(authUserId);
      } catch (cleanupError) {
        // Left as an orphan; the next grant with this email reuses it.
        console.error("Grant login: could not delete the Auth user after a failed link", cleanupError);
      }
    }
    throw error;
  }
  return temporaryPassword;
}

export async function grantLoginAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const { accountId } = AccountIdSchema.parse({ accountId: formData.get("accountId") });
    const email = emailDangNhap(accountId, formData.get("email"));
    const temporaryPassword = await capDangNhap(actor.id, accountId, email);
    revalidateAccounts();
    return {
      status: "success",
      message: `Đã cấp đăng nhập cho ${accountId}. Tên đăng nhập: ${accountId}. Gửi mật khẩu tạm dưới đây riêng cho người này; họ phải đổi mật khẩu ngay lần đăng nhập đầu tiên.`,
      temporaryPassword,
    };
  } catch (error) {
    return errorState(error);
  }
}

const AccountIdSchema = z.object({
  accountId: z.string().trim().min(2).max(100),
});

/**
 * A15-ACC-01 (audit TK-04): a temporary password lost before it was copied
 * used to mean deleting the Auth user by hand. Auth changes the password
 * first; only then does the registry raise the forced-change flag and write
 * the audit line. If Auth fails, nothing claims a reset happened; if the
 * registry step fails, the new password is known to nobody and pressing the
 * button again finishes the job.
 */
export async function resetLoginPasswordAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const { accountId } = AccountIdSchema.parse({ accountId: formData.get("accountId") });
    if (accountId === actor.id) {
      throw new AccountRegistryError(
        "Mật khẩu của chính bạn đổi ở trang Đổi mật khẩu, không cấp lại ở đây.",
      );
    }
    const authUserId = await getLinkedAuthUserId(accountId);
    if (!authUserId) {
      throw new AccountRegistryError(
        "Tài khoản này chưa được cấp đăng nhập — bấm “Cấp đăng nhập” trước.",
      );
    }
    const temporaryPassword = generateTemporaryPassword();
    await setAuthUserPassword(authUserId, temporaryPassword);
    try {
      await markLoginPasswordReset({ actorAccountId: actor.id, accountId });
    } catch (error) {
      throw new AccountRegistryError(
        "Mật khẩu đã đổi bên Supabase Auth nhưng hệ thống chưa ghi nhận xong, và mật khẩu mới chưa hiện cho ai. Bấm “Cấp lại mật khẩu tạm” thêm một lần.",
        { cause: error },
      );
    }
    revalidateAccounts();
    return {
      status: "success",
      message: `Đã cấp lại mật khẩu tạm cho ${accountId}. Mật khẩu cũ không dùng được nữa; người này phải đổi mật khẩu ngay lần đăng nhập tới.`,
      temporaryPassword,
    };
  } catch (error) {
    return errorState(error);
  }
}

/**
 * A15-ACC-01 (audit TK-03): release a login from the screen instead of from
 * the Supabase dashboard. The registry lets go first, so the person loses ERP
 * access immediately even if deleting the Auth user then fails; that leftover
 * is reported, and a later grant with the same email reuses it.
 */
export async function unlinkLoginAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const { accountId } = AccountIdSchema.parse({ accountId: formData.get("accountId") });
    if (formData.get("confirm") !== "yes") {
      throw new AccountRegistryError("Đánh dấu ô xác nhận trước khi gỡ đăng nhập.");
    }
    if (accountId === actor.id) {
      throw new AccountRegistryError(
        "Không tự gỡ đăng nhập của chính mình được — sẽ không còn đường vào lại.",
      );
    }
    const authUserId = await unlinkAuthUser({ actorAccountId: actor.id, accountId });
    revalidateAccounts();
    try {
      await deleteAuthUser(authUserId);
    } catch (error) {
      console.error("Unlink login: registry released but the Auth user was not deleted", error);
      return {
        status: "success",
        message: `Đã gỡ đăng nhập của ${accountId}: người này không vào hệ thống được nữa. Bản ghi bên Supabase Auth chưa xoá được; sau này cấp lại cùng email, hệ thống tự dùng lại bản ghi đó.`,
      };
    }
    return {
      status: "success",
      message: `Đã gỡ đăng nhập của ${accountId} và xoá người dùng bên Supabase Auth. Email cũ dùng lại được để cấp đăng nhập mới.`,
    };
  } catch (error) {
    return errorState(error);
  }
}
