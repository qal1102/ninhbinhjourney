import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const INCIDENT_COOKIE = "nbj-erp-demo-incidents";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type IncidentSeverity = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus =
  | "reported"
  | "acknowledged"
  | "in-progress"
  | "verification"
  | "closed";

export type IncidentEvidence = {
  id: string;
  kind: "Ảnh hiện trường" | "Checklist" | "Biên bản";
  label: string;
  addedBy: string;
  addedAt: string;
};

export type IncidentTimelineItem = {
  id: string;
  at: string;
  actor: string;
  action: string;
  note: string;
};

export type IncidentCase = {
  id: string;
  siteId: ErpSiteId;
  title: string;
  area: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  escalated: boolean;
  escalationReason?: string;
  reportedAt: string;
  reportedAtIso: string;
  updatedAtIso: string;
  slaMinutes: number;
  elapsedMinutes: number;
  reporter: string;
  assigneeId: string | null;
  assigneeName: string;
  assigneeTeam: string;
  sop: {
    code: string;
    title: string;
    completedSteps: number;
    totalSteps: number;
  };
  nextAction: string;
  evidence: IncidentEvidence[];
  timeline: IncidentTimelineItem[];
};

export type IncidentActionInput = {
  incidentId: string;
  siteId: ErpSiteId;
  actorId: string;
  actorName: string;
};

export class IncidentRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IncidentRepositoryError";
  }
}

export class IncidentRepositoryConflictError extends IncidentRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "IncidentRepositoryConflictError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new IncidentRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new IncidentRepositoryError(
      "Kho dữ liệu sự cố chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-incident-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new IncidentRepositoryError(
    `Kho dữ liệu sự cố chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

function displayTime() {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

// A closed case's elapsed time is a fixed historical fact ("hoàn tất trong
// N phút") and must stop ticking once closed; an open case's elapsed time
// keeps growing against the real clock. Both RPCs already set `updated_at
// = now()` on every transition including the closing one, so it doubles as
// the "closed at" timestamp without a dedicated column.
function computeElapsedMinutes(item: Pick<IncidentCase, "status" | "reportedAtIso" | "updatedAtIso">): number {
  const reportedAtMs = Date.parse(item.reportedAtIso);
  if (Number.isNaN(reportedAtMs)) return 0;
  const referenceMs = item.status === "closed" ? Date.parse(item.updatedAtIso) : Date.now();
  if (Number.isNaN(referenceMs)) return 0;
  return Math.max(0, Math.round((referenceMs - reportedAtMs) / 60_000));
}

