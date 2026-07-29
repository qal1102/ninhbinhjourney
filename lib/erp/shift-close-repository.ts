import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  computeShiftCloseDifference,
  createShiftCloseSubmission,
  isShiftCloseStatus,
  parseShiftCloseRecord,
  transitionShiftClose,
  type ShiftCloseActor,
  type ShiftCloseAuditEvent,
  type ShiftCloseRecord,
  type ShiftCloseReview,
  type ShiftCloseStatus,
} from "@/domain/erp-shift-close";
import type { ErpRole, ErpSiteId } from "@/domain/erp";

const DEMO_COOKIE_NAME = "nbj-erp-shift-close-v1";
const DEMO_COOKIE_VERSION = 1;
const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_COOKIE_VALUE_BYTES = 3_800;
const MAX_COOKIE_INFLATED_BYTES = 192 * 1024;
const MAX_DEMO_RECORDS = 12;
const MAX_AUDIT_EVENTS_PER_RECORD = 32;
const MAX_IDEMPOTENCY_RECEIPTS = 64;
const MAX_DATABASE_RECORDS = 100;
const MAX_DATABASE_AUDIT_EVENTS = 2_000;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * The ERP uses short, human-readable slugs in URLs. Persistence uses the
 * canonical UUIDs seeded by the shared-core migration. Keep this mapping
 * explicit: deriving UUIDs or querying by display name can silently attach a
 * financial record to the wrong site.
 */
export const ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG: Readonly<
  Record<ErpSiteId, string>
> = Object.freeze({
  "trang-an": "10000000-0000-4000-8000-000000000001",
  "tam-chuc": "10000000-0000-4000-8000-000000000009",
  "tam-coc": "10000000-0000-4000-8000-000000000005",
  "bai-dinh": "10000000-0000-4000-8000-000000000003",
});

const ERP_SHIFT_CLOSE_SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export type ErpPersistenceMode = "supabase" | "demo-cookie";

export type ShiftCloseListOptions = {
  siteIds?: readonly ErpSiteId[];
  limit?: number;
};

export type ShiftCloseWriteOptions = {
  idempotencyKey: string;
};

export type ShiftClosePersistenceStatus = {
  requestedMode: ErpPersistenceMode;
  activeMode: ErpPersistenceMode;
  configured: boolean;
  missingEnvironment: readonly string[];
};

type DemoIdempotencyReceipt = {
  key: string;
  recordId: string;
  resultingVersion: number;
};

type DemoCookieState = {
  version: typeof DEMO_COOKIE_VERSION;
  records: ShiftCloseRecord[];
  idempotency: DemoIdempotencyReceipt[];
};

type DatabaseWorkflowRow = Record<string, unknown>;
type DatabaseAuditRow = Record<string, unknown>;

export class ShiftCloseRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ShiftCloseRepositoryError";
  }
}

export class ShiftCloseRepositoryConfigurationError extends ShiftCloseRepositoryError {
  readonly missingEnvironment: readonly string[];

  constructor(message: string, missingEnvironment: readonly string[] = []) {
    super(message);
    this.name = "ShiftCloseRepositoryConfigurationError";
    this.missingEnvironment = missingEnvironment;
  }
}

export class ShiftCloseRepositoryConflictError extends ShiftCloseRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "ShiftCloseRepositoryConflictError";
  }
}

function readRequestedMode(): ErpPersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new ShiftCloseRepositoryConfigurationError(
    "ERP_PERSISTENCE_MODE must be either 'supabase' or 'demo-cookie'.",
  );
}

export function getShiftClosePersistenceStatus(): ShiftClosePersistenceStatus {
  const requestedMode = readRequestedMode();
  const missingEnvironment: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missingEnvironment.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SECRET_KEY?.trim()) {
    missingEnvironment.push("SUPABASE_SECRET_KEY");
  }

  return {
    requestedMode,
    activeMode: requestedMode,
    configured:
      requestedMode === "demo-cookie" || missingEnvironment.length === 0,
    missingEnvironment,
  };
}

function createSupabaseAdminClient(): SupabaseClient {
  const status = getShiftClosePersistenceStatus();
  if (status.requestedMode !== "supabase") {
    throw new ShiftCloseRepositoryConfigurationError(
      "Supabase client requested while ERP persistence is in demo-cookie mode.",
    );
  }
  if (!status.configured) {
    throw new ShiftCloseRepositoryConfigurationError(
      `Supabase persistence is enabled but required server environment is missing: ${status.missingEnvironment.join(", ")}.`,
      status.missingEnvironment,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY!.trim();
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new ShiftCloseRepositoryConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP(S) URL.",
      ["NEXT_PUBLIC_SUPABASE_URL"],
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "ninh-binh-journey-erp-server",
      },
    },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new ShiftCloseRepositoryError(
    `Kho dữ liệu chốt ca không hoàn tất được bước ${operation}.`,
    {
      cause: error
        ? new Error(
            [
              error.code,
              error.message,
              error.details,
            ]
              .filter(Boolean)
              .join(": "),
          )
        : undefined,
    },
  );
}

function normalizedLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MAX_DATABASE_RECORDS;
  }
  return Math.max(1, Math.min(MAX_DATABASE_RECORDS, Math.trunc(value)));
}

