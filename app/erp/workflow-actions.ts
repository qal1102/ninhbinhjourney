"use server";

import { z } from "zod";
import {
  createShiftCloseSubmission,
  transitionShiftClose,
  type ShiftCloseAction,
  type ShiftCloseActor,
  type ShiftCloseRecord,
} from "@/domain/erp-shift-close";
import type { ShiftCloseActionState } from "@/domain/erp-shift-close-action-state";
import { getErpSite, isErpSiteId, type ErpSiteId } from "@/domain/erp";
import {
  canDecideTicketShiftException,
  canReconcileTicketShift,
  canReviewTicketShift,
  canSubmitTicketShift,
} from "@/domain/erp-role-policy";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getAttendanceState,
  getCurrentErpUser,
  type CurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  ShiftCloseRepositoryError,
  ShiftCloseRepositoryConflictError,
  ShiftCloseRepositoryConfigurationError,
  createShiftClosure,
  listShiftClosures,
  transitionShiftClosure,
} from "@/lib/erp/shift-close-repository";

const VndSchema = z.coerce
  .number()
  .int("Số tiền phải là số nguyên.")
  .min(0, "Số tiền không được âm.")
  .max(9_000_000_000_000, "Số tiền vượt giới hạn cho phép.");

const RecordActionSchema = z.object({
  recordId: z.uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  note: z.string().trim().max(500),
});

