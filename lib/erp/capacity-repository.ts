import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import {
  calculateHourlyCapacity,
  type CapacityAlertLevel,
  type CapacityAuditEvent,
  type CapacityResponseRule,
  type CapacitySourceKind,
  type CapacityThreshold,
  type CapacityWorkspaceData,
  vietnamHourWindow,
} from "@/domain/erp-capacity";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export class CapacityRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CapacityRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new CapacityRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CapacityRepositoryError(
      "Kho ngưỡng sức chứa chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-capacity-server" },
    },
  });
}

function repositoryError(operation: string, error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("CAPACITY_DIRECTOR_REQUIRED")) {
    return new CapacityRepositoryError(
      "Chỉ giám đốc được thay đổi ngưỡng sức chứa.",
    );
  }
  if (message.includes("CAPACITY_VERSION_CONFLICT")) {
    return new CapacityRepositoryError(
      "Ngưỡng vừa được người khác cập nhật. Tải lại trang trước khi sửa tiếp.",
    );
  }
  if (message.includes("CAPACITY_THRESHOLD_NOT_FOUND")) {
    return new CapacityRepositoryError("Không tìm thấy ngưỡng cần cập nhật.");
  }
  if (message.includes("CAPACITY_INPUT_INVALID")) {
    return new CapacityRepositoryError("Giả định sức chứa chưa đúng định dạng.");
  }
  return new CapacityRepositoryError(
    `Kho ngưỡng sức chứa chưa hoàn tất bước ${operation}.`,
    { cause: error instanceof Error ? error : undefined },
  );
}

function responseRuleFromRow(
  row: Record<string, unknown>,
): CapacityResponseRule {
  return {
    level: String(row.level) as CapacityAlertLevel,
    actionText: String(row.action_text),
    ownerRole: String(row.owner_role) as CapacityResponseRule["ownerRole"],
    slaMinutes:
      row.sla_minutes === null || row.sla_minutes === undefined
        ? null
        : Number(row.sla_minutes),
  };
}

function thresholdFromRow(
  row: Record<string, unknown>,
  rules: CapacityResponseRule[],
): CapacityThreshold | null {
  const siteId = SITE_SLUG_BY_UUID.get(String(row.site_id));
  if (!siteId) return null;
  const vehicleCount = Number(row.vehicle_count);
  const seatsPerVehicle = Number(row.seats_per_vehicle);
  const roundTripMinutes = Number(row.round_trip_minutes);
  const calculated = calculateHourlyCapacity({
    vehicleCount,
    seatsPerVehicle,
    roundTripMinutes,
  });
  const stored = Number(row.hourly_capacity);
  if (!Number.isFinite(stored) || stored !== calculated) {
    throw new CapacityRepositoryError(
      `Phép tính sức chứa của ${String(row.threshold_code)} không khớp dữ liệu nguồn.`,
    );
  }
  return {
    id: String(row.id),
    siteId,
    thresholdCode: String(row.threshold_code),
    bottleneckName: String(row.bottleneck_name),
    bottleneckKind: String(
      row.bottleneck_kind,
    ) as CapacityThreshold["bottleneckKind"],
    vehicleCount,
    seatsPerVehicle,
    roundTripMinutes,
    hourlyCapacity: stored,
    watchPercent: Number(row.watch_percent),
    restrictPercent: Number(row.restrict_percent),
    stopPercent: Number(row.stop_percent),
    sourceKind: String(row.source_kind) as CapacitySourceKind,
    sourceNote: String(row.source_note),
    effectiveFrom: String(row.effective_from),
    version: Number(row.version),
    updatedByDisplayName: String(row.updated_by_display_name),
    updatedAt: String(row.updated_at),
    responseRules: rules,
  };
}

function auditFromRow(row: Record<string, unknown>): CapacityAuditEvent {
  return {
    id: String(row.id),
    thresholdId: String(row.threshold_id),
    action: String(row.action) as CapacityAuditEvent["action"],
    actorDisplayName: String(row.actor_display_name),
    createdAt: String(row.created_at),
    detail:
      typeof row.detail === "object" && row.detail !== null
        ? (row.detail as Record<string, unknown>)
        : {},
  };
}

const THRESHOLD_COLUMNS =
  "id, site_id, threshold_code, bottleneck_name, bottleneck_kind, vehicle_count, seats_per_vehicle, round_trip_minutes, hourly_capacity, watch_percent, restrict_percent, stop_percent, source_kind, source_note, effective_from, version, updated_by_display_name, updated_at";

