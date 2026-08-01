import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  assertBalancedAccountingJournal,
  createAccountingReversal,
  isAccountingJournalStatus,
  isAccountingPeriodStatus,
  nextAccountingJournalStatus,
  nextAccountingPeriodStatus,
  type AccountingAuditEvent,
  type AccountingJournal,
  type AccountingJournalLine,
  type AccountingJournalStatus,
  type AccountingPeriod,
  type AccountingPeriodAction,
  type AccountingReviewDecision,
} from "@/domain/erp-accounting";
import {
  buildShiftCloseJournalProposal,
  type ShiftCloseRecord,
} from "@/domain/erp-shift-close";
import {
  isErpSiteId,
  type ErpRole,
  type ErpSiteId,
} from "@/domain/erp";
import type { Database } from "@/types/database.generated";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import {
  ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG,
  listShiftClosures,
} from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const COOKIE_NAME = "nbj-erp-accounting-v1";
const COOKIE_VERSION = 1;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_MAX_BYTES = 3_800;
const COOKIE_MAX_INFLATED_BYTES = 256 * 1024;
const MAX_DATABASE_JOURNALS = 200;
const MAX_DATABASE_AUDITS = 4_000;
const MAX_DEMO_JOURNALS = 20;
const MAX_DEMO_AUDITS = 80;
const MAX_DEMO_RECEIPTS = 80;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

type PersistenceMode = "supabase" | "demo-cookie";
type DatabaseRow = Record<string, unknown>;

export type AccountingJournalListOptions = {
  siteIds?: readonly ErpSiteId[];
  statuses?: readonly AccountingJournalStatus[];
  periodKey?: string;
  limit?: number;
};

export type AccountingAuditListOptions = {
  entityType?: "journal" | "period" | "shift-close";
  entityId?: string;
  limit?: number;
};

export type AccountingCommandContext = {
  actorAccountId: string;
  idempotencyKey: string;
  requestHash: string;
};

export type PrepareShiftCloseAccountingCommand =
  AccountingCommandContext & {
    note: string;
  };

export type ReviewAccountingJournalCommand = AccountingCommandContext & {
  note: string;
};

export type ReverseAccountingJournalCommand = AccountingCommandContext & {
  reason: string;
};

export type ChangeAccountingPeriodCommand = AccountingCommandContext & {
  reason: string;
};

type DemoReceipt = {
  scope: string;
  key: string;
  requestHash: string;
  entityType: "journal" | "period";
  entityId: string;
  resultingVersion: number;
};

type DemoState = {
  version: typeof COOKIE_VERSION;
  journals: AccountingJournal[];
  periods: AccountingPeriod[];
  periodAudits: AccountingAuditEvent[];
  receipts: DemoReceipt[];
};

export class AccountingRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AccountingRepositoryError";
  }
}

export class AccountingRepositoryConfigurationError extends AccountingRepositoryError {
  readonly missingEnvironment: readonly string[];

  constructor(message: string, missingEnvironment: readonly string[] = []) {
    super(message);
    this.name = "AccountingRepositoryConfigurationError";
    this.missingEnvironment = missingEnvironment;
  }
}

export class AccountingRepositoryConflictError extends AccountingRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "AccountingRepositoryConflictError";
  }
}

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  const mode = !raw ? "demo-cookie" : raw;
  if (mode !== "supabase" && mode !== "demo-cookie") {
    throw new AccountingRepositoryConfigurationError(
      "ERP_PERSISTENCE_MODE phải là supabase hoặc demo-cookie.",
    );
  }
  if (process.env.VERCEL_ENV === "production" && mode !== "supabase") {
    throw new AccountingRepositoryConfigurationError(
      "Môi trường production bắt buộc dùng kho dữ liệu Supabase.",
      ["ERP_PERSISTENCE_MODE"],
    );
  }
  return mode;
}

function requiredSupabaseEnvironment() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SECRET_KEY?.trim()) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  return missing;
}

function createAdminClient(): SupabaseClient<Database> {
  if (readMode() !== "supabase") {
    throw new AccountingRepositoryConfigurationError(
      "Không được mở Supabase client trong chế độ demo-cookie.",
    );
  }
  const missing = requiredSupabaseEnvironment();
  if (missing.length > 0) {
    throw new AccountingRepositoryConfigurationError(
      "Kho kế toán Supabase chưa được cấu hình đủ biến môi trường.",
      missing,
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new AccountingRepositoryConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL không phải URL HTTP(S) hợp lệ.",
      ["NEXT_PUBLIC_SUPABASE_URL"],
    );
  }
  return createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-accounting-server" },
    },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  // Business refusals arrive as machine codes (ACCOUNTING_PERIOD_IS_LOCKED and
  // friends). Before this lookup they were either printed raw at the user or
  // buried under "kho kế toán không hoàn tất được bước ..." -- both of which
  // hide an answer the accountant could have acted on immediately.
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) {
    return new AccountingRepositoryConflictError(businessMessage);
  }
  if (
    error?.code === "40001" ||
    error?.code === "23505" ||
    (error?.code === "P0001" &&
      /version|stale|conflict|idempot|maker|checker|locked/i.test(
        error.message ?? "",
      ))
  ) {
    return new AccountingRepositoryConflictError(
      error.message || "Dữ liệu kế toán đã thay đổi.",
    );
  }
  return new AccountingRepositoryError(
    "Kho kế toán không hoàn tất được bước " + operation + ".",
    {
      cause: error
        ? new Error(
            [error.code, error.message, error.details].filter(Boolean).join(": "),
          )
        : undefined,
    },
  );
}

