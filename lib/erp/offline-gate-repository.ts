import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { OfflineGateManifestSchema, type OfflineGateSyncResult, type OfflineGateQueueItem } from "@/domain/offline-gate";
import type { ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class OfflineGateRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OfflineGateRepositoryError";
  }
}

export function isOfflineGateEnabled() {
  return process.env.ERP_OFFLINE_GATE_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new OfflineGateRepositoryError("Kho đồng bộ cổng ngoại tuyến chưa được cấu hình đủ.");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-offline-gate-server" } },
  });
}

function repositoryError(error: unknown) {
  const raw = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const safe = raw.includes("GATE_OFFLINE_ACTOR_REQUIRED")
    ? "Tài khoản chưa được phân công soát vé tại cơ sở này."
    : raw.includes("GATE_OFFLINE_MANIFEST_INVALID")
      ? "Bộ vé ngoại tuyến không còn hợp lệ cho thiết bị hoặc ca này."
      : raw.includes("GATE_OFFLINE_ITEM_INVALID") || raw.includes("GATE_OFFLINE_BATCH_INVALID")
        ? "Hàng đợi ngoại tuyến sai định dạng hoặc nằm ngoài thời gian ca."
        : "Kho đồng bộ cổng ngoại tuyến chưa hoàn tất yêu cầu.";
  return new OfflineGateRepositoryError(safe, { cause: error instanceof Error ? error : undefined });
}

export async function prepareOfflineGateManifest(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  deviceId: string;
}) {
  const { data, error } = await createAdminClient().rpc("erp_prepare_offline_gate_manifest", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_device_id: input.deviceId,
  });
  if (error || !data) throw repositoryError(error);
  const row = data as Record<string, unknown>;
  return OfflineGateManifestSchema.parse({
    manifestId: row.manifest_id,
    siteId: row.site_id,
    deviceId: row.device_id,
    serviceDate: row.service_date,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    ticketCount: row.ticket_count,
    snapshotDigest: row.snapshot_digest,
    tickets: Array.isArray(row.tickets) ? row.tickets.map((ticket) => {
      const item = ticket as Record<string, unknown>;
      return { codeDigest: item.code_digest, entriesRemaining: item.entries_remaining };
    }) : [],
  });
}

export async function syncOfflineGateBatch(input: {
  manifestId: string;
  batchId: string;
  deviceId: string;
  actorAccountId: string;
  actorName: string;
  scans: readonly OfflineGateQueueItem[];
}): Promise<OfflineGateSyncResult> {
  const { data, error } = await createAdminClient().rpc("erp_sync_offline_gate_batch", {
    p_tenant_id: TENANT_ID,
    p_manifest_id: input.manifestId,
    p_batch_id: input.batchId,
    p_device_id: input.deviceId,
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_scans: input.scans.map((scan) => ({
      idempotency_key: scan.idempotencyKey,
      code: scan.code,
      scanned_at: scan.scannedAt,
      local_result: scan.localResult,
    })),
  });
  if (error || !data) throw repositoryError(error);
  const row = data as Record<string, unknown>;
  return {
    batchId: String(row.batch_id), itemCount: Number(row.item_count),
    acceptedCount: Number(row.accepted_count), refusedCount: Number(row.refused_count),
    replayedCount: Number(row.replayed_count), divergedCount: Number(row.diverged_count),
    replayedBatch: Boolean(row.replayed_batch),
    items: Array.isArray(row.items) ? row.items.map((item) => {
      const value = item as Record<string, unknown>;
      return {
        idempotencyKey: String(value.idempotency_key),
        localResult: String(value.local_result) as OfflineGateSyncResult["items"][number]["localResult"],
        serverResult: String(value.server_result),
        reconciliationStatus: String(value.reconciliation_status) as "matched" | "diverged",
        replayed: Boolean(value.replayed),
      };
    }) : [],
  };
}