function normalizeSiteScope(siteIds: readonly ErpSiteId[] | undefined) {
  const requested = siteIds ?? (
    Object.keys(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG) as ErpSiteId[]
  );
  return [...new Set(requested)].filter(
    (siteId): siteId is ErpSiteId =>
      Object.prototype.hasOwnProperty.call(
        ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG,
        siteId,
      ),
  );
}

function requireIdempotencyKey(value: string) {
  const key = value.trim();
  if (key.length < 8 || key.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new ShiftCloseRepositoryError(
      "Shift-close idempotency key must be 8-160 safe ASCII characters.",
    );
  }
  return key;
}

function asString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close field: ${field}.`,
    );
  }
  return value;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, field: string) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numberValue)) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close number: ${field}.`,
    );
  }
  return numberValue;
}

function asInteger(value: unknown, field: string) {
  const numberValue = asNumber(value, field);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close integer: ${field}.`,
    );
  }
  return numberValue;
}

function asRole(value: unknown): ErpRole {
  if (
    value === "employee" ||
    value === "manager" ||
    value === "accountant" ||
    value === "director"
  ) {
    return value;
  }
  throw new ShiftCloseRepositoryError(
    "Invalid persisted shift-close actor role.",
  );
}

function auditEventFromRow(row: DatabaseAuditRow): ShiftCloseAuditEvent {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: asString(row.id, "audit.id"),
    action: asString(
      row.event_type,
      "audit.event_type",
    ) as ShiftCloseAuditEvent["action"],
    actor: {
      id: asString(row.actor_account_id, "audit.actor_account_id"),
      name:
        asNullableString(row.actor_display_name) ??
        asNullableString(metadata.actorName) ??
        asString(row.actor_account_id, "audit.actor_account_id"),
      role: asRole(row.actor_role),
    },
    fromStatus: asNullableString(row.from_status) as ShiftCloseStatus | null,
    toStatus: asString(row.to_status, "audit.to_status") as ShiftCloseStatus,
    note: typeof row.note === "string" ? row.note : "",
    at: asString(row.occurred_at, "audit.occurred_at"),
  };
}

function recordFromRows(
  row: DatabaseWorkflowRow,
  auditRows: readonly DatabaseAuditRow[],
) {
  const siteId = ERP_SHIFT_CLOSE_SITE_SLUG_BY_UUID.get(
    asString(row.site_id, "workflow.site_id"),
  );
  if (!siteId) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close workflow references an unknown site UUID.",
    );
  }

  const auditTrail = auditRows.map(auditEventFromRow);
  const latestEventFor = (action: ShiftCloseAuditEvent["action"]) =>
    [...auditTrail].reverse().find((event) => event.action === action);
  const managerEvent = latestEventFor("manager.review");
  const accountingEvent = latestEventFor("accountant.reconcile");
  const directorEvent = latestEventFor("director.decide");
  const managerDecision = asNullableString(row.manager_decision);
  const accountingDecision = asNullableString(row.accountant_decision);
  const directorDecision = asNullableString(row.director_decision);
  const reviewMetadata =
    row.review_metadata &&
    typeof row.review_metadata === "object" &&
    !Array.isArray(row.review_metadata)
      ? (row.review_metadata as Record<string, unknown>)
      : {};

  return boundedRecord({
    id: asString(row.id, "workflow.id"),
    idempotencyKey: asString(
      row.idempotency_key,
      "workflow.idempotency_key",
    ),
    siteId,
    shiftCode: asString(
      row.business_code ?? row.shift_label,
      "workflow.business_code",
    ),
    businessDate: asString(row.shift_date, "workflow.shift_date"),
    station: asString(row.station_code, "workflow.station_code"),
    shiftLabel: asString(row.shift_label, "workflow.shift_label"),
    shiftStartedAt: asString(
      row.shift_started_at,
      "workflow.shift_started_at",
    ),
    shiftEndedAt: asString(
      row.shift_ended_at,
      "workflow.shift_ended_at",
    ),
    ticketsSold: asInteger(row.tickets_sold, "workflow.tickets_sold"),
    financeCode: asString(row.finance_code, "workflow.finance_code"),
    note: typeof row.note === "string" ? row.note : "",
    status: asString(row.status, "workflow.status"),
    version: asInteger(row.version, "workflow.version"),
    amounts: {
      grossVnd: asNumber(row.gross_sales_vnd, "workflow.gross_sales_vnd"),
      refundVnd: asNumber(row.refund_vnd, "workflow.refund_vnd"),
      cashVnd: asNumber(row.cash_vnd, "workflow.cash_vnd"),
      cardVnd:
        asNumber(row.card_vnd, "workflow.card_vnd") +
        asNumber(
          row.bank_transfer_vnd,
          "workflow.bank_transfer_vnd",
        ) +
        asNumber(row.qr_vnd, "workflow.qr_vnd"),
    },
    differenceVnd: asNumber(
      row.difference_vnd,
      "workflow.difference_vnd",
    ),
    submittedBy: {
      id: asString(
        row.employee_account_id,
        "workflow.employee_account_id",
      ),
      name: asString(
        row.employee_display_name,
        "workflow.employee_display_name",
      ),
      role: "employee",
    },
    submittedAt: asString(row.submitted_at, "workflow.submitted_at"),
    managerReview:
      managerEvent && managerDecision
        ? {
            actor: managerEvent.actor,
            decision: managerDecision,
            note:
              typeof row.manager_note === "string"
                ? row.manager_note
                : managerEvent.note,
            at:
              asNullableString(row.manager_reviewed_at) ??
              managerEvent.at,
          }
        : undefined,
    accountingReview:
      accountingEvent && accountingDecision
        ? {
            actor: accountingEvent.actor,
            decision: accountingDecision,
            note:
              typeof row.accountant_note === "string"
                ? row.accountant_note
                : accountingEvent.note,
            at:
              asNullableString(row.accountant_reviewed_at) ??
              accountingEvent.at,
            journalReference:
              asNullableString(reviewMetadata.journalReference) ?? undefined,
          }
        : undefined,
    directorDecision:
      directorEvent && directorDecision
        ? {
            actor: directorEvent.actor,
            decision: directorDecision,
            note:
              typeof row.director_note === "string"
                ? row.director_note
                : directorEvent.note,
            at:
              asNullableString(row.director_reviewed_at) ??
              directorEvent.at,
          }
        : undefined,
    updatedAt: asString(row.updated_at, "workflow.updated_at"),
    auditTrail,
  });
}

function latestAudit(record: ShiftCloseRecord) {
  const event = record.auditTrail.at(-1);
  if (!event) {
    throw new ShiftCloseRepositoryError(
      "A persisted shift-close mutation must include its audit event.",
    );
  }
  return event;
}

function workflowRpcPayload(
  record: ShiftCloseRecord,
) {
  const expectedSettlementVnd =
    record.amounts.grossVnd - record.amounts.refundVnd;
  const actualSettlementVnd =
    record.amounts.cashVnd + record.amounts.cardVnd;

  return {
    tenant_id: TENANT_ID,
    site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[record.siteId],
    business_code: record.shiftCode,
    shift_date: record.businessDate,
    shift_label: record.shiftLabel,
    station_code: record.station,
    employee_account_id: record.submittedBy.id,
    employee_display_name: record.submittedBy.name,
    shift_started_at: record.shiftStartedAt,
    shift_ended_at: record.shiftEndedAt,
    tickets_sold: record.ticketsSold,
    tickets_checked_in: 0,
    tickets_refunded: 0,
    tickets_voided: 0,
    product_mix: {},
    cash_vnd: record.amounts.cashVnd,
    card_vnd: record.amounts.cardVnd,
    bank_transfer_vnd: 0,
    qr_vnd: 0,
    gross_sales_vnd: record.amounts.grossVnd,
    refund_vnd: record.amounts.refundVnd,
    net_sales_vnd: expectedSettlementVnd,
    expected_settlement_vnd: expectedSettlementVnd,
    actual_settlement_vnd: actualSettlementVnd,
    difference_vnd: record.differenceVnd,
    finance_code: record.financeCode,
    evidence: [],
    note: record.note,
    status: record.status,
  };
}

async function listFromSupabase(
  options: ShiftCloseListOptions,
): Promise<ShiftCloseRecord[]> {
  const siteIds = normalizeSiteScope(options.siteIds);
  if (siteIds.length === 0) return [];

  const client = createSupabaseAdminClient();
  const siteUuids = siteIds.map(
    (siteId) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  );
  const workflowResult = await client
    .from("erp_shift_close_workflows")
    .select("*")
    .in("site_id", siteUuids)
    .order("updated_at", { ascending: false })
    .limit(normalizedLimit(options.limit));

  if (workflowResult.error) {
    throw repositoryError("workflow list", workflowResult.error);
  }
  const workflowRows = (workflowResult.data ?? []) as DatabaseWorkflowRow[];
  if (workflowRows.length === 0) return [];

  const workflowIds = workflowRows.map((row) =>
    asString(row.id, "workflow.id"),
  );
  const auditResult = await client
    .from("erp_shift_close_audit_events")
    .select("*")
    .in("workflow_id", workflowIds)
    .order("sequence_number", { ascending: true })
    .limit(MAX_DATABASE_AUDIT_EVENTS);

  if (auditResult.error) {
    throw repositoryError("workflow audit list", auditResult.error);
  }
  const auditRows = (auditResult.data ?? []) as DatabaseAuditRow[];
  const auditsByWorkflow = new Map<string, DatabaseAuditRow[]>();
  for (const audit of auditRows) {
    const workflowId = asString(audit.workflow_id, "audit.workflow_id");
    const current = auditsByWorkflow.get(workflowId) ?? [];
    current.push(audit);
    auditsByWorkflow.set(workflowId, current);
  }

  return workflowRows.map((row) => {
    const id = asString(row.id, "workflow.id");
    return recordFromRows(row, auditsByWorkflow.get(id) ?? []);
  });
}

async function loadOneFromSupabase(
  client: SupabaseClient,
  recordId: string,
) {
  const workflowResult = await client
    .from("erp_shift_close_workflows")
    .select("*")
    .eq("id", recordId)
    .single();
  if (workflowResult.error) {
    throw repositoryError("workflow reload", workflowResult.error);
  }

  const auditResult = await client
    .from("erp_shift_close_audit_events")
    .select("*")
    .eq("workflow_id", recordId)
    .order("sequence_number", { ascending: true })
    .limit(MAX_AUDIT_EVENTS_PER_RECORD);
  if (auditResult.error) {
    throw repositoryError("workflow audit reload", auditResult.error);
  }

  return recordFromRows(
    workflowResult.data as DatabaseWorkflowRow,
    (auditResult.data ?? []) as DatabaseAuditRow[],
  );
}

async function createInSupabase(
  record: ShiftCloseRecord,
  idempotencyKey: string,
) {
  const client = createSupabaseAdminClient();
  const event = latestAudit(record);
  const result = await client.rpc("erp_demo_create_shift_close", {
    p_payload: workflowRpcPayload(record),
    p_actor_account_id: event.actor.id,
    p_actor_display_name: event.actor.name,
    p_actor_role: event.actor.role,
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) {
    throw repositoryError("atomic workflow creation", result.error);
  }
  const returnedRow = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as DatabaseWorkflowRow | null;
  const persistedId = asString(
    returnedRow?.id,
    "create result workflow.id",
  );
  return loadOneFromSupabase(client, persistedId);
}

async function transitionInSupabase(
  recordId: string,
  expectedVersion: number,
  nextRecord: ShiftCloseRecord,
  idempotencyKey: string,
) {
  const client = createSupabaseAdminClient();
  const event = latestAudit(nextRecord);
  const activeReview =
    event.action === "manager.review"
      ? nextRecord.managerReview
      : event.action === "accountant.reconcile"
        ? nextRecord.accountingReview
        : event.action === "director.decide"
          ? nextRecord.directorDecision
          : undefined;
  const result = await client.rpc("erp_demo_transition_shift_close", {
    p_workflow_id: recordId,
    p_expected_version: expectedVersion,
    p_to_status: nextRecord.status,
    p_actor_account_id: event.actor.id,
    p_actor_display_name: event.actor.name,
    p_actor_role: event.actor.role,
    p_action: event.action,
    p_note: event.note,
    p_review_metadata: {
      actorName: event.actor.name,
      occurredAt: event.at,
      differenceVnd: nextRecord.differenceVnd,
      decision: activeReview?.decision,
      journalReference:
        event.action === "accountant.reconcile"
          ? nextRecord.accountingReview?.journalReference
          : undefined,
    },
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) {
    if (
      result.error.code === "40001" ||
      result.error.code === "P0001" &&
        /version|conflict|stale/i.test(result.error.message)
    ) {
      throw new ShiftCloseRepositoryConflictError(result.error.message);
    }
    throw repositoryError("atomic workflow transition", result.error);
  }
  return loadOneFromSupabase(client, recordId);
}

function cookieSigningSecret() {
  return (
    process.env.ERP_SHIFT_CLOSE_COOKIE_SECRET?.trim() ||
    process.env.ERP_DEMO_SESSION_SECRET?.trim() ||
    "destinationos-shift-close-demo-cookie-v1-change-before-live-data"
  );
}

function signCookiePayload(payload: string) {
  return createHmac("sha256", cookieSigningSecret())
    .update(payload)
    .digest("base64url");
}

function encodeCookieState(state: DemoCookieState) {
  const json = Buffer.from(JSON.stringify(state), "utf8");
  const compressed = deflateRawSync(json, { level: 9 }).toString("base64url");
  return `${compressed}.${signCookiePayload(compressed)}`;
}

function decodeCookieState(input: string | undefined): unknown {
  if (!input || Buffer.byteLength(input, "utf8") > MAX_COOKIE_VALUE_BYTES) {
    return null;
  }
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  const expected = Buffer.from(signCookiePayload(payload), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }

  try {
    const compressed = Buffer.from(payload, "base64url");
    const inflated = inflateRawSync(compressed, {
      maxOutputLength: MAX_COOKIE_INFLATED_BYTES,
    });
    return JSON.parse(inflated.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function emptyDemoState(): DemoCookieState {
  const trangAnSubmission = createShiftCloseSubmission({
    id: "61000000-0000-4000-8000-000000000001",
    shiftCode: "SC-TA-20260728-01",
    idempotencyKey: "seed:shift-close:ta:submitted",
    siteId: "trang-an",
    businessDate: "2026-07-28",
    station: "Cổng A",
    shiftLabel: "Ca sáng 07:00–12:00",
    shiftStartedAt: "2026-07-28T00:00:00.000Z",
    shiftEndedAt: "2026-07-28T05:00:00.000Z",
    ticketsSold: 462,
    financeCode: "REV-TA-GATE-A",
    note: "462 vé; doanh thu thuần 79,4 triệu đồng, tiền và báo cáo ca khớp.",
    amounts: {
      grossVnd: 80_000_000,
      refundVnd: 600_000,
      cashVnd: 20_000_000,
      cardVnd: 59_400_000,
    },
    actor: {
      id: "employee-trang-an-01",
      name: "Đỗ Thị Lan",
      role: "employee",
    },
    now: "2026-07-28T05:08:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000001",
  });

  const tamChucSubmission = createShiftCloseSubmission({
    id: "61000000-0000-4000-8000-000000000002",
    shiftCode: "SC-TC-20260728-01",
    idempotencyKey: "seed:shift-close:tc:manager-approved",
    siteId: "tam-chuc",
    businessDate: "2026-07-28",
    station: "Cổng 01",
    shiftLabel: "Ca sáng 07:00–12:00",
    shiftStartedAt: "2026-07-28T00:00:00.000Z",
    shiftEndedAt: "2026-07-28T05:00:00.000Z",
    ticketsSold: 337,
    financeCode: "REV-TC-GATE-01",
    note: "Quản lý đã kiểm tra biên bản ca và số thu theo kênh.",
    amounts: {
      grossVnd: 61_600_000,
      refundVnd: 400_000,
      cashVnd: 12_000_000,
      cardVnd: 49_200_000,
    },
    actor: {
      id: "employee-tam-chuc-01",
      name: "Vũ Ngọc Mai",
      role: "employee",
    },
    now: "2026-07-28T05:06:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000002",
  });
  const tamChucApproved = transitionShiftClose(tamChucSubmission, {
    type: "manager.review",
    decision: "approve",
    actor: {
      id: "manager-tam-chuc",
      name: "Trần Thu Hà",
      role: "manager",
    },
    note: "Số vé, hoàn vé và các kênh thanh toán khớp biên bản.",
    now: "2026-07-28T05:20:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000003",
  });

  const baiDinhSubmission = createShiftCloseSubmission({
    id: "61000000-0000-4000-8000-000000000003",
    shiftCode: "SC-BD-20260728-01",
    idempotencyKey: "seed:shift-close:bd:exception",
    siteId: "bai-dinh",
    businessDate: "2026-07-28",
    station: "Cổng B",
    shiftLabel: "Ca sáng 07:00–12:00",
    shiftStartedAt: "2026-07-28T00:00:00.000Z",
    shiftEndedAt: "2026-07-28T05:00:00.000Z",
    ticketsSold: 708,
    financeCode: "REV-BD-GATE-B",
    note: "Thiếu 18 triệu đồng ở đối soát QR; kế toán đã chuyển ngoại lệ để xử lý.",
    amounts: {
      grossVnd: 126_400_000,
      refundVnd: 800_000,
      cashVnd: 30_000_000,
      cardVnd: 77_600_000,
    },
    actor: {
      id: "employee-bai-dinh-01",
      name: "Lương Thanh Tùng",
      role: "employee",
    },
    now: "2026-07-28T05:04:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000004",
  });
  const baiDinhApproved = transitionShiftClose(baiDinhSubmission, {
    type: "manager.review",
    decision: "approve",
    actor: {
      id: "manager-bai-dinh",
      name: "Hoàng Gia Bảo",
      role: "manager",
    },
    note: "Biên bản vận hành đủ; chuyển kế toán đối chiếu kênh QR.",
    now: "2026-07-28T05:18:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000005",
  });
  const baiDinhException = transitionShiftClose(baiDinhApproved, {
    type: "accountant.reconcile",
    decision: "escalate",
    actor: {
      id: "accountant-001",
      name: "Phạm Thu Trang",
      role: "accountant",
    },
    note: "QR thiếu 18 triệu đồng so với báo cáo bán vé; cần xác minh ngân hàng.",
    now: "2026-07-28T05:45:00.000Z",
    auditEventId: "62000000-0000-4000-8000-000000000006",
  });

  return {
    version: DEMO_COOKIE_VERSION,
    records: [
      trangAnSubmission,
      tamChucApproved,
      baiDinhException,
    ],
    idempotency: [],
  };
}

function boundedText(value: string, field: string, maxLength: number) {
  if (!value.trim() || value.length > maxLength) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close text: ${field}.`,
    );
  }
  return value;
}

