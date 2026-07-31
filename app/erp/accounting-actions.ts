"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type AccountingJournal,
  type AccountingPeriod,
  type AccountingPeriodAction,
  type AccountingReviewDecision,
} from "@/domain/erp-accounting";
import { hasErpCapability } from "@/domain/erp-role-policy";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
  type CurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  AccountingRepositoryConfigurationError,
  AccountingRepositoryConflictError,
  AccountingRepositoryError,
  accountingActorDuty,
  changeAccountingPeriod,
  getAccountingJournal,
  listAccountingJournals,
  prepareShiftCloseAccountingJournal,
  reverseAccountingJournal,
  reviewAccountingJournal,
} from "@/lib/erp/accounting-repository";
import {
  ShiftCloseRepositoryConfigurationError,
  ShiftCloseRepositoryError,
  listShiftClosures,
} from "@/lib/erp/shift-close-repository";

export type AccountingActionState = {
  status: "idle" | "success" | "error";
  message: string;
  entityId?: string;
  version?: number;
  journal?: AccountingJournal;
  period?: AccountingPeriod;
};

const IdSchema = z.uuid("Mã hồ sơ không hợp lệ.");
const VersionSchema = z.coerce
  .number()
  .int("Phiên bản hồ sơ không hợp lệ.")
  .min(1, "Phiên bản hồ sơ không hợp lệ.");
const NoteSchema = z
  .string()
  .trim()
  .min(4, "Nội dung xử lý phải có ít nhất 4 ký tự.")
  .max(2_000, "Nội dung xử lý không được vượt quá 2.000 ký tự.");

function actionError(error: unknown): AccountingActionState {
  if (
    error instanceof AccountingRepositoryConfigurationError ||
    error instanceof ShiftCloseRepositoryConfigurationError
  ) {
    return {
      status: "error",
      message:
        "Kho kế toán chưa được cấu hình đủ trên máy chủ. Vui lòng báo bộ phận hệ thống.",
    };
  }
  if (error instanceof AccountingRepositoryConflictError) {
    return {
      status: "error",
      message:
        "Hồ sơ vừa được người khác cập nhật. Hãy tải lại màn hình trước khi tiếp tục.",
    };
  }
  if (
    error instanceof AccountingRepositoryError ||
    error instanceof ShiftCloseRepositoryError
  ) {
    console.error("Accounting persistence failed", {
      name: error.name,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "Kho kế toán chưa phản hồi đầy đủ. Vui lòng thử lại; nếu lỗi lặp lại, báo bộ phận hệ thống kèm mã hồ sơ.",
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message:
        error.issues[0]?.message ??
        "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof Error) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: "Không thể xử lý nghiệp vụ kế toán lúc này.",
  };
}

function requireCurrentUser(user: CurrentErpUser | null) {
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  return user;
}

function requireAccountingSiteAccess(
  user: CurrentErpUser,
  siteId: AccountingJournal["siteId"],
) {
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "tai-chinh-doi-soat")
  ) {
    throw new Error(
      "Bạn không được phân quyền nghiệp vụ tài chính tại cơ sở này.",
    );
  }
}

function requireMaker(user: CurrentErpUser) {
  if (
    accountingActorDuty(user.role) !== "accountant-maker" ||
    !hasErpCapability(user.role, "accounting.journal.prepare")
  ) {
    throw new Error("Chỉ kế toán được phân công mới được lập bút toán.");
  }
}

function requireChecker(
  user: CurrentErpUser,
  capability:
    | "accounting.journal.check"
    | "accounting.journal.post"
    | "accounting.journal.reverse"
    | "accounting.period.lock"
    | "accounting.period.reopen",
) {
  if (
    accountingActorDuty(user.role) !== "accounting-checker" ||
    !hasErpCapability(user.role, capability)
  ) {
    throw new Error(
      "Chỉ kế toán trưởng được phân quyền mới được thực hiện bước này.",
    );
  }
}

