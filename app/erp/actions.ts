"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { DEMO_TICKETS_DISABLED_MESSAGE, resolveDemoTicketsEnabled } from "@/domain/erp-demo-tickets";
import { canModerateReviews, MODERATION_COPY } from "@/domain/visit-review-moderation";
import { hideVisitReview, unhideVisitReview } from "@/lib/erp/visit-review-moderation-repository";
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
  getGrantableModuleIds,
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
import { confirmPasswordChanged } from "@/lib/erp/account-registry-repository";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure } from "@/lib/erp/login-throttle";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
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
  collectOnSitePayment,
  GATE_SCAN_RESULT_LABELS,
  GateScanRepositoryError,
  listScannableTicketsToday,
  refreshDemoTickets,
  searchTickets,
  validateGateScan,
  type GateScanDecision,
  type GateScanEvent,
  type TicketSummary,
} from "@/lib/erp/gate-scan-repository";
import { canSubmitFieldOperation } from "@/domain/erp-role-policy";
import { validateCounterVisitorGroupInput } from "@/domain/erp-counter-visitor-group";
import {
  createCounterVisitorGroup,
  CounterVisitorGroupRepositoryError,
} from "@/lib/erp/visitor-group-counter-repository";
import {
  CounterSaleRepositoryError,
  createCounterSale,
  setCounterPrice,
  voidCounterSale,
} from "@/lib/erp/counter-sale-repository";
import type { CounterSaleReceipt } from "@/domain/erp-counter-sale";
import type { VisitorGroupStatus } from "@/domain/visitor-group";
import { changMoLai, VONG_TIEN_ID, type TienDoVongDan } from "@/domain/huong-dan-vong-dau";
import { writeTienDoVongDan } from "@/lib/erp/huong-dan-repository";

function safePasswordEqual(actual: string, expected: string) {
  const left = createHash("sha256").update(actual).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function loginError(code: "missing" | "invalid"): never {
  redirect(`/erp/login?error=${code}`);
}

/**
 * T6b: an identifier with "@" is a real email, so it goes through Supabase
 * Auth -- the only accounts that can be are ones a system-admin has already
 * linked via `/erp/tai-khoan`. Everything else still goes through the
 * shared-password demo path exactly as before. Two paths, one form: nobody
 * has to know which kind of account they hold to find the login screen.
 */
export async function loginErpAction(formData: FormData) {
  const identifier = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) loginError("missing");

  // QA-P2-09: nhập sai quá nhiều lần thì dừng trước khi thử mật khẩu, cho cả
  // hai lối đăng nhập. Tên có tồn tại hay không đều đếm như nhau, để không ai
  // dùng màn hình này dò ra tên đăng nhập thật.
  const chan = await checkLoginThrottle(identifier);
  if (!chan.allowed) redirect(`/erp/login?error=locked&phut=${chan.retryAfterMinutes}`);

  if (identifier.includes("@")) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });
    if (error) {
      await recordLoginFailure(identifier);
      loginError("invalid");
    }
    await clearLoginFailures(identifier);
    redirect("/erp");
  }

  const account = findDemoErpAccountByUsername(identifier);
  // An empty configured password means the role is closed on this deployment (A15-ACC-02).
  if (
    !account ||
    !account.password ||
    !safePasswordEqual(password, account.password) ||
    !isDemoErpAccountActive(account)
  ) {
    await recordLoginFailure(identifier);
    loginError("invalid");
  }

  await clearLoginFailures(identifier);
  await setErpSession(account.id);
  redirect("/erp");
}

export async function logoutErpAction() {
  // A Supabase Auth session and the legacy demo cookie can never both be
  // live for the same request (getCurrentErpUser only ever resolves one),
  // but a browser could still be holding a stale one of either kind, so both
  // are cleared unconditionally rather than branching on which was active.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearErpSession();
  redirect("/erp/login");
}