function boundedOptionalText(
  value: string | undefined,
  field: string,
  maxLength: number,
) {
  if (value === undefined) return undefined;
  if (value.length > maxLength) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close text: ${field}.`,
    );
  }
  return value;
}

function validTimestamp(value: string, field: string) {
  if (value.length > 40 || !Number.isFinite(Date.parse(value))) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close timestamp: ${field}.`,
    );
  }
  return value;
}

function sanitizedActor(
  actor: ShiftCloseActor,
  field: string,
): ShiftCloseActor {
  return {
    id: boundedText(actor.id, `${field}.id`, 100),
    name: boundedText(actor.name, `${field}.name`, 120),
    role: asRole(actor.role),
  };
}

function sanitizedReview(
  review: ShiftCloseReview | undefined,
  field: string,
) {
  if (!review) return undefined;
  return {
    actor: sanitizedActor(review.actor, `${field}.actor`),
    decision: boundedText(review.decision, `${field}.decision`, 40),
    note: boundedOptionalText(review.note, `${field}.note`, 2_000) ?? "",
    at: validTimestamp(review.at, `${field}.at`),
  };
}

function sanitizedAuditEvent(
  event: ShiftCloseAuditEvent,
  index: number,
): ShiftCloseAuditEvent {
  const allowedActions: readonly ShiftCloseAuditEvent["action"][] = [
    "employee.submit",
    "manager.review",
    "accountant.reconcile",
    "director.decide",
  ];
  if (!allowedActions.includes(event.action)) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close audit action at index ${index}.`,
    );
  }
  if (
    event.fromStatus !== null &&
    !isShiftCloseStatus(event.fromStatus)
  ) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close audit fromStatus at index ${index}.`,
    );
  }
  if (!isShiftCloseStatus(event.toStatus)) {
    throw new ShiftCloseRepositoryError(
      `Invalid persisted shift-close audit toStatus at index ${index}.`,
    );
  }
  return {
    id: boundedText(event.id, `auditTrail[${index}].id`, 100),
    action: event.action,
    actor: sanitizedActor(event.actor, `auditTrail[${index}].actor`),
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note:
      boundedOptionalText(
        event.note,
        `auditTrail[${index}].note`,
        2_000,
      ) ?? "",
    at: validTimestamp(event.at, `auditTrail[${index}].at`),
  };
}

