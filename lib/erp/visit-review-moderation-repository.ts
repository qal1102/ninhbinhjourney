import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ErpRole } from "@/domain/erp";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * TC-12 mục 3–4 — ẩn và hiện lại một lời khách.
 *
 * Kho này **không** tự kiểm luật: hạn mức, giới hạn toàn 5 sao và nhật ký đều
 * nằm trong `erp_hide_visit_review`. Ở đây chỉ gọi đúng hàm và dịch câu từ
 * chối của PostgreSQL thành câu người đọc được.
 */

export type ModerationResult =
  | { ok: true; quotaUsed: number | null; quotaLimit: number | null }
  | { ok: false; message: string };

function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-review-moderation" } },
  });
}

function cauTuChoi(error: unknown): string {
  return (
    findRpcBusinessMessage(error) ??
    "Kho đánh giá tạm thời chưa xử lý được yêu cầu. Xin thử lại giúp em một lượt ạ."
  );
}

export async function hideVisitReview(input: {
  actorAccountId: string;
  actorRole: ErpRole;
  reviewId: string;
  reason: string;
}): Promise<ModerationResult> {
  const client = createAdminClient();
  if (!client) return { ok: false, message: "Kho đánh giá chưa được cấu hình ở phía máy chủ." };
  const { data, error } = await client.rpc("erp_hide_visit_review", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_actor_role: input.actorRole,
    p_review_id: input.reviewId,
    p_reason: input.reason,
  });
  if (error) return { ok: false, message: cauTuChoi(error) };
  const row = (data ?? {}) as Record<string, unknown>;
  const used = Number(row.quota_used);
  const limit = Number(row.quota_limit);
  return {
    ok: true,
    quotaUsed: Number.isFinite(used) ? used : null,
    quotaLimit: Number.isFinite(limit) ? limit : null,
  };
}

export async function unhideVisitReview(input: {
  actorAccountId: string;
  actorRole: ErpRole;
  reviewId: string;
  reason: string;
}): Promise<ModerationResult> {
  const client = createAdminClient();
  if (!client) return { ok: false, message: "Kho đánh giá chưa được cấu hình ở phía máy chủ." };
  const { error } = await client.rpc("erp_unhide_visit_review", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_actor_role: input.actorRole,
    p_review_id: input.reviewId,
    p_reason: input.reason,
  });
  if (error) return { ok: false, message: cauTuChoi(error) };
  return { ok: true, quotaUsed: null, quotaLimit: null };
}

/** Số lời người này đã ẩn trong 30 ngày, để màn hình nói trước phần còn lại. */
export async function hideQuotaUsed(actorAccountId: string): Promise<number> {
  const client = createAdminClient();
  if (!client) return 0;
  const { data, error } = await client.rpc("erp_visit_review_hide_quota_used", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: actorAccountId,
  });
  if (error) return 0;
  const so = Number(data);
  return Number.isFinite(so) && so > 0 ? Math.round(so) : 0;
}
