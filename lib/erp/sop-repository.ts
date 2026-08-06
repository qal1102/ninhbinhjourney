import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import {
  sopFailureCounts,
  type SopApprovalStatus,
  type SopAuditEvent,
  type SopCheckResult,
  type SopOpeningAssessment,
  type SopOpeningItem,
  type SopOpeningResult,
  type SopOpeningStatus,
  type SopPendingDecision,
  type SopWorkspaceData,
  vietnamBusinessDate,
} from "@/domain/erp-sop";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export class SopRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SopRepositoryError";
  }
}

function readMode() {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie" as const;
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new SopRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new SopRepositoryError(
      "Kho SOP và Go/No-Go chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-sop-server" },
    },
  });
}

function repositoryError(operation: string, error: unknown) {
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) return new SopRepositoryError(businessMessage);
  return new SopRepositoryError(
    `Kho SOP chưa hoàn tất bước ${operation}.`,
    { cause: error instanceof Error ? error : undefined },
  );
}

function hashRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function itemFromRow(row: Record<string, unknown>): SopOpeningItem | null {
  const siteId = SITE_SLUG_BY_UUID.get(String(row.site_id));
  if (!siteId) return null;
  return {
    id: String(row.id),
    siteId,
    itemCode: String(row.item_code),
    sopCode: String(row.sop_code),
    title: String(row.title),
    operationalSummary: String(row.operational_summary),
    sourceReference: String(row.source_reference),
    sourceNotice: String(row.source_notice),
    approvalStatus: String(row.approval_status) as SopApprovalStatus,
    version: Number(row.version),
    effectiveFrom:
      row.effective_from === null || row.effective_from === undefined
        ? null
        : String(row.effective_from),
    isCritical: Boolean(row.is_critical),
    sortOrder: Number(row.sort_order),
  };
}

function resultFromRow(row: Record<string, unknown>): SopOpeningResult {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    result: String(row.result) as SopCheckResult,
    note: String(row.note ?? ""),
    evidenceReference:
      row.evidence_reference === null || row.evidence_reference === undefined
        ? null
        : String(row.evidence_reference),
  };
}

function assessmentFromRow(
  row: Record<string, unknown>,
  results: SopOpeningResult[] = [],
): SopOpeningAssessment | null {
  const siteId = SITE_SLUG_BY_UUID.get(String(row.site_id));
  if (!siteId) return null;
  return {
    id: String(row.id),
    siteId,
    assessmentCode: String(row.assessment_code),
    businessDate: String(row.business_date),
    status: String(row.status) as SopOpeningStatus,
    version: Number(row.version),
    submittedByAccountId: String(row.submitted_by_account_id),
    submittedByDisplayName: String(row.submitted_by_display_name),
    submittedAt: String(row.submitted_at),
    decisionDueAt: String(row.decision_due_at),
    decisionSlaMinutes: Number(row.decision_sla_minutes),
    decisionByDisplayName:
      row.decision_by_display_name === null ||
      row.decision_by_display_name === undefined
        ? null
        : String(row.decision_by_display_name),
    decidedAt:
      row.decided_at === null || row.decided_at === undefined
        ? null
        : String(row.decided_at),
    decisionNote:
      row.decision_note === null || row.decision_note === undefined
        ? null
        : String(row.decision_note),
    riskAcceptance:
      row.risk_acceptance === null || row.risk_acceptance === undefined
        ? null
        : String(row.risk_acceptance),
    results,
  };
}