function canonicalRequest(
  command: string,
  actorAccountId: string,
  payload: Record<string, string | number>,
) {
  const request = JSON.stringify({
    command,
    actorAccountId,
    payload: Object.fromEntries(
      Object.entries(payload).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  });
  const requestHash = createHash("sha256")
    .update(request, "utf8")
    .digest("hex");
  return {
    requestHash,
    idempotencyKey:
      "acct:" +
      command.replace(/[^a-z-]/g, "") +
      ":" +
      requestHash.slice(0, 48),
  };
}

function revalidateAccountingViews() {
  revalidatePath("/erp");
  revalidatePath("/erp/finance");
}

async function loadJournalForUser(
  user: CurrentErpUser,
  journalId: string,
) {
  const journal = await getAccountingJournal(journalId);
  if (!journal) {
    throw new Error("Không tìm thấy bút toán trong phạm vi được giao.");
  }
  requireAccountingSiteAccess(user, journal.siteId);
  return journal;
}

export async function prepareShiftCloseAccountingJournalAction(
  _previous: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    const input = z
      .object({
        workflowId: IdSchema,
        expectedSourceVersion: VersionSchema,
        note: NoteSchema,
      })
      .parse({
        workflowId: formData.get("workflowId"),
        expectedSourceVersion: formData.get("expectedSourceVersion"),
        note: formData.get("note"),
      });
    const user = requireCurrentUser(await getCurrentErpUser());
    requireMaker(user);

    const source = (
      await listShiftClosures({ siteIds: user.siteIds, limit: 100 })
    ).find((record) => record.id === input.workflowId);
    if (!source) {
      throw new Error(
        "Không tìm thấy hồ sơ chốt ca trong phạm vi cơ sở được giao.",
      );
    }
    requireAccountingSiteAccess(user, source.siteId);
    if (source.version !== input.expectedSourceVersion) {
      throw new AccountingRepositoryConflictError(
        "Shift-close source version changed.",
      );
    }

    const priorJournal = (
      await listAccountingJournals({
        siteIds: [source.siteId],
        limit: 100,
      })
    )
      .filter(
        (journal) =>
          journal.sourceType === "shift-close" &&
          journal.sourceWorkflowId === source.id &&
          !journal.reversalOfJournalId,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const envelope = canonicalRequest("prepare-shift-close", user.id, {
      ...input,
      priorJournalId: priorJournal?.id ?? "",
      priorJournalVersion: priorJournal?.version ?? 0,
      priorJournalStatus: priorJournal?.status ?? "none",
    });
    const journal = await prepareShiftCloseAccountingJournal(
      input.workflowId,
      input.expectedSourceVersion,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateAccountingViews();
    return {
      status: "success",
      message:
        journal.journalCode +
        " đã được lập và chuyển kế toán trưởng kiểm tra.",
      entityId: journal.id,
      version: journal.version,
      journal,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewAccountingJournalAction(
  _previous: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    const input = z
      .object({
        journalId: IdSchema,
        expectedVersion: VersionSchema,
        decision: z.enum(["approve", "return"], {
          message: "Quyết định kiểm tra không hợp lệ.",
        }),
        note: z.string().trim().max(2_000),
      })
      .superRefine((value, context) => {
        if (value.decision === "return" && value.note.length < 4) {
          context.addIssue({
            code: "custom",
            path: ["note"],
            message:
              "Khi trả lại phải ghi rõ nội dung cần bổ sung, ít nhất 4 ký tự.",
          });
        }
      })
      .parse({
        journalId: formData.get("journalId"),
        expectedVersion: formData.get("expectedVersion"),
        decision: formData.get("decision"),
        note: formData.get("note") ?? "",
      });
    const user = requireCurrentUser(await getCurrentErpUser());
    requireChecker(user, "accounting.journal.check");
    if (input.decision === "approve") {
      requireChecker(user, "accounting.journal.post");
    }
    const journal = await loadJournalForUser(user, input.journalId);
    if (journal.sourceType !== "shift-close") {
      throw new Error(
        "Bút toán hóa đơn nhà cung cấp phải được kiểm tra tại hàng công nợ cùng hồ sơ nguồn.",
      );
    }
    if (journal.version !== input.expectedVersion) {
      throw new AccountingRepositoryConflictError(
        "Journal version changed.",
      );
    }
    if (journal.makerAccountId === user.id) {
      throw new Error(
        "Người lập không được tự kiểm tra hoặc ghi sổ bút toán của mình.",
      );
    }

    const envelope = canonicalRequest("review-journal", user.id, input);
    const persisted = await reviewAccountingJournal(
      journal.id,
      input.expectedVersion,
      input.decision as AccountingReviewDecision,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateAccountingViews();
    return {
      status: "success",
      message:
        input.decision === "approve"
          ? persisted.journalCode + " đã được kiểm tra và ghi sổ."
          : persisted.journalCode + " đã trả lại kế toán bổ sung.",
      entityId: persisted.id,
      version: persisted.version,
      journal: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function reverseAccountingJournalAction(
  _previous: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    const input = z
      .object({
        journalId: IdSchema,
        expectedVersion: VersionSchema,
        reason: NoteSchema,
      })
      .parse({
        journalId: formData.get("journalId"),
        expectedVersion: formData.get("expectedVersion"),
        reason: formData.get("reason"),
      });
    const user = requireCurrentUser(await getCurrentErpUser());
    requireChecker(user, "accounting.journal.reverse");
    const original = await loadJournalForUser(user, input.journalId);
    if (original.sourceType !== "shift-close") {
      throw new Error(
        "Hoàn bút hóa đơn nhà cung cấp chưa mở ở luồng này; không được dùng thao tác của chốt ca.",
      );
    }
    if (original.version !== input.expectedVersion) {
      throw new AccountingRepositoryConflictError(
        "Journal version changed.",
      );
    }

    const envelope = canonicalRequest("reverse-journal", user.id, input);
    const reversal = await reverseAccountingJournal(
      original.id,
      input.expectedVersion,
      {
        actorAccountId: user.id,
        reason: input.reason,
        ...envelope,
      },
    );
    revalidateAccountingViews();
    return {
      status: "success",
      message:
        reversal.journalCode +
        " đã được ghi sổ để đảo bút toán " +
        original.journalCode +
        ".",
      entityId: reversal.id,
      version: reversal.version,
      journal: reversal,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeAccountingPeriodAction(
  _previous: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  try {
    const input = z
      .object({
        periodKey: z
          .string()
          .trim()
          .regex(
            /^\d{4}-(0[1-9]|1[0-2])$/,
            "Kỳ kế toán phải theo định dạng YYYY-MM.",
          ),
        expectedVersion: VersionSchema,
        action: z.enum(["lock", "reopen"], {
          message: "Thao tác kỳ kế toán không hợp lệ.",
        }),
        reason: NoteSchema,
      })
      .parse({
        periodKey: formData.get("periodKey"),
        expectedVersion: formData.get("expectedVersion"),
        action: formData.get("action"),
        reason: formData.get("reason"),
      });
    const user = requireCurrentUser(await getCurrentErpUser());
    requireChecker(
      user,
      input.action === "lock"
        ? "accounting.period.lock"
        : "accounting.period.reopen",
    );
    const envelope = canonicalRequest("change-period", user.id, input);
    const period = await changeAccountingPeriod(
      input.periodKey,
      input.expectedVersion,
      input.action as AccountingPeriodAction,
      {
        actorAccountId: user.id,
        reason: input.reason,
        ...envelope,
      },
    );
    revalidateAccountingViews();
    return {
      status: "success",
      message:
        input.action === "lock"
          ? "Kỳ " + period.periodKey + " đã được khóa."
          : "Kỳ " + period.periodKey + " đã được mở lại và lưu lý do.",
      entityId: period.id,
      version: period.version,
      period,
    };
  } catch (error) {
    return actionError(error);
  }
}
