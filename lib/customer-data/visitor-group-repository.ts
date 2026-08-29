import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  VisitorGroupMember,
  VisitorGroupStatus,
} from "@/domain/visitor-group";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class VisitorGroupRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "INPUT_INVALID"
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_CONFIRMED"
      | "OWNERSHIP_REQUIRED"
      | "MEMBER_NOT_FOUND"
      | "GROUP_NOT_FOUND"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "VisitorGroupRepositoryError";
  }
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new VisitorGroupRepositoryError(
      "Kho khách đoàn chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-visitor-group-server" } },
  });
}

function mapRepositoryError(error: unknown): VisitorGroupRepositoryError {
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const mappings: Array<[string, VisitorGroupRepositoryError["code"], string]> = [
    ["GROUP_INPUT_INVALID", "INPUT_INVALID", "Thông tin trưởng đoàn chưa hợp lệ."],
    ["GROUP_ORDER_NOT_FOUND", "ORDER_NOT_FOUND", "Không tìm thấy đơn đặt chỗ này."],
    ["GROUP_ORDER_NOT_CONFIRMED", "ORDER_NOT_CONFIRMED", "Đơn chưa xác nhận nên chưa có vé để chia mã."],
    ["GROUP_OWNERSHIP_REQUIRED", "OWNERSHIP_REQUIRED", "Đơn này không thuộc phiên khách hiện tại."],
    ["GROUP_MEMBER_NOT_FOUND", "MEMBER_NOT_FOUND", "Không tìm thấy mã khách này trong đoàn nào."],
  ];
  for (const [needle, code, safeMessage] of mappings) {
    if (message.includes(needle)) return new VisitorGroupRepositoryError(safeMessage, code);
  }
  return new VisitorGroupRepositoryError(
    "Kho khách đoàn tạm thời chưa xử lý được yêu cầu.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

function membersFrom(value: unknown): VisitorGroupMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const nhom = String(row.guest_group);
    if (nhom !== "adult" && nhom !== "child") return [];
    const entries = Array.isArray(row.entries) ? row.entries : [];
    return [{
      memberIndex: Number(row.member_index ?? 0),
      memberCode: String(row.member_code ?? ""),
      guestGroup: nhom,
      displayName: String(row.display_name ?? ""),
      activated: row.activated === true,
      entries: entries.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const e = entry as Record<string, unknown>;
        return [{ siteId: String(e.site_id ?? ""), scannedAt: String(e.scanned_at ?? "") }];
      }),
    }];
  });
}

/**
 * Số điện thoại trưởng đoàn cố ý **không** đi ra khỏi đây.
 *
 * Mã đoàn là thứ trưởng đoàn gửi cho cả đoàn, nên bất kỳ ai trong đoàn cũng
 * cầm nó. Kèm số điện thoại vào là phát tán một dữ liệu cá nhân mà chính chủ
 * chỉ khai để đội vận hành liên lạc khi có việc.
 */
function statusFrom(value: unknown): VisitorGroupStatus | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!row.group_code) return null;
  return {
    groupCode: String(row.group_code),
    orderCode: String(row.order_code ?? ""),
    leaderName: String(row.leader_name ?? ""),
    visitDate: String(row.visit_date ?? ""),
    memberCount: Number(row.member_count ?? 0),
    activatedCount: Number(row.activated_count ?? 0),
    members: membersFrom(row.members),
  };
}

export async function createVisitorGroup(input: {
  orderId: string;
  anonymousId: string;
  leaderName: string;
  leaderPhone: string;
}): Promise<VisitorGroupStatus> {
  const { data, error } = await createAdminClient().rpc("erp_create_visitor_group", {
    p_tenant_id: TENANT_ID,
    p_order_id: input.orderId,
    p_anonymous_id: input.anonymousId,
    p_leader_name: input.leaderName,
    p_leader_phone: input.leaderPhone,
  });
  if (error) throw mapRepositoryError(error);
  const status = statusFrom(data);
  if (!status) throw mapRepositoryError(new Error("GROUP_ORDER_NOT_FOUND"));
  return status;
}

export async function activateVisitorGroupMember(input: {
  memberCode: string;
  displayName: string;
}): Promise<{ memberCode: string; displayName: string; activated: boolean }> {
  const { data, error } = await createAdminClient().rpc("erp_activate_group_member", {
    p_tenant_id: TENANT_ID,
    p_member_code: input.memberCode.toUpperCase(),
    p_display_name: input.displayName,
  });
  if (error) throw mapRepositoryError(error);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    memberCode: String(row.member_code ?? input.memberCode.toUpperCase()),
    displayName: String(row.display_name ?? ""),
    activated: row.activated_at != null,
  };
}

export async function getVisitorGroupStatus(groupCode: string): Promise<VisitorGroupStatus> {
  const { data, error } = await createAdminClient().rpc("erp_visitor_group_status", {
    p_tenant_id: TENANT_ID,
    p_group_code: groupCode.toUpperCase(),
  });
  if (error) throw mapRepositoryError(error);
  const status = statusFrom(data);
  if (!status) {
    throw new VisitorGroupRepositoryError("Không tìm thấy đoàn nào mang mã này.", "GROUP_NOT_FOUND");
  }
  return status;
}