function actionError(error: unknown): ShiftCloseActionState {
  if (error instanceof ShiftCloseRepositoryConfigurationError) {
    return {
      status: "error",
      message:
        "Kho dữ liệu ERP chưa được cấu hình đủ. Hãy kiểm tra URL và server secret Supabase.",
    };
  }
  if (error instanceof ShiftCloseRepositoryConflictError) {
    return {
      status: "error",
      message:
        "Hồ sơ vừa được người khác cập nhật. Tải lại trang để xem trạng thái mới nhất.",
    };
  }
  if (error instanceof ShiftCloseRepositoryError) {
    console.error("Shift-close persistence failed", {
      name: error.name,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "Kho dữ liệu chưa phản hồi. Vui lòng thử lại; nếu lỗi còn lặp lại, báo bộ phận hệ thống kèm mã ca.",
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message:
        error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof Error) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Không thể xử lý hồ sơ lúc này." };
}

function requireCurrentUser(user: CurrentErpUser | null) {
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  return user;
}

function actorFromUser(user: CurrentErpUser): ShiftCloseActor {
  return { id: user.id, name: user.name, role: user.role };
}

function vietnamDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function siteCode(siteId: ErpSiteId) {
  return {
    "trang-an": "TA",
    "tam-chuc": "TC",
    "tam-coc": "TCO",
    "bai-dinh": "BD",
  }[siteId];
}

async function loadRecordForUser(
  user: CurrentErpUser,
  recordId: string,
): Promise<ShiftCloseRecord> {
  const records = await listShiftClosures({
    siteIds: user.siteIds,
    limit: 100,
  });
  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) {
    throw new Error("Không tìm thấy hồ sơ trong phạm vi được giao.");
  }
  return record;
}

function requireExpectedVersion(
  record: ShiftCloseRecord,
  expectedVersion: number,
) {
  if (record.version !== expectedVersion) {
    throw new ShiftCloseRepositoryConflictError(
      `Shift-close record ${record.id} is at version ${record.version}, not expected version ${expectedVersion}.`,
    );
  }
}

export async function submitShiftCloseAction(
  _previous: ShiftCloseActionState,
  formData: FormData,
): Promise<ShiftCloseActionState> {
  try {
    const rawSiteId = String(formData.get("siteId") ?? "");
    if (!isErpSiteId(rawSiteId)) throw new Error("Cơ sở không hợp lệ.");
    const siteId: ErpSiteId = rawSiteId;
    const input = z
      .object({
        ticketsSold: z.coerce.number().int().min(0).max(1_000_000),
        grossVnd: VndSchema,
        refundVnd: VndSchema,
        cashVnd: VndSchema,
        cardVnd: VndSchema,
        financeCode: z.string().trim().min(3).max(60),
        note: z.string().trim().min(4).max(500),
      })
      .parse({
        ticketsSold: formData.get("ticketsSold"),
        grossVnd: formData.get("grossVnd"),
        refundVnd: formData.get("refundVnd"),
        cashVnd: formData.get("cashVnd"),
        cardVnd: formData.get("cardVnd"),
        financeCode: formData.get("financeCode"),
        note: formData.get("note"),
      });
    const user = requireCurrentUser(await getCurrentErpUser());
    if (
      user.role !== "employee" ||
      !canSubmitTicketShift(user.role) ||
      !accountCanAccessSite(user, siteId) ||
      !accountCanAccessModule(user, siteId, "ve-dat-cho")
    ) {
      throw new Error("Bạn không được phân công gửi chốt ca vé tại cơ sở này.");
    }

    const attendance = await getAttendanceState();
    const now = new Date();
    const openAttendance = attendance.events
      .filter(
        (event) =>
          event.userId === user.id &&
          event.siteId === siteId &&
          vietnamDateKey(new Date(event.createdAt)) === vietnamDateKey(now),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(-1);
    if (!openAttendance || openAttendance.type !== "check-in") {
      throw new Error("Bạn cần chấm vào ca trước khi gửi chốt vé và tiền thu.");
    }

    const site = getErpSite(siteId)!;
    const nowIso = now.toISOString();
    const businessDate = vietnamDateKey(now);
    const attendanceSuffix = new Date(openAttendance.createdAt)
      .getTime()
      .toString(36)
      .slice(-6)
      .toUpperCase();
    const idempotencyKey = [
      "submit",
      user.id,
      siteId,
      businessDate,
      openAttendance.createdAt,
    ].join(":");
    const record = createShiftCloseSubmission({
      id: crypto.randomUUID(),
      shiftCode: `SHIFT-${siteCode(siteId)}-${businessDate.replaceAll("-", "")}-${user.id.slice(-4).toUpperCase()}-${attendanceSuffix}`,
      idempotencyKey,
      siteId,
      businessDate,
      station: user.workforceProfile?.primaryStation ?? `Quầy vé ${site.shortName}`,
      shiftLabel: user.workforceProfile?.shiftLabel ?? "Ca hiện tại",
      shiftStartedAt: openAttendance.createdAt,
      shiftEndedAt: nowIso,
      ticketsSold: input.ticketsSold,
      financeCode: input.financeCode,
      note: input.note,
      amounts: {
        grossVnd: input.grossVnd,
        refundVnd: input.refundVnd,
        cashVnd: input.cashVnd,
        cardVnd: input.cardVnd,
      },
      actor: actorFromUser(user),
      now: nowIso,
      auditEventId: crypto.randomUUID(),
    });
    const persisted = await createShiftClosure(record, { idempotencyKey });
    return {
      status: "success",
      message: `${persisted.shiftCode} đã gửi quản lý xác nhận. Chênh lệch được hệ thống tự tính.`,
      recordId: persisted.id,
      record: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function resubmitShiftCloseAction(
  _previous: ShiftCloseActionState,
  formData: FormData,
): Promise<ShiftCloseActionState> {
  try {
    const base = RecordActionSchema.parse({
      recordId: formData.get("recordId"),
      expectedVersion: formData.get("expectedVersion"),
      note: formData.get("note"),
    });
    const user = requireCurrentUser(await getCurrentErpUser());
    if (user.role !== "employee" || !canSubmitTicketShift(user.role)) {
      throw new Error("Bạn không có quyền gửi lại hồ sơ chốt ca.");
    }
    const record = await loadRecordForUser(user, base.recordId);
    if (
      record.submittedBy.id !== user.id ||
      !accountCanAccessSite(user, record.siteId) ||
      !accountCanAccessModule(user, record.siteId, "ve-dat-cho")
    ) {
      throw new Error("Bạn chỉ được bổ sung hồ sơ chốt ca của mình.");
    }
    requireExpectedVersion(record, base.expectedVersion);
    const action: ShiftCloseAction = {
      type: "employee.submit",
      actor: actorFromUser(user),
      note: base.note,
      now: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    };
    const next = transitionShiftClose(record, action);
    const persisted = await transitionShiftClosure(
      record.id,
      base.expectedVersion,
      next,
      {
        idempotencyKey: [
          "employee-resubmit",
          record.id,
          base.expectedVersion,
        ].join(":"),
      },
    );
    return {
      status: "success",
      message: `${persisted.shiftCode} đã bổ sung và gửi lại quản lý xác nhận.`,
      recordId: persisted.id,
      record: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewShiftCloseAction(
  _previous: ShiftCloseActionState,
  formData: FormData,
): Promise<ShiftCloseActionState> {
  try {
    const base = RecordActionSchema.extend({
      decision: z.enum(["approve", "return"]),
    }).parse({
      recordId: formData.get("recordId"),
      expectedVersion: formData.get("expectedVersion"),
      decision: formData.get("decision"),
      note: formData.get("note"),
    });
    const user = requireCurrentUser(await getCurrentErpUser());
    if (user.role !== "manager" || !canReviewTicketShift(user.role)) {
      throw new Error("Bạn không có quyền xác nhận chốt ca.");
    }
    const record = await loadRecordForUser(user, base.recordId);
    if (!user.managedSiteIds.includes(record.siteId)) {
      throw new Error("Hồ sơ nằm ngoài cơ sở bạn quản lý.");
    }
    requireExpectedVersion(record, base.expectedVersion);
    const action: ShiftCloseAction = {
      type: "manager.review",
      decision: base.decision,
      actor: actorFromUser(user),
      note: base.note,
      now: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    };
    const next = transitionShiftClose(record, action);
    const persisted = await transitionShiftClosure(
      record.id,
      base.expectedVersion,
      next,
      {
        idempotencyKey: [
          "manager",
          record.id,
          base.expectedVersion,
          base.decision,
        ].join(":"),
      },
    );
    return {
      status: "success",
      message:
        base.decision === "approve"
          ? `${persisted.shiftCode} đã chuyển kế toán đối soát.`
          : `${persisted.shiftCode} đã trả nhân viên bổ sung.`,
      recordId: persisted.id,
      record: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function reconcileShiftCloseAction(
  _previous: ShiftCloseActionState,
  formData: FormData,
): Promise<ShiftCloseActionState> {
  try {
    const base = RecordActionSchema.extend({
      decision: z.enum(["review", "escalate", "return"]),
    }).parse({
      recordId: formData.get("recordId"),
      expectedVersion: formData.get("expectedVersion"),
      decision: formData.get("decision"),
      note: formData.get("note"),
    });
    const user = requireCurrentUser(await getCurrentErpUser());
    if (user.role !== "accountant" || !canReconcileTicketShift(user.role)) {
      throw new Error("Bạn không có quyền đối soát chốt ca.");
    }
    const record = await loadRecordForUser(user, base.recordId);
    requireExpectedVersion(record, base.expectedVersion);
    const action: ShiftCloseAction = {
      type: "accountant.reconcile",
      decision: base.decision,
      actor: actorFromUser(user),
      note: base.note,
      now: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    };
    const next = transitionShiftClose(record, action);
    const persisted = await transitionShiftClosure(
      record.id,
      base.expectedVersion,
      next,
      {
        idempotencyKey: [
          "accounting",
          record.id,
          base.expectedVersion,
          base.decision,
        ].join(":"),
      },
    );
    const message = {
      review: `${persisted.shiftCode} đã được nhận kiểm tra.`,
      escalate: `${persisted.shiftCode} đã chuyển giám đốc vì vượt ngưỡng.`,
      return: `${persisted.shiftCode} đã trả quản lý bổ sung hồ sơ.`,
    }[base.decision];
    return {
      status: "success",
      message,
      recordId: persisted.id,
      record: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function decideShiftCloseExceptionAction(
  _previous: ShiftCloseActionState,
  formData: FormData,
): Promise<ShiftCloseActionState> {
  try {
    const base = RecordActionSchema.extend({
      decision: z.enum(["approve", "reject"]),
    }).parse({
      recordId: formData.get("recordId"),
      expectedVersion: formData.get("expectedVersion"),
      decision: formData.get("decision"),
      note: formData.get("note"),
    });
    const user = requireCurrentUser(await getCurrentErpUser());
    if (
      user.role !== "director" ||
      !canDecideTicketShiftException(user.role)
    ) {
      throw new Error("Bạn không có quyền quyết định ngoại lệ tài chính.");
    }
    const record = await loadRecordForUser(user, base.recordId);
    requireExpectedVersion(record, base.expectedVersion);
    const action: ShiftCloseAction = {
      type: "director.decide",
      decision: base.decision,
      actor: actorFromUser(user),
      note: base.note,
      now: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    };
    const next = transitionShiftClose(record, action);
    const persisted = await transitionShiftClosure(
      record.id,
      base.expectedVersion,
      next,
      {
        idempotencyKey: [
          "director",
          record.id,
          base.expectedVersion,
          base.decision,
        ].join(":"),
      },
    );
    return {
      status: "success",
      message:
        base.decision === "approve"
          ? `${persisted.shiftCode} đã duyệt phương án ngoại lệ và trả kế toán hoàn tất.`
          : `${persisted.shiftCode} đã trả kế toán làm rõ thêm.`,
      recordId: persisted.id,
      record: persisted,
    };
  } catch (error) {
    return actionError(error);
  }
}
