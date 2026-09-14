import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import { parseOnSiteDueOrders, type OnSiteDueOrder } from "@/domain/erp-on-site-due";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * QA-DON-DU-LIEU-10 — đơn trả tại điểm còn chờ thu, và đóng khoản khi khách
 * không đến. Mọi quyền và điều kiện nằm ở migration `202609140073`.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class OnSiteDueRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OnSiteDueRepositoryError";
  }
}

export type OnSiteDueWorkspace =
  | { available: true; orders: OnSiteDueOrder[] }
  | { available: false; message: string };

function createAdminClient(): SupabaseClient | null {
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-on-site-due" } },
  });
}

export async function listOnSiteDueOrders(input: {
  siteId: ErpSiteId;
  viewerAccountId: string;
}): Promise<OnSiteDueWorkspace> {
  const client = createAdminClient();
  if (!client) {
    return {
      available: false,
      message: "Bản chạy thử chưa nối kho đơn đặt chỗ, nên chưa có đơn trả tại điểm nào để xem.",
    };
  }
  const { data, error } = await client.rpc("erp_on_site_due_orders", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_viewer_account_id: input.viewerAccountId,
    p_limit: 50,
  });
  if (error) {
    return {
      available: false,
      message: findRpcBusinessMessage(error) ?? "Chưa đọc được danh sách đơn trả tại điểm. Xin tải lại trang.",
    };
  }
  return { available: true, orders: parseOnSiteDueOrders(data) };
}

export async function closeOnSiteNoShow(input: {
  siteId: ErpSiteId;
  orderCode: string;
  actorAccountId: string;
  reason: string;
}): Promise<{ closed: boolean; alreadySettled: boolean; voidedTickets: number }> {
  const client = createAdminClient();
  if (!client) throw new OnSiteDueRepositoryError("Bản chạy thử chưa nối kho đơn đặt chỗ.");
  const { data, error } = await client.rpc("erp_close_on_site_no_show", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_order_code: input.orderCode,
    p_actor_account_id: input.actorAccountId,
    p_reason: input.reason,
  });
  if (error) {
    throw new OnSiteDueRepositoryError(
      findRpcBusinessMessage(error) ?? "Chưa đóng được khoản này. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.",
      { cause: error instanceof Error ? error : undefined },
    );
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    closed: row.closed === true,
    alreadySettled: row.already_settled === true,
    voidedTickets: Number(row.voided_tickets) || 0,
  };
}