function boundedRecord(value: unknown): ShiftCloseRecord {
  const parsed = parseShiftCloseRecord(value);
  if (!parsed) {
    throw new ShiftCloseRepositoryError(
      "Invalid persisted shift-close record.",
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(
      ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG,
      parsed.siteId,
    )
  ) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close record has an unknown site.",
    );
  }
  if (
    !Number.isSafeInteger(parsed.ticketsSold) ||
    parsed.ticketsSold < 0 ||
    !Number.isSafeInteger(parsed.version) ||
    parsed.version < 1
  ) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close counters are invalid.",
    );
  }
  const differenceVnd = computeShiftCloseDifference(parsed.amounts);
  if (parsed.differenceVnd !== differenceVnd) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close difference does not match its source amounts.",
    );
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(parsed.businessDate) ||
    parsed.auditTrail.length < 1 ||
    parsed.auditTrail.length > 256
  ) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close date or audit length is invalid.",
    );
  }

  const auditTrail = parsed.auditTrail
    .map(sanitizedAuditEvent)
    .slice(-MAX_AUDIT_EVENTS_PER_RECORD);
  const uniqueAuditIds = new Set(auditTrail.map((event) => event.id));
  if (
    uniqueAuditIds.size !== auditTrail.length ||
    auditTrail.at(-1)?.toStatus !== parsed.status
  ) {
    throw new ShiftCloseRepositoryError(
      "Persisted shift-close audit trail is inconsistent.",
    );
  }

  const managerReview = sanitizedReview(
    parsed.managerReview,
    "managerReview",
  );
  const accountingBase = sanitizedReview(
    parsed.accountingReview,
    "accountingReview",
  );
  const accountingReview =
    accountingBase && parsed.accountingReview
      ? {
          ...accountingBase,
          journalReference: boundedOptionalText(
            parsed.accountingReview.journalReference,
            "accountingReview.journalReference",
            120,
          ),
        }
      : undefined;
  const directorDecision = sanitizedReview(
    parsed.directorDecision,
    "directorDecision",
  );
  const sanitized: ShiftCloseRecord = {
    id: boundedText(parsed.id, "id", 100),
    shiftCode: boundedText(parsed.shiftCode, "shiftCode", 100),
    idempotencyKey: requireIdempotencyKey(parsed.idempotencyKey),
    siteId: parsed.siteId,
    businessDate: parsed.businessDate,
    station: boundedText(parsed.station, "station", 160),
    shiftLabel: boundedText(parsed.shiftLabel, "shiftLabel", 160),
    shiftStartedAt: validTimestamp(
      parsed.shiftStartedAt,
      "shiftStartedAt",
    ),
    shiftEndedAt: validTimestamp(parsed.shiftEndedAt, "shiftEndedAt"),
    ticketsSold: parsed.ticketsSold,
    financeCode: boundedText(parsed.financeCode, "financeCode", 100),
    note: boundedOptionalText(parsed.note, "note", 2_000) ?? "",
    status: parsed.status,
    amounts: {
      grossVnd: parsed.amounts.grossVnd,
      refundVnd: parsed.amounts.refundVnd,
      cashVnd: parsed.amounts.cashVnd,
      cardVnd: parsed.amounts.cardVnd,
    },
    differenceVnd,
    submittedBy: sanitizedActor(parsed.submittedBy, "submittedBy"),
    submittedAt: validTimestamp(parsed.submittedAt, "submittedAt"),
    managerReview,
    accountingReview,
    directorDecision,
    updatedAt: validTimestamp(parsed.updatedAt, "updatedAt"),
    version: parsed.version,
    auditTrail,
  };
  if (sanitized.submittedBy.role !== "employee") {
    throw new ShiftCloseRepositoryError(
      "Shift-close submitter must have the employee role.",
    );
  }
  return sanitized;
}