// Not exported: a "use server" file may only export async functions --
// account-actions.ts's INITIAL_ACCOUNT_ACTION_STATE const looked like a safe
// precedent for the same shape here, but it is what broke
// `next build` (found while shipping T6b): "A 'use server' file can only
// export async functions, found object". The type and initial value for this
// form now live with its one caller, components/erp/change-password-form.tsx.
type ChangePasswordActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function changePasswordErpAction(
  _previous: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8) {
    return { status: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự." };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "Hai lần nhập mật khẩu không khớp nhau." };
  }
  const user = await getCurrentErpUser();
  if (!user || !user.authUserId) {
    return {
      status: "error",
      message: "Phiên đăng nhập không hợp lệ. Xin đăng nhập lại.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      status: "error",
      message: "Không đổi được mật khẩu. Thử lại sau ít phút.",
    };
  }
  await confirmPasswordChanged(user.authUserId);
  redirect("/erp");
}

export async function switchDemoRoleAction(formData: FormData) {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const { director, target, previous } = await startRoleSwitch(targetUserId);
  // T4 allows hopping role to role without returning to the director. The
  // audit trail must still read as one closed session per account, so a hop
  // writes the "ended" leg for the account being left behind.
  if (previous) {
    await recordRoleSwitch({
      directorId: director.id,
      directorName: director.name,
      targetId: previous.id,
      targetName: previous.name,
      targetRole: previous.role,
      action: "ended",
    });
  }
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
  if (!employee || (employee.role !== "employee" && employee.role !== "manager")) {
    throw new Error("Không tìm thấy nhân viên.");
  }
  // V14: managers are now permissioned through this same grant, so their row
  // is editable here -- but only by a director, and only on the site they
  // actually manage. A manager must never be able to widen their own scope
  // (or a peer's) through the screen they themselves operate.
  if (employee.role === "manager") {
    if (actor.role !== "director") {
      throw new Error("Chỉ giám đốc mới đổi được quyền của quản lý cơ sở.");
    }
    if (!employee.managedSiteIds.includes(siteValue)) {
      throw new Error("Quản lý này không phụ trách cơ sở đang mở.");
    }
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
  const grantableModules = new Set(getGrantableModuleIds(employee));
  // Only the modules the UI actually renders as a checkbox may be toggled
  // here (see staff-access-manager.tsx): for an employee that is the
  // intersection of globally employee-assignable and their trained list; for
  // a manager it is every module. A module the account already holds outside
  // that set (e.g. granted directly via a migration seed, never added to
  // their trainedModuleIds) is invisible to the form and must be preserved
  // here -- otherwise saving ANY other change silently revokes it, since the
  // form can only submit what it can show.
  const visibleModules = new Set(
    ERP_MODULES.filter(
      (module) =>
        grantableModules.has(module.id) &&
        (employee.role === "manager" || module.employeeAssignable),
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
      message: "Chưa thể ghi nhận chấm công. Xin kiểm tra kết nối rồi thử lại.",
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
    return { success: false, message: "Chưa thể cập nhật sự cố. Xin thử lại." };
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
    return { success: false, message: "Chưa thể cập nhật sự cố. Xin thử lại." };
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
    return { success: false, message: "Chưa thể tạo hồ sơ sự cố. Xin thử lại." };
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
    return { success: false, message: "Chưa thể lưu báo cáo. Xin thử lại." };
  }
}

export type GateScanActionResult =
  | {
      success: true;
      message: string;
      event: GateScanEvent;
      decision: GateScanDecision;
    }
  | { success: false; message: string; decision?: GateScanDecision };

export async function recordGateScanAction(input: {
  siteId: string;
  code: string;
  idempotencyKey?: string;
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
    // T8: the gate now decides against a real ticket. A refusal is a normal,
    // recorded outcome -- not an error -- so it comes back with the reason
    // attached instead of a generic failure.
    const decision = await validateGateScan({
      siteId,
      code: normalized,
      actorId: user.id,
      actorName: user.name,
      idempotencyKey: input.idempotencyKey,
    });
    revalidatePath(`/erp/${siteId}/check-in-khach`);
    const clock = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(decision.scannedAt));
    const event: GateScanEvent = {
      id: decision.code + decision.scannedAt,
      siteId,
      code: decision.code,
      scannedByName: user.name,
      scannedAt: decision.scannedAt,
    };
    if (decision.result === "payment-due") {
      // TC-22: đây không phải một tấm vé hỏng, nên câu chữ phải nói đúng việc
      // nhân viên cần làm — thu bao nhiêu — chứ không chỉ nói "không cho vào".
      const tien = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(decision.paymentDueVnd);
      return {
        success: false,
        message: `${decision.code}: khách chọn trả tiền tại điểm. Thu ${tien} rồi bấm “Đã thu tiền”.`,
        decision,
      };
    }
    if (decision.result !== "accepted") {
      return {
        success: false,
        message: `${decision.code}: ${GATE_SCAN_RESULT_LABELS[decision.result]}.`,
        decision,
      };
    }
    const guest = decision.ticket?.guestName
      ? ` · ${decision.ticket.guestName}`
      : "";
    const remaining = decision.ticket
      ? ` (${decision.ticket.entriesUsed}/${decision.ticket.entriesAllowed} lượt)`
      : "";
    // Vé khách đặt trên web: nói luôn khách đã trả bằng cách nào, để nhân
    // viên khỏi hỏi lại. Đọc không được thì thôi, cổng vẫn chạy như cũ.
    let cachTra: string | null = null;
    if (!decision.replayed) {
      try {
        const { cachTraCuaVe } = await import("@/lib/customer-data/booking-repository");
        cachTra = await cachTraCuaVe(decision.code);
      } catch {
        cachTra = null;
      }
    }
    const daTra = cachTra === "qr-transfer" ? " · Đã thanh toán bằng QR" : "";
    return {
      success: true,
      message: decision.replayed
        ? `${decision.code} đã được ghi nhận trước đó lúc ${clock}, không tính thêm lượt.`
        : `Vé hợp lệ${guest}${remaining}${daTra} — vào cổng lúc ${clock}.`,
      event,
      decision,
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Chưa thể ghi nhận lượt quét. Xin thử lại." };
  }
}

export type TicketLookupResult = {
  tickets: TicketSummary[];
  message: string;
};

/**
 * T8. A guest at the gate has lost their phone, not their identity: the ticket
 * has to be findable by name, by phone or by booking reference, not only by
 * the code they can no longer show. Before this the only way in was the code
 * itself, so the answer to a flat battery was "buy another ticket".
 */
export async function lookupTicketsAction(input: {
  siteId: string;
  query: string;
}): Promise<TicketLookupResult> {
  const user = await getCurrentErpUser();
  if (!user) return { tickets: [], message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { tickets: [], message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "check-in-khach")
  ) {
    return {
      tickets: [],
      message: "Bạn không được phân công check-in tại cơ sở này.",
    };
  }
  const query = input.query.trim();
  if (query.length < 3) {
    return {
      tickets: [],
      message: "Nhập ít nhất 3 ký tự của mã vé, tên khách hoặc số điện thoại.",
    };
  }
  try {
    const tickets = await searchTickets(siteId, query);
    return {
      tickets,
      message: tickets.length
        ? `Tìm thấy ${tickets.length} vé khớp.`
        : "Không tìm thấy vé nào khớp tại cơ sở này.",
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { tickets: [], message: error.message };
    }
    return { tickets: [], message: "Chưa tra cứu được vé. Xin thử lại." };
  }
}

/**
 * Vé còn quét được ở cơ sở này, hôm nay.
 *
 * Ô tra cứu bên cạnh đòi gõ trước ba ký tự, mà người mới mở màn hình thì
 * không biết gõ gì. Đây là câu trả lời cho "giờ tôi quét cái gì".
 */
export async function listTodayTicketsAction(input: {
  siteId: string;
}): Promise<TicketLookupResult> {
  const user = await getCurrentErpUser();
  if (!user) return { tickets: [], message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { tickets: [], message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "check-in-khach")
  ) {
    return {
      tickets: [],
      message: "Bạn không được phân công check-in tại cơ sở này.",
    };
  }
  try {
    const tickets = await listScannableTicketsToday(siteId);
    return {
      tickets,
      message: tickets.length
        ? `Có ${tickets.length} vé còn quét được hôm nay.`
        : "Hôm nay chưa có vé nào còn hiệu lực tại cơ sở này.",
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { tickets: [], message: error.message };
    }
    return { tickets: [], message: "Chưa đọc được danh sách vé. Xin thử lại." };
  }
}

/**
 * Kéo vé mẫu về hôm nay.
 *
 * Tám tấm vé mẫu neo cứng vào ngày seed, nên sau ngày đó không ai thử được
 * cổng nữa: quét tấm nào cũng ra "vé không dùng cho hôm nay". Nút này kéo
 * chúng về hôm nay và trả lại lượt vào đã dùng.
 *
 * Chỉ giám đốc bấm được, và PostgreSQL chặn cứng phạm vi: chỉ những mã dạng
 * `TA-2026-000101` mới bị chạm, vé khách thật mua qua web thì không.
 */
export async function refreshDemoTicketsAction(): Promise<{
  ok: boolean;
  message: string;
  ticketCodes: string[];
}> {
  const user = await getCurrentErpUser();
  if (!user) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn.", ticketCodes: [] };
  }
  // Ẩn nút trên màn hình là chưa đủ: lệnh này gọi thẳng được. Cờ phải chặn ở
  // đây thì mới thật sự tắt (A15-ERP-07).
  if (!resolveDemoTicketsEnabled(process.env.ERP_DEMO_TICKETS_ENABLED)) {
    return { ok: false, message: DEMO_TICKETS_DISABLED_MESSAGE, ticketCodes: [] };
  }
  try {
    const result = await refreshDemoTickets(user.id);
    const ngay = new Date(`${result.validOn}T00:00:00`).toLocaleDateString("vi-VN");
    return {
      ok: true,
      message: result.ticketCodes.length
        ? `Đã kéo ${result.ticketCodes.length} vé mẫu về ngày ${ngay}. Mời bạn quét thử.`
        : "Không có vé mẫu nào để kéo về hôm nay.",
      ticketCodes: result.ticketCodes,
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { ok: false, message: error.message, ticketCodes: [] };
    }
    return {
      ok: false,
      message: "Chỉ giám đốc mới làm mới được vé mẫu.",
      ticketCodes: [],
    };
  }
}

/**
 * TC-22 — nhân viên ở cổng bấm "đã thu tiền" cho một tấm vé trả tại điểm.
 *
 * Quyền không kiểm ở đây: PostgreSQL đọc đúng luật gác cổng đã có. Chỗ này chỉ
 * là đường đi, và một luật quyền thứ hai ở tầng này sẽ là chỗ để hai bên lệch
 * nhau mà không ai biết.
 */
export async function collectOnSitePaymentAction(input: {
  siteId: string;
  code: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { ok: false, message: "Cơ sở không hợp lệ." };
  }
  try {
    const ket_qua = await collectOnSitePayment({
      siteId: input.siteId,
      code: input.code,
      actorId: user.id,
    });
    const tien = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(ket_qua.amountVnd);
    if (ket_qua.alreadyCollected) {
      return {
        ok: true,
        message: `Đơn ${ket_qua.orderCode} đã có người thu ${tien} rồi. Mời bạn quét lại để cho khách vào.`,
      };
    }
    return {
      ok: true,
      message: `Đã ghi nhận thu ${tien} cho đơn ${ket_qua.orderCode}. Mời bạn quét lại để cho khách vào.`,
    };
  } catch (error) {
    if (error instanceof GateScanRepositoryError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Chưa ghi nhận được khoản thu. Bạn thử lại giúp em, nếu vẫn vậy thì báo đội kỹ thuật.",
    };
  }
}

const COUNTER_GROUP_INPUT_ERROR_MESSAGES: Record<string, string> = {
  PARTY_SIZE_INVALID: "Số người phải là số nguyên từ 1 đến 45.",
  GROUP_LABEL_REQUIRED: "Nhập một nhãn để dễ nhận ra đoàn này, ví dụ nơi xuất phát hoặc tên đoàn.",
  GROUP_LABEL_TOO_LONG: "Nhãn đoàn tối đa 120 ký tự.",
};

export type CreateCounterVisitorGroupActionResult =
  | { ok: true; status: VisitorGroupStatus }
  | { ok: false; message: string };

/**
 * TC-18 — nhân viên bán vé lập một phiếu đoàn ngay tại quầy.
 *
 * Chỉ nhận số người và nhãn đoàn; mã đoàn và mã từng người do
 * `erp_create_counter_visitor_group` tự sinh (ERP-UX-06 — không nhận mã gõ
 * tay ở bất kỳ tầng nào). Quyền được kiểm hai lớp, giống hệt
 * `recordGateScanAction`: lớp này (module `ve-dat-cho`) chỉ để trả lời sớm và
 * đúng chữ, lớp thật nằm ở `erp_counter_actor_can_sell` trong PostgreSQL.
 */
export async function createCounterVisitorGroupAction(input: {
  siteId: string;
  partySize: number;
  groupLabel: string;
  /** Khoá chống lập trùng, do màn hình sinh một lần cho mỗi tấm phiếu. */
  idempotencyKey: string;
}): Promise<CreateCounterVisitorGroupActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) {
    return { ok: false, message: "Cơ sở không hợp lệ." };
  }
  const siteId: ErpSiteId = input.siteId;
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "ve-dat-cho")
  ) {
    return { ok: false, message: "Bạn không được phân công bán vé tại cơ sở này." };
  }

  const parsed = validateCounterVisitorGroupInput({
    partySize: input.partySize,
    groupLabel: input.groupLabel,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      message: COUNTER_GROUP_INPUT_ERROR_MESSAGES[parsed.error] ?? "Thông tin đoàn chưa hợp lệ.",
    };
  }

  // Khoá rỗng thì máy chủ sẽ từ chối, và câu từ chối ấy nói về một thứ nhân
  // viên không nhìn thấy bao giờ. Chặn ngay ở đây, bằng lời của người dùng.
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 1 || idempotencyKey.length > 128) {
    return { ok: false, message: "Chưa lập được phiếu đoàn tại quầy. Mời bạn tải lại trang rồi thử lại ạ." };
  }

  try {
    const status = await createCounterVisitorGroup({
      siteId,
      actorAccountId: user.id,
      actorName: user.name,
      partySize: parsed.partySize,
      groupLabel: parsed.groupLabel,
      idempotencyKey,
    });
    revalidatePath(`/erp/${siteId}/ve-dat-cho`);
    return { ok: true, status };
  } catch (error) {
    if (error instanceof CounterVisitorGroupRepositoryError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Chưa lập được phiếu đoàn tại quầy. Xin thử lại." };
  }
}

