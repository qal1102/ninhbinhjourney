import "server-only";

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  createWorkdayAssignment,
  parseWorkdayRecord,
  type WorkdayAuditEvent,
  type WorkdayEvidence,
  type WorkdayLocationEvent,
  type WorkdayRecord,
} from "@/domain/erp-workday";
import { getErpSite, type ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const COOKIE_NAME = "nbj-erp-workday-v1";
const COOKIE_VERSION = 1;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_MAX_BYTES = 3_800;
const COOKIE_MAX_INFLATED_BYTES = 160 * 1024;
const MAX_DEMO_RECORDS = 8;
const MAX_RECORDS = 100;
const MAX_AUDIT_EVENTS = 1_000;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EVIDENCE_BUCKET = "erp-workday-evidence";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type PersistenceMode = "supabase" | "demo-cookie";
type DatabaseRow = Record<string, unknown>;
type DatabaseAuditRow = Record<string, unknown>;

type DemoReceipt = {
  key: string;
  recordId: string;
  resultingVersion: number;
};

type DemoState = {
  version: typeof COOKIE_VERSION;
  records: WorkdayRecord[];
  idempotency: DemoReceipt[];
};

export type WorkdayListOptions = {
  siteIds: readonly ErpSiteId[];
  businessDate?: string;
  employeeAccountId?: string;
  managerAccountId?: string;
  limit?: number;
};

export type WorkdayWriteOptions = {
  idempotencyKey: string;
};

export type WorkdayLocationInput = {
  workdayId: string;
  employeeAccountId: string;
  siteId: ErpSiteId;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  idempotencyKey: string;
};

export type WorkdayEvidenceUpload = {
  file: File;
  siteId: ErpSiteId;
  employeeAccountId: string;
  workdayId: string;
  actionKey: string;
  uploadedBy: string;
  uploadedAt: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export class WorkdayRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkdayRepositoryError";
  }
}

