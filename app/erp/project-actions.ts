"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId, type ErpSiteId } from "@/domain/erp";
import {
  canDecideProjectChange,
  canRecordProjectSettlement,
  canRequestProjectChange,
  canUpdateProjectWork,
} from "@/domain/erp-role-policy";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
  type CurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  ProjectRepositoryConflictError,
  decideProjectChangeRequest,
  recordProjectSettlement,
  reportProjectBlocker,
  submitProjectChangeRequest,
  updateProjectWorkItem,
  type ProjectChangeKind,
  type ProjectChangeRequest,
  type ProjectSettlement,
  type ProjectWorkItem,
  type ProjectWorkItemStatus,
} from "@/lib/erp/project-repository";

const PROJECT_MODULE_PATH = (siteId: ErpSiteId) => `/erp/${siteId}/du-an-su-kien`;
const WORK_ITEM_STATUSES: ProjectWorkItemStatus[] = [
  "open",
  "in-progress",
  "blocked",
  "ready-for-acceptance",
  "done",
];

export type ProjectWorkItemActionResult =
  | { success: true; message: string; workItem: ProjectWorkItem }
  | { success: false; message: string };

export type ProjectChangeRequestActionResult =
  | { success: true; message: string; changeRequest: ProjectChangeRequest }
  | { success: false; message: string };

export type ProjectSettlementActionResult =
  | { success: true; message: string; settlement: ProjectSettlement }
  | { success: false; message: string };

type ProjectAccessResult =
  | { ok: true; user: CurrentErpUser; siteId: ErpSiteId }
  | { ok: false; message: string };

async function requireProjectAccess(siteValue: string): Promise<ProjectAccessResult> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(siteValue)) return { ok: false, message: "Cơ sở không hợp lệ." };
  const siteId: ErpSiteId = siteValue;
  if (!accountCanAccessSite(user, siteId) || !accountCanAccessModule(user, siteId, "du-an-su-kien")) {
    return { ok: false, message: "Bạn không có quyền truy cập dự án tại cơ sở này." };
  }
  return { ok: true, user, siteId };
}