export type CounterSaleActionResult =
  | { ok: true; receipt: CounterSaleReceipt; message: string }
  | { ok: false; message: string };

/**
 * QA-ERP-POS-04 — nhân viên bán vé tại quầy.
 *
 * Màn hình chỉ gửi số vé, số tiền khách đưa và dấu xác nhận đã đếm tiền. Giá
 * và tổng tiền do `erp_create_counter_sale` tự tính từ bảng giá đang hiệu lực.
 * Quyền được kiểm hai lớp như `createCounterVisitorGroupAction`: lớp này để
 * trả lời sớm và đúng chữ, lớp thật ở `erp_counter_actor_can_sell`.
 *
 * Giám đốc đang "xem thử" vai nhân viên thì phiếu mang tài khoản nhân viên,
 * đúng như mọi thao tác khác trong lúc xem thử — nhưng tên giám đốc thật đi
 * kèm vào phiếu và nhật ký, để không ai bị gán nhầm trách nhiệm về số tiền.
 */
export async function createCounterSaleAction(input: {
  siteId: string;
  adults: number;
  children: number;
  paymentMethod: "cash" | "qr-transfer";
  cashReceivedVnd: number;
  paymentReference?: string | null;
  cashCountedConfirmed: boolean;
  requestKey: string;
}): Promise<CounterSaleActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) return { ok: false, message: "Cơ sở không hợp lệ." };
  if (!accountCanAccessModule(user, input.siteId, "ve-dat-cho")) {
    return { ok: false, message: "Tài khoản này chưa được phân công bán vé tại cơ sở này." };
  }
  if (input.cashCountedConfirmed !== true) {
    return { ok: false, message: "Chưa đánh dấu đã đếm tiền và bỏ vào quỹ, nên phiếu chưa được lưu." };
  }
  try {
    const receipt = await createCounterSale({
      siteId: input.siteId,
      actorAccountId: user.id,
      actorName: user.name,
      actingDirectorAccountId: user.actingAs?.directorId ?? null,
      adults: Math.trunc(Number(input.adults)),
      children: Math.trunc(Number(input.children)),
      paymentMethod: input.paymentMethod === "qr-transfer" ? "qr-transfer" : "cash",
      cashReceivedVnd: Math.trunc(Number(input.cashReceivedVnd)),
      paymentReference: input.paymentReference ? String(input.paymentReference) : null,
      cashCountedConfirmed: true,
      requestKey: String(input.requestKey ?? ""),
    });
    revalidatePath(`/erp/${input.siteId}/ve-dat-cho`);
    return { ok: true, receipt, message: `Đã lưu phiếu ${receipt.saleCode}. Mời bạn đưa vé cho khách.` };
  } catch (error) {
    if (error instanceof CounterSaleRepositoryError) return { ok: false, message: error.message };
    return { ok: false, message: "Chưa lưu được phiếu. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật." };
  }
}

