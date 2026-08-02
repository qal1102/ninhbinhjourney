import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

/**
 * T15 — nhật ký tập trung.
 *
 * Phạm vi nhìn **không** tính ở đây. Nó tính bên trong `erp_audit_timeline`,
 * từ chính phiếu cấp vai trò của người xem. Tầng này chỉ chuyển tiếp mã tài
 * khoản đang đăng nhập; không có tham số nào cho phép nới phạm vi, kể cả khi
 * ai đó gọi thẳng hàm này từ chỗ khác trong mã nguồn.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export type ErpAuditEntry = {
  source: string;
  occurredAt: string;
  siteId: ErpSiteId | null;
  actorAccountId: string;
  actorDisplayName: string;
  actorJobTitle: string | null;
  /** Cơ sở của **người thao tác** lúc đó. Rỗng nghĩa là toàn vùng. */
  actorSiteIds: ErpSiteId[];
  /**
   * `false` khi tên ở trên là tên **hiện tại** được điền bù cho dòng cũ, không
   * phải tên lúc thao tác. Màn hình phải nói ra, không được lặng lẽ trình bày
   * nó như một ảnh chụp.
   */
  actorSnapshotAtWrite: boolean;
  action: string;
  entityType: string | null;
  entityId: string | null;
  note: string | null;
};

export type ErpHeadcountRow = {
  siteId: ErpSiteId;
  role: string;
  headcount: number;
};

export class AuditTimelineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuditTimelineError";
  }
}

function isSupabaseMode() {
  return process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new AuditTimelineError("Nhật ký chưa được cấu hình đủ ở phía máy chủ.");
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-audit-timeline" } },
  });
}

function timelineError(operation: string, error: unknown) {
  const businessMessage = findRpcBusinessMessage(error);
  if (businessMessage) return new AuditTimelineError(businessMessage);
  return new AuditTimelineError(`Nhật ký chưa hoàn tất bước ${operation}.`, {
    cause: error,
  });
}

function isSiteId(value: unknown): value is ErpSiteId {
  return ERP_SITES.some((site) => site.id === value);
}

function parseSiteScope(value: unknown): ErpSiteId[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(isSiteId);
}

export type AuditTimelineQuery = {
  viewerAccountId: string;
  search?: string;
  siteId?: ErpSiteId;
  from?: string;
  to?: string;
  limit?: number;
  /** Thu hẹp về đúng một người, cho trang hồ sơ. Không nới được phạm vi. */
  actorAccountId?: string;
};

export async function listAuditTimeline(
  query: AuditTimelineQuery,
): Promise<ErpAuditEntry[]> {
  // Chế độ demo-cookie không có tám bảng nhật ký này. Trả rỗng và để màn hình
  // nói thẳng, thay vì dựng một dòng thời gian giả cho một tính năng mà cả
  // điểm của nó là đáng tin.
  if (!isSupabaseMode()) return [];

  const client = createAdminClient();
  const result = await client.rpc("erp_audit_timeline", {
    p_tenant_id: TENANT_ID,
    p_viewer_account_id: query.viewerAccountId,
    p_search: query.search?.trim() || null,
    p_site_id: query.siteId ?? null,
    p_from: query.from ?? null,
    p_to: query.to ?? null,
    p_limit: query.limit ?? 200,
    p_actor_account_id: query.actorAccountId ?? null,
  });

  if (result.error) throw timelineError("đọc dòng thời gian", result.error);

  return (result.data ?? []).map((row: Record<string, unknown>) => ({
    source: String(row.source ?? ""),
    occurredAt: String(row.occurred_at ?? ""),
    siteId: isSiteId(row.site_id) ? row.site_id : null,
    actorAccountId: String(row.actor_account_id ?? ""),
    actorDisplayName: String(row.actor_display_name ?? row.actor_account_id ?? ""),
    actorJobTitle: row.actor_job_title == null ? null : String(row.actor_job_title),
    actorSiteIds: parseSiteScope(row.actor_site_scope),
    actorSnapshotAtWrite: row.actor_snapshot_at_write !== false,
    action: String(row.action ?? ""),
    entityType: row.entity_type == null ? null : String(row.entity_type),
    entityId: row.entity_id == null ? null : String(row.entity_id),
    note: row.note == null ? null : String(row.note),
  }));
}

export async function listHeadcountBySite(
  viewerAccountId: string,
): Promise<ErpHeadcountRow[]> {
  if (!isSupabaseMode()) return [];

  const client = createAdminClient();
  const result = await client.rpc("erp_headcount_by_site", {
    p_tenant_id: TENANT_ID,
    p_viewer_account_id: viewerAccountId,
  });

  if (result.error) throw timelineError("đếm nhân sự theo khu vực", result.error);

  return (result.data ?? [])
    .filter((row: Record<string, unknown>) => isSiteId(row.site_id))
    .map((row: Record<string, unknown>) => ({
      siteId: row.site_id as ErpSiteId,
      role: String(row.role ?? ""),
      headcount: Number(row.headcount ?? 0),
    }));
}
