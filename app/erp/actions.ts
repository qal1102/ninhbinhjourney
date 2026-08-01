"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ERP_MODULES,
  getErpSite,
  isErpModuleId,
  isErpSiteId,
  type ErpModuleId,
  type ErpSiteId,
} from "@/domain/erp";
import {
  findDemoErpAccountById,
  findDemoErpAccountByUsername,
  getEmployeeAssignableModuleIds,
  isDemoErpAccountActive,
} from "@/lib/erp/demo-data";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  clearErpSession,
  endRoleSwitch,
  getCurrentErpUser,
  setErpSession,
  startRoleSwitch,
} from "@/lib/erp/demo-session";
import { recordRoleSwitch } from "@/lib/erp/role-switch-audit-repository";
import {
  getAccessState,
  updateEmployeeAccessGrant,
} from "@/lib/erp/staff-access-repository";
import {
  AttendanceRepositoryConflictError,
  recordAttendanceEvent,
  type AttendanceEvent,
} from "@/lib/erp/attendance-repository";
import {
  IncidentRepositoryConflictError,
  IncidentRepositoryError,
  progressIncidentByEmployee,
  reportIncidentFromCamera,
  transitionIncidentByManager,
  type IncidentCase,
} from "@/lib/erp/incident-repository";
import {
  FieldReportRepositoryError,
  submitFieldReport,
  type FieldReport,
} from "@/lib/erp/field-report-repository";
import {
  GateScanRepositoryError,
  recordGateScan,
  type GateScanEvent,
} from "@/lib/erp/gate-scan-repository";
import { canSubmitFieldOperation } from "@/domain/erp-role-policy";

function safePasswordEqual(actual: string, expected: string) {
  const left = createHash("sha256").update(actual).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function loginError(code: "missing" | "invalid"): never {
  redirect(`/erp/login?error=${code}`);
}

export async function loginErpAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) loginError("missing");

  const account = findDemoErpAccountByUsername(username);
  if (!account || !safePasswordEqual(password, account.password) || !isDemoErpAccountActive(account)) {
    loginError("invalid");
  }

  await setErpSession(account.id);
  redirect("/erp");
}

export async function logoutErpAction() {
  await clearErpSession();
  redirect("/erp/login");
}

export async function switchDemoRoleAction(formData: FormData) {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const { director, target } = await startRoleSwitch(targetUserId);
  await recordRoleSwitch({
    directorId: director.id,
    directorName: director.name,
    targetId: target.id,
    targetName: target.name,
    targetRole: target.role,
    action: "started",
  });
  redirect("/erp");
}

export async function endRoleSwitchAction() {
  const { director, target } = await endRoleSwitch();
  await recordRoleSwitch({
    directorId: director.id,
    directorName: director.name,
    targetId: target.id,
    targetName: target.name,
    targetRole: target.role,
    action: "ended",
  });
  redirect("/erp");
}