function sanitizeDemoState(value: unknown): DemoCookieState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyDemoState();
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== DEMO_COOKIE_VERSION ||
    !Array.isArray(candidate.records) ||
    !Array.isArray(candidate.idempotency)
  ) {
    return emptyDemoState();
  }

  const recordsById = new Map<string, ShiftCloseRecord>();
  for (const rawRecord of candidate.records.slice(-MAX_DEMO_RECORDS * 2)) {
    try {
      const record = boundedRecord(rawRecord);
      recordsById.set(record.id, record);
    } catch {
      // A malformed record is omitted; the signed cookie remains usable for
      // its other independently valid workflows.
    }
  }
  const records = [...recordsById.values()].slice(-MAX_DEMO_RECORDS);
  const retainedRecordIds = new Set(records.map((record) => record.id));

  const idempotency: DemoIdempotencyReceipt[] = [];
  const seenKeys = new Set<string>();
  for (const rawReceipt of candidate.idempotency.slice(
    -MAX_IDEMPOTENCY_RECEIPTS * 2,
  )) {
    if (
      !rawReceipt ||
      typeof rawReceipt !== "object" ||
      Array.isArray(rawReceipt)
    ) {
      continue;
    }
    const receipt = rawReceipt as Record<string, unknown>;
    if (
      typeof receipt.key !== "string" ||
      receipt.key.length < 8 ||
      receipt.key.length > 160 ||
      typeof receipt.recordId !== "string" ||
      !retainedRecordIds.has(receipt.recordId) ||
      !Number.isInteger(receipt.resultingVersion) ||
      (receipt.resultingVersion as number) < 1 ||
      seenKeys.has(receipt.key)
    ) {
      continue;
    }
    seenKeys.add(receipt.key);
    idempotency.push({
      key: receipt.key,
      recordId: receipt.recordId,
      resultingVersion: receipt.resultingVersion as number,
    });
  }

  return {
    version: DEMO_COOKIE_VERSION,
    records,
    idempotency: idempotency.slice(-MAX_IDEMPOTENCY_RECEIPTS),
  };
}