/** QA-ERP-POS-04 — quản lý hoặc giám đốc huỷ một phiếu bán trong ngày. */
export async function voidCounterSaleAction(input: {
  siteId: string;
  saleCode: string;
  reason: string;
}): Promise<CounterSaleActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) return { ok: false, message: "Cơ sở không hợp lệ." };
  if (user.role !== "manager" && user.role !== "director") {
    return { ok: false, message: "Chỉ quản lý cơ sở hoặc giám đốc được huỷ vé." };
  }
  if (String(input.reason ?? "").trim().length < 10) {
    return { ok: false, message: "Xin ghi lý do huỷ, ít nhất mười ký tự." };
  }
  try {
    const receipt = await voidCounterSale({
      siteId: input.siteId,
      actorAccountId: user.id,
      actorName: user.name,
      actingDirectorAccountId: user.actingAs?.directorId ?? null,
      saleCode: String(input.saleCode ?? ""),
      reason: String(input.reason ?? ""),
    });
    revalidatePath(`/erp/${input.siteId}/ve-dat-cho`);
    return { ok: true, receipt, message: `Đã huỷ phiếu ${receipt.saleCode}. Xin hoàn tiền cho khách.` };
  } catch (error) {
    if (error instanceof CounterSaleRepositoryError) return { ok: false, message: error.message };
    return { ok: false, message: "Chưa huỷ được phiếu. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật." };
  }
}

