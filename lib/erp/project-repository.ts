import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpRole, ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const STATE_COOKIE = "nbj-erp-demo-project";
const STATE_SECONDS = 60 * 60 * 24 * 30;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type ProjectWorkItemStatus =
  | "open"
  | "in-progress"
  | "blocked"
  | "ready-for-acceptance"
  | "done";

export type ProjectChangeKind = "budget" | "deadline" | "scope";
export type ProjectChangeStatus = "pending" | "approved" | "rejected";

export type ProjectWorkItem = {
  code: string;
  milestoneName: string;
  title: string;
  ownerTeam: string;
  assigneeAccountId: string | null;
  dueDate: string;
  status: ProjectWorkItemStatus;
  progressPercent: number;
  requiresSettlement: boolean;
  blockedReason: string | null;
  submittedForAcceptanceBy: string | null;
  dependsOnCodes: string[];
  version: number;
};

export type ProjectMilestone = {
  name: string;
  sortOrder: number;
  workItems: ProjectWorkItem[];
};

export type ProjectChangeRequest = {
  id: string;
  kind: ProjectChangeKind;
  summary: string;
  proposedBudgetBillion: number | null;
  proposedEventDate: string | null;
  note: string | null;
  status: ProjectChangeStatus;
  requestedByName: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type ProjectSettlement = {
  id: string;
  workItemCode: string;
  amountBillion: number;
  note: string;
  financeCode: string;
  recordedByName: string;
  recordedAt: string;
};

export type ProjectEventSummary = {
  siteId: ErpSiteId;
  name: string;
  eventDate: string;
  budgetBillion: number;
  committedBillion: number;
  expectedGuests: number;
  nextMilestone: string;
  version: number;
};

export type ProjectWorkspace = {
  event: ProjectEventSummary;
  milestones: ProjectMilestone[];
  changeRequests: ProjectChangeRequest[];
  settlements: ProjectSettlement[];
};

export type UpdateProjectWorkItemInput = {
  siteId: ErpSiteId;
  workItemCode: string;
  actorId: string;
  actorName: string;
  actorRole: ErpRole;
  nextStatus: ProjectWorkItemStatus;
  progressPercent?: number;
};

export type ReportProjectBlockerInput = {
  siteId: ErpSiteId;
  workItemCode: string;
  actorId: string;
  actorName: string;
  actorRole: ErpRole;
  reason?: string;
};

export type SubmitProjectChangeRequestInput = {
  siteId: ErpSiteId;
  actorId: string;
  actorName: string;
  actorRole: ErpRole;
  kind: ProjectChangeKind;
  summary: string;
  proposedBudgetBillion?: number | null;
  proposedEventDate?: string | null;
  note?: string | null;
};

export type DecideProjectChangeRequestInput = {
  siteId: ErpSiteId;
  changeRequestId: string;
  actorId: string;
  actorName: string;
  actorRole: ErpRole;
  decision: "approved" | "rejected";
  decisionNote?: string | null;
};

export type RecordProjectSettlementInput = {
  siteId: ErpSiteId;
  workItemCode: string;
  actorId: string;
  actorName: string;
  actorRole: ErpRole;
  amountBillion: number;
  note: string;
  financeCode: string;
};

export class ProjectRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectRepositoryError";
  }
}