async function readDemoState() {
  const store = await cookies();
  return sanitizeDemoState(
    decodeCookieState(store.get(DEMO_COOKIE_NAME)?.value),
  );
}

function fitDemoStateToCookie(state: DemoCookieState) {
  const candidate = sanitizeDemoState(state);
  let encoded = encodeCookieState(candidate);

  while (
    Buffer.byteLength(encoded, "utf8") > MAX_COOKIE_VALUE_BYTES &&
    candidate.idempotency.length > 1
  ) {
    candidate.idempotency.shift();
    encoded = encodeCookieState(candidate);
  }
  while (
    Buffer.byteLength(encoded, "utf8") > MAX_COOKIE_VALUE_BYTES &&
    candidate.records.length > 1
  ) {
    const removed = candidate.records.shift();
    candidate.idempotency = candidate.idempotency.filter(
      (receipt) => receipt.recordId !== removed?.id,
    );
    encoded = encodeCookieState(candidate);
  }
  while (
    Buffer.byteLength(encoded, "utf8") > MAX_COOKIE_VALUE_BYTES &&
    candidate.records[0]?.auditTrail.length > 1
  ) {
    candidate.records[0] = boundedRecord({
      ...candidate.records[0],
      auditTrail: candidate.records[0].auditTrail.slice(1),
    });
    encoded = encodeCookieState(candidate);
  }

  if (Buffer.byteLength(encoded, "utf8") > MAX_COOKIE_VALUE_BYTES) {
    throw new ShiftCloseRepositoryError(
      "The newest demo shift-close record exceeds the safe cookie size.",
    );
  }
  return { state: candidate, encoded };
}

