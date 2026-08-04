import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import type {
  BankStatementLine,
  CashDeposit,
  CashDepositEligibleShift,
  CashDepositStatus,
} from "@/domain/erp-cash-deposit";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export class CashDepositRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CashDepositRepositoryError";
  }
}

export class CashDepositRepositoryConfigurationError extends CashDepositRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "CashDepositRepositoryConfigurationError";
  }
}

export class CashDepositRepositoryConflictError extends CashDepositRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "CashDepositRepositoryConflictError";
  }
}

function isSupabaseMode() {
  return process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CashDepositRepositoryConfigurationError(
      "Đối soát tiền mặt chưa được cấu hình đủ biến môi trường ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "ninhbinhjourney-erp-cash" } },
  });
}

function repositoryError(operation: string, error: unknown) {
  const source =
    error && typeof error === "object"
      ? (error as { code?: string; message?: string })
      : {};
  const message = source.message ?? "";
  if (source.code === "40001" || message.includes("VERSION_CONFLICT")) {
    return new CashDepositRepositoryConflictError(
      "Hồ sơ vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
    );
  }
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) return new CashDepositRepositoryError(businessMessage);
  return new CashDepositRepositoryError(
    `Đối soát tiền mặt chưa hoàn tất bước ${operation}.`,
    { cause: error },
  );
}

function requireSupabaseMode() {
  if (!isSupabaseMode()) {
    throw new CashDepositRepositoryConfigurationError(
      "Đối soát tiền mặt chỉ chạy ở chế độ dữ liệu Supabase, chưa hỗ trợ chế độ demo-cookie.",
    );
  }
}

function newIdempotencyKey(scope: string) {
  return `cash:${scope}:${randomUUID()}`;
}

function mapDeposit(row: Record<string, unknown>, shiftCloseIds: string[]): CashDeposit {
  const status = row.status as CashDepositStatus;
  return {
    id: String(row.id),
    siteId: SITE_SLUG_BY_UUID.get(String(row.site_id)) ?? "trang-an",
    depositCode: String(row.deposit_code),
    status,
    amountVnd: Number(row.amount_vnd),
    bankAccountRef: String(row.bank_account_ref),
    note: String(row.note ?? ""),
    submittedByAccountId: String(row.submitted_by_account_id),
    submittedAt: String(row.submitted_at),
    shiftCloseIds,
    statementLineId: row.statement_line_id ? String(row.statement_line_id) : null,
    differenceVnd: Number(row.difference_vnd ?? 0),
    matchedByAccountId: row.matched_by_account_id
      ? String(row.matched_by_account_id)
      : null,
    matchedAt: row.matched_at ? String(row.matched_at) : null,
    exceptionOwnerAccountId: row.exception_owner_account_id
      ? String(row.exception_owner_account_id)
      : null,
    exceptionDueAt: row.exception_due_at ? String(row.exception_due_at) : null,
    exceptionNote: row.exception_note ? String(row.exception_note) : null,
    exceptionDecidedByAccountId: row.exception_decided_by_account_id
      ? String(row.exception_decided_by_account_id)
      : null,
    exceptionDecidedAt: row.exception_decided_at
      ? String(row.exception_decided_at)
      : null,
    exceptionDecision:
      (row.exception_decision as CashDeposit["exceptionDecision"]) ?? null,
    journalId: row.journal_id ? String(row.journal_id) : null,
    reconciledByAccountId: row.reconciled_by_account_id
      ? String(row.reconciled_by_account_id)
      : null,
    reconciledAt: row.reconciled_at ? String(row.reconciled_at) : null,
    version: Number(row.version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapStatementLine(row: Record<string, unknown>): BankStatementLine {
  return {
    id: String(row.id),
    siteId: SITE_SLUG_BY_UUID.get(String(row.site_id)) ?? "trang-an",
    source: row.source === "bank-api" ? "bank-api" : "manual",
    bankAccountRef: String(row.bank_account_ref),
    statementDate: String(row.statement_date),
    amountVnd: Number(row.amount_vnd),
    description: String(row.description ?? ""),
    externalRef: String(row.external_ref ?? ""),
    status: row.status === "matched" ? "matched" : "unmatched",
    matchedDepositId: row.matched_deposit_id ? String(row.matched_deposit_id) : null,
    enteredByAccountId: String(row.entered_by_account_id),
    enteredAt: String(row.entered_at),
    version: Number(row.version),
  };
}

export type CashDepositListOptions = {
  siteIds?: readonly ErpSiteId[];
};

/** Ca đã chốt (`posted`) tại các cơ sở đã cho, chưa từng được gộp vào lượt nộp nào. */
export async function listEligibleShiftsForDeposit(
  siteId: ErpSiteId,
): Promise<CashDepositEligibleShift[]> {
  if (!isSupabaseMode()) return [];
  const client = createAdminClient();
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId];
  const { data: deposited, error: depositedError } = await client
    .from("erp_cash_deposit_shifts")
    .select("shift_close_id");
  if (depositedError) {
    throw repositoryError("đọc ca đã nộp quỹ", depositedError);
  }
  const excludeIds = (deposited ?? []).map((row) => row.shift_close_id as string);

  let query = client
    .from("erp_shift_close_workflows")
    .select("id, business_code, shift_date, station_code, cash_vnd")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", siteUuid)
    .eq("status", "posted")
    .gt("cash_vnd", 0)
    .order("shift_date", { ascending: false })
    .limit(100);
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) throw repositoryError("đọc ca đã chốt", error);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    shiftCode: String(row.business_code),
    businessDate: String(row.shift_date),
    station: String(row.station_code ?? ""),
    cashVnd: Number(row.cash_vnd),
  }));
}