export async function updateEmployeeAccessAction(formData: FormData) {
  const actor = await getCurrentErpUser();
  if (!actor || (actor.role !== "manager" && actor.role !== "director")) {
    throw new Error("Bạn không có quyền phân công nhân viên.");
  }

  const siteValue = String(formData.get("siteId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!isErpSiteId(siteValue) || !accountCanAccessSite(actor, siteValue)) {
    throw new Error("Cơ sở nằm ngoài phạm vi quản lý.");
  }

  const employee = findDemoErpAccountById(employeeId);
  if (!employee || employee.role !== "employee") {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const access = await getAccessState();
  const current = access.employees[employeeId] ?? {
    siteIds: [],
    moduleIdsBySite: {},
  };
  const assignedElsewhere = current.siteIds.find((id) => id !== siteValue);
  if (assignedElsewhere && actor.role !== "director") {
    throw new Error("Nhân viên đang thuộc một cơ sở khác.");
  }

  const siteActive = formData.get("siteActive") === "on";
  const trainedModules = new Set(getEmployeeAssignableModuleIds(employee));
  // Only modules that are both globally employee-assignable AND on this
  // employee's trained list ever appear as a checkbox in the UI (see
  // staff-access-manager.tsx's `assignableModules`). A module the employee
  // already holds outside that set (e.g. granted directly via a migration
  // seed, never added to their trainedModuleIds) is invisible to the form
  // and must be preserved here -- otherwise saving ANY other change for
  // this employee silently revokes it, since the form can only submit what
  // it can show.
  const visibleModules = new Set(
    ERP_MODULES.filter(
      (module) => module.employeeAssignable && trainedModules.has(module.id),
    ).map((module) => module.id),
  );
  const submittedVisible = formData
    .getAll("moduleIds")
    .map(String)
    .filter(isErpModuleId)
    .filter((moduleId) => visibleModules.has(moduleId)) as ErpModuleId[];
  const hiddenPreserved = (current.moduleIdsBySite[siteValue] ?? []).filter(
    (moduleId) => !visibleModules.has(moduleId),
  );
  const moduleIds = [...new Set([...submittedVisible, ...hiddenPreserved])] as ErpModuleId[];

  await updateEmployeeAccessGrant({
    employeeId,
    siteContextId: siteValue,
    siteActive,
    moduleIds,
    actorId: actor.id,
    actorRole: actor.role as "manager" | "director",
  });
  revalidatePath(`/erp/${siteValue}/nhan-su`);
}

export type AttendanceActionInput = {
  siteId: string;
  type: "check-in" | "check-out";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  useDemoLocation?: boolean;
};

export type AttendanceActionResult =
  | { success: true; message: string; event: AttendanceEvent }
  | { success: false; message: string };

function distanceMeters(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const deltaLat = radians(end.latitude - start.latitude);
  const deltaLon = radians(end.longitude - start.longitude);
  const startLat = radians(start.latitude);
  const endLat = radians(end.latitude);
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function vietnamDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export async function recordAttendanceAction(
  input: AttendanceActionInput,
): Promise<AttendanceActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "cham-cong")
  ) {
    return {
      success: false,
      message: "Bạn không được phân công chấm công tại cơ sở này.",
    };
  }

  const site = getErpSite(siteId)!;
  let latitude = Number(input.latitude);
  let longitude = Number(input.longitude);
  let accuracy = Number(input.accuracy);
  let source: AttendanceEvent["source"] = "gps";

  if (input.useDemoLocation) {
    latitude = site.coordinates.latitude;
    longitude = site.coordinates.longitude;
    accuracy = 12;
    source = "demo-location";
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { success: false, message: "Không đọc được vị trí của thiết bị." };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { success: false, message: "Tọa độ không hợp lệ." };
  }

  const distance = distanceMeters(
    { latitude, longitude },
    site.coordinates,
  );
  if (distance > site.geofenceRadiusMeters) {
    return {
      success: false,
      message: `Thiết bị đang cách vùng chấm công khoảng ${Math.round(
        distance / 100,
      ) * 100} m.`,
    };
  }

  const today = vietnamDateKey(new Date());
  let event: AttendanceEvent;
  try {
    event = await recordAttendanceEvent({
      userId: user.id,
      siteId,
      type: input.type,
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : null,
      source,
      businessDate: today,
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof AttendanceRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: "Chưa thể ghi nhận chấm công. Hãy kiểm tra kết nối rồi thử lại.",
    };
  }
  revalidatePath(`/erp/${siteId}/cham-cong`);
  return {
    success: true,
    message: input.type === "check-in" ? "Đã ghi nhận vào ca." : "Đã ghi nhận ra ca.",
    event,
  };
}

export type IncidentActionInput = { incidentId: string; siteId: string };
export type IncidentActionResult =
  | { success: true; message: string; incident: IncidentCase }
  | { success: false; message: string };

const incidentTransitionMessage: Record<IncidentCase["status"], string> = {
  reported: "đã báo sự cố",
  acknowledged: "tiếp nhận sự cố",
  "in-progress": "giao xử lý",
  verification: "yêu cầu xác minh",
  closed: "xác minh và đóng",
};

export async function transitionIncidentAction(
  input: IncidentActionInput,
): Promise<IncidentActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    user.role !== "manager" ||
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "su-co")
  ) {
    return { success: false, message: "Bạn không có quyền xử lý sự cố tại cơ sở này." };
  }

  try {
    const incident = await transitionIncidentByManager({
      incidentId: input.incidentId,
      siteId,
      actorId: user.id,
      actorName: user.name,
    });
    revalidatePath(`/erp/${siteId}/su-co`);
    return {
      success: true,
      message: `${incident.id}: ${incidentTransitionMessage[incident.status]}.`,
      incident,
    };
  } catch (error) {
    if (error instanceof IncidentRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể cập nhật sự cố. Hãy thử lại." };
  }
}