async function writeDemoState(state: DemoCookieState) {
  const bounded = fitDemoStateToCookie(state);
  const store = await cookies();
  store.set(DEMO_COOKIE_NAME, bounded.encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
  });
  return bounded.state;
}

function receiptFor(
  state: DemoCookieState,
  idempotencyKey: string,
) {
  return state.idempotency.find(
    (receipt) => receipt.key === idempotencyKey,
  );
}

async function createInDemoCookie(
  record: ShiftCloseRecord,
  idempotencyKey: string,
) {
  const state = await readDemoState();
  const receipt = receiptFor(state, idempotencyKey);
  if (receipt) {
    const existing = state.records.find(
      (candidate) => candidate.id === receipt.recordId,
    );
    if (existing) return existing;
    throw new ShiftCloseRepositoryConflictError(
      "The idempotency receipt exists but its bounded demo record has expired.",
    );
  }
  if (state.records.some((candidate) => candidate.id === record.id)) {
    throw new ShiftCloseRepositoryConflictError(
      `Shift-close record ${record.id} already exists.`,
    );
  }
  if (record.version !== 1) {
    throw new ShiftCloseRepositoryConflictError(
      "A new shift-close record must start at version 1.",
    );
  }

  state.records.push(record);
  state.idempotency.push({
    key: idempotencyKey,
    recordId: record.id,
    resultingVersion: record.version,
  });
  const saved = await writeDemoState(state);
  return (
    saved.records.find((candidate) => candidate.id === record.id) ?? record
  );
}

function assertImmutableIdentity(
  current: ShiftCloseRecord,
  next: ShiftCloseRecord,
) {
  if (
    current.id !== next.id ||
    current.siteId !== next.siteId ||
    current.shiftCode !== next.shiftCode ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.businessDate !== next.businessDate ||
    current.station !== next.station ||
    current.shiftLabel !== next.shiftLabel ||
    current.shiftStartedAt !== next.shiftStartedAt ||
    current.shiftEndedAt !== next.shiftEndedAt ||
    current.ticketsSold !== next.ticketsSold ||
    current.financeCode !== next.financeCode ||
    current.note !== next.note ||
    JSON.stringify(current.amounts) !== JSON.stringify(next.amounts) ||
    current.differenceVnd !== next.differenceVnd ||
    current.submittedBy.id !== next.submittedBy.id ||
    current.submittedBy.name !== next.submittedBy.name ||
    current.submittedBy.role !== next.submittedBy.role ||
    current.submittedAt !== next.submittedAt
  ) {
    throw new ShiftCloseRepositoryConflictError(
      "A shift-close transition cannot rewrite immutable submission identity.",
    );
  }
}

function assertAppendOnlyAudit(
  current: ShiftCloseRecord,
  next: ShiftCloseRecord,
) {
  if (next.auditTrail.length !== current.auditTrail.length + 1) {
    throw new ShiftCloseRepositoryConflictError(
      "A shift-close transition must append exactly one audit event.",
    );
  }
  for (let index = 0; index < current.auditTrail.length; index += 1) {
    if (
      JSON.stringify(current.auditTrail[index]) !==
      JSON.stringify(next.auditTrail[index])
    ) {
      throw new ShiftCloseRepositoryConflictError(
        "Existing shift-close audit events are immutable.",
      );
    }
  }
}