function asString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AccountingRepositoryError("Thiếu trường dữ liệu " + field + ".");
  }
  return value;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asInteger(value: unknown, field: string) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(number)) {
    throw new AccountingRepositoryError(
      "Trường " + field + " không phải số nguyên hợp lệ.",
    );
  }
  return number;
}

function asSiteId(value: unknown) {
  const mapped = SITE_SLUG_BY_UUID.get(asString(value, "site_id"));
  if (!mapped) {
    throw new AccountingRepositoryError(
      "Bút toán đang tham chiếu cơ sở không thuộc hệ thống.",
    );
  }
  return mapped;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function dimensionsFromRow(value: unknown) {
  const source = asObject(value);
  return Object.fromEntries(
    Object.entries(source)
      .filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      )
      .map(([key, item]) => [key, String(item)]),
  );
}

function lineFromRow(row: DatabaseRow): AccountingJournalLine {
  return {
    id: asString(row.id, "journal_line.id"),
    journalId: asString(row.journal_id, "journal_line.journal_id"),
    lineNumber: asInteger(row.line_number, "journal_line.line_number"),
    accountCode: asString(row.account_code, "journal_line.account_code"),
    accountName: asString(row.account_name, "journal_line.account_name"),
    debitVnd: asInteger(row.debit_vnd, "journal_line.debit_vnd"),
    creditVnd: asInteger(row.credit_vnd, "journal_line.credit_vnd"),
    dimensions: dimensionsFromRow(row.dimensions),
  };
}

function auditFromRow(row: DatabaseRow): AccountingAuditEvent {
  const entityType = asString(row.entity_type, "audit.entity_type");
  const actorRole = asString(row.actor_role, "audit.actor_role");
  if (
    actorRole !== "accountant-maker" &&
    actorRole !== "accounting-checker" &&
    actorRole !== "system"
  ) {
    throw new AccountingRepositoryError(
      "Vai trò trong nhật ký kế toán không hợp lệ.",
    );
  }
  const entityId = asString(row.entity_id, "audit.entity_id");
  return {
    id: asString(row.id, "audit.id"),
    journalId: entityType === "journal" ? entityId : null,
    periodId: entityType === "period" ? entityId : null,
    sequenceNumber: asInteger(row.sequence_number, "audit.sequence_number"),
    eventType: asString(row.event_type, "audit.event_type"),
    fromStatus: asNullableString(row.from_status),
    toStatus: asString(row.to_status, "audit.to_status"),
    actorAccountId: asString(
      row.actor_account_id,
      "audit.actor_account_id",
    ),
    actorRole,
    note: typeof row.note === "string" ? row.note : "",
    metadata: asObject(row.metadata),
    occurredAt: asString(row.occurred_at, "audit.occurred_at"),
  };
}

function journalFromRows(
  row: DatabaseRow,
  lineRows: readonly DatabaseRow[],
  auditRows: readonly DatabaseRow[],
): AccountingJournal {
  const status = row.status;
  if (!isAccountingJournalStatus(status)) {
    throw new AccountingRepositoryError(
      "Trạng thái bút toán trong kho dữ liệu không hợp lệ.",
    );
  }
  if (
    row.source_type !== "shift-close" &&
    row.source_type !== "supplier-invoice"
  ) {
    throw new AccountingRepositoryError(
      "Nguồn bút toán chưa được hệ thống hỗ trợ.",
    );
  }
  const sourceWorkflowId = asNullableString(row.source_workflow_id);
  const sourceSupplierInvoiceId = asNullableString(
    row.source_supplier_invoice_id,
  );
  if (
    (row.source_type === "shift-close" &&
      (!sourceWorkflowId || sourceSupplierInvoiceId)) ||
    (row.source_type === "supplier-invoice" &&
      (sourceWorkflowId || !sourceSupplierInvoiceId))
  ) {
    throw new AccountingRepositoryError(
      "Liên kết nguồn bút toán trong kho dữ liệu không hợp lệ.",
    );
  }
  const lines = lineRows
    .map(lineFromRow)
    .sort((left, right) => left.lineNumber - right.lineNumber);
  assertBalancedAccountingJournal(lines);
  return {
    id: asString(row.id, "journal.id"),
    tenantId: asString(row.tenant_id, "journal.tenant_id"),
    siteId: asSiteId(row.site_id),
    journalCode: asString(row.journal_code, "journal.journal_code"),
    sourceType: row.source_type,
    sourceWorkflowId,
    sourceSupplierInvoiceId,
    sourceVersion: asInteger(row.source_version, "journal.source_version"),
    businessDate: asString(row.business_date, "journal.business_date"),
    periodKey: asString(row.period_key, "journal.period_key"),
    status,
    version: asInteger(row.version, "journal.version"),
    makerAccountId: asString(
      row.maker_account_id,
      "journal.maker_account_id",
    ),
    makerNote: typeof row.maker_note === "string" ? row.maker_note : "",
    checkerAccountId: asNullableString(row.checker_account_id),
    checkerNote: asNullableString(row.checker_note),
    submittedAt: asNullableString(row.submitted_at),
    approvedAt: asNullableString(row.approved_at),
    postedAt: asNullableString(row.posted_at),
    reversalOfJournalId: asNullableString(row.reversal_of_journal_id),
    supersedesJournalId: asNullableString(row.supersedes_journal_id),
    createdAt: asString(row.created_at, "journal.created_at"),
    updatedAt: asString(row.updated_at, "journal.updated_at"),
    lines,
    auditTrail: auditRows
      .map(auditFromRow)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber),
  };
}