export type SetCounterPriceActionResult = { ok: boolean; message: string };

/**
 * QA-ERP-POS-05 — giám đốc đặt giá vé quầy. Chỉ giám đốc thật: đang "xem thử"
 * vai khác thì tài khoản hiện hành không phải giám đốc và máy chủ từ chối, đúng
 * như `erp_counter_actor_can_set_price`.
 */
export async function setCounterPriceAction(input: {
  siteId: string;
  product: string;
  unitPriceVnd: number;
  effectiveFrom: string;
  note: string;
}): Promise<SetCounterPriceActionResult> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (user.role !== "director") return { ok: false, message: "Chỉ giám đốc được đặt giá vé quầy." };
  if (!isErpSiteId(input.siteId)) return { ok: false, message: "Cơ sở không hợp lệ." };
  if (input.product !== "adult" && input.product !== "child") {
    return { ok: false, message: "Loại vé không hợp lệ." };
  }
  try {
    await setCounterPrice({
      siteId: input.siteId,
      actorAccountId: user.id,
      actorName: user.name,
      product: input.product,
      unitPriceVnd: Math.trunc(Number(input.unitPriceVnd)),
      effectiveFrom: String(input.effectiveFrom ?? ""),
      note: String(input.note ?? "").slice(0, 500),
    });
    revalidatePath("/erp/bang-gia-quay");
    revalidatePath(`/erp/${input.siteId}/ve-dat-cho`);
    return { ok: true, message: "Đã lưu giá mới. Quầy thấy giá này từ ngày áp dụng." };
  } catch (error) {
    if (error instanceof CounterSaleRepositoryError) return { ok: false, message: error.message };
    return { ok: false, message: "Chưa lưu được giá mới. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật." };
  }
}