async function transitionInDemoCookie(
  recordId: string,
  expectedVersion: number,
  nextRecord: ShiftCloseRecord,
  idempotencyKey: string,
) {
  const state = await readDemoState();
  const receipt = receiptFor(state, idempotencyKey);
  if (receipt) {
    const existing = state.records.find(
      (candidate) => candidate.id === receipt.recordId,
    );
    if (existing && existing.id === recordId) return existing;
    throw new ShiftCloseRepositoryConflictError(
      "The transition idempotency key was already used for another record.",
    );
  }

  const index = state.records.findIndex(
    (candidate) => candidate.id === recordId,
  );
  if (index < 0) {
    throw new ShiftCloseRepositoryError(
      `Shift-close record ${recordId} was not found.`,
    );
  }
  const current = state.records[index];
  if (current.version !== expectedVersion) {
    throw new ShiftCloseRepositoryConflictError(
      `Shift-close record ${recordId} is at version ${current.version}, not expected version ${expectedVersion}.`,
    );
  }
  if (nextRecord.version !== expectedVersion + 1) {
    throw new ShiftCloseRepositoryConflictError(
      "The transitioned shift-close record must increment version exactly once.",
    );
  }
  assertImmutableIdentity(current, nextRecord);
  assertAppendOnlyAudit(current, nextRecord);

  state.records.splice(index, 1);
  state.records.push(nextRecord);
  state.idempotency.push({
    key: idempotencyKey,
    recordId,
    resultingVersion: nextRecord.version,
  });
  const saved = await writeDemoState(state);
  const result = saved.records.find((candidate) => candidate.id === recordId);
  if (!result) {
    throw new ShiftCloseRepositoryError(
      "The transitioned demo shift-close record could not be reloaded.",
    );
  }
  return result;
}

/**
 * Lists persisted golden-path records. Callers should pass the sites already
 * authorized for the current ERP account. Omitting the scope is reserved for
 * all-site director/server workflows.
 */
export async function listShiftClosures(
  options: ShiftCloseListOptions = {},
): Promise<ShiftCloseRecord[]> {
  const status = getShiftClosePersistenceStatus();
  if (status.requestedMode === "supabase") {
    if (!status.configured) {
      throw new ShiftCloseRepositoryConfigurationError(
        `Supabase persistence is enabled but required server environment is missing: ${status.missingEnvironment.join(", ")}.`,
        status.missingEnvironment,
      );
    }
    return listFromSupabase(options);
  }

  const state = await readDemoState();
  const allowedSites = new Set(normalizeSiteScope(options.siteIds));
  return state.records
    .filter((record) => allowedSites.has(record.siteId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, normalizedLimit(options.limit));
}

export async function createShiftClosure(
  value: ShiftCloseRecord,
  options: ShiftCloseWriteOptions,
): Promise<ShiftCloseRecord> {
  const record = boundedRecord(value);
  const idempotencyKey = requireIdempotencyKey(options.idempotencyKey);
  if (record.idempotencyKey !== idempotencyKey) {
    throw new ShiftCloseRepositoryConflictError(
      "Create idempotency key does not match the shift-close submission.",
    );
  }
  const status = getShiftClosePersistenceStatus();

  if (status.requestedMode === "supabase") {
    if (!status.configured) {
      throw new ShiftCloseRepositoryConfigurationError(
        `Supabase persistence is enabled but required server environment is missing: ${status.missingEnvironment.join(", ")}.`,
        status.missingEnvironment,
      );
    }
    return createInSupabase(record, idempotencyKey);
  }
  return createInDemoCookie(record, idempotencyKey);
}

export async function transitionShiftClosure(
  recordId: string,
  expectedVersion: number,
  value: ShiftCloseRecord,
  options: ShiftCloseWriteOptions,
): Promise<ShiftCloseRecord> {
  if (!recordId || recordId.length > 100) {
    throw new ShiftCloseRepositoryError("Invalid shift-close record id.");
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ShiftCloseRepositoryError(
      "Expected shift-close version must be a positive integer.",
    );
  }
  const nextRecord = boundedRecord(value);
  if (nextRecord.id !== recordId) {
    throw new ShiftCloseRepositoryConflictError(
      "Transition record id does not match its persisted target.",
    );
  }
  if (nextRecord.version !== expectedVersion + 1) {
    throw new ShiftCloseRepositoryConflictError(
      "Transition record version does not follow expectedVersion.",
    );
  }

  const idempotencyKey = requireIdempotencyKey(options.idempotencyKey);
  const status = getShiftClosePersistenceStatus();
  if (status.requestedMode === "supabase") {
    if (!status.configured) {
      throw new ShiftCloseRepositoryConfigurationError(
        `Supabase persistence is enabled but required server environment is missing: ${status.missingEnvironment.join(", ")}.`,
        status.missingEnvironment,
      );
    }
    return transitionInSupabase(
      recordId,
      expectedVersion,
      nextRecord,
      idempotencyKey,
    );
  }
  return transitionInDemoCookie(
    recordId,
    expectedVersion,
    nextRecord,
    idempotencyKey,
  );
}
