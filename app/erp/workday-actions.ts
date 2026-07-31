"use server";

import { revalidatePath } from "next/cache";
import {
  createWorkdayAssignment,
  transitionWorkday,
  workdayLocationFromCheckIn,
  type WorkdayActor,
  type WorkdayEvidence,
  type WorkdayPriority,
} from "@/domain/erp-workday";
import { getWorkdayTaskTemplate } from "@/domain/erp-workday-catalog";
import {
  canAssignWorkday,
  canExecuteWorkday,
  canReviewWorkday,
} from "@/domain/erp-role-policy";
import { isErpSiteId, type ErpSiteId } from "@/domain/erp";
import {
  findDemoErpAccountById,
  getEmployeeAssignableModuleIds,
  isDemoErpAccountActive,
} from "@/lib/erp/demo-data";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";
import { getAccessState } from "@/lib/erp/staff-access-repository";
import {
  createWorkday,
  getWorkday,
  recordWorkdayLocation,
  removeWorkdayEvidence,
  saveWorkdayTransition,
  uploadWorkdayEvidence,
  verifyWorkdayLocation,
  WorkdayRepositoryConflictError,
  WorkdayRepositoryError,
} from "@/lib/erp/workday-repository";
import type { WorkdayActionResult } from "@/domain/erp-workday-action-state";

const MAX_CAPTURE_AGE_MS = 10 * 60 * 1_000;

function fail(message: string): WorkdayActionResult {
  return { success: false, message };
}

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function asNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function actorOf(user: {
  id: string;
  name: string;
  role: WorkdayActor["role"];
}): WorkdayActor {
  return { id: user.id, name: user.name, role: user.role };
}

function vietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function revalidateWorkday(siteId: ErpSiteId) {
  revalidatePath("/erp");
  revalidatePath(`/erp/${siteId}/nhan-su`);
  revalidatePath(`/erp/${siteId}/cham-cong`);
  revalidatePath(`/erp/${siteId}/bao-cao-hien-truong`);
}

function errorMessage(error: unknown) {
  if (
    error instanceof WorkdayRepositoryError ||
    error instanceof WorkdayRepositoryConflictError ||
    error instanceof Error
  ) {
    return error.message;
  }
  return "Không thể cập nhật phiếu công việc. Vui lòng thử lại.";
}

function locationFrom(
  latitudeValue: FormDataEntryValue | null,
  longitudeValue: FormDataEntryValue | null,
  accuracyValue: FormDataEntryValue | null,
) {
  const latitude = asNumber(latitudeValue);
  const longitude = asNumber(longitudeValue);
  const parsedAccuracy = asNumber(accuracyValue);
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(parsedAccuracy) ? Math.max(0, parsedAccuracy) : null,
  };
}

function requireFreshCapture(capturedAt: string) {
  const time = Date.parse(capturedAt);
  const now = Date.now();
  if (
    !Number.isFinite(time) ||
    time < now - MAX_CAPTURE_AGE_MS ||
    time > now + 2 * 60 * 1_000
  ) {
    throw new Error(
      "Vị trí của ảnh đã cũ. Hãy chụp lại tại hiện trường rồi gửi ngay.",
    );
  }
}

async function evidenceFromForm(
  formData: FormData,
  input: {
    workdayId: string;
    siteId: ErpSiteId;
    employeeAccountId: string;
    uploadedBy: string;
    actionKey: string;
  },
): Promise<WorkdayEvidence | undefined> {
  const file = formData.get("evidence");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const capturedAt = asText(formData.get("capturedAt"));
  requireFreshCapture(capturedAt);
  const location = locationFrom(
    formData.get("latitude"),
    formData.get("longitude"),
    formData.get("accuracy"),
  );
  const verified = verifyWorkdayLocation({
    siteId: input.siteId,
    ...location,
  });
  if (!verified.insideGeofence) {
    throw new Error(
      `GPS của thiết bị đang cách khu vực làm việc khoảng ${verified.distanceMeters.toLocaleString(
        "vi-VN",
      )} m. Hệ thống chỉ nhận ảnh khi GPS được ghi nhận trong vùng cơ sở.`,
    );
  }
  return uploadWorkdayEvidence({
    file,
    siteId: input.siteId,
    employeeAccountId: input.employeeAccountId,
    workdayId: input.workdayId,
    actionKey: input.actionKey,
    uploadedBy: input.uploadedBy,
    uploadedAt: new Date().toISOString(),
    capturedAt,
    ...location,
  });
}

