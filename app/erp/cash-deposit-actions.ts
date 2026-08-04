"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId, type ErpSiteId } from "@/domain/erp";
import type { CashDeposit } from "@/domain/erp-cash-deposit";
import { hasErpCapability } from "@/domain/erp-role-policy";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
  type CurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  CashDepositRepositoryConfigurationError,
  CashDepositRepositoryConflictError,
  CashDepositRepositoryError,
  decideCashException,
  matchCashDeposit,
  recordBankStatementLine,
  reviewCashDepositJournal,
  submitCashDeposit,
} from "@/lib/erp/cash-deposit-repository";

export type CashDepositActionState = {
  status: "idle" | "success" | "error";
  message: string;
  record?: CashDeposit;
};

const IdSchema = z.uuid("Mã hồ sơ không hợp lệ.");
const VersionSchema = z.coerce
  .number()
  .int("Phiên bản hồ sơ không hợp lệ.")
  .min(1, "Phiên bản hồ sơ không hợp lệ.");
const MoneySchema = z.coerce
  .number()
  .int("Số tiền phải là số nguyên.")
  .min(1, "Số tiền phải lớn hơn 0.")
  .max(1_000_000_000_000, "Số tiền vượt giới hạn của hệ thống.");
const TextSchema = (label: string, min = 2, max = 200) =>
  z
    .string()
    .trim()
    .min(min, `${label} phải có ít nhất ${min} ký tự.`)
    .max(max, `${label} không được vượt quá ${max} ký tự.`);
const NoteSchema = TextSchema("Nội dung xử lý", 4, 2_000);
const DateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD.");
const SiteIdSchema = z.string().refine(isErpSiteId, "Cơ sở không hợp lệ.");

function errorState(error: unknown): CashDepositActionState {
  if (error instanceof CashDepositRepositoryConfigurationError) {
    return {
      status: "error",
      message:
        "Đối soát tiền mặt chưa được cấu hình đủ trên máy chủ. Vui lòng báo bộ phận hệ thống.",
    };
  }
  if (error instanceof CashDepositRepositoryConflictError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof CashDepositRepositoryError) {
    console.error("Cash deposit persistence failed", {
      name: error.name,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "Kho đối soát tiền mặt chưa phản hồi đầy đủ. Vui lòng thử lại; nếu lỗi lặp lại, báo bộ phận hệ thống.",
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof Error) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Không thể xử lý lượt nộp quỹ lúc này." };
}

function requireUser(user: CurrentErpUser | null) {
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  return user;
}

function requireSiteModuleAccess(user: CurrentErpUser, siteId: ErpSiteId) {
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "tai-chinh-doi-soat")
  ) {
    throw new Error(
      "Bạn không được phân quyền nghiệp vụ tài chính & đối soát tại cơ sở này.",
    );
  }
}

function requireCapability(
  user: CurrentErpUser,
  capability: "cash.deposit.submit" | "cash.exception.decide" | "cash.deposit.review",
) {
  if (!hasErpCapability(user.role, capability)) {
    throw new Error("Tài khoản không có quyền thực hiện bước nghiệp vụ này.");
  }
}

function revalidateCashDeposits(siteId: ErpSiteId) {
  revalidatePath("/erp");
  revalidatePath("/erp/finance");
  revalidatePath(`/erp/${siteId}`);
}

