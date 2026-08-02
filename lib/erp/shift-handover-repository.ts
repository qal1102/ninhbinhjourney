import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const READ_LIMIT = 12;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

export type ShiftHandoverStatus = "submitted" | "accepted" | "disputed";

export type ShiftHandover = {
  id: string;
  siteId: ErpSiteId;
  businessDate: string;
  shiftLabel: string;
  stationCode: string;
  outgoingAccountId: string;
  outgoingDisplayName: string;
  incomingAccountId: string;
  incomingDisplayName: string;
  cashCountedVnd: number;
  cashExpectedVnd: number;
  cashDifferenceVnd: number;
  openIncidentCodes: string[];
  equipmentNote: string;
  handoverNote: string;
  status: ShiftHandoverStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  version: number;
  createdAt: string;
};

export class ShiftHandoverRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ShiftHandoverRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new ShiftHandoverRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new ShiftHandoverRepositoryError(
      "Kho bàn giao ca chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-shift-handover-server" },
    },
  });
}

function repositoryError(operation: string, error: unknown) {
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) return new ShiftHandoverRepositoryError(businessMessage);
  return new ShiftHandoverRepositoryError(
    `Kho bàn giao ca chưa hoàn tất bước ${operation}.`,
    { cause: error },
  );
}

function fromRow(row: Record<string, unknown>): ShiftHandover | null {
  const siteId = SITE_SLUG_BY_UUID.get(String(row.site_id));
  if (!siteId) return null;
  return {
    id: String(row.id),
    siteId,
    businessDate: String(row.business_date),
    shiftLabel: String(row.shift_label),
    stationCode: String(row.station_code),
    outgoingAccountId: String(row.outgoing_account_id),
    outgoingDisplayName: String(row.outgoing_display_name),
    incomingAccountId: String(row.incoming_account_id),
    incomingDisplayName: String(row.incoming_display_name),
    cashCountedVnd: Number(row.cash_counted_vnd ?? 0),
    cashExpectedVnd: Number(row.cash_expected_vnd ?? 0),
    cashDifferenceVnd: Number(row.cash_difference_vnd ?? 0),
    openIncidentCodes: (row.open_incident_codes ?? []) as string[],
    equipmentNote: String(row.equipment_note ?? ""),
    handoverNote: String(row.handover_note ?? ""),
    status: String(row.status) as ShiftHandoverStatus,
    decisionNote: row.decision_note === null ? null : String(row.decision_note),
    decidedAt: row.decided_at === null ? null : String(row.decided_at),
    version: Number(row.version ?? 1),
    createdAt: String(row.created_at),
  };
}

const SELECT_COLUMNS =
  "id, site_id, business_date, shift_label, station_code, outgoing_account_id, outgoing_display_name, incoming_account_id, incoming_display_name, cash_counted_vnd, cash_expected_vnd, cash_difference_vnd, open_incident_codes, equipment_note, handover_note, status, decision_note, decided_at, version, created_at";

export async function listShiftHandovers(
  siteId: ErpSiteId,
): Promise<ShiftHandover[]> {
  // No demo-cookie fallback on purpose: a handover that only exists in the
  // reader's own browser is not a handover, and pretending otherwise is
  // exactly the kind of demo-only illusion this module is meant to remove.
  if (readMode() !== "supabase") return [];
  const client = createAdminClient();
  const result = await client
    .from("erp_shift_handovers")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .order("business_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(READ_LIMIT);
  if (result.error) throw repositoryError("đọc danh sách bàn giao ca", result.error);
  return (result.data ?? [])
    .map(fromRow)
    .filter((row): row is ShiftHandover => row !== null);
}

export type SubmitShiftHandoverInput = {
  siteId: ErpSiteId;
  businessDate: string;
  shiftLabel: string;
  stationCode: string;
  outgoingAccountId: string;
  outgoingDisplayName: string;
  incomingAccountId: string;
  incomingDisplayName: string;
  cashCountedVnd: number;
  cashExpectedVnd: number;
  openIncidentCodes: string[];
  equipmentNote: string;
  handoverNote: string;
  idempotencyKey: string;
};

export async function submitShiftHandover(
  input: SubmitShiftHandoverInput,
): Promise<ShiftHandover> {
  if (readMode() !== "supabase") {
    throw new ShiftHandoverRepositoryError(
      "Chế độ demo cục bộ không lưu được bàn giao ca. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_shift_handover_submit", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_business_date: input.businessDate,
    p_shift_label: input.shiftLabel,
    p_station_code: input.stationCode,
    p_outgoing_account_id: input.outgoingAccountId,
    p_outgoing_display_name: input.outgoingDisplayName,
    p_incoming_account_id: input.incomingAccountId,
    p_incoming_display_name: input.incomingDisplayName,
    p_cash_counted_vnd: input.cashCountedVnd,
    p_cash_expected_vnd: input.cashExpectedVnd,
    p_open_incident_codes: input.openIncidentCodes,
    p_equipment_note: input.equipmentNote,
    p_handover_note: input.handoverNote,
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) throw repositoryError("gửi bàn giao ca", result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as
    | Record<string, unknown>
    | null;
  const handover = row ? fromRow(row) : null;
  if (!handover) {
    throw new ShiftHandoverRepositoryError("Không đọc lại được phiếu bàn giao vừa gửi.");
  }
  return handover;
}

export async function decideShiftHandover(input: {
  handoverId: string;
  expectedVersion: number;
  actorAccountId: string;
  actorDisplayName: string;
  accept: boolean;
  note: string;
}): Promise<ShiftHandover> {
  if (readMode() !== "supabase") {
    throw new ShiftHandoverRepositoryError(
      "Chế độ demo cục bộ không xác nhận được bàn giao ca. Bật ERP_PERSISTENCE_MODE=supabase.",
    );
  }
  const client = createAdminClient();
  const result = await client.rpc("erp_shift_handover_decide", {
    p_tenant_id: TENANT_ID,
    p_handover_id: input.handoverId,
    p_expected_version: input.expectedVersion,
    p_actor_account_id: input.actorAccountId,
    p_actor_display_name: input.actorDisplayName,
    p_accept: input.accept,
    p_note: input.note,
  });
  if (result.error) throw repositoryError("xác nhận bàn giao ca", result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as
    | Record<string, unknown>
    | null;
  const handover = row ? fromRow(row) : null;
  if (!handover) {
    throw new ShiftHandoverRepositoryError("Không đọc lại được phiếu bàn giao vừa xử lý.");
  }
  return handover;
}
