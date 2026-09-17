"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateCode, ACCOUNT_CODE_SHAPE } from "@/domain/auto-code";
import { isErpSiteId } from "@/domain/erp";
import {
  isErpAccountStatus,
  isErpRegistryRole,
} from "@/domain/erp-account-roles";
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
  status: z.enum(["active", "suspended", "revoked"]),
});

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

export async function upsertAccountAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const input = AccountSchema.parse({
      displayName: formData.get("displayName"),
      jobTitle: formData.get("jobTitle"),
      employmentType: formData.get("employmentType"),
      status: formData.get("status"),
    });
    // upsertRegistryAccount ghi đè lặng lẽ nếu trùng mã — vì vậy PHẢI đọc
    // trước toàn bộ mã đang dùng (gồm cả tài khoản đã ngưng/thu hồi,
    // listRegistryAccounts() không lọc trạng thái) rồi mới sinh mã mới.
    // Nếu bước đọc này lỗi, ném ra ngay và dừng ở đây — không được đoán
    // liều một mã rồi lưu, vì đoán sai nghĩa là ghi đè lên một người thật.
    const existingAccounts = await listRegistryAccounts();
    // Nền tảng đọc bảng trả về tối đa 1.000 hàng một lượt. Chạm trần nghĩa là
    // danh sách đã bị cắt bớt, và một mã nằm ở phần bị cắt sẽ trông như còn
    // trống — sinh trúng mã đó là ghi đè lên một người đang đi làm. Chưa tới
    // ngưỡng ấy thì thôi, nhưng tới thì phải dừng và nói ra, đừng đoán.
    if (existingAccounts.length >= 1000) {
      throw new Error(
        "Danh sách tài khoản đã chạm mức đọc tối đa nên chưa chắc đủ. Em chưa dám tự đặt mã lúc này, xin báo lại để đội kỹ thuật nới chỗ đọc.",
      );
    }
    const takenAccountIds = existingAccounts.map((account) => account.accountId);
    const accountId = GeneratedAccountIdSchema.parse(
      generateCode(input.displayName, takenAccountIds, ACCOUNT_CODE_SHAPE),
    );
    await upsertRegistryAccount({ actorAccountId: actor.id, accountId, ...input });
    revalidateAccounts();
    return {
      status: "success",
      message: `Đã tạo tài khoản cho ${input.displayName}, mã đăng nhập nội bộ là ${accountId}.`,
    };
  } catch (error) {
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
    // An empty site means "toàn vùng" — the registry's own null-site grant,
    // which is how accounting and the director are scoped.
    const siteId = siteValue === "" ? null : siteValue;
    if (siteId !== null && !isErpSiteId(siteId)) {
      throw new Error("Cơ sở không hợp lệ.");
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

const GrantLoginSchema = z.object({
  accountId: z.string().trim().min(2).max(100),
  email: z.string().trim().email("Email không hợp lệ."),
});

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
export async function grantLoginAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const input = GrantLoginSchema.parse({
      accountId: formData.get("accountId"),
      email: formData.get("email"),
    });
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

    revalidateAccounts();
    return {
      status: "success",
      message: `Đã cấp đăng nhập cho ${input.accountId}. Gửi mật khẩu tạm dưới đây riêng cho người này qua kênh khác; họ phải đổi mật khẩu ngay lần đăng nhập đầu tiên.`,
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
