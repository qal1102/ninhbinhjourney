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
  getCurrentErpUser,
  setErpSession,
} from "@/lib/erp/demo-session";
import {
  getAccessState,
  updateEmployeeAccessGrant,
} from "@/lib/erp/staff-access-repository";
import {
  AttendanceRepositoryConflictError,
  recordAttendanceEvent,
  type AttendanceEvent,
} from "@/lib/erp/attendance-repository";

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
  const allowedModules = new Set(
    ERP_MODULES.filter((module) => module.employeeAssignable).map(
      (module) => module.id,
    ),
  );
  const moduleIds = formData
    .getAll("moduleIds")
    .map(String)
    .filter(isErpModuleId)
    .filter((moduleId) => allowedModules.has(moduleId) && trainedModules.has(moduleId)) as ErpModuleId[];

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
