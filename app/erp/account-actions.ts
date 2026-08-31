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
  createAuthUserForAccount,
  generateTemporaryPassword,
  getRegistryAccount,
  hasSystemAdmin,
  linkAuthUser,
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