/**
 * TC-12 mục 3–4 — ẩn một lời khách, hoặc hiện lại lời đã ẩn.
 *
 * Lệnh này KHÔNG tự quyết ai được làm: nó chuyển thẳng vai của người đang đăng
 * nhập xuống `erp_hide_visit_review`, nơi hạn mức, giới hạn "không được ẩn tới
 * mức toàn 5 sao" và nhật ký cùng nằm trong một giao dịch. Chặn ở đây chỉ để
 * đỡ một vòng đi xuống kho khi vai rõ ràng không có quyền.
 */
export async function moderateVisitReviewAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getCurrentErpUser();
  if (!actor) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!canModerateReviews(actor.role)) {
    return { ok: false, message: MODERATION_COPY.khongCoQuyen };
  }

  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const action = String(formData.get("action") ?? "hide");
  if (!reviewId) return { ok: false, message: "Thiếu mã đánh giá." };
  if (reason.length < 5) return { ok: false, message: MODERATION_COPY.thieuLyDo };

  const ket_qua =
    action === "unhide"
      ? await unhideVisitReview({ actorAccountId: actor.id, actorRole: actor.role, reviewId, reason })
      : await hideVisitReview({ actorAccountId: actor.id, actorRole: actor.role, reviewId, reason });

  if (!ket_qua.ok) return { ok: false, message: ket_qua.message };
  revalidatePath("/erp/khach-hang");
  return {
    ok: true,
    message:
      action === "unhide"
        ? "Đã hiện lại lời này ạ."
        : `Đã ẩn lời này ạ. ${MODERATION_COPY.conLai(
            ket_qua.quotaLimit === null ? null : Math.max(0, ket_qua.quotaLimit - (ket_qua.quotaUsed ?? 0)),
          )}`,
  };
}

/**
 * Mạch dẫn — ghi lại người này đang đi tới chặng nào của vòng dẫn.
 *
 * Không có nhánh phân quyền nào ở đây, cố ý: vòng dẫn chỉ ghi vào hàng của
 * chính tài khoản đang đăng nhập, và nó không mang một mẩu dữ liệu nghiệp vụ
 * nào. Thứ tệ nhất một lượt gọi sai có thể làm là khiến chính người gọi phải
 * xem lại vòng dẫn từ đầu.
 */
export async function ghiTienDoVongDanAction(
  formData: FormData,
): Promise<{ ok: boolean; tienDo: TienDoVongDan }> {
  const actor = await getCurrentErpUser();
  if (!actor) {
    return {
      ok: false,
      tienDo: { changHienTai: 1, daXong: false, boQua: false, tungDi: false },
    };
  }

  const chang = Number(formData.get("chang"));
  const tienDo = await writeTienDoVongDan({
    accountId: actor.id,
    vongId: VONG_TIEN_ID,
    chang: Number.isFinite(chang) ? changMoLai(chang) : 1,
    xong: formData.get("xong") === "1",
    boQua: formData.get("boQua") === "1",
    diLai: formData.get("diLai") === "1",
  });
  return { ok: true, tienDo };
}