export async function listCapacityWorkspace(
  siteId: ErpSiteId,
): Promise<CapacityWorkspaceData | null> {
  // A browser-local threshold would be a second source of truth. Local demo
  // mode therefore says the production store is unavailable instead of
  // inventing a parallel configuration.
  if (readMode() !== "supabase") return null;

  const client = createAdminClient();
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId];
  const window = vietnamHourWindow();
  const [thresholdResult, countResult, lastScanResult, auditResult] =
    await Promise.all([
      client
        .from("erp_capacity_thresholds")
        .select(THRESHOLD_COLUMNS)
        .eq("tenant_id", TENANT_ID)
        .eq("site_id", siteUuid)
        .order("threshold_code", { ascending: true }),
      client
        .from("erp_gate_scan_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", TENANT_ID)
        .eq("site_id", siteUuid)
        .eq("result", "accepted")
        .gte("scanned_at", window.start)
        .lt("scanned_at", window.end),
      client
        .from("erp_gate_scan_events")
        .select("scanned_at")
        .eq("tenant_id", TENANT_ID)
        .eq("site_id", siteUuid)
        .eq("result", "accepted")
        .order("scanned_at", { ascending: false })
        .limit(1),
      client
        .from("erp_capacity_audit_events")
        .select(
          "id, threshold_id, action, actor_display_name, detail, created_at",
        )
        .eq("tenant_id", TENANT_ID)
        .eq("site_id", siteUuid)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  for (const [operation, result] of [
    ["đọc cấu hình", thresholdResult],
    ["đếm lượt cổng", countResult],
    ["đọc thời điểm quét gần nhất", lastScanResult],
    ["đọc lịch sử cấu hình", auditResult],
  ] as const) {
    if (result.error) throw repositoryError(operation, result.error);
  }

  const thresholdRows = (thresholdResult.data ?? []) as Record<
    string,
    unknown
  >[];
  const thresholdIds = thresholdRows.map((row) => String(row.id));
  const ruleResult = thresholdIds.length
    ? await client
        .from("erp_capacity_response_rules")
        .select("threshold_id, level, action_text, owner_role, sla_minutes")
        .eq("tenant_id", TENANT_ID)
        .in("threshold_id", thresholdIds)
    : { data: [], error: null };
  if (ruleResult.error) {
    throw repositoryError("đọc quy tắc phản ứng", ruleResult.error);
  }

  const rulesByThreshold = new Map<string, CapacityResponseRule[]>();
  for (const row of (ruleResult.data ?? []) as Record<string, unknown>[]) {
    const thresholdId = String(row.threshold_id);
    const current = rulesByThreshold.get(thresholdId) ?? [];
    current.push(responseRuleFromRow(row));
    rulesByThreshold.set(thresholdId, current);
  }
  const levelOrder: Record<CapacityAlertLevel, number> = {
    green: 0,
    yellow: 1,
    orange: 2,
    red: 3,
  };
  const thresholds = thresholdRows
    .map((row) => {
      const rules = rulesByThreshold.get(String(row.id)) ?? [];
      rules.sort((left, right) => levelOrder[left.level] - levelOrder[right.level]);
      return thresholdFromRow(row, rules);
    })
    .filter((row): row is CapacityThreshold => row !== null);

  const lastScanRows = (lastScanResult.data ?? []) as Record<string, unknown>[];
  return {
    siteId,
    windowStartedAt: window.start,
    windowEndsAt: window.end,
    acceptedEntriesThisHour: countResult.count ?? 0,
    lastAcceptedScanAt:
      lastScanRows.length > 0 ? String(lastScanRows[0].scanned_at) : null,
    thresholds,
    auditEvents: ((auditResult.data ?? []) as Record<string, unknown>[]).map(
      auditFromRow,
    ),
  };
}

export async function updateCapacityThreshold(input: {
  thresholdId: string;
  actorAccountId: string;
  actorDisplayName: string;
  expectedVersion: number;
  vehicleCount: number;
  seatsPerVehicle: number;
  roundTripMinutes: number;
  sourceKind: CapacitySourceKind;
  sourceNote: string;
}): Promise<void> {
  if (readMode() !== "supabase") {
    throw new CapacityRepositoryError(
      "Chế độ demo cục bộ không lưu ngưỡng sức chứa. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_capacity_update_threshold", {
    p_tenant_id: TENANT_ID,
    p_threshold_id: input.thresholdId,
    p_actor_account_id: input.actorAccountId,
    p_actor_display_name: input.actorDisplayName,
    p_expected_version: input.expectedVersion,
    p_vehicle_count: input.vehicleCount,
    p_seats_per_vehicle: input.seatsPerVehicle,
    p_round_trip_minutes: input.roundTripMinutes,
    p_source_kind: input.sourceKind,
    p_source_note: input.sourceNote,
  });
  if (result.error) {
    throw repositoryError("cập nhật giả định", result.error);
  }
}