function periodFromRow(row: DatabaseRow): AccountingPeriod {
  if (!isAccountingPeriodStatus(row.status)) {
    throw new AccountingRepositoryError(
      "Trạng thái kỳ kế toán trong kho dữ liệu không hợp lệ.",
    );
  }
  return {
    id: asString(row.id, "period.id"),
    tenantId: asString(row.tenant_id, "period.tenant_id"),
    periodKey: asString(row.period_key, "period.period_key"),
    startsOn: asString(row.starts_on, "period.starts_on"),
    endsOn: asString(row.ends_on, "period.ends_on"),
    status: row.status,
    version: asInteger(row.version, "period.version"),
    lockedByAccountId: asNullableString(row.locked_by_account_id),
    lockedAt: asNullableString(row.locked_at),
    lockReason: asNullableString(row.lock_reason),
    reopenedByAccountId: asNullableString(row.reopened_by_account_id),
    reopenedAt: asNullableString(row.reopened_at),
    reopenReason: asNullableString(row.reopen_reason),
    createdAt: asString(row.created_at, "period.created_at"),
    updatedAt: asString(row.updated_at, "period.updated_at"),
  };
}

function normalizedLimit(value: number | undefined, maximum: number) {
  if (!Number.isFinite(value)) return maximum;
  return Math.max(1, Math.min(maximum, Math.trunc(value!)));
}

function normalizeSiteScope(siteIds: readonly ErpSiteId[] | undefined) {
  const source =
    siteIds ??
    (Object.keys(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG) as ErpSiteId[]);
  return [...new Set(source)].filter(isErpSiteId);
}

function validatePeriodKey(value: string) {
  const periodKey = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new AccountingRepositoryError(
      "Kỳ kế toán phải theo định dạng YYYY-MM.",
    );
  }
  return periodKey;
}

function validateRecordId(value: string, label: string) {
  const id = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    throw new AccountingRepositoryError(label + " không hợp lệ.");
  }
  return id;
}

function validateExpectedVersion(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AccountingRepositoryError(
      "Phiên bản dự kiến của " + label + " không hợp lệ.",
    );
  }
  return value;
}

function validateCommandContext(context: AccountingCommandContext) {
  const actorAccountId = context.actorAccountId.trim();
  const idempotencyKey = context.idempotencyKey.trim();
  const requestHash = context.requestHash.trim();
  if (actorAccountId.length < 2 || actorAccountId.length > 100) {
    throw new AccountingRepositoryError(
      "Tài khoản thực hiện lệnh kế toán không hợp lệ.",
    );
  }
  if (
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 160 ||
    !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
  ) {
    throw new AccountingRepositoryError(
      "Khóa chống gửi trùng của lệnh kế toán không hợp lệ.",
    );
  }
  if (!/^[0-9a-f]{64}$/.test(requestHash)) {
    throw new AccountingRepositoryError(
      "Dấu vân tay yêu cầu kế toán không hợp lệ.",
    );
  }
  return { actorAccountId, idempotencyKey, requestHash };
}

async function listJournalsFromSupabase(
  options: AccountingJournalListOptions,
) {
  const client = createAdminClient();
  const sites = normalizeSiteScope(options.siteIds);
  if (sites.length === 0) return [];
  const siteUuids = sites.map(
    (siteId) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  );
  let query = client
    .from("erp_accounting_journals")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .in("site_id", siteUuids);
  if (options.statuses?.length) {
    query = query.in("status", [...new Set(options.statuses)]);
  }
  if (options.periodKey) {
    query = query.eq("period_key", validatePeriodKey(options.periodKey));
  }
  const journalResult = await query
    .order("updated_at", { ascending: false })
    .limit(normalizedLimit(options.limit, MAX_DATABASE_JOURNALS));
  if (journalResult.error) {
    throw repositoryError("đọc danh sách bút toán", journalResult.error);
  }
  const journalRows = (journalResult.data ?? []) as DatabaseRow[];
  return hydrateJournals(client, journalRows);
}

async function hydrateJournals(
  client: SupabaseClient<Database>,
  journalRows: readonly DatabaseRow[],
) {
  if (journalRows.length === 0) return [];
  const journalIds = journalRows.map((row) => asString(row.id, "journal.id"));
  const [lineResult, auditResult] = await Promise.all([
    client
      .from("erp_accounting_journal_lines")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .in("journal_id", journalIds)
      .order("line_number", { ascending: true }),
    client
      .from("erp_accounting_audit_events")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("entity_type", "journal")
      .in("entity_id", journalIds)
      .order("sequence_number", { ascending: true })
      .limit(MAX_DATABASE_AUDITS),
  ]);
  if (lineResult.error) {
    throw repositoryError("đọc dòng bút toán", lineResult.error);
  }
  if (auditResult.error) {
    throw repositoryError("đọc nhật ký bút toán", auditResult.error);
  }
  const linesByJournal = new Map<string, DatabaseRow[]>();
  for (const row of (lineResult.data ?? []) as DatabaseRow[]) {
    const id = asString(row.journal_id, "journal_line.journal_id");
    const current = linesByJournal.get(id) ?? [];
    current.push(row);
    linesByJournal.set(id, current);
  }
  const auditsByJournal = new Map<string, DatabaseRow[]>();
  for (const row of (auditResult.data ?? []) as DatabaseRow[]) {
    const id = asString(row.entity_id, "audit.entity_id");
    const current = auditsByJournal.get(id) ?? [];
    current.push(row);
    auditsByJournal.set(id, current);
  }
  return journalRows.map((row) => {
    const id = asString(row.id, "journal.id");
    return journalFromRows(
      row,
      linesByJournal.get(id) ?? [],
      auditsByJournal.get(id) ?? [],
    );
  });
}

async function getJournalFromSupabase(id: string) {
  const client = createAdminClient();
  const result = await client
    .from("erp_accounting_journals")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("id", id)
    .maybeSingle();
  if (result.error) {
    throw repositoryError("đọc bút toán", result.error);
  }
  if (!result.data) return null;
  const hydrated = await hydrateJournals(client, [
    result.data as DatabaseRow,
  ]);
  return hydrated[0] ?? null;
}

