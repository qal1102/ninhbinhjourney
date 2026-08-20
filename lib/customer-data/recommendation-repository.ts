import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRecommendation } from "@/domain/customer-recommendations";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CustomerRecommendationRepositoryError extends Error {
  constructor(message: string, readonly code: "CONFIGURATION_MISSING" | "PERSISTENCE_FAILED", options?: ErrorOptions) {
    super(message, options);
    this.name = "CustomerRecommendationRepositoryError";
  }
}

export function isCustomerRecommendationsEnabled() {
  return process.env.CUSTOMER_RECOMMENDATIONS_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CustomerRecommendationRepositoryError(
      "Kho gợi ý khách hàng chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-customer-recommendations-server" } },
  });
}

function mapError(error: unknown) {
  return new CustomerRecommendationRepositoryError(
    "Kho gợi ý khách hàng tạm thời chưa phản hồi.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

export async function refreshCustomerRecommendations(profileId: string) {
  const { error } = await createAdminClient().rpc("customer_refresh_recommendations", {
    p_tenant_id: TENANT_ID,
    p_profile_id: profileId,
    p_occurred_at: new Date().toISOString(),
  });
  if (error) throw mapError(error);
}

export type Customer360OutboundAction = {
  actionId: string;
  profileId: string;
  channel: "email" | "sms" | "zalo";
  status: string;
  suppressionReason: string | null;
  templateCode: string;
  createdAt: string;
};

export async function listCustomer360Recommendations(limit = 100): Promise<{
  recommendations: CustomerRecommendation[];
  outboundActions: Customer360OutboundAction[];
}> {
  const client = createAdminClient();
  const [recommendationResult, outboundResult] = await Promise.all([
    client
      .from("customer_recommendations")
      .select("id, profile_id, target_product_id, rule_version, reason_code, status, expires_at, created_at, products(name)")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200)),
    client
      .from("customer_outbound_actions")
      .select("id, profile_id, channel, status, suppression_reason, template_code, created_at")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200)),
  ]);
  if (recommendationResult.error) throw mapError(recommendationResult.error);
  if (outboundResult.error) throw mapError(outboundResult.error);
  return {
    recommendations: ((recommendationResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const product = row.products as { name?: unknown } | null;
      return {
        recommendationId: String(row.id), profileId: String(row.profile_id), productId: String(row.target_product_id),
        productName: String(product?.name ?? "Gói dịch vụ"), ruleVersion: String(row.rule_version),
        reasonCode: String(row.reason_code), status: String(row.status) as CustomerRecommendation["status"],
        expiresAt: String(row.expires_at), createdAt: String(row.created_at),
      };
    }),
    outboundActions: ((outboundResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      actionId: String(row.id), profileId: String(row.profile_id), channel: String(row.channel) as Customer360OutboundAction["channel"],
      status: String(row.status), suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
      templateCode: String(row.template_code), createdAt: String(row.created_at),
    })),
  };
}