function auditFromRow(row: Record<string, unknown>): SopAuditEvent {
  return {
    id: String(row.id),
    assessmentId: String(row.assessment_id),
    action: String(row.action) as SopAuditEvent["action"],
    fromStatus:
      row.from_status === null || row.from_status === undefined
        ? null
        : (String(row.from_status) as SopOpeningStatus),
    toStatus: String(row.to_status) as SopOpeningStatus,
    actorDisplayName: String(row.actor_display_name),
    detail:
      typeof row.detail === "object" && row.detail !== null
        ? (row.detail as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  };
}

const ITEM_COLUMNS =
  "id, site_id, item_code, sop_code, title, operational_summary, source_reference, source_notice, approval_status, version, effective_from, is_critical, sort_order";
const ASSESSMENT_COLUMNS =
  "id, site_id, assessment_code, business_date, status, version, submitted_by_account_id, submitted_by_display_name, submitted_at, decision_due_at, decision_sla_minutes, decision_by_display_name, decided_at, decision_note, risk_acceptance";
const RESULT_COLUMNS =
  "id, assessment_id, item_id, result, note, evidence_reference";

export async function listSopWorkspace(
  siteId: ErpSiteId,
): Promise<SopWorkspaceData | null> {
  if (readMode() !== "supabase") return null;
  const client = createAdminClient();
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId];
  const businessDate = vietnamBusinessDate();
  const [itemResult, currentResult, recentResult] = await Promise.all([
    client
      .from("erp_sop_opening_items")
      .select(ITEM_COLUMNS)
      .eq("tenant_id", TENANT_ID)
      .eq("site_id", siteUuid)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    client
      .from("erp_sop_opening_assessments")
      .select(ASSESSMENT_COLUMNS)
      .eq("tenant_id", TENANT_ID)
      .eq("site_id", siteUuid)
      .eq("business_date", businessDate)
      .maybeSingle(),
    client
      .from("erp_sop_opening_assessments")
      .select(ASSESSMENT_COLUMNS)
      .eq("tenant_id", TENANT_ID)
      .eq("site_id", siteUuid)
      .order("business_date", { ascending: false })
      .limit(8),
  ]);
  for (const [operation, result] of [
    ["đọc checklist", itemResult],
    ["đọc cổng mở cửa hôm nay", currentResult],
    ["đọc lịch sử cổng mở cửa", recentResult],
  ] as const) {
    if (result.error) throw repositoryError(operation, result.error);
  }

  const currentRow = currentResult.data as Record<string, unknown> | null;
  const assessmentId = currentRow ? String(currentRow.id) : null;
  const [resultRows, auditRows] = assessmentId
    ? await Promise.all([
        client
          .from("erp_sop_opening_results")
          .select(RESULT_COLUMNS)
          .eq("tenant_id", TENANT_ID)
          .eq("assessment_id", assessmentId),
        client
          .from("erp_sop_audit_events")
          .select(
            "id, assessment_id, action, from_status, to_status, actor_display_name, detail, created_at",
          )
          .eq("tenant_id", TENANT_ID)
          .eq("assessment_id", assessmentId)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (resultRows.error) throw repositoryError("đọc kết quả checklist", resultRows.error);
  if (auditRows.error) throw repositoryError("đọc lịch sử quyết định", auditRows.error);

  const currentResults = ((resultRows.data ?? []) as Record<string, unknown>[])
    .map(resultFromRow);
  const items = ((itemResult.data ?? []) as Record<string, unknown>[])
    .map(itemFromRow)
    .filter((item): item is SopOpeningItem => item !== null);
  const assessment = currentRow
    ? assessmentFromRow(currentRow, currentResults)
    : null;
  return {
    siteId,
    businessDate,
    items,
    assessment,
    recentAssessments: ((recentResult.data ?? []) as Record<string, unknown>[])
      .map((row) => assessmentFromRow(row))
      .filter((row): row is SopOpeningAssessment => row !== null),
    auditEvents: ((auditRows.data ?? []) as Record<string, unknown>[]).map(
      auditFromRow,
    ),
  };
}

export async function listPendingSopDecisions(
  siteIds: readonly ErpSiteId[],
): Promise<SopPendingDecision[]> {
  if (readMode() !== "supabase" || siteIds.length === 0) return [];
  const client = createAdminClient();
  const siteUuids = siteIds.map(
    (siteId) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  );
  const assessmentResult = await client
    .from("erp_sop_opening_assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("tenant_id", TENANT_ID)
    .in("site_id", siteUuids)
    .eq("status", "submitted")
    .order("decision_due_at", { ascending: true });
  if (assessmentResult.error) {
    throw repositoryError("đọc hàng quyết định Go/No-Go", assessmentResult.error);
  }
  const rows = (assessmentResult.data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => String(row.id));
  const [resultQuery, itemQuery] = await Promise.all([
    client
      .from("erp_sop_opening_results")
      .select(RESULT_COLUMNS)
      .eq("tenant_id", TENANT_ID)
      .in("assessment_id", ids),
    client
      .from("erp_sop_opening_items")
      .select(ITEM_COLUMNS)
      .eq("tenant_id", TENANT_ID)
      .in("site_id", siteUuids),
  ]);
  if (resultQuery.error) throw repositoryError("đọc điểm chưa đạt", resultQuery.error);
  if (itemQuery.error) throw repositoryError("đọc mức quan trọng SOP", itemQuery.error);

  const items = ((itemQuery.data ?? []) as Record<string, unknown>[])
    .map(itemFromRow)
    .filter((item): item is SopOpeningItem => item !== null);
  const resultsByAssessment = new Map<string, SopOpeningResult[]>();
  for (const row of (resultQuery.data ?? []) as Record<string, unknown>[]) {
    const assessmentId = String(row.assessment_id);
    const list = resultsByAssessment.get(assessmentId) ?? [];
    list.push(resultFromRow(row));
    resultsByAssessment.set(assessmentId, list);
  }
  return rows.flatMap((row) => {
    const assessment = assessmentFromRow(row);
    if (!assessment) return [];
    const counts = sopFailureCounts(
      items.filter((item) => item.siteId === assessment.siteId),
      resultsByAssessment.get(assessment.id) ?? [],
    );
    return [{
      id: assessment.id,
      siteId: assessment.siteId,
      assessmentCode: assessment.assessmentCode,
      businessDate: assessment.businessDate,
      version: assessment.version,
      submittedByDisplayName: assessment.submittedByDisplayName,
      submittedAt: assessment.submittedAt,
      decisionDueAt: assessment.decisionDueAt,
      ...counts,
    }];
  });
}

export async function submitSopOpeningAssessment(input: {
  siteId: ErpSiteId;
  businessDate: string;
  actorAccountId: string;
  actorDisplayName: string;
  expectedVersion: number;
  results: Array<{
    itemId: string;
    result: SopCheckResult;
    note: string;
    evidenceReference: string;
  }>;
  idempotencyKey: string;
}): Promise<void> {
  if (readMode() !== "supabase") {
    throw new SopRepositoryError(
      "Chế độ demo cục bộ không ghi cổng Go/No-Go. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const request = {
    siteId: input.siteId,
    businessDate: input.businessDate,
    expectedVersion: input.expectedVersion,
    results: input.results,
  };
  const result = await createAdminClient().rpc(
    "erp_sop_submit_opening_assessment",
    {
      p_tenant_id: TENANT_ID,
      p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
      p_business_date: input.businessDate,
      p_actor_account_id: input.actorAccountId,
      p_actor_display_name: input.actorDisplayName,
      p_expected_version: input.expectedVersion,
      p_results: input.results.map((entry) => ({
        item_id: entry.itemId,
        result: entry.result,
        note: entry.note,
        evidence_reference: entry.evidenceReference || null,
      })),
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: hashRequest(request),
    },
  );
  if (result.error) throw repositoryError("gửi đánh giá mở cửa", result.error);
}

export async function decideSopOpeningAssessment(input: {
  assessmentId: string;
  actorAccountId: string;
  actorDisplayName: string;
  expectedVersion: number;
  decision: "go" | "no-go" | "risk-accepted";
  decisionNote: string;
  riskAcceptance: string;
  idempotencyKey: string;
}): Promise<void> {
  if (readMode() !== "supabase") {
    throw new SopRepositoryError(
      "Chế độ demo cục bộ không ghi quyết định Go/No-Go. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const request = {
    assessmentId: input.assessmentId,
    expectedVersion: input.expectedVersion,
    decision: input.decision,
    decisionNote: input.decisionNote,
    riskAcceptance: input.riskAcceptance,
  };
  const result = await createAdminClient().rpc(
    "erp_sop_decide_opening_assessment",
    {
      p_tenant_id: TENANT_ID,
      p_assessment_id: input.assessmentId,
      p_actor_account_id: input.actorAccountId,
      p_actor_display_name: input.actorDisplayName,
      p_expected_version: input.expectedVersion,
      p_decision: input.decision,
      p_decision_note: input.decisionNote,
      p_risk_acceptance: input.riskAcceptance || null,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: hashRequest(request),
    },
  );
  if (result.error) throw repositoryError("ghi quyết định mở cửa", result.error);
}