export async function submitCashDepositAction(
  _previous: CashDepositActionState,
  formData: FormData,
): Promise<CashDepositActionState> {
  try {
    const input = z
      .object({
        siteId: SiteIdSchema,
        shiftCloseIds: z
          .string()
          .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
          .pipe(z.array(IdSchema).min(1, "Chọn ít nhất một ca đã chốt.")),
        bankAccountRef: TextSchema("Số tài khoản ngân hàng", 2, 100),
        note: NoteSchema,
      })
      .parse({
        siteId: formData.get("siteId"),
        shiftCloseIds: formData.get("shiftCloseIds"),
        bankAccountRef: formData.get("bankAccountRef"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireSiteModuleAccess(user, input.siteId as ErpSiteId);
    requireCapability(user, "cash.deposit.submit");

    const record = await submitCashDeposit({
      siteId: input.siteId as ErpSiteId,
      shiftCloseIds: input.shiftCloseIds,
      bankAccountRef: input.bankAccountRef,
      note: input.note,
      actorAccountId: user.id,
    });
    revalidateCashDeposits(input.siteId as ErpSiteId);
    return {
      status: "success",
      message: `${record.depositCode} đã ghi nhận, chờ đối khớp với sao kê ngân hàng.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function recordBankStatementLineAction(
  _previous: CashDepositActionState,
  formData: FormData,
): Promise<CashDepositActionState> {
  try {
    const input = z
      .object({
        siteId: SiteIdSchema,
        bankAccountRef: TextSchema("Số tài khoản ngân hàng", 2, 100),
        statementDate: DateSchema,
        amountVnd: MoneySchema,
        description: TextSchema("Nội dung sao kê", 0, 500).optional().default(""),
        externalRef: TextSchema("Mã tham chiếu", 0, 200).optional().default(""),
      })
      .parse({
        siteId: formData.get("siteId"),
        bankAccountRef: formData.get("bankAccountRef"),
        statementDate: formData.get("statementDate"),
        amountVnd: formData.get("amountVnd"),
        description: formData.get("description") ?? "",
        externalRef: formData.get("externalRef") ?? "",
      });
    const user = requireUser(await getCurrentErpUser());
    requireSiteModuleAccess(user, input.siteId as ErpSiteId);
    requireCapability(user, "cash.deposit.submit");

    await recordBankStatementLine({
      siteId: input.siteId as ErpSiteId,
      bankAccountRef: input.bankAccountRef,
      statementDate: input.statementDate,
      amountVnd: input.amountVnd,
      description: input.description,
      externalRef: input.externalRef,
      actorAccountId: user.id,
    });
    revalidateCashDeposits(input.siteId as ErpSiteId);
    return {
      status: "success",
      message: "Đã ghi nhận dòng sao kê ngân hàng, sẵn sàng để đối khớp.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function matchCashDepositAction(
  _previous: CashDepositActionState,
  formData: FormData,
): Promise<CashDepositActionState> {
  try {
    const input = z
      .object({
        siteId: SiteIdSchema,
        depositId: IdSchema,
        expectedDepositVersion: VersionSchema,
        statementLineId: IdSchema,
        expectedLineVersion: VersionSchema,
        note: NoteSchema,
      })
      .parse({
        siteId: formData.get("siteId"),
        depositId: formData.get("depositId"),
        expectedDepositVersion: formData.get("expectedDepositVersion"),
        statementLineId: formData.get("statementLineId"),
        expectedLineVersion: formData.get("expectedLineVersion"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireSiteModuleAccess(user, input.siteId as ErpSiteId);
    requireCapability(user, "cash.deposit.submit");

    const record = await matchCashDeposit({
      depositId: input.depositId,
      expectedDepositVersion: input.expectedDepositVersion,
      statementLineId: input.statementLineId,
      expectedLineVersion: input.expectedLineVersion,
      note: input.note,
      actorAccountId: user.id,
    });
    revalidateCashDeposits(input.siteId as ErpSiteId);
    return {
      status: "success",
      message:
        record.status === "exception"
          ? `${record.depositCode} lệch số với sao kê — đã tạo việc chờ giải trình.`
          : `${record.depositCode} khớp đúng số, đã chuyển kế toán trưởng ghi sổ.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function decideCashExceptionAction(
  _previous: CashDepositActionState,
  formData: FormData,
): Promise<CashDepositActionState> {
  try {
    const input = z
      .object({
        siteId: SiteIdSchema,
        depositId: IdSchema,
        expectedVersion: VersionSchema,
        approve: z.enum(["true", "false"]).transform((value) => value === "true"),
        note: NoteSchema,
      })
      .parse({
        siteId: formData.get("siteId"),
        depositId: formData.get("depositId"),
        expectedVersion: formData.get("expectedVersion"),
        approve: formData.get("approve"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireSiteModuleAccess(user, input.siteId as ErpSiteId);
    requireCapability(user, "cash.exception.decide");

    const record = await decideCashException({
      depositId: input.depositId,
      expectedVersion: input.expectedVersion,
      approve: input.approve,
      note: input.note,
      actorAccountId: user.id,
    });
    revalidateCashDeposits(input.siteId as ErpSiteId);
    return {
      status: "success",
      message: input.approve
        ? `${record.depositCode} đã duyệt ngoại lệ, chuyển kế toán trưởng ghi sổ.`
        : `${record.depositCode} đã trả lại kế toán để sửa và đối khớp lại.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function reviewCashDepositJournalAction(
  _previous: CashDepositActionState,
  formData: FormData,
): Promise<CashDepositActionState> {
  try {
    const input = z
      .object({
        siteId: SiteIdSchema,
        depositId: IdSchema,
        expectedDepositVersion: VersionSchema,
        expectedJournalVersion: VersionSchema,
        decision: z.enum(["approve", "return"]),
        note: NoteSchema,
      })
      .parse({
        siteId: formData.get("siteId"),
        depositId: formData.get("depositId"),
        expectedDepositVersion: formData.get("expectedDepositVersion"),
        expectedJournalVersion: formData.get("expectedJournalVersion"),
        decision: formData.get("decision"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireSiteModuleAccess(user, input.siteId as ErpSiteId);
    requireCapability(user, "cash.deposit.review");

    const record = await reviewCashDepositJournal({
      depositId: input.depositId,
      expectedDepositVersion: input.expectedDepositVersion,
      expectedJournalVersion: input.expectedJournalVersion,
      decision: input.decision,
      note: input.note,
      actorAccountId: user.id,
    });
    revalidateCashDeposits(input.siteId as ErpSiteId);
    return {
      status: "success",
      message:
        input.decision === "approve"
          ? `${record.depositCode} đã ghi sổ — tiền mặt xác nhận đã vào ngân hàng.`
          : `${record.depositCode} đã trả lại kế toán, bút toán chưa ghi sổ.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}