export async function listCashDeposits(
  options: CashDepositListOptions = {},
): Promise<CashDeposit[]> {
  if (!isSupabaseMode()) return [];
  const client = createAdminClient();
  let query = client
    .from("erp_cash_deposits")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (options.siteIds && options.siteIds.length > 0) {
    const uuids = options.siteIds.map((id) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[id]);
    query = query.in("site_id", uuids);
  }
  const { data, error } = await query;
  if (error) throw repositoryError("đọc danh sách lượt nộp quỹ", error);
  const deposits = data ?? [];
  if (deposits.length === 0) return [];

  const { data: shiftRows, error: shiftError } = await client
    .from("erp_cash_deposit_shifts")
    .select("deposit_id, shift_close_id")
    .in(
      "deposit_id",
      deposits.map((row) => row.id as string),
    );
  if (shiftError) throw repositoryError("đọc ca thuộc lượt nộp quỹ", shiftError);
  const shiftsByDeposit = new Map<string, string[]>();
  for (const row of shiftRows ?? []) {
    const key = String(row.deposit_id);
    const list = shiftsByDeposit.get(key) ?? [];
    list.push(String(row.shift_close_id));
    shiftsByDeposit.set(key, list);
  }

  return deposits.map((row) =>
    mapDeposit(row, shiftsByDeposit.get(String(row.id)) ?? []),
  );
}

export async function listUnmatchedStatementLines(
  options: CashDepositListOptions = {},
): Promise<BankStatementLine[]> {
  if (!isSupabaseMode()) return [];
  const client = createAdminClient();
  let query = client
    .from("erp_bank_statement_lines")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("status", "unmatched")
    .order("statement_date", { ascending: false })
    .limit(200);
  if (options.siteIds && options.siteIds.length > 0) {
    const uuids = options.siteIds.map((id) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[id]);
    query = query.in("site_id", uuids);
  }
  const { data, error } = await query;
  if (error) throw repositoryError("đọc dòng sao kê chưa khớp", error);
  return (data ?? []).map(mapStatementLine);
}

export type SubmitCashDepositInput = {
  siteId: ErpSiteId;
  shiftCloseIds: readonly string[];
  bankAccountRef: string;
  note: string;
  actorAccountId: string;
};

export async function submitCashDeposit(
  input: SubmitCashDepositInput,
): Promise<CashDeposit> {
  requireSupabaseMode();
  const client = createAdminClient();
  const result = await client.rpc("erp_cash_submit_deposit", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_shift_close_ids: input.shiftCloseIds,
    p_bank_account_ref: input.bankAccountRef,
    p_note: input.note,
    p_actor_account_id: input.actorAccountId,
    p_idempotency_key: newIdempotencyKey("submit-deposit"),
  });
  if (result.error) throw repositoryError("gộp ca thành lượt nộp quỹ", result.error);
  return mapDeposit(result.data as Record<string, unknown>, [...input.shiftCloseIds]);
}

export type RecordStatementLineInput = {
  siteId: ErpSiteId;
  bankAccountRef: string;
  statementDate: string;
  amountVnd: number;
  description: string;
  externalRef: string;
  actorAccountId: string;
};

