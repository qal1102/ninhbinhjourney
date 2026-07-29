import {
  isErpModuleId,
  isErpSiteId,
  type ErpModuleId,
  type ErpRole,
  type ErpSiteId,
} from "@/domain/erp";

export const WORKDAY_STATUSES = [
  "assigned",
  "checked-in",
  "in-progress",
  "submitted",
  "manager-returned",
  "approved",
] as const;

export type WorkdayStatus = (typeof WORKDAY_STATUSES)[number];
export type WorkdayPriority = "normal" | "high" | "critical";

export type WorkdayActor = {
  id: string;
  name: string;
  role: ErpRole;
};

export type WorkdayEvidence = {
  id: string;
  kind: "photo";
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  uploadedAt: string;
  uploadedBy: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number;
  siteVerified: boolean;
  previewUrl?: string;
};

export type WorkdayLocationEvent = {
  id: string;
  workdayId: string;
  employeeAccountId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number;
  insideGeofence: boolean;
  recordedAt: string;
};

export type WorkdayAuditEvent = {
  id: string;
  sequence: number;
  action:
    | "manager.assign"
    | "employee.check-in"
    | "employee.progress"
    | "employee.submit"
    | "manager.review";
  fromStatus: WorkdayStatus | null;
  toStatus: WorkdayStatus;
  actor: WorkdayActor;
  note: string;
  at: string;
};

export type WorkdayRecord = {
  id: string;
  code: string;
  siteId: ErpSiteId;
  businessDate: string;
  employee: WorkdayActor;
  manager: WorkdayActor;
  moduleId: ErpModuleId;
  station: string;
  shiftLabel: string;
  taskTitle: string;
  instructions: string;
  priority: WorkdayPriority;
  dueAt: string;
  evidenceRequired: boolean;
  status: WorkdayStatus;
  progressPercent: number;
  latestUpdateNote: string;
  resultNote: string;
  evidence: WorkdayEvidence[];
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
  latestLocation: WorkdayLocationEvent | null;
  managerNote: string;
  version: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: WorkdayAuditEvent[];
};

export type WorkdayAssignmentInput = {
  id: string;
  code: string;
  siteId: ErpSiteId;
  businessDate: string;
  employee: WorkdayActor;
  manager: WorkdayActor;
  moduleId: ErpModuleId;
  station: string;
  shiftLabel: string;
  taskTitle: string;
  instructions: string;
  priority: WorkdayPriority;
  dueAt: string;
  evidenceRequired: boolean;
  idempotencyKey: string;
  createdAt: string;
  auditEventId: string;
};

export type WorkdayAction =
  | {
      type: "employee.check-in";
      actor: WorkdayActor;
      latitude: number;
      longitude: number;
      accuracy: number | null;
      at: string;
      auditEventId: string;
    }
  | {
      type: "employee.progress";
      actor: WorkdayActor;
      progressPercent: number;
      note: string;
      evidence?: WorkdayEvidence;
      at: string;
      auditEventId: string;
    }
  | {
      type: "employee.submit";
      actor: WorkdayActor;
      note: string;
      evidence?: WorkdayEvidence;
      at: string;
      auditEventId: string;
    }
  | {
      type: "manager.review";
      actor: WorkdayActor;
      decision: "approve" | "return";
      note: string;
      at: string;
      auditEventId: string;
    };

const SAFE_TEXT_LIMIT = 2_000;