export class ProjectRepositoryConflictError extends ProjectRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "ProjectRepositoryConflictError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new ProjectRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new ProjectRepositoryError(
      "Kho dữ liệu dự án & sự kiện chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-project-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new ProjectRepositoryError(
    `Kho dữ liệu dự án & sự kiện chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

const MILESTONE_ORDER = [
  "Pháp lý & giấy phép",
  "Nhà thầu & mua sắm",
  "Vận hành & phân luồng",
  "An toàn & diễn tập",
] as const;

function groupByMilestone(items: ProjectWorkItem[]): ProjectMilestone[] {
  return MILESTONE_ORDER.map((name, index) => ({
    name,
    sortOrder: index + 1,
    workItems: items.filter((item) => item.milestoneName === name),
  }));
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

type CookieSiteState = {
  event: ProjectEventSummary;
  workItems: ProjectWorkItem[];
  changeRequests: ProjectChangeRequest[];
  settlements: ProjectSettlement[];
};

type CookieState = { version: 1; sitesById: Partial<Record<ErpSiteId, CookieSiteState>> };

const SEED_EVENTS: Record<ErpSiteId, Omit<ProjectEventSummary, "siteId" | "version">> = {
  "trang-an": { name: "Lễ hội Tràng An 2026", eventDate: "2026-08-14", budgetBillion: 12.8, committedBillion: 9.4, expectedGuests: 35000, nextMilestone: "Chốt phương án phân luồng trước 29/07" },
  "tam-chuc": { name: "Tuần Văn hóa Tam Chúc", eventDate: "2026-09-01", budgetBillion: 8.6, committedBillion: 5.1, expectedGuests: 24000, nextMilestone: "Nghiệm thu sân khấu trước 04/08" },
  "tam-coc": { name: "Festival Sắc vàng Tam Cốc", eventDate: "2026-09-12", budgetBillion: 6.2, committedBillion: 3.4, expectedGuests: 18000, nextMilestone: "Khóa danh sách nhà cung ứng trước 06/08" },
  "bai-dinh": { name: "Đêm hội Hoa đăng Bái Đính", eventDate: "2026-09-26", budgetBillion: 9.1, committedBillion: 4.0, expectedGuests: 28000, nextMilestone: "Duyệt thiết kế ánh sáng trước 10/08" },
};

const SEED_WORK_ITEMS: Record<ErpSiteId, Omit<ProjectWorkItem, "blockedReason" | "submittedForAcceptanceBy" | "version">[]> = {
  "trang-an": [
    { code: "EV-TA-041", milestoneName: "Vận hành & phân luồng", title: "Phê duyệt phương án phân luồng 35.000 khách", ownerTeam: "Ban vận hành", assigneeAccountId: "employee-trang-an-01", dueDate: "2026-07-29", status: "open", progressPercent: 0, requiresSettlement: false, dependsOnCodes: [] },
    { code: "EV-TA-038", milestoneName: "Nhà thầu & mua sắm", title: "Chốt hợp đồng sân khấu và ánh sáng", ownerTeam: "Phòng mua sắm", assigneeAccountId: null, dueDate: "2026-07-30", status: "in-progress", progressPercent: 60, requiresSettlement: true, dependsOnCodes: [] },
    { code: "EV-TA-032", milestoneName: "An toàn & diễn tập", title: "Diễn tập y tế, cứu hộ và thất lạc trẻ em", ownerTeam: "An ninh & y tế", assigneeAccountId: "employee-trang-an-01", dueDate: "2026-08-02", status: "in-progress", progressPercent: 40, requiresSettlement: false, dependsOnCodes: [] },
  ],
  "tam-chuc": [
    { code: "EV-TC-026", milestoneName: "Nhà thầu & mua sắm", title: "Nghiệm thu tải trọng sân khấu mặt nước", ownerTeam: "Kỹ thuật", assigneeAccountId: null, dueDate: "2026-08-04", status: "open", progressPercent: 0, requiresSettlement: true, dependsOnCodes: [] },
    { code: "EV-TC-021", milestoneName: "Vận hành & phân luồng", title: "Khóa lịch xe điện tăng cường", ownerTeam: "Điều phối xe", assigneeAccountId: "employee-tam-chuc-01", dueDate: "2026-08-06", status: "in-progress", progressPercent: 30, requiresSettlement: false, dependsOnCodes: ["EV-TC-026"] },
    { code: "EV-TC-018", milestoneName: "Vận hành & phân luồng", title: "Xác nhận danh sách 140 tình nguyện viên", ownerTeam: "Nhân sự", assigneeAccountId: "employee-tam-chuc-01", dueDate: "2026-08-08", status: "in-progress", progressPercent: 45, requiresSettlement: false, dependsOnCodes: [] },
  ],
  "tam-coc": [
    { code: "EV-TM-019", milestoneName: "Nhà thầu & mua sắm", title: "Bổ sung nhà cung ứng thuyền trang trí", ownerTeam: "Mua sắm", assigneeAccountId: null, dueDate: "2026-08-06", status: "open", progressPercent: 10, requiresSettlement: true, dependsOnCodes: [] },
    { code: "EV-TM-016", milestoneName: "An toàn & diễn tập", title: "Chốt phương án thời tiết xấu", ownerTeam: "Ban tổ chức", assigneeAccountId: "employee-tam-coc-01", dueDate: "2026-08-09", status: "in-progress", progressPercent: 35, requiresSettlement: false, dependsOnCodes: ["EV-TM-019"] },
    { code: "EV-TM-011", milestoneName: "Vận hành & phân luồng", title: "Duyệt tuyến chụp ảnh và vùng hạn chế", ownerTeam: "Vận hành bến", assigneeAccountId: "employee-tam-coc-01", dueDate: "2026-08-12", status: "open", progressPercent: 0, requiresSettlement: false, dependsOnCodes: [] },
  ],
  "bai-dinh": [
    { code: "EV-BD-014", milestoneName: "Nhà thầu & mua sắm", title: "Duyệt thiết kế ánh sáng Bảo Tháp", ownerTeam: "Ban nội dung", assigneeAccountId: null, dueDate: "2026-08-10", status: "in-progress", progressPercent: 80, requiresSettlement: false, dependsOnCodes: [] },
    { code: "EV-BD-012", milestoneName: "Vận hành & phân luồng", title: "Khảo sát nguồn điện dự phòng", ownerTeam: "Kỹ thuật", assigneeAccountId: "employee-bai-dinh-01", dueDate: "2026-08-12", status: "open", progressPercent: 15, requiresSettlement: false, dependsOnCodes: [] },
    { code: "EV-BD-009", milestoneName: "An toàn & diễn tập", title: "Chốt phương án kiểm soát nến và cháy", ownerTeam: "PCCC", assigneeAccountId: "employee-bai-dinh-01", dueDate: "2026-08-14", status: "open", progressPercent: 0, requiresSettlement: false, dependsOnCodes: [] },
  ],
};

function createSeedSiteState(siteId: ErpSiteId): CookieSiteState {
  return {
    event: { siteId, version: 1, ...SEED_EVENTS[siteId] },
    workItems: SEED_WORK_ITEMS[siteId].map((item) => ({
      ...item,
      blockedReason: null,
      submittedForAcceptanceBy: null,
      version: 1,
    })),
    changeRequests: [],
    settlements: [],
  };
}

async function readCookieState(): Promise<CookieState> {
  const store = await cookies();
  const decoded = decodeSigned<CookieState>(store.get(STATE_COOKIE)?.value);
  if (!decoded || decoded.version !== 1 || typeof decoded.sitesById !== "object") {
    return { version: 1, sitesById: {} };
  }
  return decoded;
}

async function writeCookieState(state: CookieState) {
  const store = await cookies();
  store.set(STATE_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function siteState(siteId: ErpSiteId): Promise<{ state: CookieState; site: CookieSiteState }> {
  const state = await readCookieState();
  const site = state.sitesById[siteId] ?? createSeedSiteState(siteId);
  return { state, site };
}

async function readCookieWorkspace(siteId: ErpSiteId): Promise<ProjectWorkspace> {
  const { site } = await siteState(siteId);
  return {
    event: site.event,
    milestones: groupByMilestone(site.workItems),
    changeRequests: site.changeRequests,
    settlements: site.settlements,
  };
}

function requireRole(condition: boolean) {
  if (!condition) throw new ProjectRepositoryConflictError("Bạn không có quyền thực hiện thao tác này.");
}

async function updateInCookie(input: UpdateProjectWorkItemInput): Promise<ProjectWorkItem> {
  const { state, site } = await siteState(input.siteId);
  const item = site.workItems.find((candidate) => candidate.code === input.workItemCode);
  if (!item) throw new ProjectRepositoryError("Không tìm thấy gói việc.");

  const isEmployeeOwner = input.actorRole === "employee" && item.assigneeAccountId === input.actorId;
  const isManagerOrEmployeeOwner = input.actorRole === "manager" || isEmployeeOwner;

  if (input.nextStatus === item.status && (item.status === "open" || item.status === "in-progress")) {
    requireRole(isManagerOrEmployeeOwner);
    item.progressPercent = input.progressPercent ?? item.progressPercent;
  } else if (item.status === "open" && input.nextStatus === "in-progress") {
    requireRole(isManagerOrEmployeeOwner);
    item.status = "in-progress";
    item.progressPercent = input.progressPercent ?? Math.max(item.progressPercent, 5);
  } else if (item.status === "in-progress" && input.nextStatus === "ready-for-acceptance") {
    requireRole(isManagerOrEmployeeOwner);
    const pending = item.dependsOnCodes.some(
      (code) => site.workItems.find((candidate) => candidate.code === code)?.status !== "done",
    );
    if (pending) {
      throw new ProjectRepositoryConflictError(
        "Còn gói việc phụ thuộc chưa hoàn thành, chưa thể gửi nghiệm thu.",
      );
    }
    item.status = "ready-for-acceptance";
    item.progressPercent = 100;
    item.submittedForAcceptanceBy = input.actorId;
  } else if (item.status === "ready-for-acceptance" && input.nextStatus === "done") {
    requireRole(input.actorRole === "manager" || input.actorRole === "director");
    if (item.submittedForAcceptanceBy === input.actorId) {
      throw new ProjectRepositoryConflictError(
        "Người xác nhận hoàn thành phải khác người đã gửi nghiệm thu.",
      );
    }
    item.status = "done";
  } else if (item.status === "ready-for-acceptance" && input.nextStatus === "in-progress") {
    requireRole(input.actorRole === "manager" || input.actorRole === "director");
    item.status = "in-progress";
    item.submittedForAcceptanceBy = null;
  } else {
    throw new ProjectRepositoryConflictError("Gói việc không thể chuyển sang trạng thái này.");
  }

  item.version += 1;
  site.workItems = site.workItems.map((candidate) => (candidate.code === item.code ? item : candidate));
  state.sitesById[input.siteId] = site;
  await writeCookieState(state);
  return item;
}

async function reportBlockerInCookie(input: ReportProjectBlockerInput): Promise<ProjectWorkItem> {
  const { state, site } = await siteState(input.siteId);
  const item = site.workItems.find((candidate) => candidate.code === input.workItemCode);
  if (!item) throw new ProjectRepositoryError("Không tìm thấy gói việc.");
  const isEmployeeOwner = input.actorRole === "employee" && item.assigneeAccountId === input.actorId;
  requireRole(input.actorRole === "manager" || isEmployeeOwner);

  if (item.status === "in-progress") {
    const reason = (input.reason ?? "").trim();
    if (!reason) {
      throw new ProjectRepositoryConflictError("Cần nhập lý do khi báo chặn.");
    }
    item.status = "blocked";
    item.blockedReason = reason;
  } else if (item.status === "blocked") {
    item.status = "in-progress";
    item.blockedReason = null;
  } else {
    throw new ProjectRepositoryConflictError("Gói việc không thể chuyển sang trạng thái này.");
  }

  item.version += 1;
  site.workItems = site.workItems.map((candidate) => (candidate.code === item.code ? item : candidate));
  state.sitesById[input.siteId] = site;
  await writeCookieState(state);
  return item;
}

async function submitChangeRequestInCookie(
  input: SubmitProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  requireRole(input.actorRole === "manager");
  const { state, site } = await siteState(input.siteId);
  const summary = input.summary.trim();
  if (!summary) throw new ProjectRepositoryConflictError("Cần nhập nội dung yêu cầu.");
  if (input.kind === "budget" && input.proposedBudgetBillion == null) {
    throw new ProjectRepositoryConflictError("Cần nhập ngân sách đề xuất.");
  }
  if (input.kind === "deadline" && !input.proposedEventDate) {
    throw new ProjectRepositoryConflictError("Cần nhập ngày đề xuất.");
  }

  const request: ProjectChangeRequest = {
    id: crypto.randomUUID(),
    kind: input.kind,
    summary,
    proposedBudgetBillion: input.proposedBudgetBillion ?? null,
    proposedEventDate: input.proposedEventDate ?? null,
    note: input.note ?? null,
    status: "pending",
    requestedByName: input.actorName,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: new Date().toISOString(),
  };
  site.changeRequests = [request, ...site.changeRequests].slice(0, 30);
  state.sitesById[input.siteId] = site;
  await writeCookieState(state);
  return request;
}

async function decideChangeRequestInCookie(
  input: DecideProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  requireRole(input.actorRole === "director");
  const { state, site } = await siteState(input.siteId);
  const request = site.changeRequests.find((candidate) => candidate.id === input.changeRequestId);
  if (!request) throw new ProjectRepositoryError("Không tìm thấy yêu cầu đổi phạm vi.");
  if (request.status !== "pending") {
    throw new ProjectRepositoryConflictError("Yêu cầu này đã được xử lý.");
  }

  request.status = input.decision;
  request.decidedByName = input.actorName;
  request.decidedAt = new Date().toISOString();
  request.decisionNote = input.decisionNote ?? null;

  if (input.decision === "approved") {
    if (request.proposedBudgetBillion != null) site.event.budgetBillion = request.proposedBudgetBillion;
    if (request.proposedEventDate) site.event.eventDate = request.proposedEventDate;
    site.event.version += 1;
  }

  site.changeRequests = site.changeRequests.map((candidate) =>
    candidate.id === request.id ? request : candidate,
  );
  state.sitesById[input.siteId] = site;
  await writeCookieState(state);
  return request;
}

async function recordSettlementInCookie(
  input: RecordProjectSettlementInput,
): Promise<ProjectSettlement> {
  requireRole(input.actorRole === "accountant");
  const { state, site } = await siteState(input.siteId);
  const item = site.workItems.find((candidate) => candidate.code === input.workItemCode);
  if (!item) throw new ProjectRepositoryError("Không tìm thấy gói việc.");
  if (item.status !== "done" || !item.requiresSettlement) {
    throw new ProjectRepositoryConflictError("Gói việc chưa đủ điều kiện quyết toán.");
  }
  if (input.amountBillion <= 0) {
    throw new ProjectRepositoryConflictError("Số tiền quyết toán không hợp lệ.");
  }

  const settlement: ProjectSettlement = {
    id: crypto.randomUUID(),
    workItemCode: item.code,
    amountBillion: input.amountBillion,
    note: input.note,
    financeCode: input.financeCode,
    recordedByName: input.actorName,
    recordedAt: new Date().toISOString(),
  };
  site.settlements = [settlement, ...site.settlements].slice(0, 30);
  site.event.committedBillion += input.amountBillion;
  site.event.version += 1;
  state.sitesById[input.siteId] = site;
  await writeCookieState(state);
  return settlement;
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

function eventFromRow(row: Record<string, unknown>): ProjectEventSummary | null {
  const siteId = siteSlugFromUuid(row.site_id);
  if (!siteId) return null;
  return {
    siteId,
    name: row.name as string,
    eventDate: row.event_date as string,
    budgetBillion: Number(row.budget_billion),
    committedBillion: Number(row.committed_billion),
    expectedGuests: row.expected_guests as number,
    nextMilestone: row.next_milestone as string,
    version: row.version as number,
  };
}

function changeRequestFromRow(row: Record<string, unknown>): ProjectChangeRequest {
  return {
    id: row.id as string,
    kind: row.kind as ProjectChangeKind,
    summary: row.summary as string,
    proposedBudgetBillion: row.proposed_budget_billion == null ? null : Number(row.proposed_budget_billion),
    proposedEventDate: (row.proposed_event_date as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    status: row.status as ProjectChangeStatus,
    requestedByName: row.requested_by_name as string,
    decidedByName: (row.decided_by_name as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    decisionNote: (row.decision_note as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

async function readSupabaseWorkspace(siteId: ErpSiteId): Promise<ProjectWorkspace> {
  const client = createAdminClient();
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId];

  const eventResult = await client
    .from("erp_project_events")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", siteUuid)
    .maybeSingle();
  if (eventResult.error) {
    throw repositoryError("đọc sự kiện", eventResult.error);
  }
  const event = eventResult.data ? eventFromRow(eventResult.data) : null;
  if (!event) {
    throw new ProjectRepositoryError("Cơ sở này chưa có sự kiện được thiết lập.");
  }

  const [milestonesResult, workItemsResult, changeRequestsResult, settlementsResult] = await Promise.all([
    client
      .from("erp_project_milestones")
      .select("id, name, sort_order")
      .eq("event_id", eventResult.data!.id)
      .order("sort_order", { ascending: true }),
    client
      .from("erp_project_action_items")
      .select("*")
      .eq("event_id", eventResult.data!.id),
    client
      .from("erp_project_change_requests")
      .select("*")
      .eq("event_id", eventResult.data!.id)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("erp_project_settlements")
      .select("*, erp_project_action_items(code)")
      .eq("event_id", eventResult.data!.id)
      .order("recorded_at", { ascending: false })
      .limit(20),
  ]);
  if (milestonesResult.error) throw repositoryError("đọc nhóm công việc", milestonesResult.error);
  if (workItemsResult.error) throw repositoryError("đọc gói việc", workItemsResult.error);
  if (changeRequestsResult.error) throw repositoryError("đọc yêu cầu đổi phạm vi", changeRequestsResult.error);
  if (settlementsResult.error) throw repositoryError("đọc quyết toán", settlementsResult.error);

  const milestoneNameById = new Map(
    (milestonesResult.data ?? []).map((row) => [row.id as string, row.name as string]),
  );
  const workItemRows = workItemsResult.data ?? [];
  const workItemIds = workItemRows.map((row) => row.id as string);

  const dependenciesResult = workItemIds.length
    ? await client
        .from("erp_project_work_item_dependencies")
        .select("work_item_id, depends_on_work_item_id")
        .in("work_item_id", workItemIds)
    : { data: [], error: null };
  if (dependenciesResult.error) throw repositoryError("đọc phụ thuộc gói việc", dependenciesResult.error);

  const codeById = new Map(workItemRows.map((row) => [row.id as string, row.code as string]));
  const dependsOnByWorkItemId = new Map<string, string[]>();
  for (const dep of dependenciesResult.data ?? []) {
    const list = dependsOnByWorkItemId.get(dep.work_item_id as string) ?? [];
    const code = codeById.get(dep.depends_on_work_item_id as string);
    if (code) list.push(code);
    dependsOnByWorkItemId.set(dep.work_item_id as string, list);
  }

  const workItems: ProjectWorkItem[] = workItemRows.map((row) => ({
    code: row.code as string,
    milestoneName: milestoneNameById.get(row.milestone_id as string) ?? "",
    title: row.title as string,
    ownerTeam: row.owner_team as string,
    assigneeAccountId: (row.assignee_account_id as string | null) ?? null,
    dueDate: row.due_date as string,
    status: row.status as ProjectWorkItemStatus,
    progressPercent: row.progress_percent as number,
    requiresSettlement: row.requires_settlement as boolean,
    blockedReason: (row.blocked_reason as string | null) ?? null,
    submittedForAcceptanceBy: (row.submitted_for_acceptance_by as string | null) ?? null,
    dependsOnCodes: dependsOnByWorkItemId.get(row.id as string) ?? [],
    version: row.version as number,
  }));

  const settlements: ProjectSettlement[] = (settlementsResult.data ?? []).map((row) => {
    const embedded = row.erp_project_action_items as { code?: string } | null;
    return {
      id: row.id as string,
      workItemCode: embedded?.code ?? "",
      amountBillion: Number(row.amount_billion),
      note: row.note as string,
      financeCode: row.finance_code as string,
      recordedByName: row.recorded_by_name as string,
      recordedAt: row.recorded_at as string,
    };
  });

  return {
    event,
    milestones: groupByMilestone(workItems),
    changeRequests: (changeRequestsResult.data ?? []).map(changeRequestFromRow),
    settlements,
  };
}

async function updateInSupabase(input: UpdateProjectWorkItemInput): Promise<ProjectWorkItem> {
  const client = createAdminClient();
  const result = await client.rpc("erp_project_update_work_item_progress", {
    p_tenant_id: TENANT_ID,
    p_work_item_code: input.workItemCode,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: input.actorRole,
    p_next_status: input.nextStatus,
    p_progress_percent: input.progressPercent ?? null,
  });
  if (result.error) {
    if (/PROJECT_WORK_ITEM_DEPENDENCY_NOT_DONE/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError(
        "Còn gói việc phụ thuộc chưa hoàn thành, chưa thể gửi nghiệm thu.",
      );
    }
    if (/PROJECT_WORK_ITEM_SELF_ACCEPT/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError(
        "Người xác nhận hoàn thành phải khác người đã gửi nghiệm thu.",
      );
    }
    if (/PROJECT_WORK_ITEM_NO_TRANSITION|PROJECT_ACTOR_NOT_ALLOWED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Gói việc không thể chuyển sang trạng thái này.");
    }
    throw repositoryError("cập nhật gói việc", result.error);
  }
  return workItemFromRpcRow(result.data, "Không tìm thấy gói việc vừa cập nhật.");
}

async function reportBlockerInSupabase(input: ReportProjectBlockerInput): Promise<ProjectWorkItem> {
  const client = createAdminClient();
  const result = await client.rpc("erp_project_report_blocker", {
    p_tenant_id: TENANT_ID,
    p_work_item_code: input.workItemCode,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: input.actorRole,
    p_reason: input.reason ?? null,
  });
  if (result.error) {
    if (/PROJECT_BLOCKER_REASON_REQUIRED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Cần nhập lý do khi báo chặn.");
    }
    if (/PROJECT_WORK_ITEM_NO_TRANSITION|PROJECT_ACTOR_NOT_ALLOWED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Gói việc không thể chuyển sang trạng thái này.");
    }
    throw repositoryError("báo chặn gói việc", result.error);
  }
  return workItemFromRpcRow(result.data, "Không tìm thấy gói việc vừa cập nhật.");
}

function workItemFromRpcRow(data: unknown, missingMessage: string): ProjectWorkItem {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) throw new ProjectRepositoryError(missingMessage);
  return {
    code: row.code as string,
    milestoneName: "",
    title: row.title as string,
    ownerTeam: row.owner_team as string,
    assigneeAccountId: (row.assignee_account_id as string | null) ?? null,
    dueDate: row.due_date as string,
    status: row.status as ProjectWorkItemStatus,
    progressPercent: row.progress_percent as number,
    requiresSettlement: row.requires_settlement as boolean,
    blockedReason: (row.blocked_reason as string | null) ?? null,
    submittedForAcceptanceBy: (row.submitted_for_acceptance_by as string | null) ?? null,
    dependsOnCodes: [],
    version: row.version as number,
  };
}

async function submitChangeRequestInSupabase(
  input: SubmitProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  const client = createAdminClient();
  const eventResult = await client
    .from("erp_project_events")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId])
    .maybeSingle();
  if (eventResult.error || !eventResult.data) {
    throw repositoryError("tra cứu sự kiện", eventResult.error);
  }
  const result = await client.rpc("erp_project_submit_change_request", {
    p_tenant_id: TENANT_ID,
    p_event_id: eventResult.data.id,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: input.actorRole,
    p_kind: input.kind,
    p_summary: input.summary,
    p_proposed_budget_billion: input.proposedBudgetBillion ?? null,
    p_proposed_event_date: input.proposedEventDate ?? null,
    p_note: input.note ?? null,
  });
  if (result.error) {
    if (/PROJECT_CHANGE_BUDGET_REQUIRED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Cần nhập ngân sách đề xuất.");
    }
    if (/PROJECT_CHANGE_DATE_REQUIRED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Cần nhập ngày đề xuất.");
    }
    throw repositoryError("gửi yêu cầu đổi phạm vi", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  return changeRequestFromRow(row);
}

async function decideChangeRequestInSupabase(
  input: DecideProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  const client = createAdminClient();
  const result = await client.rpc("erp_project_decide_change_request", {
    p_tenant_id: TENANT_ID,
    p_change_request_id: input.changeRequestId,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: input.actorRole,
    p_decision: input.decision,
    p_decision_note: input.decisionNote ?? null,
  });
  if (result.error) {
    if (/PROJECT_CHANGE_ALREADY_DECIDED/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Yêu cầu này đã được xử lý.");
    }
    throw repositoryError("xử lý yêu cầu đổi phạm vi", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  return changeRequestFromRow(row);
}

async function recordSettlementInSupabase(
  input: RecordProjectSettlementInput,
): Promise<ProjectSettlement> {
  const client = createAdminClient();
  const result = await client.rpc("erp_project_record_settlement", {
    p_tenant_id: TENANT_ID,
    p_work_item_code: input.workItemCode,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
    p_actor_role: input.actorRole,
    p_amount_billion: input.amountBillion,
    p_note: input.note,
    p_finance_code: input.financeCode,
  });
  if (result.error) {
    if (/PROJECT_SETTLEMENT_NOT_ELIGIBLE/.test(result.error.message)) {
      throw new ProjectRepositoryConflictError("Gói việc chưa đủ điều kiện quyết toán.");
    }
    throw repositoryError("ghi nhận quyết toán", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  return {
    id: row.id as string,
    workItemCode: input.workItemCode,
    amountBillion: Number(row.amount_billion),
    note: row.note as string,
    financeCode: row.finance_code as string,
    recordedByName: row.recorded_by_name as string,
    recordedAt: row.recorded_at as string,
  };
}

// --- public API -----------------------------------------------------------

export async function getProjectWorkspace(siteId: ErpSiteId): Promise<ProjectWorkspace> {
  if (readMode() === "supabase") return readSupabaseWorkspace(siteId);
  return readCookieWorkspace(siteId);
}

export type ProjectChangeRequestWithSite = ProjectChangeRequest & {
  siteId: ErpSiteId;
};

export async function listPendingProjectChangeRequests(
  siteIds: readonly ErpSiteId[],
): Promise<ProjectChangeRequestWithSite[]> {
  const bySite = await Promise.all(
    siteIds.map(async (siteId) => {
      // A site without a project event yet is not an error condition here —
      // it just contributes nothing to the director's decision queue.
      try {
        const workspace = await getProjectWorkspace(siteId);
        return workspace.changeRequests
          .filter((request) => request.status === "pending")
          .map((request) => ({ ...request, siteId }));
      } catch {
        return [];
      }
    }),
  );
  return bySite.flat();
}

export async function updateProjectWorkItem(input: UpdateProjectWorkItemInput): Promise<ProjectWorkItem> {
  if (readMode() === "supabase") return updateInSupabase(input);
  return updateInCookie(input);
}

export async function reportProjectBlocker(input: ReportProjectBlockerInput): Promise<ProjectWorkItem> {
  if (readMode() === "supabase") return reportBlockerInSupabase(input);
  return reportBlockerInCookie(input);
}

export async function submitProjectChangeRequest(
  input: SubmitProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  if (readMode() === "supabase") return submitChangeRequestInSupabase(input);
  return submitChangeRequestInCookie(input);
}

export async function decideProjectChangeRequest(
  input: DecideProjectChangeRequestInput,
): Promise<ProjectChangeRequest> {
  if (readMode() === "supabase") return decideChangeRequestInSupabase(input);
  return decideChangeRequestInCookie(input);
}

export async function recordProjectSettlement(
  input: RecordProjectSettlementInput,
): Promise<ProjectSettlement> {
  if (readMode() === "supabase") return recordSettlementInSupabase(input);
  return recordSettlementInCookie(input);
}