export async function recordBankStatementLine(
  input: RecordStatementLineInput,
): Promise<BankStatementLine> {
  requireSupabaseMode();
  const client = createAdminClient();
  const result = await client.rpc("erp_cash_record_statement_line", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_bank_account_ref: input.bankAccountRef,
    p_statement_date: input.statementDate,
    p_amount_vnd: input.amountVnd,
    p_description: input.description,
    p_external_ref: input.externalRef,
    p_actor_account_id: input.actorAccountId,
    p_idempotency_key: newIdempotencyKey("record-statement-line"),
  });
  if (result.error) throw repositoryError("nhập dòng sao kê ngân hàng", result.error);
  return mapStatementLine(result.data as Record<string, unknown>);
}

export type MatchCashDepositInput = {
  depositId: string;
  expectedDepositVersion: number;
  statementLineId: string;
  expectedLineVersion: number;
  note: string;
  actorAccountId: string;
};

export async function matchCashDeposit(
  input: MatchCashDepositInput,
): Promise<CashDeposit> {
  requireSupabaseMode();
  const client = createAdminClient();
  const result = await client.rpc("erp_cash_match_deposit", {
    p_tenant_id: TENANT_ID,
    p_deposit_id: input.depositId,
    p_expected_deposit_version: input.expectedDepositVersion,
    p_statement_line_id: input.statementLineId,
    p_expected_line_version: input.expectedLineVersion,
    p_actor_account_id: input.actorAccountId,
    p_note: input.note,
    p_idempotency_key: newIdempotencyKey("match-deposit"),
  });
  if (result.error) throw repositoryError("đối khớp lượt nộp quỹ", result.error);
  const row = result.data as Record<string, unknown>;
  const shiftCloseIds = await shiftCloseIdsForDeposit(client, String(row.id));
  return mapDeposit(row, shiftCloseIds);
}

export type DecideCashExceptionInput = {
  depositId: string;
  expectedVersion: number;
  approve: boolean;
  note: string;
  actorAccountId: string;
};

export async function decideCashException(
  input: DecideCashExceptionInput,
): Promise<CashDeposit> {
  requireSupabaseMode();
  const client = createAdminClient();
  const result = await client.rpc("erp_cash_decide_exception", {
    p_tenant_id: TENANT_ID,
    p_deposit_id: input.depositId,
    p_expected_version: input.expectedVersion,
    p_actor_account_id: input.actorAccountId,
    p_approve: input.approve,
    p_note: input.note,
    p_idempotency_key: newIdempotencyKey("decide-exception"),
  });
  if (result.error) throw repositoryError("quyết định ngoại lệ chênh lệch", result.error);
  const row = result.data as Record<string, unknown>;
  const shiftCloseIds = await shiftCloseIdsForDeposit(client, String(row.id));
  return mapDeposit(row, shiftCloseIds);
}

export type ReviewCashDepositJournalInput = {
  depositId: string;
  expectedDepositVersion: number;
  expectedJournalVersion: number;
  decision: "approve" | "return";
  note: string;
  actorAccountId: string;
};

export async function reviewCashDepositJournal(
  input: ReviewCashDepositJournalInput,
): Promise<CashDeposit> {
  requireSupabaseMode();
  const client = createAdminClient();
  const result = await client.rpc("erp_accounting_review_cash_deposit_journal", {
    p_tenant_id: TENANT_ID,
    p_deposit_id: input.depositId,
    p_expected_deposit_version: input.expectedDepositVersion,
    p_expected_journal_version: input.expectedJournalVersion,
    p_actor_account_id: input.actorAccountId,
    p_decision: input.decision,
    p_note: input.note,
    p_idempotency_key: newIdempotencyKey("review-journal"),
  });
  if (result.error) throw repositoryError("ghi sổ lượt nộp quỹ", result.error);
  const row = result.data as Record<string, unknown>;
  const shiftCloseIds = await shiftCloseIdsForDeposit(client, String(row.id));
  return mapDeposit(row, shiftCloseIds);
}

async function shiftCloseIdsForDeposit(client: SupabaseClient, depositId: string) {
  const { data, error } = await client
    .from("erp_cash_deposit_shifts")
    .select("shift_close_id")
    .eq("deposit_id", depositId);
  if (error) throw repositoryError("đọc ca thuộc lượt nộp quỹ", error);
  return (data ?? []).map((row) => String(row.shift_close_id));
}