function withLiveElapsed(item: IncidentCase): IncidentCase {
  return { ...item, elapsedMinutes: computeElapsedMinutes(item) };
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const siteCode: Record<ErpSiteId, string> = {
  "trang-an": "TA",
  "tam-chuc": "TC",
  "tam-coc": "TCO",
  "bai-dinh": "BD",
};

const assignedEmployee: Record<
  ErpSiteId,
  { id: string; name: string; team: string }
> = {
  "trang-an": {
    id: "employee-trang-an-01",
    name: "Đỗ Thị Lan",
    team: "Đón khách & cổng vé",
  },
  "tam-chuc": {
    id: "employee-tam-chuc-01",
    name: "Vũ Ngọc Mai",
    team: "Điều phối xe trung chuyển",
  },
  "tam-coc": {
    id: "employee-tam-coc-01",
    name: "Nguyễn Văn Sơn",
    team: "Điều phối bến đò",
  },
  "bai-dinh": {
    id: "employee-bai-dinh-01",
    name: "Lương Thanh Tùng",
    team: "Điều phối xe điện",
  },
};

function createSeedCases(siteId: ErpSiteId): IncidentCase[] {
  const code = siteCode[siteId];
  const employee = assignedEmployee[siteId];
  const shortName = ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId;

  return [
    {
      id: `INC-${code}-071`,
      siteId,
      title: "Khách cần hỗ trợ y tế tại cổng chính",
      area: "Cổng chính · Làn khách đoàn",
      summary:
        "Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.",
      severity: "P2",
      status: "reported",
      escalated: true,
      escalationReason:
        "Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.",
      reportedAt: "09:16",
      reportedAtIso: minutesAgoIso(4),
      updatedAtIso: minutesAgoIso(4),
      slaMinutes: 5,
      elapsedMinutes: 4,
      reporter: employee.name,
      assigneeId: null,
      assigneeName: "Chưa giao",
      assigneeTeam: "Tổ y tế & an toàn",
      sop: { code: "SOP-YT-02", title: "Sơ cứu và bảo đảm lối tiếp cận", completedSteps: 2, totalSteps: 6 },
      nextAction: "Quản lý tiếp nhận và giao tổ y tế",
      evidence: [
        { id: "EV-071-01", kind: "Ảnh hiện trường", label: "Vị trí khách đang được hỗ trợ", addedBy: employee.name, addedAt: "09:17" },
        { id: "EV-071-02", kind: "Checklist", label: "Đã mở lối tiếp cận tạm thời", addedBy: employee.name, addedAt: "09:18" },
      ],
      timeline: [
        { id: "TL-071-02", at: "09:18", actor: "Hệ thống", action: "Chuyển cấp P2", note: "Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách." },
        { id: "TL-071-01", at: "09:16", actor: employee.name, action: "Báo sự cố", note: "Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế." },
      ],
    },
    {
      id: `INC-${code}-069`,
      siteId,
      title: "Dòng khách dồn tại điểm đón",
      area: "Điểm đón trung tâm · Làn số 2",
      summary:
        "Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.",
      severity: "P3",
      status: "in-progress",
      escalated: false,
      reportedAt: "09:02",
      reportedAtIso: minutesAgoIso(7),
      updatedAtIso: minutesAgoIso(7),
      slaMinutes: 10,
      elapsedMinutes: 7,
      reporter: "Camera AI · CAM 02",
      assigneeId: employee.id,
      assigneeName: employee.name,
      assigneeTeam: employee.team,
      sop: { code: "SOP-LUONG-03", title: "Phân luồng khi thời gian chờ vượt 10 phút", completedSteps: 4, totalSteps: 5 },
      nextAction: "Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh",
      evidence: [
        { id: "EV-069-01", kind: "Ảnh hiện trường", label: "Hàng chờ trước khi mở làn phụ", addedBy: "Camera AI · CAM 02", addedAt: "09:02" },
        { id: "EV-069-02", kind: "Checklist", label: "Đã đặt biển hướng dẫn và mở hàng chờ phụ", addedBy: employee.name, addedAt: "09:06" },
      ],
      timeline: [
        { id: "TL-069-03", at: "09:06", actor: employee.name, action: "Cập nhật xử lý", note: "Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút." },
        { id: "TL-069-02", at: "09:04", actor: `Quản lý ${shortName}`, action: "Giao xử lý", note: `Giao ${employee.name} phụ trách tại hiện trường.` },
        { id: "TL-069-01", at: "09:02", actor: "Camera AI · CAM 02", action: "Tạo cảnh báo", note: "Mật độ hàng chờ vượt ngưỡng vận hành." },
      ],
    },
    {
      id: `INC-${code}-064`,
      siteId,
      title: "Đồ thất lạc đã bàn giao cho khách",
      area: "Quầy hỗ trợ khách",
      summary:
        "Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.",
      severity: "P4",
      status: "closed",
      escalated: false,
      reportedAt: "08:21",
      reportedAtIso: minutesAgoIso(6),
      updatedAtIso: new Date().toISOString(),
      slaMinutes: 15,
      elapsedMinutes: 6,
      reporter: "Quầy hỗ trợ 01",
      assigneeId: employee.id,
      assigneeName: employee.name,
      assigneeTeam: "Chăm sóc khách hàng",
      sop: { code: "SOP-TS-01", title: "Tiếp nhận và bàn giao tài sản thất lạc", completedSteps: 5, totalSteps: 5 },
      nextAction: "Không còn việc cần xử lý",
      evidence: [
        { id: "EV-064-01", kind: "Biên bản", label: "Biên bản bàn giao có xác nhận của khách", addedBy: employee.name, addedAt: "08:27" },
      ],
      timeline: [
        { id: "TL-064-02", at: "08:27", actor: `Quản lý ${shortName}`, action: "Xác minh và đóng", note: "Đủ thông tin người nhận và biên bản bàn giao." },
        { id: "TL-064-01", at: "08:21", actor: "Quầy hỗ trợ 01", action: "Báo tài sản thất lạc", note: "Niêm phong và chuyển quầy hỗ trợ đối chiếu." },
      ],
    },
  ];
}

function nextManagerTransition(status: IncidentStatus): {
  status: IncidentStatus;
  action: string;
  note: string;
  nextAction: string;
} | null {
  if (status === "reported") {
    return { status: "acknowledged", action: "Tiếp nhận sự cố", note: "Quản lý đã kiểm tra thông tin ban đầu và nhận điều phối.", nextAction: "Giao tổ phụ trách và chốt mốc cập nhật" };
  }
  if (status === "acknowledged") {
    return { status: "in-progress", action: "Giao xử lý", note: "Đã giao đúng tổ phụ trách và thông báo mốc cập nhật tiếp theo.", nextAction: "Cập nhật hiện trường và bằng chứng sau xử lý" };
  }
  if (status === "in-progress") {
    return { status: "verification", action: "Yêu cầu xác minh", note: "Hiện trường báo đã xử lý; chờ quản lý kiểm tra kết quả và bằng chứng.", nextAction: "Quản lý kiểm tra hiện trường và đủ bằng chứng" };
  }
  if (status === "verification") {
    return { status: "closed", action: "Xác minh và đóng", note: "Kết quả đạt yêu cầu, đủ bằng chứng và không còn rủi ro tồn đọng.", nextAction: "Không còn việc cần xử lý" };
  }
  return null;
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

type CookieState = { version: 1; casesBySite: Partial<Record<ErpSiteId, IncidentCase[]>> };

function defaultCookieState(): CookieState {
  const casesBySite: Partial<Record<ErpSiteId, IncidentCase[]>> = {};
  for (const site of ERP_SITES) {
    casesBySite[site.id] = createSeedCases(site.id);
  }
  return { version: 1, casesBySite };
}

async function readCookieAllSites(): Promise<CookieState> {
  const store = await cookies();
  const decoded = decodeSigned<CookieState>(store.get(INCIDENT_COOKIE)?.value);
  if (!decoded || decoded.version !== 1 || typeof decoded.casesBySite !== "object") {
    return defaultCookieState();
  }
  const fallback = defaultCookieState();
  for (const site of ERP_SITES) {
    if (!decoded.casesBySite[site.id]) {
      decoded.casesBySite[site.id] = fallback.casesBySite[site.id];
    }
  }
  return decoded;
}

async function writeCookieAllSites(state: CookieState) {
  const store = await cookies();
  store.set(INCIDENT_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function readCookieCases(siteId: ErpSiteId): Promise<IncidentCase[]> {
  const state = await readCookieAllSites();
  return state.casesBySite[siteId] ?? createSeedCases(siteId);
}

async function managerTransitionInCookie(input: IncidentActionInput): Promise<IncidentCase> {
  const state = await readCookieAllSites();
  const cases = state.casesBySite[input.siteId] ?? createSeedCases(input.siteId);
  const incident = cases.find((item) => item.id === input.incidentId);
  if (!incident) {
    throw new IncidentRepositoryError("Không tìm thấy hồ sơ sự cố.");
  }
  const transition = nextManagerTransition(incident.status);
  if (!transition) {
    throw new IncidentRepositoryConflictError("Hồ sơ đã đóng, không thể chuyển trạng thái tiếp.");
  }
  const employee = assignedEmployee[input.siteId];
  const shouldAssign = transition.status === "in-progress" && incident.assigneeId === null;
  const updated: IncidentCase = {
    ...incident,
    status: transition.status,
    assigneeId: shouldAssign ? employee.id : incident.assigneeId,
    assigneeName: shouldAssign ? employee.name : incident.assigneeName,
    nextAction: transition.nextAction,
    updatedAtIso: new Date().toISOString(),
    timeline: [
      { id: crypto.randomUUID(), at: displayTime(), actor: input.actorName, action: transition.action, note: transition.note },
      ...incident.timeline,
    ],
  };
  state.casesBySite[input.siteId] = cases.map((item) => (item.id === updated.id ? updated : item));
  await writeCookieAllSites(state);
  return updated;
}

async function employeeProgressInCookie(input: IncidentActionInput): Promise<IncidentCase> {
  const state = await readCookieAllSites();
  const cases = state.casesBySite[input.siteId] ?? createSeedCases(input.siteId);
  const incident = cases.find((item) => item.id === input.incidentId);
  if (!incident) {
    throw new IncidentRepositoryError("Không tìm thấy hồ sơ sự cố.");
  }
  if (incident.assigneeId !== input.actorId) {
    throw new IncidentRepositoryConflictError("Hồ sơ này không được giao cho bạn.");
  }
  if (incident.status === "closed" || incident.status === "verification") {
    throw new IncidentRepositoryConflictError("Hồ sơ đang chờ quản lý xác minh hoặc đã đóng.");
  }
  const updated: IncidentCase = {
    ...incident,
    status: "verification",
    sop: { ...incident.sop, completedSteps: incident.sop.totalSteps },
    nextAction: "Chờ quản lý kiểm tra hiện trường và bằng chứng",
    updatedAtIso: new Date().toISOString(),
    timeline: [
      { id: crypto.randomUUID(), at: displayTime(), actor: input.actorName, action: "Báo đã xử lý", note: "Đã hoàn thành checklist và chuyển quản lý xác minh kết quả." },
      ...incident.timeline,
    ],
  };
  state.casesBySite[input.siteId] = cases.map((item) => (item.id === updated.id ? updated : item));
  await writeCookieAllSites(state);
  return updated;
}

// --- supabase mode ------------------------------------------------------

function caseFromRow(row: Record<string, unknown>): IncidentCase | null {
  const siteId = typeof row.site_id === "string" ? SITE_SLUG_BY_UUID.get(row.site_id) ?? null : null;
  if (!siteId) return null;
  return {
    id: row.id as string,
    siteId,
    title: row.title as string,
    area: row.area as string,
    summary: row.summary as string,
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    escalated: row.escalated as boolean,
    escalationReason: (row.escalation_reason as string | null) ?? undefined,
    reportedAt: row.reported_at as string,
    reportedAtIso: row.reported_at_ts as string,
    updatedAtIso: row.updated_at as string,
    slaMinutes: row.sla_minutes as number,
    elapsedMinutes: 0,
    reporter: row.reporter as string,
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: row.assignee_name as string,
    assigneeTeam: row.assignee_team as string,
    sop: {
      code: row.sop_code as string,
      title: row.sop_title as string,
      completedSteps: row.sop_completed_steps as number,
      totalSteps: row.sop_total_steps as number,
    },
    nextAction: row.next_action as string,
    evidence: (row.evidence ?? []) as IncidentEvidence[],
    timeline: (row.timeline ?? []) as IncidentTimelineItem[],
  };
}

async function readSupabaseCases(siteId: ErpSiteId): Promise<IncidentCase[]> {
  const client = createAdminClient();
  const result = await client
    .from("erp_incidents")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .order("id", { ascending: true });
  if (result.error) {
    throw repositoryError("đọc hồ sơ sự cố", result.error);
  }
  return (result.data ?? [])
    .map(caseFromRow)
    .filter((item): item is IncidentCase => item !== null);
}

async function managerTransitionInSupabase(input: IncidentActionInput): Promise<IncidentCase> {
  const client = createAdminClient();
  const result = await client.rpc("erp_incident_manager_transition", {
    p_tenant_id: TENANT_ID,
    p_incident_id: input.incidentId,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: "manager",
  });
  if (result.error) {
    if (/INCIDENT_NO_TRANSITION/.test(result.error.message)) {
      throw new IncidentRepositoryConflictError("Hồ sơ đã đóng, không thể chuyển trạng thái tiếp.");
    }
    throw repositoryError("chuyển trạng thái sự cố", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  const updated = caseFromRow(row);
  if (!updated) {
    throw new IncidentRepositoryError("Cơ sở trong hồ sơ sự cố không hợp lệ.");
  }
  return updated;
}

async function employeeProgressInSupabase(input: IncidentActionInput): Promise<IncidentCase> {
  const client = createAdminClient();
  const result = await client.rpc("erp_incident_employee_progress", {
    p_tenant_id: TENANT_ID,
    p_incident_id: input.incidentId,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
  });
  if (result.error) {
    if (/INCIDENT_NOT_ASSIGNED/.test(result.error.message)) {
      throw new IncidentRepositoryConflictError("Hồ sơ này không được giao cho bạn.");
    }
    if (/INCIDENT_NO_TRANSITION/.test(result.error.message)) {
      throw new IncidentRepositoryConflictError("Hồ sơ đang chờ quản lý xác minh hoặc đã đóng.");
    }
    throw repositoryError("cập nhật tiến độ sự cố", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  const updated = caseFromRow(row);
  if (!updated) {
    throw new IncidentRepositoryError("Cơ sở trong hồ sơ sự cố không hợp lệ.");
  }
  return updated;
}

// --- public API -----------------------------------------------------------

export async function getIncidentCases(siteId: ErpSiteId): Promise<IncidentCase[]> {
  const cases =
    readMode() === "supabase" ? await readSupabaseCases(siteId) : await readCookieCases(siteId);
  return cases.map(withLiveElapsed);
}

export async function listEscalatedIncidents(
  siteIds: readonly ErpSiteId[],
): Promise<IncidentCase[]> {
  const bySite = await Promise.all(siteIds.map((siteId) => getIncidentCases(siteId)));
  return bySite
    .flat()
    .filter((incident) => incident.escalated && incident.status !== "closed");
}

export async function transitionIncidentByManager(input: IncidentActionInput): Promise<IncidentCase> {
  const result =
    readMode() === "supabase"
      ? await managerTransitionInSupabase(input)
      : await managerTransitionInCookie(input);
  return withLiveElapsed(result);
}

export async function progressIncidentByEmployee(input: IncidentActionInput): Promise<IncidentCase> {
  const result =
    readMode() === "supabase"
      ? await employeeProgressInSupabase(input)
      : await employeeProgressInCookie(input);
  return withLiveElapsed(result);
}