function requireText(value: string, label: string, min = 2, max = 200) {
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${label} phải có từ ${min} đến ${max} ký tự.`);
  }
  return normalized;
}

function requireIso(value: string, label: string) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return new Date(value).toISOString();
}

function requireActor(
  actor: WorkdayActor,
  role: "employee" | "manager",
  expectedId?: string,
) {
  if (actor.role !== role || (expectedId && actor.id !== expectedId)) {
    throw new Error("Vai trò hoặc người thực hiện không đúng với phiếu công việc.");
  }
}

function requireStatus(
  record: WorkdayRecord,
  allowed: readonly WorkdayStatus[],
) {
  if (!allowed.includes(record.status)) {
    throw new Error(`Không thể thực hiện bước này khi hồ sơ đang ở trạng thái ${record.status}.`);
  }
}

function requireGpsAccuracy(value: number | null, label: string) {
  if (
    value === null ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 250
  ) {
    throw new Error(`${label} phải là số lớn hơn 0 và không vượt quá 250 m.`);
  }
}

function requireEvidenceLocation(evidence: WorkdayEvidence) {
  requireGpsAccuracy(evidence.accuracy, "Độ chính xác GPS khi tải ảnh");
  if (
    !Number.isFinite(evidence.latitude) ||
    evidence.latitude < -90 ||
    evidence.latitude > 90 ||
    !Number.isFinite(evidence.longitude) ||
    evidence.longitude < -180 ||
    evidence.longitude > 180 ||
    !Number.isFinite(Date.parse(evidence.capturedAt))
  ) {
    throw new Error("Dữ liệu GPS hoặc thời điểm tải ảnh không hợp lệ.");
  }
  if (!evidence.siteVerified) {
    throw new Error(
      "GPS của thiết bị khi tải ảnh phải được ghi nhận trong vùng cơ sở.",
    );
  }
}

export function isWorkdayStatus(value: unknown): value is WorkdayStatus {
  return WORKDAY_STATUSES.includes(value as WorkdayStatus);
}

export function createWorkdayAssignment(
  input: WorkdayAssignmentInput,
): WorkdayRecord {
  requireActor(input.manager, "manager");
  requireActor(input.employee, "employee");
  if (!isErpSiteId(input.siteId) || !isErpModuleId(input.moduleId)) {
    throw new Error("Cơ sở hoặc nghiệp vụ giao việc không hợp lệ.");
  }
  const createdAt = requireIso(input.createdAt, "Thời điểm giao việc");
  const dueAt = requireIso(input.dueAt, "Hạn hoàn thành");
  if (Date.parse(dueAt) <= Date.parse(createdAt)) {
    throw new Error("Hạn hoàn thành phải sau thời điểm giao việc.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new Error("Ngày làm việc không hợp lệ.");
  }

  const record: WorkdayRecord = {
    id: requireText(input.id, "Mã định danh", 8, 80),
    code: requireText(input.code, "Mã phiếu", 5, 80),
    siteId: input.siteId,
    businessDate: input.businessDate,
    employee: { ...input.employee },
    manager: { ...input.manager },
    moduleId: input.moduleId,
    station: requireText(input.station, "Trạm làm việc", 2, 120),
    shiftLabel: requireText(input.shiftLabel, "Ca làm", 2, 80),
    taskTitle: requireText(input.taskTitle, "Tên công việc", 4, 180),
    instructions: requireText(
      input.instructions,
      "Yêu cầu hoàn thành",
      4,
      1_000,
    ),
    priority: input.priority,
    dueAt,
    evidenceRequired: input.evidenceRequired,
    status: "assigned",
    progressPercent: 0,
    latestUpdateNote: "",
    resultNote: "",
    evidence: [],
    checkInAt: null,
    checkOutAt: null,
    checkInLocation: null,
    latestLocation: null,
    managerNote: "",
    version: 1,
    idempotencyKey: requireText(
      input.idempotencyKey,
      "Khóa chống gửi trùng",
      8,
      200,
    ),
    createdAt,
    updatedAt: createdAt,
    auditTrail: [
      {
        id: input.auditEventId,
        sequence: 1,
        action: "manager.assign",
        fromStatus: null,
        toStatus: "assigned",
        actor: { ...input.manager },
        note: `Giao việc cho ${input.employee.name}`,
        at: createdAt,
      },
    ],
  };
  return record;
}

function nextStatus(
  record: WorkdayRecord,
  action: WorkdayAction,
): WorkdayStatus {
  if ("evidence" in action && action.evidence) {
    requireEvidenceLocation(action.evidence);
  }
  if (action.type === "employee.check-in") {
    requireActor(action.actor, "employee", record.employee.id);
    requireStatus(record, ["assigned"]);
    return "checked-in";
  }
  if (action.type === "employee.progress") {
    requireActor(action.actor, "employee", record.employee.id);
    requireStatus(record, ["checked-in", "in-progress"]);
    if (
      !Number.isInteger(action.progressPercent) ||
      action.progressPercent < 1 ||
      action.progressPercent > 99 ||
      action.progressPercent < record.progressPercent
    ) {
      throw new Error("Tiến độ phải tăng dần và nằm trong khoảng 1–99%.");
    }
    return "in-progress";
  }
  if (action.type === "employee.submit") {
    requireActor(action.actor, "employee", record.employee.id);
    requireStatus(record, ["checked-in", "in-progress", "manager-returned"]);
    if (record.evidenceRequired && !action.evidence) {
      throw new Error(
        "Mỗi lần bàn giao công việc này cần một ảnh mới cùng GPS tại thời điểm gửi.",
      );
    }
    if (
      action.evidence &&
      record.evidence.some(
        (item) =>
          item.id === action.evidence?.id ||
          item.storagePath === action.evidence?.storagePath,
      )
    ) {
      throw new Error("Ảnh bàn giao phải là ảnh mới, chưa có trong phiếu.");
    }
    if (record.status === "manager-returned" && record.evidenceRequired) {
      const lastReturn = [...record.auditTrail]
        .reverse()
        .find(
          (event) =>
            event.action === "manager.review" &&
            event.toStatus === "manager-returned",
        );
      const isNewEvidence =
        Boolean(action.evidence) &&
        (!lastReturn ||
          Date.parse(action.evidence?.capturedAt ?? "") >
            Date.parse(lastReturn.at));
      if (!isNewEvidence) {
        throw new Error(
          "Phiếu bị trả lại cần một ảnh bổ sung mới cùng GPS ghi nhận sau yêu cầu của quản lý.",
        );
      }
    }
    return "submitted";
  }
  requireActor(action.actor, "manager", record.manager.id);
  requireStatus(record, ["submitted"]);
  return action.decision === "approve" ? "approved" : "manager-returned";
}

export function transitionWorkday(
  record: WorkdayRecord,
  action: WorkdayAction,
): WorkdayRecord {
  const at = requireIso(action.at, "Thời điểm thao tác");
  const status = nextStatus(record, action);
  const evidence =
    "evidence" in action && action.evidence
      ? [...record.evidence, action.evidence]
      : [...record.evidence];
  let progressPercent = record.progressPercent;
  let latestUpdateNote = record.latestUpdateNote;
  let resultNote = record.resultNote;
  let checkInAt = record.checkInAt;
  let checkOutAt = record.checkOutAt;
  let checkInLocation = record.checkInLocation;
  let managerNote = record.managerNote;
  let note = "";

  if (action.type === "employee.check-in") {
    if (
      !Number.isFinite(action.latitude) ||
      action.latitude < -90 ||
      action.latitude > 90 ||
      !Number.isFinite(action.longitude) ||
      action.longitude < -180 ||
      action.longitude > 180
    ) {
      throw new Error("Tọa độ vào ca không hợp lệ.");
    }
    requireGpsAccuracy(action.accuracy, "Độ chính xác GPS khi vào ca");
    checkInAt = at;
    checkInLocation = {
      latitude: action.latitude,
      longitude: action.longitude,
      accuracy: action.accuracy,
    };
    note = "Nhân viên đã vào ca tại đúng cơ sở.";
  } else if (action.type === "employee.progress") {
    progressPercent = action.progressPercent;
    latestUpdateNote = requireText(
      action.note,
      "Nội dung cập nhật",
      4,
      SAFE_TEXT_LIMIT,
    );
    note = `Cập nhật tiến độ ${action.progressPercent}%: ${latestUpdateNote}`;
  } else if (action.type === "employee.submit") {
    progressPercent = 100;
    resultNote = requireText(
      action.note,
      "Kết quả bàn giao",
      4,
      SAFE_TEXT_LIMIT,
    );
    latestUpdateNote = resultNote;
    checkOutAt = at;
    note = `Bàn giao kết quả và ra ca: ${resultNote}`;
  } else {
    managerNote = requireText(
      action.note,
      "Ý kiến quản lý",
      action.decision === "return" ? 4 : 2,
      SAFE_TEXT_LIMIT,
    );
    note =
      action.decision === "approve"
        ? `Quản lý xác nhận hoàn thành: ${managerNote}`
        : `Quản lý trả lại để bổ sung: ${managerNote}`;
    if (action.decision === "return") {
      checkOutAt = null;
    }
  }

  return {
    ...record,
    status,
    progressPercent,
    latestUpdateNote,
    resultNote,
    evidence,
    checkInAt,
    checkOutAt,
    checkInLocation,
    latestLocation: record.latestLocation,
    managerNote,
    version: record.version + 1,
    updatedAt: at,
    auditTrail: [
      ...record.auditTrail,
      {
        id: action.auditEventId,
        sequence: record.auditTrail.length + 1,
        action: action.type,
        fromStatus: record.status,
        toStatus: status,
        actor: { ...action.actor },
        note,
        at,
      },
    ],
  };
}

export function parseWorkdayRecord(value: unknown): WorkdayRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Phiếu công việc không hợp lệ.");
  }
  const record = value as WorkdayRecord;
  if (
    !isWorkdayStatus(record.status) ||
    !isErpSiteId(record.siteId) ||
    !isErpModuleId(record.moduleId) ||
    !Number.isInteger(record.version) ||
    record.version < 1 ||
    !Array.isArray(record.evidence) ||
    !Array.isArray(record.auditTrail)
  ) {
    throw new Error("Cấu trúc phiếu công việc không hợp lệ.");
  }
  requireActor(record.employee, "employee");
  requireActor(record.manager, "manager");
  requireIso(record.createdAt, "Thời điểm tạo");
  requireIso(record.updatedAt, "Thời điểm cập nhật");
  requireIso(record.dueAt, "Hạn hoàn thành");
  return record;
}

export function workdayNeedsEmployee(record: WorkdayRecord) {
  return [
    "assigned",
    "checked-in",
    "in-progress",
    "manager-returned",
  ].includes(record.status);
}

export function workdayNeedsManager(record: WorkdayRecord) {
  return record.status === "submitted";
}

export function workdayLocationFromCheckIn(
  record: WorkdayRecord,
  verification: {
    distanceMeters: number;
    insideGeofence: boolean;
  },
): WorkdayLocationEvent {
  if (!record.checkInAt || !record.checkInLocation) {
    throw new Error("Phiếu chưa có vị trí vào ca để khôi phục.");
  }
  return {
    id: `check-in-fallback:${record.id}:${record.version}`,
    workdayId: record.id,
    employeeAccountId: record.employee.id,
    latitude: record.checkInLocation.latitude,
    longitude: record.checkInLocation.longitude,
    accuracy: record.checkInLocation.accuracy,
    distanceMeters: verification.distanceMeters,
    insideGeofence: verification.insideGeofence,
    recordedAt: record.checkInAt,
  };
}