async function employeeRecord(workdayId: string) {
  const user = await getCurrentErpUser();
  if (!user || !canExecuteWorkday(user.role)) {
    throw new Error("Phiên đăng nhập không có quyền thực hiện công việc trong ca.");
  }
  const record = await getWorkday(workdayId);
  if (
    record.employee.id !== user.id ||
    !accountCanAccessSite(user, record.siteId) ||
    !accountCanAccessModule(user, record.siteId, record.moduleId)
  ) {
    throw new Error("Phiếu công việc không thuộc phạm vi được phân công.");
  }
  if (record.businessDate !== vietnamDateKey()) {
    throw new Error(
      "Phiếu này không thuộc ngày làm việc hiện tại. Hãy liên hệ quản lý để xử lý ngoại lệ.",
    );
  }
  return { user, record };
}

export async function assignWorkdayAction(
  formData: FormData,
): Promise<WorkdayActionResult> {
  try {
    const manager = await getCurrentErpUser();
    if (!manager || !canAssignWorkday(manager.role)) {
      return fail("Chỉ quản lý cơ sở mới được giao việc trong ca.");
    }
    const siteValue = asText(formData.get("siteId"));
    const employeeId = asText(formData.get("employeeId"));
    const templateId = asText(formData.get("templateId"));
    const priorityValue = asText(formData.get("priority"));
    const dueTime = asText(formData.get("dueTime"));
    if (!isErpSiteId(siteValue) || !accountCanAccessSite(manager, siteValue)) {
      return fail("Cơ sở nằm ngoài phạm vi quản lý.");
    }
    const siteId = siteValue;
    const employee = findDemoErpAccountById(employeeId);
    const template = getWorkdayTaskTemplate(siteId, templateId);
    if (
      !employee ||
      employee.role !== "employee" ||
      !isDemoErpAccountActive(employee) ||
      !template
    ) {
      return fail("Nhân viên hoặc loại công việc không hợp lệ.");
    }
    const access = await getAccessState();
    const employeeAccess = access.employees[employee.id];
    const employeeSiteIds = employeeAccess?.siteIds ?? [];
    const employeeModules = employeeAccess?.moduleIdsBySite[siteId] ?? [];
    if (
      !employeeSiteIds.includes(siteId) ||
      !employeeModules.includes(template.moduleId) ||
      !getEmployeeAssignableModuleIds(employee).includes(template.moduleId)
    ) {
      return fail(
        "Nhân viên chưa được cấp đúng cơ sở hoặc chưa được đào tạo cho công việc này.",
      );
    }
    const priority: WorkdayPriority = ["normal", "high", "critical"].includes(
      priorityValue,
    )
      ? (priorityValue as WorkdayPriority)
      : "normal";
    const businessDate = vietnamDateKey();
    if (!/^\d{2}:\d{2}$/.test(dueTime)) {
      return fail("Hạn hoàn thành chưa đúng định dạng giờ.");
    }
    const dueAt = new Date(`${businessDate}T${dueTime}:00+07:00`);
    if (dueAt.getTime() <= Date.now()) {
      return fail("Hạn hoàn thành phải muộn hơn thời điểm hiện tại.");
    }
    const id = crypto.randomUUID();
    const compactDate = businessDate.replaceAll("-", "");
    const idempotencyKey =
      asText(formData.get("idempotencyKey")) ||
      `assign:${manager.id}:${employee.id}:${businessDate}:${template.id}`;
    const note = asText(formData.get("managerNote"));
    const instructions = note
      ? `${template.instructions} Lưu ý của quản lý: ${note}`
      : template.instructions;
    const record = createWorkdayAssignment({
      id,
      code: `CV-${siteId.toUpperCase()}-${compactDate}-${id.slice(0, 4).toUpperCase()}`,
      siteId,
      businessDate,
      employee: actorOf(employee),
      manager: actorOf(manager),
      moduleId: template.moduleId,
      station: template.station,
      shiftLabel: employee.workforceProfile?.shiftLabel ?? "Theo lịch phân ca",
      taskTitle: template.title,
      instructions,
      priority,
      dueAt: dueAt.toISOString(),
      evidenceRequired: template.evidenceRequired,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    });
    const saved = await createWorkday(record, { idempotencyKey });
    revalidateWorkday(siteId);
    return {
      success: true,
      message: `Đã giao ${saved.code} cho ${saved.employee.name}.`,
      record: saved,
    };
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function checkInWorkdayAction(input: {
  workdayId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  idempotencyKey: string;
}): Promise<WorkdayActionResult> {
  try {
    const { user, record } = await employeeRecord(input.workdayId);
    const location = {
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      accuracy:
        input.accuracy !== null && Number.isFinite(Number(input.accuracy))
          ? Math.max(0, Number(input.accuracy))
          : null,
    };
    const verified = verifyWorkdayLocation({ siteId: record.siteId, ...location });
    if (!verified.insideGeofence) {
      return fail(
        `Bạn đang cách vùng làm việc khoảng ${verified.distanceMeters.toLocaleString(
          "vi-VN",
        )} m hoặc GPS chưa đủ chính xác. Hãy đến đúng cơ sở để vào ca.`,
      );
    }
    const at = new Date().toISOString();
    const next = transitionWorkday(record, {
      type: "employee.check-in",
      actor: actorOf(user),
      ...location,
      at,
      auditEventId: crypto.randomUUID(),
    });
    const saved = await saveWorkdayTransition(record, next, {
      idempotencyKey: input.idempotencyKey,
    });
    let latestLocation = workdayLocationFromCheckIn(saved, verified);
    let periodicLocationReady = false;
    try {
      latestLocation = await recordWorkdayLocation({
        workdayId: saved.id,
        employeeAccountId: user.id,
        siteId: saved.siteId,
        ...location,
        recordedAt: at,
        idempotencyKey: `${input.idempotencyKey}:location`,
      });
      periodicLocationReady = true;
    } catch {
      // The atomic workflow transition already persisted the check-in and its
      // coordinates. A secondary location-event outage must not report that
      // committed check-in as failed; the foreground watcher can retry.
    }
    revalidateWorkday(saved.siteId);
    return {
      success: true,
      message: periodicLocationReady
        ? "Đã vào ca tại đúng cơ sở. GPS trong ca đang được bật."
        : "Đã vào ca và lưu vị trí check-in. GPS định kỳ sẽ tự thử lại khi ca đang mở.",
      record: { ...saved, latestLocation },
      location: latestLocation,
    };
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function recordActiveWorkdayLocationAction(input: {
  workdayId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string;
  idempotencyKey: string;
}): Promise<WorkdayActionResult> {
  try {
    const { user, record } = await employeeRecord(input.workdayId);
    if (
      !["checked-in", "in-progress", "manager-returned"].includes(
        record.status,
      )
    ) {
      return fail("GPS chỉ cập nhật khi ca đang mở.");
    }
    const recordedAt = new Date(input.recordedAt);
    if (
      !Number.isFinite(recordedAt.getTime()) ||
      Math.abs(Date.now() - recordedAt.getTime()) > MAX_CAPTURE_AGE_MS
    ) {
      return fail("Thời điểm GPS không còn hợp lệ.");
    }
    const location = await recordWorkdayLocation({
      workdayId: record.id,
      employeeAccountId: user.id,
      siteId: record.siteId,
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      accuracy:
        input.accuracy !== null && Number.isFinite(Number(input.accuracy))
          ? Math.max(0, Number(input.accuracy))
          : null,
      recordedAt: recordedAt.toISOString(),
      idempotencyKey: input.idempotencyKey,
    });
    return {
      success: true,
      message: location.insideGeofence
        ? "Đã cập nhật vị trí trong ca."
        : "Đã ghi nhận nhân viên đang ngoài vùng làm việc.",
      location,
    };
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function updateWorkdayProgressAction(
  formData: FormData,
): Promise<WorkdayActionResult> {
  let uploaded: WorkdayEvidence | undefined;
  let transitionStarted = false;
  try {
    const workdayId = asText(formData.get("workdayId"));
    const expectedVersion = Number(formData.get("expectedVersion"));
    const { user, record } = await employeeRecord(workdayId);
    if (record.version !== expectedVersion) {
      return fail("Phiếu đã thay đổi. Hãy tải lại trước khi cập nhật.");
    }
    const actionKey =
      asText(formData.get("idempotencyKey")) || crypto.randomUUID();
    uploaded = await evidenceFromForm(formData, {
      workdayId,
      siteId: record.siteId,
      employeeAccountId: user.id,
      uploadedBy: user.id,
      actionKey,
    });
    const next = transitionWorkday(record, {
      type: "employee.progress",
      actor: actorOf(user),
      progressPercent: Number(formData.get("progressPercent")),
      note: asText(formData.get("note")),
      evidence: uploaded,
      at: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    });
    transitionStarted = true;
    const saved = await saveWorkdayTransition(record, next, {
      idempotencyKey: actionKey,
    });
    if (
      uploaded &&
      !saved.evidence.some((evidence) => evidence.id === uploaded?.id)
    ) {
      await removeWorkdayEvidence(uploaded.storagePath);
      uploaded = undefined;
    }
    revalidateWorkday(record.siteId);
    return {
      success: true,
      message: `Đã cập nhật tiến độ ${saved.progressPercent}%.`,
      record: saved,
    };
  } catch (error) {
    if (uploaded && !transitionStarted) {
      await removeWorkdayEvidence(uploaded.storagePath);
    }
    return fail(errorMessage(error));
  }
}

export async function submitWorkdayAction(
  formData: FormData,
): Promise<WorkdayActionResult> {
  let uploaded: WorkdayEvidence | undefined;
  let transitionStarted = false;
  try {
    const workdayId = asText(formData.get("workdayId"));
    const expectedVersion = Number(formData.get("expectedVersion"));
    const { user, record } = await employeeRecord(workdayId);
    if (record.version !== expectedVersion) {
      return fail("Phiếu đã thay đổi. Hãy tải lại trước khi bàn giao.");
    }
    const actionKey =
      asText(formData.get("idempotencyKey")) || crypto.randomUUID();
    uploaded = await evidenceFromForm(formData, {
      workdayId,
      siteId: record.siteId,
      employeeAccountId: user.id,
      uploadedBy: user.id,
      actionKey,
    });
    const next = transitionWorkday(record, {
      type: "employee.submit",
      actor: actorOf(user),
      note: asText(formData.get("note")),
      evidence: uploaded,
      at: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    });
    transitionStarted = true;
    const saved = await saveWorkdayTransition(record, next, {
      idempotencyKey: actionKey,
    });
    if (
      uploaded &&
      !saved.evidence.some((evidence) => evidence.id === uploaded?.id)
    ) {
      await removeWorkdayEvidence(uploaded.storagePath);
      uploaded = undefined;
    }
    revalidateWorkday(record.siteId);
    return {
      success: true,
      message: "Đã bàn giao công việc và kết thúc theo dõi GPS trong ca.",
      record: saved,
    };
  } catch (error) {
    if (uploaded && !transitionStarted) {
      await removeWorkdayEvidence(uploaded.storagePath);
    }
    return fail(errorMessage(error));
  }
}

export async function reviewWorkdayAction(
  formData: FormData,
): Promise<WorkdayActionResult> {
  try {
    const manager = await getCurrentErpUser();
    if (!manager || !canReviewWorkday(manager.role)) {
      return fail("Chỉ quản lý được phân công mới có quyền duyệt.");
    }
    const record = await getWorkday(asText(formData.get("workdayId")));
    if (
      record.manager.id !== manager.id ||
      !accountCanAccessSite(manager, record.siteId)
    ) {
      return fail("Phiếu không thuộc phạm vi quản lý.");
    }
    if (record.version !== Number(formData.get("expectedVersion"))) {
      return fail("Phiếu đã thay đổi. Hãy tải lại trước khi duyệt.");
    }
    const decisionValue = asText(formData.get("decision"));
    if (decisionValue !== "approve" && decisionValue !== "return") {
      return fail("Hãy chọn xác nhận hoàn thành hoặc yêu cầu bổ sung.");
    }
    const decision = decisionValue;
    const actionKey =
      asText(formData.get("idempotencyKey")) || crypto.randomUUID();
    const next = transitionWorkday(record, {
      type: "manager.review",
      actor: actorOf(manager),
      decision,
      note: asText(formData.get("note")),
      at: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    });
    const saved = await saveWorkdayTransition(record, next, {
      idempotencyKey: actionKey,
    });
    revalidateWorkday(record.siteId);
    return {
      success: true,
      message:
        decision === "approve"
          ? "Đã xác nhận công việc hoàn thành."
          : "Đã trả lại phiếu và nêu rõ nội dung cần bổ sung.",
      record: saved,
    };
  } catch (error) {
    return fail(errorMessage(error));
  }
}