function rpcRow(data: unknown, field: string) {
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") {
    throw new AccountingRepositoryError(
      "RPC không trả lại " + field + " vừa cập nhật.",
    );
  }
  return raw as DatabaseRow;
}

async function prepareInSupabase(
  workflowId: string,
  expectedSourceVersion: number,
  command: PrepareShiftCloseAccountingCommand,
) {
  const client = createAdminClient();
  const result = await client.rpc("erp_accounting_prepare_shift_close", {
    p_workflow_id: workflowId,
    p_expected_source_version: expectedSourceVersion,
    p_actor_account_id: command.actorAccountId,
    p_note: command.note,
    p_idempotency_key: command.idempotencyKey,
    p_request_hash: command.requestHash,
  });
  if (result.error) {
    throw repositoryError("lập bút toán chốt ca", result.error);
  }
  const id = asString(rpcRow(result.data, "bút toán").id, "journal.id");
  const journal = await getJournalFromSupabase(id);
  if (!journal) {
    throw new AccountingRepositoryError(
      "Không tải lại được bút toán vừa lập.",
    );
  }
  return journal;
}

async function reviewInSupabase(
  journalId: string,
  expectedVersion: number,
  decision: AccountingReviewDecision,
  command: ReviewAccountingJournalCommand,
) {
  const client = createAdminClient();
  const result = await client.rpc("erp_accounting_review_journal", {
    p_journal_id: journalId,
    p_expected_version: expectedVersion,
    p_actor_account_id: command.actorAccountId,
    p_decision: decision,
    p_note: command.note,
    p_idempotency_key: command.idempotencyKey,
    p_request_hash: command.requestHash,
  });
  if (result.error) {
    throw repositoryError("kiểm tra bút toán", result.error);
  }
  const id = asString(rpcRow(result.data, "bút toán").id, "journal.id");
  const journal = await getJournalFromSupabase(id);
  if (!journal) {
    throw new AccountingRepositoryError(
      "Không tải lại được bút toán vừa kiểm tra.",
    );
  }
  return journal;
}

async function reverseInSupabase(
  journalId: string,
  expectedVersion: number,
  command: ReverseAccountingJournalCommand,
) {
  const client = createAdminClient();
  const result = await client.rpc("erp_accounting_reverse_journal", {
    p_journal_id: journalId,
    p_expected_version: expectedVersion,
    p_actor_account_id: command.actorAccountId,
    p_reason: command.reason,
    p_idempotency_key: command.idempotencyKey,
    p_request_hash: command.requestHash,
  });
  if (result.error) {
    throw repositoryError("đảo bút toán", result.error);
  }
  const id = asString(
    rpcRow(result.data, "bút toán đảo").id,
    "reversal_journal.id",
  );
  const journal = await getJournalFromSupabase(id);
  if (!journal) {
    throw new AccountingRepositoryError(
      "Không tải lại được bút toán đảo vừa tạo.",
    );
  }
  return journal;
}

async function changePeriodInSupabase(
  periodKey: string,
  expectedVersion: number,
  action: AccountingPeriodAction,
  command: ChangeAccountingPeriodCommand,
) {
  const client = createAdminClient();
  const result = await client.rpc("erp_accounting_change_period", {
    p_period_key: periodKey,
    p_expected_version: expectedVersion,
    p_actor_account_id: command.actorAccountId,
    p_action: action,
    p_reason: command.reason,
    p_idempotency_key: command.idempotencyKey,
    p_request_hash: command.requestHash,
  });
  if (result.error) {
    throw repositoryError("thay đổi trạng thái kỳ kế toán", result.error);
  }
  return periodFromRow(rpcRow(result.data, "kỳ kế toán"));
}

function cookieSecret() {
  return (
    process.env.ERP_ACCOUNTING_COOKIE_SECRET?.trim() ||
    process.env.ERP_DEMO_SESSION_SECRET?.trim() ||
    "destinationos-accounting-demo-cookie-v1-change-before-live-data"
  );
}

function sign(payload: string) {
  return createHmac("sha256", cookieSecret())
    .update(payload)
    .digest("base64url");
}

function encodeState(state: DemoState) {
  const compressed = deflateRawSync(
    Buffer.from(JSON.stringify(state), "utf8"),
  ).toString("base64url");
  return compressed + "." + sign(compressed);
}

