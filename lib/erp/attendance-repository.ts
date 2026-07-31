import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const ATTENDANCE_COOKIE = "nbj-erp-demo-attendance";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const READ_LIMIT = 200;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type AttendanceEvent = {
  id: string;
  userId: string;
  siteId: ErpSiteId;
  type: "check-in" | "check-out";
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: "gps" | "demo-location";
};

export type AttendanceState = {
  version: 1;
  events: AttendanceEvent[];
};

export type RecordAttendanceEventInput = {
  userId: string;
  siteId: ErpSiteId;
  type: "check-in" | "check-out";
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: "gps" | "demo-location";
  businessDate: string;
  idempotencyKey: string;
};

export class AttendanceRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AttendanceRepositoryError";
  }
}

export class AttendanceRepositoryConflictError extends AttendanceRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceRepositoryConflictError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new AttendanceRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new AttendanceRepositoryError(
      "Kho dữ liệu chấm công chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-attendance-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new AttendanceRepositoryError(
    `Kho dữ liệu chấm công chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

// --- demo-cookie mode -------------------------------------------------

function sign(payload: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function encodeSigned(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSigned<T>(input: string | undefined): T | null {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge,
  };
}

function createDefaultAttendanceState(): AttendanceState {
  const schedule = [
    ["employee-trang-an-01", "trang-an", 7, 28],
    ["employee-trang-an-02", "trang-an", 7, 36],
    ["employee-trang-an-seasonal-01", "trang-an", 8, 2],
    ["employee-tam-chuc-01", "tam-chuc", 7, 19],
    ["employee-tam-coc-01", "tam-coc", 7, 42],
    ["employee-bai-dinh-01", "bai-dinh", 7, 31],
  ] as const;
  const events: AttendanceEvent[] = schedule.map(([userId, siteId, hour, minute], index) => {
    const site = ERP_SITES.find((candidate) => candidate.id === siteId)!;
    const createdAt = new Date();
    createdAt.setHours(hour, minute, 0, 0);
    return {
      id: `seed-attendance-${index + 1}`,
      userId,
      siteId,
      type: "check-in",
      createdAt: createdAt.toISOString(),
      latitude: site.coordinates.latitude,
      longitude: site.coordinates.longitude,
      accuracy: 14 + index,
      source: "demo-location",
    };
  });
  return { version: 1, events };
}

async function readCookieState(): Promise<AttendanceState> {
  const store = await cookies();
  const state = decodeSigned<AttendanceState>(store.get(ATTENDANCE_COOKIE)?.value);
  if (!state || state.version !== 1 || !Array.isArray(state.events)) {
    return createDefaultAttendanceState();
  }
  return { version: 1, events: state.events.slice(-80) };
}

async function writeCookieState(state: AttendanceState) {
  const store = await cookies();
  store.set(
    ATTENDANCE_COOKIE,
    encodeSigned({ ...state, events: state.events.slice(-80) }),
    cookieOptions(STATE_SECONDS),
  );
}

function vietnamDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(typeof value === "string" ? new Date(value) : value);
}

async function recordInCookie(input: RecordAttendanceEventInput): Promise<AttendanceEvent> {
  const state = await readCookieState();
  const sameDay = state.events
    .filter(
      (event) =>
        event.userId === input.userId &&
        event.siteId === input.siteId &&
        vietnamDateKey(event.createdAt) === input.businessDate,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = sameDay.at(-1);
  if (input.type === "check-in" && last?.type === "check-in") {
    throw new AttendanceRepositoryConflictError("Bạn đã vào ca; hãy chấm ra trước.");
  }
  if (input.type === "check-out" && last?.type !== "check-in") {
    throw new AttendanceRepositoryConflictError("Chưa có lượt vào ca đang mở.");
  }
  const event: AttendanceEvent = {
    id: crypto.randomUUID(),
    userId: input.userId,
    siteId: input.siteId,
    type: input.type,
    createdAt: new Date().toISOString(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    source: input.source,
  };
  state.events.push(event);
  await writeCookieState(state);
  return event;
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

function eventFromRow(row: Record<string, unknown>): AttendanceEvent | null {
  const siteId = siteSlugFromUuid(row.site_id);
  if (!siteId) return null;
  return {
    id: row.id as string,
    userId: row.user_account_id as string,
    siteId,
    type: row.event_type as "check-in" | "check-out",
    createdAt: row.created_at as string,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    accuracy: (row.accuracy_meters as number | null) ?? null,
    source: row.source as "gps" | "demo-location",
  };
}

async function readSupabaseState(): Promise<AttendanceState> {
  const client = createAdminClient();
  const result = await client
    .from("erp_staff_attendance_events")
    .select("id, user_account_id, site_id, event_type, created_at, latitude, longitude, accuracy_meters, source")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(READ_LIMIT);
  if (result.error) {
    throw repositoryError("đọc nhật ký chấm công", result.error);
  }
  const events = (result.data ?? [])
    .map(eventFromRow)
    .filter((event): event is AttendanceEvent => event !== null)
    .reverse();
  return { version: 1, events };
}

async function recordInSupabase(
  input: RecordAttendanceEventInput,
): Promise<AttendanceEvent> {
  const client = createAdminClient();
  const result = await client.rpc("erp_record_attendance_event", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_user_account_id: input.userId,
    p_event_type: input.type,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_meters: input.accuracy,
    p_source: input.source,
    p_business_date: input.businessDate,
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) {
    if (/ATTENDANCE_ALREADY_CHECKED_IN/.test(result.error.message)) {
      throw new AttendanceRepositoryConflictError("Bạn đã vào ca; hãy chấm ra trước.");
    }
    if (/ATTENDANCE_NO_OPEN_CHECK_IN/.test(result.error.message)) {
      throw new AttendanceRepositoryConflictError("Chưa có lượt vào ca đang mở.");
    }
    throw repositoryError("ghi nhận chấm công", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<
    string,
    unknown
  >;
  const event = eventFromRow(row);
  if (!event) {
    throw new AttendanceRepositoryError("Cơ sở trong bản ghi chấm công không hợp lệ.");
  }
  return event;
}

// --- public API -----------------------------------------------------------

export async function getAttendanceState(): Promise<AttendanceState> {
  if (readMode() === "supabase") return readSupabaseState();
  return readCookieState();
}

export async function recordAttendanceEvent(
  input: RecordAttendanceEventInput,
): Promise<AttendanceEvent> {
  if (readMode() === "supabase") return recordInSupabase(input);
  return recordInCookie(input);
}

export { vietnamDateKey as attendanceVietnamDateKey };
