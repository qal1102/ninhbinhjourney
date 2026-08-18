import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingCampaignRecord,
  MarketingCampaignInput,
  MarketingQrConfig,
  MarketingQrSourceRecord,
  MarketingQrSourceInput,
} from "@/domain/marketing-qr";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class MarketingQrRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "NOT_FOUND"
      | "NOT_ACTIVE"
      | "VERSION_CONFLICT"
      | "INPUT_INVALID"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MarketingQrRepositoryError";
  }
}

type RpcRow = Record<string, unknown>;

export function isMarketingQrRoutingEnabled() {
  return process.env.CUSTOMER_QR_ROUTING_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new MarketingQrRepositoryError(
      "Kho QR marketing chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-marketing-qr-server" } },
  });
}

function errorMessage(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message)
    : "";
}

function mapRepositoryError(error: unknown): MarketingQrRepositoryError {
  const message = errorMessage(error);
  if (message.includes("MARKETING_QR_NOT_FOUND")) {
    return new MarketingQrRepositoryError("Không tìm thấy mã QR marketing này.", "NOT_FOUND");
  }
  if (message.includes("MARKETING_QR_NOT_ACTIVE")) {
    return new MarketingQrRepositoryError("Mã QR này đang tạm dừng hoặc chiến dịch chưa hoạt động.", "NOT_ACTIVE");
  }
  if (message.includes("MARKETING_QR_VERSION_CONFLICT")) {
    return new MarketingQrRepositoryError("Mã QR vừa được người khác cập nhật. Hãy tải lại trước khi đổi đích.", "VERSION_CONFLICT");
  }
  if (message.includes("MARKETING_QR_") || message.includes("MARKETING_CAMPAIGN_")) {
    return new MarketingQrRepositoryError("Dữ liệu campaign hoặc QR chưa hợp lệ.", "INPUT_INVALID");
  }
  return new MarketingQrRepositoryError(
    "Kho QR marketing chưa thể hoàn tất thao tác này.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

function firstRow(data: unknown) {
  return Array.isArray(data) ? (data[0] as RpcRow | undefined) : undefined;
}

export async function listMarketingQrConfig(): Promise<MarketingQrConfig> {
  const client = createAdminClient();
  const [campaignResult, sourceResult] = await Promise.all([
    client
      .from("marketing_campaigns")
      .select("id, code, name, status")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false }),
    client
      .from("marketing_qr_sources")
      .select("id, campaign_id, code, placement_id, placement_label, destination_path, status, version, created_at")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false }),
  ]);
  if (campaignResult.error) throw mapRepositoryError(campaignResult.error);
  if (sourceResult.error) throw mapRepositoryError(sourceResult.error);

  const campaigns = (campaignResult.data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: row.status as MarketingCampaignRecord["status"],
  }));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const sourceRows = (sourceResult.data ?? []) as Array<RpcRow>;
  const sourceIds = sourceRows.map((row) => String(row.id));
  const scansBySource = new Map<string, { count: number; lastScannedAt: string | null }>();

  if (sourceIds.length > 0) {
    const { data: scans, error: scanError } = await client
      .from("marketing_qr_scans")
      .select("qr_source_id, occurred_at")
      .eq("tenant_id", TENANT_ID)
      .in("qr_source_id", sourceIds)
      .order("occurred_at", { ascending: false })
      .limit(5_000);
    if (scanError) throw mapRepositoryError(scanError);
    for (const scan of (scans ?? []) as Array<RpcRow>) {
      const sourceId = String(scan.qr_source_id);
      const existing = scansBySource.get(sourceId) ?? { count: 0, lastScannedAt: null };
      existing.count += 1;
      existing.lastScannedAt ??= String(scan.occurred_at);
      scansBySource.set(sourceId, existing);
    }
  }

  return {
    campaigns,
    sources: sourceRows.flatMap((row) => {
      const campaign = campaignById.get(String(row.campaign_id));
      if (!campaign) return [];
      const scans = scansBySource.get(String(row.id)) ?? { count: 0, lastScannedAt: null };
      return [{
        id: String(row.id),
        campaignId: campaign.id,
        campaignCode: campaign.code,
        campaignName: campaign.name,
        code: String(row.code),
        placementId: String(row.placement_id),
        placementLabel: String(row.placement_label),
        destinationPath: String(row.destination_path),
        status: row.status as MarketingQrSourceRecord["status"],
        version: Number(row.version),
        scanCount: scans.count,
        lastScannedAt: scans.lastScannedAt,
      }];
    }),
  };
}

export async function createMarketingCampaign(input: MarketingCampaignInput & { actorAccountId: string }) {
  const { data, error } = await createAdminClient().rpc("marketing_create_campaign", {
    p_tenant_id: TENANT_ID,
    p_campaign_id: crypto.randomUUID(),
    p_actor_account_id: input.actorAccountId,
    p_code: input.code,
    p_name: input.name,
    p_status: input.status,
  });
  const row = firstRow(data);
  if (error || !row) throw mapRepositoryError(error);
  return String(row.campaign_id);
}

export async function createMarketingQrSource(input: MarketingQrSourceInput & { actorAccountId: string }) {
  const { data, error } = await createAdminClient().rpc("marketing_create_qr_source", {
    p_tenant_id: TENANT_ID,
    p_qr_source_id: crypto.randomUUID(),
    p_actor_account_id: input.actorAccountId,
    p_campaign_id: input.campaignId,
    p_code: input.code,
    p_placement_id: input.placementId,
    p_placement_label: input.placementLabel,
    p_destination_path: input.destinationPath,
    p_status: input.status,
  });
  const row = firstRow(data);
  if (error || !row) throw mapRepositoryError(error);
  return String(row.qr_source_id);
}

export async function updateMarketingQrDestination(input: {
  sourceId: string;
  actorAccountId: string;
  expectedVersion: number;
  destinationPath: string;
}) {
  const { data, error } = await createAdminClient().rpc("marketing_update_qr_destination", {
    p_tenant_id: TENANT_ID,
    p_qr_source_id: input.sourceId,
    p_actor_account_id: input.actorAccountId,
    p_expected_version: input.expectedVersion,
    p_destination_path: input.destinationPath,
  });
  const row = firstRow(data);
  if (error || !row) throw mapRepositoryError(error);
  return Number(row.version);
}

export async function resolveMarketingQrRedirect(code: string) {
  const { data, error } = await createAdminClient().rpc("marketing_resolve_qr_redirect", {
    p_tenant_id: TENANT_ID,
    p_code: code,
  });
  const row = firstRow(data);
  if (error || !row) throw mapRepositoryError(error);
  return {
    sourceId: String(row.qr_source_id),
    sourceCode: String(row.qr_code),
    campaignCode: String(row.campaign_code),
    placementId: String(row.placement_id),
    destinationPath: String(row.destination_path),
  };
}
