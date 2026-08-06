import type { ErpSiteId } from "@/domain/erp";

export type SopApprovalStatus =
  | "demo-unapproved"
  | "approved"
  | "retired";
export type SopCheckResult = "pass" | "fail" | "not-applicable";
export type SopOpeningStatus =
  | "submitted"
  | "go"
  | "no-go"
  | "risk-accepted";

export type SopOpeningItem = {
  id: string;
  siteId: ErpSiteId;
  itemCode: string;
  sopCode: string;
  title: string;
  operationalSummary: string;
  sourceReference: string;
  sourceNotice: string;
  approvalStatus: SopApprovalStatus;
  version: number;
  effectiveFrom: string | null;
  isCritical: boolean;
  sortOrder: number;
};

export type SopOpeningResult = {
  id: string;
  itemId: string;
  result: SopCheckResult;
  note: string;
  evidenceReference: string | null;
};

export type SopOpeningAssessment = {
  id: string;
  siteId: ErpSiteId;
  assessmentCode: string;
  businessDate: string;
  status: SopOpeningStatus;
  version: number;
  submittedByAccountId: string;
  submittedByDisplayName: string;
  submittedAt: string;
  decisionDueAt: string;
  decisionSlaMinutes: number;
  decisionByDisplayName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  riskAcceptance: string | null;
  results: SopOpeningResult[];
};

export type SopAuditEvent = {
  id: string;
  assessmentId: string;
  action:
    | "assessment.submitted"
    | "assessment.resubmitted"
    | "assessment.go"
    | "assessment.no-go"
    | "assessment.risk-accepted";
  fromStatus: SopOpeningStatus | null;
  toStatus: SopOpeningStatus;
  actorDisplayName: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type SopWorkspaceData = {
  siteId: ErpSiteId;
  businessDate: string;
  items: SopOpeningItem[];
  assessment: SopOpeningAssessment | null;
  recentAssessments: SopOpeningAssessment[];
  auditEvents: SopAuditEvent[];
};

export type SopPendingDecision = {
  id: string;
  siteId: ErpSiteId;
  assessmentCode: string;
  businessDate: string;
  version: number;
  submittedByDisplayName: string;
  submittedAt: string;
  decisionDueAt: string;
  criticalFailures: number;
  totalFailures: number;
};

export function vietnamBusinessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function sopFailureCounts(
  items: readonly SopOpeningItem[],
  results: readonly SopOpeningResult[],
) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  let totalFailures = 0;
  let criticalFailures = 0;
  for (const result of results) {
    if (result.result !== "fail") continue;
    totalFailures += 1;
    if (itemById.get(result.itemId)?.isCritical) criticalFailures += 1;
  }
  return { totalFailures, criticalFailures };
}
