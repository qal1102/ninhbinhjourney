"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId } from "@/domain/erp";
import {
  isErpAccountStatus,
  isErpRegistryRole,
} from "@/domain/erp-account-roles";
import {
  AccountRegistryError,
  createAuthUserForAccount,
  generateTemporaryPassword,
  getRegistryAccount,
  hasSystemAdmin,
  linkAuthUser,
  setRegistryAccountStatus,
  setRegistryRoleAssignment,
  upsertRegistryAccount,
} from "@/lib/erp/account-registry-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = {
  status: "idle",
  message: "",
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
  accountId: z
    .string()
    .trim()
    .min(2, "Mã tài khoản phải có ít nhất 2 ký tự.")
    .max(100, "Mã tài khoản quá dài.")
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      "Mã tài khoản chỉ dùng chữ thường, số và dấu gạch ngang.",
    ),
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

export async function upsertAccountAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireSystemAdmin();
    const input = AccountSchema.parse({
      accountId: formData.get("accountId"),
      displayName: formData.get("displayName"),
      jobTitle: formData.get("jobTitle"),
      employmentType: formData.get("employmentType"),
      status: formData.get("status"),
    });
    await upsertRegistryAccount({ actorAccountId: actor.id, ...input });
    revalidateAccounts();
    return {
      status: "success",
      message: `Đã lưu tài khoản ${input.accountId}.`,
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
 * one-time temporary password in the success message for the system-admin
 * to relay out of band. There is no email delivery here on purpose: this
 * project has no transactional-email sender, and bolting one on to mail a
 * password is a bigger, separate decision than this action should make.
 * Whoever holds the temporary password must change it before doing anything
 * else -- enforced by `must_change_password` and the `/erp/doi-mat-khau`
 * redirect, not by convention.
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
    const authUserId = await createAuthUserForAccount({
      accountId: input.accountId,
      email: input.email,
      temporaryPassword,
    });
    await linkAuthUser({
      actorAccountId: actor.id,
      accountId: input.accountId,
      authUserId,
      email: input.email,
    });
    revalidateAccounts();
    return {
      status: "success",
      message: `Đã cấp đăng nhập cho ${input.accountId}. Mật khẩu tạm (chỉ hiện một lần, hãy sao chép ngay): ${temporaryPassword} — gửi riêng cho người này qua kênh khác, không dán vào đây. Họ bắt buộc phải đổi mật khẩu ngay lần đăng nhập đầu tiên.`,
    };
  } catch (error) {
    return errorState(error);
  }
}