export class WorkdayRepositoryConflictError extends WorkdayRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "WorkdayRepositoryConflictError";
  }
}

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new WorkdayRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new WorkdayRepositoryError(
      "Kho dữ liệu ngày làm việc chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "ninh-binh-journey-workday-server",
      },
    },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new WorkdayRepositoryError(
    `Kho dữ liệu ngày làm việc chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error(
            [error.code, error.message, error.details]
              .filter(Boolean)
              .join(": "),
          )
        : undefined,
    },
  );
}

function asString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkdayRepositoryError(`Thiếu trường ${label}.`);
  }
  return value;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new WorkdayRepositoryError(`Trường ${label} không phải số hợp lệ.`);
  }
  return number;
}

function siteSlugFromUuid(value: unknown): ErpSiteId {
  const uuid = asString(value, "site_id");
  const match = Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).find(
    ([, candidate]) => candidate === uuid,
  );
  if (!match) throw new WorkdayRepositoryError("Cơ sở trong hồ sơ không hợp lệ.");
  return match[0] as ErpSiteId;
}

function parseEvidence(value: unknown): WorkdayEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: asString(item.id, "evidence.id"),
      kind: "photo" as const,
      fileName: asString(item.fileName, "evidence.fileName"),
      storagePath: asString(item.storagePath, "evidence.storagePath"),
      mimeType: asString(item.mimeType, "evidence.mimeType"),
      sizeBytes: asNumber(item.sizeBytes, "evidence.sizeBytes"),
      sha256:
        typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256)
          ? item.sha256
          : undefined,
      uploadedAt: asString(item.uploadedAt, "evidence.uploadedAt"),
      uploadedBy: asString(item.uploadedBy, "evidence.uploadedBy"),
      capturedAt: asString(item.capturedAt, "evidence.capturedAt"),
      latitude: asNumber(item.latitude, "evidence.latitude"),
      longitude: asNumber(item.longitude, "evidence.longitude"),
      accuracy:
        item.accuracy === null || item.accuracy === undefined
          ? null
          : asNumber(item.accuracy, "evidence.accuracy"),
      distanceMeters: asNumber(
        item.distanceMeters,
        "evidence.distanceMeters",
      ),
      siteVerified: item.siteVerified === true,
    }));
}

function locationFromRow(row: DatabaseRow): WorkdayLocationEvent {
  return {
    id: asString(row.id, "location.id"),
    workdayId: asString(row.workday_id, "location.workday_id"),
    employeeAccountId: asString(
      row.employee_account_id,
      "location.employee_account_id",
    ),
    latitude: asNumber(row.latitude, "location.latitude"),
    longitude: asNumber(row.longitude, "location.longitude"),
    accuracy:
      row.accuracy_meters === null || row.accuracy_meters === undefined
        ? null
        : asNumber(row.accuracy_meters, "location.accuracy_meters"),
    distanceMeters: asNumber(
      row.distance_meters,
      "location.distance_meters",
    ),
    insideGeofence: row.inside_geofence === true,
    recordedAt: asString(row.recorded_at, "location.recorded_at"),
  };
}

function auditFromRow(row: DatabaseAuditRow): WorkdayAuditEvent {
  return {
    id: asString(row.id, "audit.id"),
    sequence: asNumber(row.sequence_number, "audit.sequence_number"),
    action: asString(row.event_type, "audit.event_type") as WorkdayAuditEvent["action"],
    fromStatus: asNullableString(row.from_status) as WorkdayAuditEvent["fromStatus"],
    toStatus: asString(
      row.to_status,
      "audit.to_status",
    ) as WorkdayAuditEvent["toStatus"],
    actor: {
      id: asString(row.actor_account_id, "audit.actor_account_id"),
      name: asString(row.actor_display_name, "audit.actor_display_name"),
      role: asString(
        row.actor_role,
        "audit.actor_role",
      ) as WorkdayAuditEvent["actor"]["role"],
    },
    note: typeof row.note === "string" ? row.note : "",
    at: asString(row.occurred_at, "audit.occurred_at"),
  };
}

function recordFromRows(
  row: DatabaseRow,
  auditRows: readonly DatabaseAuditRow[],
): WorkdayRecord {
  const checkInAt = asNullableString(row.check_in_at);
  const latitude =
    row.check_in_latitude === null || row.check_in_latitude === undefined
      ? null
      : asNumber(row.check_in_latitude, "check_in_latitude");
  const longitude =
    row.check_in_longitude === null || row.check_in_longitude === undefined
      ? null
      : asNumber(row.check_in_longitude, "check_in_longitude");
  const accuracy =
    row.check_in_accuracy_meters === null ||
    row.check_in_accuracy_meters === undefined
      ? null
      : asNumber(row.check_in_accuracy_meters, "check_in_accuracy_meters");

  return parseWorkdayRecord({
    id: asString(row.id, "workday.id"),
    code: asString(row.business_code, "workday.business_code"),
    siteId: siteSlugFromUuid(row.site_id),
    businessDate: asString(row.business_date, "workday.business_date"),
    employee: {
      id: asString(row.employee_account_id, "workday.employee_account_id"),
      name: asString(
        row.employee_display_name,
        "workday.employee_display_name",
      ),
      role: "employee",
    },
    manager: {
      id: asString(row.manager_account_id, "workday.manager_account_id"),
      name: asString(
        row.manager_display_name,
        "workday.manager_display_name",
      ),
      role: "manager",
    },
    moduleId: asString(row.module_id, "workday.module_id"),
    station: asString(row.station_code, "workday.station_code"),
    shiftLabel: asString(row.shift_label, "workday.shift_label"),
    taskTitle: asString(row.task_title, "workday.task_title"),
    instructions: asString(row.instructions, "workday.instructions"),
    priority: asString(row.priority, "workday.priority"),
    dueAt: asString(row.due_at, "workday.due_at"),
    evidenceRequired: Boolean(row.evidence_required),
    status: asString(row.status, "workday.status"),
    progressPercent: asNumber(
      row.progress_percent,
      "workday.progress_percent",
    ),
    latestUpdateNote:
      typeof row.latest_update_note === "string" ? row.latest_update_note : "",
    resultNote: typeof row.result_note === "string" ? row.result_note : "",
    evidence: parseEvidence(row.evidence),
    checkInAt,
    checkOutAt: asNullableString(row.check_out_at),
    checkInLocation:
      checkInAt !== null && latitude !== null && longitude !== null
        ? { latitude, longitude, accuracy }
        : null,
    latestLocation: null,
    managerNote:
      typeof row.manager_note === "string" ? row.manager_note : "",
    version: asNumber(row.version, "workday.version"),
    idempotencyKey: asString(
      row.idempotency_key,
      "workday.idempotency_key",
    ),
    createdAt: asString(row.created_at, "workday.created_at"),
    updatedAt: asString(row.updated_at, "workday.updated_at"),
    auditTrail: auditRows.map(auditFromRow),
  });
}

async function attachSignedEvidence(
  client: SupabaseClient,
  records: WorkdayRecord[],
) {
  const paths = [
    ...new Set(
      records.flatMap((record) =>
        record.evidence
          .map((item) => item.storagePath)
          .filter((path) => !path.startsWith("demo://")),
      ),
    ),
  ];
  if (paths.length === 0) return records;
  const result = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(paths, 60 * 10);
  if (result.error) return records;
  const urlByPath = new Map(
    (result.data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  return records.map((record) => ({
    ...record,
    evidence: record.evidence.map((item) => {
      const previewUrl = urlByPath.get(item.storagePath);
      return typeof previewUrl === "string"
        ? { ...item, previewUrl }
        : item;
    }),
  }));
}

async function listFromSupabase(
  options: WorkdayListOptions,
): Promise<WorkdayRecord[]> {
  if (options.siteIds.length === 0) return [];
  const client = createAdminClient();
  let query = client
    .from("erp_workday_workflows")
    .select("*")
    .in(
      "site_id",
      options.siteIds.map(
        (siteId) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
      ),
    )
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(options.limit ?? MAX_RECORDS, MAX_RECORDS)));
  if (options.employeeAccountId) {
    query = query.eq("employee_account_id", options.employeeAccountId);
  }
  if (options.managerAccountId) {
    query = query.eq("manager_account_id", options.managerAccountId);
  }
  if (options.businessDate) {
    query = query.eq("business_date", options.businessDate);
  }
  const workdayResult = await query;
  if (workdayResult.error) {
    throw repositoryError("đọc danh sách phiếu", workdayResult.error);
  }
  const rows = (workdayResult.data ?? []) as DatabaseRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => asString(row.id, "workday.id"));
  const auditResult = await client
    .from("erp_workday_audit_events")
    .select("*")
    .in("workday_id", ids)
    .order("sequence_number", { ascending: true })
    .limit(MAX_AUDIT_EVENTS);
  if (auditResult.error) {
    throw repositoryError("đọc lịch sử phiếu", auditResult.error);
  }
  const locationResult = await client
    .from("erp_workday_location_events")
    .select("*")
    .in("workday_id", ids)
    .order("recorded_at", { ascending: false })
    .limit(MAX_AUDIT_EVENTS);
  if (locationResult.error) {
    throw repositoryError("đọc vị trí trong ca", locationResult.error);
  }
  const auditsById = new Map<string, DatabaseAuditRow[]>();
  for (const audit of (auditResult.data ?? []) as DatabaseAuditRow[]) {
    const id = asString(audit.workday_id, "audit.workday_id");
    const list = auditsById.get(id) ?? [];
    list.push(audit);
    auditsById.set(id, list);
  }
  const latestLocationById = new Map<string, WorkdayLocationEvent>();
  for (const row of (locationResult.data ?? []) as DatabaseRow[]) {
    const workdayId = asString(row.workday_id, "location.workday_id");
    if (!latestLocationById.has(workdayId)) {
      latestLocationById.set(workdayId, locationFromRow(row));
    }
  }
  return attachSignedEvidence(
    client,
    rows.map((row) => {
      const id = asString(row.id, "workday.id");
      return {
        ...recordFromRows(row, auditsById.get(id) ?? []),
        latestLocation: latestLocationById.get(id) ?? null,
      };
    }),
  );
}

async function loadOneFromSupabase(
  client: SupabaseClient,
  id: string,
): Promise<WorkdayRecord> {
  const rowResult = await client
    .from("erp_workday_workflows")
    .select("*")
    .eq("id", id)
    .single();
  if (rowResult.error) {
    throw repositoryError("đọc lại phiếu", rowResult.error);
  }
  const auditResult = await client
    .from("erp_workday_audit_events")
    .select("*")
    .eq("workday_id", id)
    .order("sequence_number", { ascending: true });
  if (auditResult.error) {
    throw repositoryError("đọc lại lịch sử", auditResult.error);
  }
  const locationResult = await client
    .from("erp_workday_location_events")
    .select("*")
    .eq("workday_id", id)
    .order("recorded_at", { ascending: false })
    .limit(1);
  if (locationResult.error) {
    throw repositoryError("đọc lại vị trí", locationResult.error);
  }
  const records = await attachSignedEvidence(client, [
    {
      ...recordFromRows(
        rowResult.data as DatabaseRow,
        (auditResult.data ?? []) as DatabaseAuditRow[],
      ),
      latestLocation:
        locationResult.data?.[0]
          ? locationFromRow(locationResult.data[0] as DatabaseRow)
          : null,
    },
  ]);
  return records[0];
}

function assignmentPayload(record: WorkdayRecord) {
  return {
    tenant_id: TENANT_ID,
    site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[record.siteId],
    business_code: record.code,
    business_date: record.businessDate,
    employee_account_id: record.employee.id,
    employee_display_name: record.employee.name,
    manager_account_id: record.manager.id,
    manager_display_name: record.manager.name,
    module_id: record.moduleId,
    station_code: record.station,
    shift_label: record.shiftLabel,
    task_title: record.taskTitle,
    instructions: record.instructions,
    priority: record.priority,
    due_at: record.dueAt,
    evidence_required: record.evidenceRequired,
    status: record.status,
  };
}

async function createInSupabase(
  record: WorkdayRecord,
  idempotencyKey: string,
) {
  const client = createAdminClient();
  const result = await client.rpc("erp_demo_assign_workday", {
    p_payload: assignmentPayload(record),
    p_actor_account_id: record.manager.id,
    p_actor_display_name: record.manager.name,
    p_actor_role: record.manager.role,
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) {
    if (/already assigned|WORKDAY_ALREADY_ASSIGNED/i.test(result.error.message)) {
      throw new WorkdayRepositoryConflictError(
        "Nhân viên đã có phiếu công việc cho ngày và cơ sở này.",
      );
    }
    throw repositoryError("giao việc", result.error);
  }
  const row = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as DatabaseRow;
  return loadOneFromSupabase(client, asString(row.id, "assign.id"));
}

function mutationPayload(current: WorkdayRecord, next: WorkdayRecord) {
  const event = next.auditTrail.at(-1);
  if (!event) throw new WorkdayRepositoryError("Thiếu sự kiện thay đổi.");
  const evidence =
    next.evidence.length > current.evidence.length
      ? next.evidence[next.evidence.length - 1]
      : undefined;
  return {
    latitude: next.checkInLocation?.latitude,
    longitude: next.checkInLocation?.longitude,
    accuracy: next.checkInLocation?.accuracy,
    progress_percent: next.progressPercent,
    latest_update_note: next.latestUpdateNote,
    result_note: next.resultNote,
    manager_note: next.managerNote,
    evidence:
      evidence && event.action !== "manager.review"
        ? {
            id: evidence.id,
            kind: evidence.kind,
            fileName: evidence.fileName,
            storagePath: evidence.storagePath,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            sha256: evidence.sha256,
            uploadedAt: evidence.uploadedAt,
            uploadedBy: evidence.uploadedBy,
            capturedAt: evidence.capturedAt,
            latitude: evidence.latitude,
            longitude: evidence.longitude,
            accuracy: evidence.accuracy,
            distanceMeters: evidence.distanceMeters,
            siteVerified: evidence.siteVerified,
          }
        : null,
  };
}

async function transitionInSupabase(
  current: WorkdayRecord,
  next: WorkdayRecord,
  idempotencyKey: string,
) {
  const client = createAdminClient();
  const event = next.auditTrail.at(-1);
  if (!event) throw new WorkdayRepositoryError("Thiếu sự kiện thay đổi.");
  const result = await client.rpc("erp_demo_transition_workday", {
    p_workday_id: current.id,
    p_expected_version: current.version,
    p_to_status: next.status,
    p_actor_account_id: event.actor.id,
    p_actor_display_name: event.actor.name,
    p_actor_role: event.actor.role,
    p_action: event.action,
    p_note: event.note,
    p_mutation: mutationPayload(current, next),
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) {
    if (
      result.error.code === "40001" ||
      /version|conflict|stale/i.test(result.error.message)
    ) {
      throw new WorkdayRepositoryConflictError(
        "Phiếu đã được cập nhật ở phiên khác. Hãy tải lại trước khi thao tác.",
      );
    }
    throw repositoryError("cập nhật phiếu", result.error);
  }
  return loadOneFromSupabase(client, current.id);
}

function cookieSecret() {
  return (
    process.env.ERP_WORKDAY_COOKIE_SECRET?.trim() ||
    process.env.ERP_DEMO_SESSION_SECRET?.trim() ||
    "destinationos-workday-cookie-v1-change-before-live-data"
  );
}

function sign(value: string) {
  return createHmac("sha256", cookieSecret()).update(value).digest("base64url");
}

function encodeState(state: DemoState) {
  const payload = deflateRawSync(
    Buffer.from(JSON.stringify(state), "utf8"),
    { level: 9 },
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeState(value: string | undefined): unknown {
  if (!value || Buffer.byteLength(value, "utf8") > COOKIE_MAX_BYTES) return null;
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }
  try {
    const inflated = inflateRawSync(Buffer.from(payload, "base64url"), {
      maxOutputLength: COOKIE_MAX_INFLATED_BYTES,
    });
    return JSON.parse(inflated.toString("utf8"));
  } catch {
    return null;
  }
}

export function vietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function defaultRecord() {
  const now = new Date();
  const dueAt = new Date(now.getTime() + 4 * 60 * 60 * 1_000);
  const date = vietnamDateKey(now);
  return createWorkdayAssignment({
    id: "00000000-0000-4000-9000-000000000001",
    code: `WD-TA-${date.replaceAll("-", "")}-001`,
    siteId: "trang-an",
    businessDate: date,
    employee: {
      id: "employee-trang-an-01",
      name: "Đỗ Thị Lan",
      role: "employee",
    },
    manager: {
      id: "manager-trang-an",
      name: "Lê Hoàng Nam",
      role: "manager",
    },
    moduleId: "check-in-khach",
    station: "Cổng A",
    shiftLabel: "07:30–12:15",
    taskTitle: "Xác thực đoàn TA-018 tại Cổng A",
    instructions:
      "Kiểm tra quyền lợi của 42 khách, ghi nhận ngoại lệ và nộp ảnh bàn giao cổng.",
    priority: "high",
    dueAt: dueAt.toISOString(),
    evidenceRequired: true,
    idempotencyKey: "seed:workday:trang-an:employee-01:v1",
    createdAt: now.toISOString(),
    auditEventId: "00000000-0000-4000-a000-000000000001",
  });
}

function defaultState(): DemoState {
  return { version: COOKIE_VERSION, records: [defaultRecord()], idempotency: [] };
}

function sanitizeState(value: unknown): DemoState {
  if (!value || typeof value !== "object") return defaultState();
  const candidate = value as Partial<DemoState>;
  if (
    candidate.version !== COOKIE_VERSION ||
    !Array.isArray(candidate.records) ||
    !Array.isArray(candidate.idempotency)
  ) {
    return defaultState();
  }
  try {
    return {
      version: COOKIE_VERSION,
      records: candidate.records
        .slice(-MAX_DEMO_RECORDS)
        .map(parseWorkdayRecord),
      idempotency: candidate.idempotency
        .filter(
          (receipt): receipt is DemoReceipt =>
            Boolean(
              receipt &&
                typeof receipt.key === "string" &&
                typeof receipt.recordId === "string" &&
                Number.isInteger(receipt.resultingVersion),
            ),
        )
        .slice(-40),
    };
  } catch {
    return defaultState();
  }
}

async function readDemoState() {
  const store = await cookies();
  return sanitizeState(decodeState(store.get(COOKIE_NAME)?.value));
}

async function writeDemoState(state: DemoState) {
  const bounded: DemoState = {
    version: COOKIE_VERSION,
    records: state.records.slice(-MAX_DEMO_RECORDS),
    idempotency: state.idempotency.slice(-40),
  };
  let encoded = encodeState(bounded);
  while (
    Buffer.byteLength(encoded, "utf8") > COOKIE_MAX_BYTES &&
    bounded.records.length > 1
  ) {
    const removed = bounded.records.shift();
    bounded.idempotency = bounded.idempotency.filter(
      (receipt) => receipt.recordId !== removed?.id,
    );
    encoded = encodeState(bounded);
  }
  if (Buffer.byteLength(encoded, "utf8") > COOKIE_MAX_BYTES) {
    throw new WorkdayRepositoryError(
      "Phiếu công việc vượt dung lượng lưu trữ demo an toàn.",
    );
  }
  const store = await cookies();
  store.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

function filterRecords(
  records: WorkdayRecord[],
  options: WorkdayListOptions,
) {
  const sites = new Set(options.siteIds);
  return records
    .filter((record) => sites.has(record.siteId))
    .filter(
      (record) =>
        !options.employeeAccountId ||
        record.employee.id === options.employeeAccountId,
    )
    .filter(
      (record) =>
        !options.managerAccountId ||
        record.manager.id === options.managerAccountId,
    )
    .filter(
      (record) =>
        !options.businessDate || record.businessDate === options.businessDate,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, options.limit ?? MAX_RECORDS);
}

async function createInDemo(
  record: WorkdayRecord,
  idempotencyKey: string,
) {
  const state = await readDemoState();
  const receipt = state.idempotency.find(
    (item) => item.key === idempotencyKey,
  );
  if (receipt) {
    const existing = state.records.find(
      (item) => item.id === receipt.recordId,
    );
    if (existing) return existing;
  }
  if (
    state.records.some(
      (item) =>
        item.siteId === record.siteId &&
        item.businessDate === record.businessDate &&
        item.employee.id === record.employee.id,
    )
  ) {
    throw new WorkdayRepositoryConflictError(
      "Nhân viên đã có phiếu công việc cho ngày và cơ sở này.",
    );
  }
  state.records.push(record);
  state.idempotency.push({
    key: idempotencyKey,
    recordId: record.id,
    resultingVersion: record.version,
  });
  await writeDemoState(state);
  return record;
}

async function transitionInDemo(
  current: WorkdayRecord,
  next: WorkdayRecord,
  idempotencyKey: string,
) {
  const state = await readDemoState();
  const receipt = state.idempotency.find(
    (item) => item.key === idempotencyKey,
  );
  if (receipt) {
    const existing = state.records.find(
      (item) => item.id === receipt.recordId,
    );
    if (existing) return existing;
  }
  const index = state.records.findIndex((item) => item.id === current.id);
  if (index < 0) {
    throw new WorkdayRepositoryConflictError("Không tìm thấy phiếu công việc.");
  }
  if (state.records[index].version !== current.version) {
    throw new WorkdayRepositoryConflictError(
      "Phiếu đã được cập nhật ở phiên khác. Hãy tải lại trước khi thao tác.",
    );
  }
  state.records[index] = next;
  state.idempotency.push({
    key: idempotencyKey,
    recordId: next.id,
    resultingVersion: next.version,
  });
  await writeDemoState(state);
  return next;
}

export async function listWorkdays(options: WorkdayListOptions) {
  if (readMode() === "supabase") return listFromSupabase(options);
  return filterRecords((await readDemoState()).records, options);
}

export async function getWorkday(id: string) {
  if (readMode() === "supabase") {
    return loadOneFromSupabase(createAdminClient(), id);
  }
  const record = (await readDemoState()).records.find((item) => item.id === id);
  if (!record) throw new WorkdayRepositoryError("Không tìm thấy phiếu công việc.");
  return record;
}

export async function createWorkday(
  record: WorkdayRecord,
  options: WorkdayWriteOptions,
) {
  if (readMode() === "supabase") {
    return createInSupabase(record, options.idempotencyKey);
  }
  return createInDemo(record, options.idempotencyKey);
}

export async function saveWorkdayTransition(
  current: WorkdayRecord,
  next: WorkdayRecord,
  options: WorkdayWriteOptions,
) {
  if (readMode() === "supabase") {
    return transitionInSupabase(current, next, options.idempotencyKey);
  }
  return transitionInDemo(current, next, options.idempotencyKey);
}

function distanceMeters(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6_371_000;
  const deltaLatitude = radians(end.latitude - start.latitude);
  const deltaLongitude = radians(end.longitude - start.longitude);
  const startLatitude = radians(start.latitude);
  const endLatitude = radians(end.latitude);
  const value =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function verifyWorkdayLocation(input: {
  siteId: ErpSiteId;
  latitude: number;
  longitude: number;
  accuracy: number | null;
}) {
  const site = getErpSite(input.siteId);
  if (!site) throw new WorkdayRepositoryError("Cơ sở không hợp lệ.");
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new WorkdayRepositoryError("Tọa độ không hợp lệ.");
  }
  if (
    input.accuracy === null ||
    !Number.isFinite(input.accuracy) ||
    input.accuracy <= 0 ||
    input.accuracy > 250
  ) {
    throw new WorkdayRepositoryError(
      "Độ chính xác GPS phải là số lớn hơn 0 và không vượt quá 250 m.",
    );
  }
  const distance = distanceMeters(
    { latitude: input.latitude, longitude: input.longitude },
    site.coordinates,
  );
  return {
    distanceMeters: Math.round(distance),
    insideGeofence: distance <= site.geofenceRadiusMeters,
  };
}

export async function recordWorkdayLocation(
  input: WorkdayLocationInput,
): Promise<WorkdayLocationEvent> {
  const verified = verifyWorkdayLocation(input);
  if (readMode() === "supabase") {
    const client = createAdminClient();
    const result = await client.rpc("erp_demo_record_workday_location", {
      p_workday_id: input.workdayId,
      p_employee_account_id: input.employeeAccountId,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_accuracy_meters: input.accuracy,
      p_recorded_at: input.recordedAt,
      p_idempotency_key: input.idempotencyKey,
    });
    if (result.error) {
      throw repositoryError("ghi vị trí trong ca", result.error);
    }
    const row = (
      Array.isArray(result.data) ? result.data[0] : result.data
    ) as DatabaseRow;
    return locationFromRow(row);
  }

  const state = await readDemoState();
  const record = state.records.find((item) => item.id === input.workdayId);
  if (!record || record.employee.id !== input.employeeAccountId) {
    throw new WorkdayRepositoryError("Không tìm thấy phiếu công việc đang mở.");
  }
  const event: WorkdayLocationEvent = {
    id: crypto.randomUUID(),
    workdayId: record.id,
    employeeAccountId: input.employeeAccountId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    distanceMeters: verified.distanceMeters,
    insideGeofence: verified.insideGeofence,
    recordedAt: input.recordedAt,
  };
  record.latestLocation = event;
  await writeDemoState(state);
  return event;
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-100) || "evidence.jpg"
  );
}

export async function uploadWorkdayEvidence(
  input: WorkdayEvidenceUpload,
): Promise<WorkdayEvidence> {
  if (
    !ALLOWED_EVIDENCE_TYPES.has(input.file.type) ||
    input.file.size <= 0 ||
    input.file.size > MAX_EVIDENCE_BYTES
  ) {
    throw new WorkdayRepositoryError(
      "Ảnh phải là JPEG, PNG, WebP hoặc HEIC và không vượt quá 5 MB.",
    );
  }
  const verified = verifyWorkdayLocation({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
  });
  if (!verified.insideGeofence) {
    throw new WorkdayRepositoryError(
      "GPS của thiết bị khi tải ảnh nằm ngoài vùng cơ sở.",
    );
  }
  const body = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const objectId = randomUUID();
  const fileName = safeFileName(input.file.name);
  const storagePath = `${input.siteId}/${input.employeeAccountId}/${input.workdayId}/${objectId}-${fileName}`;
  const evidence: WorkdayEvidence = {
    id: `photo-${objectId}`,
    kind: "photo",
    fileName,
    storagePath:
      readMode() === "supabase"
        ? storagePath
        : `demo://${storagePath}`,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    sha256,
    uploadedAt: input.uploadedAt,
    uploadedBy: input.uploadedBy,
    capturedAt: input.capturedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    distanceMeters: verified.distanceMeters,
    siteVerified: true,
  };
  if (readMode() === "demo-cookie") return evidence;

  const client = createAdminClient();
  const result = await client.storage.from(EVIDENCE_BUCKET).upload(
    storagePath,
    body,
    {
      contentType: input.file.type,
      upsert: false,
      cacheControl: "3600",
    },
  );
  if (result.error) {
    throw repositoryError("tải ảnh bằng chứng", result.error);
  }
  return evidence;
}

export async function removeWorkdayEvidence(storagePath: string) {
  if (readMode() !== "supabase" || storagePath.startsWith("demo://")) return;
  await createAdminClient().storage.from(EVIDENCE_BUCKET).remove([storagePath]);
}

export const WORKDAY_EVIDENCE_MAX_BYTES = MAX_EVIDENCE_BYTES;