export async function progressIncidentAction(
  input: IncidentActionInput,
): Promise<IncidentActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    user.role !== "employee" ||
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "su-co")
  ) {
    return { success: false, message: "Bạn không có quyền cập nhật sự cố này." };
  }

  try {
    const incident = await progressIncidentByEmployee({
      incidentId: input.incidentId,
      siteId,
      actorId: user.id,
      actorName: user.name,
    });
    revalidatePath(`/erp/${siteId}/su-co`);
    return {
      success: true,
      message: `${incident.id}: đã chuyển quản lý xác minh.`,
      incident,
    };
  } catch (error) {
    if (error instanceof IncidentRepositoryConflictError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể cập nhật sự cố. Hãy thử lại." };
  }
}

export type CameraIncidentReportActionInput = {
  siteId: string;
  cameraName: string;
  zone: string;
  note: string;
  peopleCount: number;
  cameraStatus: "stable" | "attention" | "offline";
};

const cameraReportSuccessLabel: Record<"director" | "manager" | "employee", string> = {
  director: "Đã giao quản lý kiểm tra",
  manager: "Đã tạo phiếu hiện trường",
  employee: "Đã báo quản lý",
};

export async function reportIncidentFromCameraAction(
  input: CameraIncidentReportActionInput,
): Promise<IncidentActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    (user.role !== "director" && user.role !== "manager" && user.role !== "employee") ||
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "su-co")
  ) {
    return { success: false, message: "Bạn không có quyền tạo hồ sơ sự cố tại cơ sở này." };
  }

  try {
    const incident = await reportIncidentFromCamera({
      siteId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      cameraName: input.cameraName,
      zone: input.zone,
      note: input.note,
      peopleCount: input.peopleCount,
      cameraStatus: input.cameraStatus,
    });
    revalidatePath(`/erp/${siteId}/su-co`);
    return {
      success: true,
      message: `${cameraReportSuccessLabel[user.role]}: hồ sơ ${incident.id} đã được tạo trong module Sự cố.`,
      incident,
    };
  } catch (error) {
    if (error instanceof IncidentRepositoryError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể tạo hồ sơ sự cố. Hãy thử lại." };
  }
}

export type FieldReportActionResult =
  | { success: true; message: string; report: FieldReport }
  | { success: false; message: string };

export async function submitFieldReportAction(
  formData: FormData,
): Promise<FieldReportActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };

  const siteValue = String(formData.get("siteId") ?? "");
  if (!isErpSiteId(siteValue)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = siteValue;
  if (
    !canSubmitFieldOperation(user.role) ||
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "bao-cao-hien-truong")
  ) {
    return { success: false, message: "Bạn không có quyền gửi báo cáo tại cơ sở này." };
  }

  const area = String(formData.get("area") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const task = String(formData.get("task") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const financeCode = String(formData.get("financeCode") ?? "").trim();
  const progressRaw = Number(formData.get("progress"));
  const file = formData.get("evidence");

  if (!area || !category || !task || !note || !financeCode) {
    return { success: false, message: "Vui lòng điền đủ thông tin bắt buộc." };
  }
  if (![25, 50, 75, 100].includes(progressRaw)) {
    return { success: false, message: "Tiến độ không hợp lệ." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Vui lòng chọn ảnh hiện trường." };
  }

  try {
    const report = await submitFieldReport({
      siteId,
      area,
      category,
      task,
      employeeAccountId: user.id,
      employeeName: user.name,
      progress: progressRaw as 25 | 50 | 75 | 100,
      note,
      financeCode,
      file,
    });
    revalidatePath(`/erp/${siteId}/bao-cao-hien-truong`);
    return {
      success: true,
      message: `Đã ghi nhận ${report.id} và chuyển quản lý ${getErpSite(siteId)!.shortName}.`,
      report,
    };
  } catch (error) {
    if (error instanceof FieldReportRepositoryError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể lưu báo cáo. Hãy thử lại." };
  }
}

export type GateScanActionResult =
  | { success: true; message: string; event: GateScanEvent }
  | { success: false; message: string };

export async function recordGateScanAction(input: {
  siteId: string;
  code: string;
}): Promise<GateScanActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { success: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { success: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "check-in-khach")
  ) {
    return { success: false, message: "Bạn không được phân công check-in tại cơ sở này." };
  }
  const normalized = input.code.trim().toUpperCase();
  if (normalized.length < 6) {
    return { success: false, message: "Mã QR không hợp lệ." };
  }

  try {
    const event = await recordGateScan({
      siteId,
      code: normalized,
      actorId: user.id,
      actorName: user.name,
    });
    revalidatePath(`/erp/${siteId}/check-in-khach`);
    return {
      success: true,
      message: `Đã ghi nhận ${event.code} qua Cổng A lúc ${new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(event.scannedAt))}.`,
      event,
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể ghi nhận lượt quét. Hãy thử lại." };
  }
}