export async function updateProjectWorkItemAction(input: {
  siteId: string;
  workItemCode: string;
  nextStatus: string;
  progressPercent?: number;
}): Promise<ProjectWorkItemActionResult> {
  const access = await requireProjectAccess(input.siteId);
  if (!access.ok) return { success: false, message: access.message };
  const { user, siteId } = access;

  if (!canUpdateProjectWork(user.role) && user.role !== "director") {
    return { success: false, message: "Bạn không có quyền cập nhật gói việc." };
  }
  const nextStatus = input.nextStatus as ProjectWorkItemStatus;
  if (!WORK_ITEM_STATUSES.includes(nextStatus)) {
    return { success: false, message: "Trạng thái không hợp lệ." };
  }
  if (
    input.progressPercent !== undefined &&
    (!Number.isFinite(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100)
  ) {
    return { success: false, message: "Tiến độ phải trong khoảng 0-100." };
  }

  try {
    const workItem = await updateProjectWorkItem({
      siteId,
      workItemCode: input.workItemCode,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      nextStatus,
      progressPercent: input.progressPercent,
    });
    revalidatePath(PROJECT_MODULE_PATH(siteId));
    return { success: true, message: `${workItem.code}: đã cập nhật.`, workItem };
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể cập nhật gói việc. Hãy thử lại." };
  }
}

export async function reportProjectBlockerAction(input: {
  siteId: string;
  workItemCode: string;
  reason?: string;
}): Promise<ProjectWorkItemActionResult> {
  const access = await requireProjectAccess(input.siteId);
  if (!access.ok) return { success: false, message: access.message };
  const { user, siteId } = access;

  if (!canUpdateProjectWork(user.role)) {
    return { success: false, message: "Bạn không có quyền báo chặn gói việc." };
  }

  try {
    const workItem = await reportProjectBlocker({
      siteId,
      workItemCode: input.workItemCode,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      reason: input.reason,
    });
    revalidatePath(PROJECT_MODULE_PATH(siteId));
    const message =
      workItem.status === "blocked" ? `${workItem.code}: đã báo chặn.` : `${workItem.code}: đã gỡ chặn.`;
    return { success: true, message, workItem };
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể cập nhật gói việc. Hãy thử lại." };
  }
}

export async function submitProjectChangeRequestAction(input: {
  siteId: string;
  kind: string;
  summary: string;
  proposedBudgetBillion?: number;
  proposedEventDate?: string;
  note?: string;
}): Promise<ProjectChangeRequestActionResult> {
  const access = await requireProjectAccess(input.siteId);
  if (!access.ok) return { success: false, message: access.message };
  const { user, siteId } = access;

  if (!canRequestProjectChange(user.role)) {
    return { success: false, message: "Bạn không có quyền gửi yêu cầu đổi phạm vi." };
  }
  if (!["budget", "deadline", "scope"].includes(input.kind)) {
    return { success: false, message: "Loại yêu cầu không hợp lệ." };
  }
  const summary = input.summary.trim();
  if (!summary) {
    return { success: false, message: "Vui lòng nhập nội dung yêu cầu." };
  }

  try {
    const changeRequest = await submitProjectChangeRequest({
      siteId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      kind: input.kind as ProjectChangeKind,
      summary,
      proposedBudgetBillion: input.proposedBudgetBillion,
      proposedEventDate: input.proposedEventDate,
      note: input.note,
    });
    revalidatePath(PROJECT_MODULE_PATH(siteId));
    return { success: true, message: "Đã gửi yêu cầu đổi phạm vi tới giám đốc.", changeRequest };
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể gửi yêu cầu. Hãy thử lại." };
  }
}

export async function decideProjectChangeRequestAction(input: {
  siteId: string;
  changeRequestId: string;
  decision: "approved" | "rejected";
  decisionNote?: string;
}): Promise<ProjectChangeRequestActionResult> {
  const access = await requireProjectAccess(input.siteId);
  if (!access.ok) return { success: false, message: access.message };
  const { user, siteId } = access;

  if (!canDecideProjectChange(user.role)) {
    return { success: false, message: "Bạn không có quyền duyệt yêu cầu đổi phạm vi." };
  }
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { success: false, message: "Quyết định không hợp lệ." };
  }

  try {
    const changeRequest = await decideProjectChangeRequest({
      siteId,
      changeRequestId: input.changeRequestId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      decision: input.decision,
      decisionNote: input.decisionNote,
    });
    revalidatePath(PROJECT_MODULE_PATH(siteId));
    const message = input.decision === "approved" ? "Đã duyệt yêu cầu đổi phạm vi." : "Đã từ chối yêu cầu.";
    return { success: true, message, changeRequest };
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể xử lý yêu cầu. Hãy thử lại." };
  }
}

export async function recordProjectSettlementAction(input: {
  siteId: string;
  workItemCode: string;
  amountBillion: number;
  note: string;
  financeCode: string;
}): Promise<ProjectSettlementActionResult> {
  const access = await requireProjectAccess(input.siteId);
  if (!access.ok) return { success: false, message: access.message };
  const { user, siteId } = access;

  if (!canRecordProjectSettlement(user.role)) {
    return { success: false, message: "Bạn không có quyền ghi nhận quyết toán." };
  }
  if (!Number.isFinite(input.amountBillion) || input.amountBillion <= 0) {
    return { success: false, message: "Số tiền quyết toán không hợp lệ." };
  }
  const note = input.note.trim();
  const financeCode = input.financeCode.trim();
  if (!note || !financeCode) {
    return { success: false, message: "Vui lòng nhập đủ ghi chú và mã hạch toán." };
  }

  try {
    const settlement = await recordProjectSettlement({
      siteId,
      workItemCode: input.workItemCode,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      amountBillion: input.amountBillion,
      note,
      financeCode,
    });
    revalidatePath(PROJECT_MODULE_PATH(siteId));
    return { success: true, message: `Đã ghi nhận quyết toán ${input.workItemCode}.`, settlement };
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể ghi nhận quyết toán. Hãy thử lại." };
  }
}