function decodeState(input: string | undefined): unknown {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
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

function emptyState(): DemoState {
  return {
    version: COOKIE_VERSION,
    journals: [],
    periods: [],
    periodAudits: [],
    receipts: [],
  };
}

function sanitizeDemoJournal(value: unknown): AccountingJournal | null {
  if (!value || typeof value !== "object") return null;
  const journal = value as Partial<AccountingJournal>;
  if (
    typeof journal.id !== "string" ||
    typeof journal.tenantId !== "string" ||
    !isErpSiteId(journal.siteId ?? "") ||
    typeof journal.journalCode !== "string" ||
    journal.sourceType !== "shift-close" ||
    typeof journal.sourceWorkflowId !== "string" ||
    journal.sourceSupplierInvoiceId != null ||
    !Number.isSafeInteger(journal.sourceVersion) ||
    typeof journal.businessDate !== "string" ||
    typeof journal.periodKey !== "string" ||
    !isAccountingJournalStatus(journal.status) ||
    !Number.isSafeInteger(journal.version) ||
    typeof journal.makerAccountId !== "string" ||
    !Array.isArray(journal.lines) ||
    !Array.isArray(journal.auditTrail)
  ) {
    return null;
  }
  try {
    assertBalancedAccountingJournal(journal.lines as AccountingJournalLine[]);
  } catch {
    return null;
  }
  return { ...journal, sourceSupplierInvoiceId: null } as AccountingJournal;
}

function sanitizeState(value: unknown): DemoState {
  if (!value || typeof value !== "object") return emptyState();
  const candidate = value as Partial<DemoState>;
  if (candidate.version !== COOKIE_VERSION) return emptyState();
  return {
    version: COOKIE_VERSION,
    journals: Array.isArray(candidate.journals)
      ? candidate.journals
          .map(sanitizeDemoJournal)
          .filter((item): item is AccountingJournal => Boolean(item))
          .slice(-MAX_DEMO_JOURNALS)
      : [],
    periods: Array.isArray(candidate.periods)
      ? candidate.periods
          .filter(
            (item): item is AccountingPeriod =>
              Boolean(
                item &&
                  typeof item === "object" &&
                  isAccountingPeriodStatus(
                    (item as AccountingPeriod).status,
                  ),
              ),
          )
          .slice(-24)
      : [],
    periodAudits: Array.isArray(candidate.periodAudits)
      ? candidate.periodAudits.slice(-MAX_DEMO_AUDITS)
      : [],
    receipts: Array.isArray(candidate.receipts)
      ? candidate.receipts.slice(-MAX_DEMO_RECEIPTS)
      : [],
  };
}

async function readDemoState() {
  const store = await cookies();
  return sanitizeState(decodeState(store.get(COOKIE_NAME)?.value));
}

async function writeDemoState(state: DemoState) {
  state.journals = state.journals
    .slice(-MAX_DEMO_JOURNALS)
    .map((journal) => ({
      ...journal,
      auditTrail: journal.auditTrail.slice(-MAX_DEMO_AUDITS),
    }));
  state.periodAudits = state.periodAudits.slice(-MAX_DEMO_AUDITS);
  state.receipts = state.receipts.slice(-MAX_DEMO_RECEIPTS);
  const encoded = encodeState(state);
  if (Buffer.byteLength(encoded, "utf8") > COOKIE_MAX_BYTES) {
    throw new AccountingRepositoryError(
      "Kho demo kế toán đã đầy; hãy xóa phiên demo trước khi tạo thêm hồ sơ.",
    );
  }
  const store = await cookies();
  store.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/erp",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

function findReceipt(
  state: DemoState,
  scope: string,
  command: AccountingCommandContext,
) {
  const receipt = state.receipts.find(
    (item) => item.scope === scope && item.key === command.idempotencyKey,
  );
  if (receipt && receipt.requestHash !== command.requestHash) {
    throw new AccountingRepositoryConflictError(
      "Khóa chống gửi trùng đã được dùng cho một nội dung khác.",
    );
  }
  return receipt;
}

function saveReceipt(
  state: DemoState,
  scope: string,
  command: AccountingCommandContext,
  entityType: "journal" | "period",
  entityId: string,
  resultingVersion: number,
) {
  state.receipts.push({
    scope,
    key: command.idempotencyKey,
    requestHash: command.requestHash,
    entityType,
    entityId,
    resultingVersion,
  });
}

function receiptJournal(state: DemoState, receipt: DemoReceipt) {
  const journal = state.journals.find((item) => item.id === receipt.entityId);
  if (!journal) {
    throw new AccountingRepositoryError(
      "Không tìm thấy kết quả của lệnh đã nhận trước đó.",
    );
  }
  return journal;
}

function receiptPeriod(state: DemoState, receipt: DemoReceipt) {
  const period = state.periods.find((item) => item.id === receipt.entityId);
  if (!period) {
    throw new AccountingRepositoryError(
      "Không tìm thấy kỳ kế toán của lệnh đã nhận trước đó.",
    );
  }
  return period;
}

function periodDates(periodKey: string) {
  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startsOn: periodKey + "-01",
    endsOn: periodKey + "-" + String(lastDay).padStart(2, "0"),
  };
}

function ensureDemoPeriod(state: DemoState, periodKey: string, now: string) {
  const existing = state.periods.find(
    (period) => period.periodKey === periodKey,
  );
  if (existing) return existing;
  const dates = periodDates(periodKey);
  const period: AccountingPeriod = {
    id: randomUUID(),
    tenantId: TENANT_ID,
    periodKey,
    ...dates,
    status: "open",
    version: 1,
    lockedByAccountId: null,
    lockedAt: null,
    lockReason: null,
    reopenedByAccountId: null,
    reopenedAt: null,
    reopenReason: null,
    createdAt: now,
    updatedAt: now,
  };
  state.periods.push(period);
  return period;
}

function requireOpenPeriod(state: DemoState, periodKey: string, now: string) {
  const period = ensureDemoPeriod(state, periodKey, now);
  if (period.status !== "open") {
    throw new AccountingRepositoryConflictError(
      "Kỳ kế toán " + periodKey + " đã khóa.",
    );
  }
  return period;
}

function sourceJournalLines(
  source: ShiftCloseRecord,
  journalId: string,
): AccountingJournalLine[] {
  return buildShiftCloseJournalProposal(source).map((line, index) => ({
    id: journalId + ":line:" + (index + 1),
    journalId,
    lineNumber: index + 1,
    accountCode: line.account,
    accountName: line.label,
    debitVnd: line.debitVnd,
    creditVnd: line.creditVnd,
    dimensions: {
      siteId: source.siteId,
      financeCode: source.financeCode,
      station: source.station,
      shiftCode: source.shiftCode,
    },
  }));
}

function makerAudit(
  journal: AccountingJournal,
  actorAccountId: string,
  note: string,
  fromStatus: AccountingJournalStatus | null,
  now: string,
  idempotencyKey: string,
): AccountingAuditEvent {
  return {
    id: randomUUID(),
    journalId: journal.id,
    periodId: null,
    sequenceNumber: journal.auditTrail.length + 1,
    eventType:
      fromStatus === "checker-returned"
        ? "journal.resubmitted"
        : "journal.prepared",
    fromStatus,
    toStatus: "pending-checker",
    actorAccountId,
    actorRole: "accountant-maker",
    note,
    metadata: { idempotencyKey, sourceVersion: journal.sourceVersion },
    occurredAt: now,
  };
}

async function prepareInDemo(
  workflowId: string,
  expectedSourceVersion: number,
  command: PrepareShiftCloseAccountingCommand,
) {
  const state = await readDemoState();
  const scope = "prepare-shift-close:" + workflowId;
  const receipt = findReceipt(state, scope, command);
  if (receipt) return receiptJournal(state, receipt);
  const sources = await listShiftClosures({ limit: 100 });
  const source = sources.find((item) => item.id === workflowId);
  if (!source) {
    throw new AccountingRepositoryError(
      "Không tìm thấy hồ sơ chốt ca để lập bút toán.",
    );
  }
  if (source.version !== expectedSourceVersion) {
    throw new AccountingRepositoryConflictError(
      "Hồ sơ chốt ca đã được cập nhật; hãy tải lại trước khi lập bút toán.",
    );
  }
  if (
    !["manager-approved", "accounting-review", "director-approved"].includes(
      source.status,
    )
  ) {
    throw new AccountingRepositoryConflictError(
      "Hồ sơ chốt ca chưa đủ điều kiện chuyển sang kế toán.",
    );
  }
  const now = new Date().toISOString();
  const periodKey = validatePeriodKey(source.businessDate.slice(0, 7));
  requireOpenPeriod(state, periodKey, now);
  const existing = state.journals.find(
    (item) =>
      item.sourceType === "shift-close" &&
      item.sourceWorkflowId === workflowId &&
      !item.reversalOfJournalId,
  );

  let journal: AccountingJournal;
  if (existing) {
    if (existing.status !== "checker-returned") {
      throw new AccountingRepositoryConflictError(
        "Hồ sơ chốt ca này đã có bút toán đang xử lý hoặc đã ghi sổ.",
      );
    }
    const fromStatus = existing.status;
    journal = {
      ...existing,
      sourceVersion: source.version,
      status: nextAccountingJournalStatus(existing.status, "prepare"),
      version: existing.version + 1,
      makerAccountId: command.actorAccountId,
      makerNote: command.note.trim(),
      checkerAccountId: null,
      checkerNote: null,
      approvedAt: null,
      postedAt: null,
      submittedAt: now,
      updatedAt: now,
      lines: sourceJournalLines(source, existing.id),
      auditTrail: existing.auditTrail,
    };
    journal = {
      ...journal,
      auditTrail: [
        ...journal.auditTrail,
        makerAudit(
          journal,
          command.actorAccountId,
          command.note,
          fromStatus,
          now,
          command.idempotencyKey,
        ),
      ],
    };
    state.journals[state.journals.indexOf(existing)] = journal;
  } else {
    const id = randomUUID();
    journal = {
      id,
      tenantId: TENANT_ID,
      siteId: source.siteId,
      journalCode:
        "JV-" +
        source.businessDate.replaceAll("-", "") +
        "-" +
        source.shiftCode.replace(/[^A-Za-z0-9]/g, "").slice(-12),
      sourceType: "shift-close",
      sourceWorkflowId: source.id,
      sourceSupplierInvoiceId: null,
      sourceVersion: source.version,
      businessDate: source.businessDate,
      periodKey,
      status: "pending-checker",
      version: 1,
      makerAccountId: command.actorAccountId,
      makerNote: command.note.trim(),
      checkerAccountId: null,
      checkerNote: null,
      submittedAt: now,
      approvedAt: null,
      postedAt: null,
      reversalOfJournalId: null,
      supersedesJournalId: null,
      createdAt: now,
      updatedAt: now,
      lines: sourceJournalLines(source, id),
      auditTrail: [],
    };
    assertBalancedAccountingJournal(journal.lines);
    journal = {
      ...journal,
      auditTrail: [
        makerAudit(
          journal,
          command.actorAccountId,
          command.note,
          null,
          now,
          command.idempotencyKey,
        ),
      ],
    };
    state.journals.push(journal);
  }
  saveReceipt(
    state,
    scope,
    command,
    "journal",
    journal.id,
    journal.version,
  );
  await writeDemoState(state);
  return journal;
}

async function reviewInDemo(
  journalId: string,
  expectedVersion: number,
  decision: AccountingReviewDecision,
  command: ReviewAccountingJournalCommand,
) {
  const state = await readDemoState();
  const scope =
    "review-journal:" + journalId + ":" + expectedVersion + ":" + decision;
  const receipt = findReceipt(state, scope, command);
  if (receipt) return receiptJournal(state, receipt);
  const current = state.journals.find((item) => item.id === journalId);
  if (!current) throw new AccountingRepositoryError("Không tìm thấy bút toán.");
  if (current.version !== expectedVersion) {
    throw new AccountingRepositoryConflictError(
      "Bút toán đã được cập nhật; hãy tải lại trước khi xử lý.",
    );
  }
  if (current.makerAccountId === command.actorAccountId) {
    throw new AccountingRepositoryConflictError(
      "Người lập không được tự kiểm tra bút toán của mình.",
    );
  }
  const now = new Date().toISOString();
  if (decision === "approve") {
    requireOpenPeriod(state, current.periodKey, now);
    assertBalancedAccountingJournal(current.lines);
  } else if (command.note.trim().length < 4) {
    throw new AccountingRepositoryError(
      "Khi trả lại phải ghi rõ nội dung cần bổ sung.",
    );
  }
  const nextStatus = nextAccountingJournalStatus(
    current.status,
    decision,
  );
  const audit: AccountingAuditEvent = {
    id: randomUUID(),
    journalId: current.id,
    periodId: null,
    sequenceNumber: current.auditTrail.length + 1,
    eventType:
      decision === "approve" ? "journal.approved" : "journal.returned",
    fromStatus: current.status,
    toStatus: nextStatus,
    actorAccountId: command.actorAccountId,
    actorRole: "accounting-checker",
    note: command.note.trim(),
    metadata: { idempotencyKey: command.idempotencyKey },
    occurredAt: now,
  };
  const journal: AccountingJournal = {
    ...current,
    status: nextStatus,
    version: current.version + 1,
    checkerAccountId: command.actorAccountId,
    checkerNote: command.note.trim(),
    approvedAt: decision === "approve" ? now : null,
    postedAt: decision === "approve" ? now : null,
    updatedAt: now,
    auditTrail: [...current.auditTrail, audit],
  };
  state.journals[state.journals.indexOf(current)] = journal;
  saveReceipt(
    state,
    scope,
    command,
    "journal",
    journal.id,
    journal.version,
  );
  await writeDemoState(state);
  return journal;
}

async function reverseInDemo(
  journalId: string,
  expectedVersion: number,
  command: ReverseAccountingJournalCommand,
) {
  const state = await readDemoState();
  const scope = "reverse-journal:" + journalId + ":" + expectedVersion;
  const receipt = findReceipt(state, scope, command);
  if (receipt) return receiptJournal(state, receipt);
  const original = state.journals.find((item) => item.id === journalId);
  if (!original) throw new AccountingRepositoryError("Không tìm thấy bút toán.");
  if (original.version !== expectedVersion) {
    throw new AccountingRepositoryConflictError(
      "Bút toán đã được cập nhật; hãy tải lại trước khi đảo.",
    );
  }
  if (
    state.journals.some(
      (item) => item.reversalOfJournalId === original.id,
    )
  ) {
    throw new AccountingRepositoryConflictError(
      "Bút toán này đã có bút toán đảo.",
    );
  }
  const now = new Date().toISOString();
  requireOpenPeriod(state, original.periodKey, now);
  const id = randomUUID();
  const reversal = createAccountingReversal(original, {
    id,
    journalCode: "REV-" + original.journalCode,
    actorAccountId: command.actorAccountId,
    reason: command.reason,
    now,
  });
  state.journals.push(reversal);
  saveReceipt(
    state,
    scope,
    command,
    "journal",
    reversal.id,
    reversal.version,
  );
  await writeDemoState(state);
  return reversal;
}

async function changePeriodInDemo(
  periodKey: string,
  expectedVersion: number,
  action: AccountingPeriodAction,
  command: ChangeAccountingPeriodCommand,
) {
  const state = await readDemoState();
  const scope =
    "change-period:" + periodKey + ":" + expectedVersion + ":" + action;
  const receipt = findReceipt(state, scope, command);
  if (receipt) return receiptPeriod(state, receipt);
  const current = state.periods.find(
    (period) => period.periodKey === periodKey,
  );
  if (!current) {
    throw new AccountingRepositoryError(
      "Không tìm thấy kỳ kế toán " + periodKey + ".",
    );
  }
  if (current.version !== expectedVersion) {
    throw new AccountingRepositoryConflictError(
      "Kỳ kế toán đã được cập nhật; hãy tải lại trước khi xử lý.",
    );
  }
  if (command.reason.trim().length < 4) {
    throw new AccountingRepositoryError(
      "Phải ghi rõ lý do khóa hoặc mở lại kỳ.",
    );
  }
  if (
    action === "lock" &&
    state.journals.some(
      (journal) =>
        journal.periodKey === periodKey && journal.status !== "posted",
    )
  ) {
    throw new AccountingRepositoryConflictError(
      "Kỳ còn bút toán chưa ghi sổ nên chưa thể khóa.",
    );
  }
  const now = new Date().toISOString();
  const status = nextAccountingPeriodStatus(current.status, action);
  const period: AccountingPeriod = {
    ...current,
    status,
    version: current.version + 1,
    lockedByAccountId:
      action === "lock" ? command.actorAccountId : null,
    lockedAt: action === "lock" ? now : null,
    lockReason: action === "lock" ? command.reason.trim() : null,
    reopenedByAccountId:
      action === "reopen" ? command.actorAccountId : null,
    reopenedAt: action === "reopen" ? now : null,
    reopenReason: action === "reopen" ? command.reason.trim() : null,
    updatedAt: now,
  };
  state.periods[state.periods.indexOf(current)] = period;
  state.periodAudits.push({
    id: randomUUID(),
    journalId: null,
    periodId: period.id,
    sequenceNumber:
      state.periodAudits.filter((audit) => audit.periodId === period.id)
        .length + 1,
    eventType: action === "lock" ? "period.locked" : "period.reopened",
    fromStatus: current.status,
    toStatus: period.status,
    actorAccountId: command.actorAccountId,
    actorRole: "accounting-checker",
    note: command.reason.trim(),
    metadata: { idempotencyKey: command.idempotencyKey },
    occurredAt: now,
  });
  saveReceipt(
    state,
    scope,
    command,
    "period",
    period.id,
    period.version,
  );
  await writeDemoState(state);
  return period;
}

export async function listAccountingJournals(
  options: AccountingJournalListOptions = {},
): Promise<AccountingJournal[]> {
  if (readMode() === "supabase") {
    return listJournalsFromSupabase(options);
  }
  const state = await readDemoState();
  const sites = new Set(normalizeSiteScope(options.siteIds));
  const statuses = options.statuses
    ? new Set(options.statuses)
    : null;
  return state.journals
    .filter((journal) => sites.has(journal.siteId))
    .filter((journal) => !statuses || statuses.has(journal.status))
    .filter(
      (journal) =>
        !options.periodKey ||
        journal.periodKey === validatePeriodKey(options.periodKey),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, normalizedLimit(options.limit, MAX_DATABASE_JOURNALS));
}

export async function getAccountingJournal(
  id: string,
): Promise<AccountingJournal | null> {
  const journalId = validateRecordId(id, "Mã bút toán");
  if (readMode() === "supabase") return getJournalFromSupabase(journalId);
  const state = await readDemoState();
  return state.journals.find((journal) => journal.id === journalId) ?? null;
}

export async function listAccountingPeriods(): Promise<AccountingPeriod[]> {
  if (readMode() === "supabase") {
    const result = await createAdminClient()
      .from("erp_accounting_periods")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .order("period_key", { ascending: false });
    if (result.error) {
      throw repositoryError("đọc danh sách kỳ kế toán", result.error);
    }
    return ((result.data ?? []) as DatabaseRow[]).map(periodFromRow);
  }
  const state = await readDemoState();
  return [...state.periods].sort((left, right) =>
    right.periodKey.localeCompare(left.periodKey),
  );
}

export async function listAccountingAuditEvents(
  options: AccountingAuditListOptions = {},
): Promise<AccountingAuditEvent[]> {
  if (readMode() === "supabase") {
    const client = createAdminClient();
    let query = client
      .from("erp_accounting_audit_events")
      .select("*")
      .eq("tenant_id", TENANT_ID);
    if (options.entityType) {
      query = query.eq("entity_type", options.entityType);
    }
    if (options.entityId) {
      query = query.eq(
        "entity_id",
        validateRecordId(options.entityId, "Mã đối tượng nhật ký"),
      );
    }
    const result = await query
      .order("occurred_at", { ascending: false })
      .limit(normalizedLimit(options.limit, MAX_DATABASE_AUDITS));
    if (result.error) {
      throw repositoryError("đọc nhật ký kế toán", result.error);
    }
    return ((result.data ?? []) as DatabaseRow[]).map(auditFromRow);
  }
  const state = await readDemoState();
  const journalAudits = state.journals.flatMap(
    (journal) => journal.auditTrail,
  );
  return [...journalAudits, ...state.periodAudits]
    .filter(
      (audit) =>
        !options.entityType ||
        (options.entityType === "journal" && Boolean(audit.journalId)) ||
        (options.entityType === "period" && Boolean(audit.periodId)),
    )
    .filter(
      (audit) =>
        !options.entityId ||
        audit.journalId === options.entityId ||
        audit.periodId === options.entityId,
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, normalizedLimit(options.limit, MAX_DATABASE_AUDITS));
}

export async function prepareShiftCloseAccountingJournal(
  workflowId: string,
  expectedSourceVersion: number,
  value: PrepareShiftCloseAccountingCommand,
) {
  const id = validateRecordId(workflowId, "Mã hồ sơ chốt ca");
  const version = validateExpectedVersion(
    expectedSourceVersion,
    "hồ sơ chốt ca",
  );
  const command = {
    ...validateCommandContext(value),
    note: value.note.trim().slice(0, 2_000),
  };
  if (readMode() === "supabase") {
    return prepareInSupabase(id, version, command);
  }
  return prepareInDemo(id, version, command);
}

export async function reviewAccountingJournal(
  journalId: string,
  expectedVersion: number,
  decision: AccountingReviewDecision,
  value: ReviewAccountingJournalCommand,
) {
  const id = validateRecordId(journalId, "Mã bút toán");
  const version = validateExpectedVersion(expectedVersion, "bút toán");
  if (decision !== "approve" && decision !== "return") {
    throw new AccountingRepositoryError(
      "Quyết định kiểm tra bút toán không hợp lệ.",
    );
  }
  const command = {
    ...validateCommandContext(value),
    note: value.note.trim().slice(0, 2_000),
  };
  if (readMode() === "supabase") {
    return reviewInSupabase(id, version, decision, command);
  }
  return reviewInDemo(id, version, decision, command);
}

export async function reverseAccountingJournal(
  journalId: string,
  expectedVersion: number,
  value: ReverseAccountingJournalCommand,
) {
  const id = validateRecordId(journalId, "Mã bút toán");
  const version = validateExpectedVersion(expectedVersion, "bút toán");
  const command = {
    ...validateCommandContext(value),
    reason: value.reason.trim().slice(0, 2_000),
  };
  if (readMode() === "supabase") {
    return reverseInSupabase(id, version, command);
  }
  return reverseInDemo(id, version, command);
}

export async function changeAccountingPeriod(
  periodKey: string,
  expectedVersion: number,
  action: AccountingPeriodAction,
  value: ChangeAccountingPeriodCommand,
) {
  const key = validatePeriodKey(periodKey);
  const version = validateExpectedVersion(expectedVersion, "kỳ kế toán");
  if (action !== "lock" && action !== "reopen") {
    throw new AccountingRepositoryError(
      "Thao tác kỳ kế toán không hợp lệ.",
    );
  }
  const command = {
    ...validateCommandContext(value),
    reason: value.reason.trim().slice(0, 2_000),
  };
  if (readMode() === "supabase") {
    return changePeriodInSupabase(key, version, action, command);
  }
  return changePeriodInDemo(key, version, action, command);
}

export function accountingActorDuty(role: ErpRole) {
  if (role === "accountant") return "accountant-maker" as const;
  if (role === "chief-accountant") return "accounting-checker" as const;
  return null;
}
