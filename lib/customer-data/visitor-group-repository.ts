import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  VisitorGroupMember,
  VisitorGroupMemberEntry,
  VisitorGroupMemberJourney,
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
      | "JOURNEY_NOT_READY"
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

function careNeedFrom(value: unknown): VisitorGroupMember["careNeed"] {
  const raw = String(value);
  return raw === "young-child" || raw === "elderly" || raw === "mobility" ? raw : "none";
}

function entriesFrom(value: unknown): VisitorGroupMemberEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    return [{ siteId: String(e.site_id ?? ""), scannedAt: String(e.scanned_at ?? "") }];
  });
}

function membersFrom(value: unknown): VisitorGroupMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const nhom = String(row.guest_group);
    if (nhom !== "adult" && nhom !== "child") return [];
    return [{
      memberIndex: Number(row.member_index ?? 0),
      memberCode: String(row.member_code ?? ""),
      guestGroup: nhom,
      displayName: String(row.display_name ?? ""),
      careNeed: careNeedFrom(row.care_need),
      activated: row.activated === true,
      entries: entriesFrom(row.entries),
    }];
  });
}

/**
 * Hàm đọc chưa có trên cơ sở dữ liệu: PostgREST báo `PGRST202` (không thấy hàm
 * trong bộ nhớ lược đồ), PostgreSQL báo `42883` (không có hàm mang chữ ký ấy).
 *
 * Mã ứng dụng lên production trước khi migration `202609180077` được áp, nên
 * đây là một trạng thái có thật, không phải lỗi hiếm.
 */
export function isMissingDatabaseFunction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "PGRST202" || code === "42883";
}

/**
 * Chỉ nhận đúng năm trường hàm đã hứa. Trường lạ nào có lọt vào dữ liệu trả
 * về cũng không đi tiếp ra trình duyệt.
 */
export function memberJourneyFrom(value: unknown): VisitorGroupMemberJourney | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const nhom = String(row.guest_group);
  if (!row.member_code || (nhom !== "adult" && nhom !== "child")) return null;
  return {
    memberCode: String(row.member_code),
    guestGroup: nhom,
    displayName: String(row.display_name ?? ""),
    visitDate: row.visit_date == null ? "" : String(row.visit_date),
    entries: entriesFrom(row.entries),
  };
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
    groupLabel: String(row.group_label ?? ""),
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
  groupLabel: string;
}): Promise<VisitorGroupStatus> {
  const { data, error } = await createAdminClient().rpc("erp_create_visitor_group", {
    p_tenant_id: TENANT_ID,
    p_order_id: input.orderId,
    p_anonymous_id: input.anonymousId,
    p_leader_name: input.leaderName,
    p_leader_phone: input.leaderPhone,
    p_group_label: input.groupLabel,
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

/**
 * TC-15 — trưởng đoàn điền hộ tên cả đoàn.
 *
 * `anonymousId` là phiên khách đã đặt đơn, không phải mã đoàn. Mã đoàn thì cả
 * đoàn ai cũng cầm; nếu nó đủ để đổi tên người khác thì bất kỳ ai trong đoàn
 * cũng sửa được tên mọi người, và không ai truy ra được ai vừa sửa. Tầng chặn
 * thật nằm ở PostgreSQL, đây chỉ là đường đi tới đó.
 */
export async function setVisitorGroupMemberDetails(input: {
  groupCode: string;
  anonymousId: string;
  members: Array<{
    memberIndex: number;
    displayName: string;
    careNeed: VisitorGroupMember["careNeed"];
  }>;
}): Promise<VisitorGroupStatus> {
  const { data, error } = await createAdminClient().rpc("erp_set_group_member_details", {
    p_tenant_id: TENANT_ID,
    p_group_code: input.groupCode.toUpperCase(),
    p_anonymous_id: input.anonymousId,
    p_members: input.members.map((member) => ({
      member_index: member.memberIndex,
      display_name: member.displayName,
      care_need: member.careNeed,
    })),
  });
  if (error) throw mapRepositoryError(error);
  const status = statusFrom(data);
  if (!status) {
    throw new VisitorGroupRepositoryError("Không tìm thấy đoàn nào mang mã này.", "GROUP_NOT_FOUND");
  }
  return status;
}

/**
 * TC-10 — những nơi một người đã đi qua, đọc bằng mã của chính họ.
 *
 * Hàm cơ sở dữ liệu chưa được áp thì báo `JOURNEY_NOT_READY` để trang nói
 * thẳng "phần này sắp có", thay vì một câu "kết nối trục trặc" sai sự thật.
 */
export async function getVisitorGroupMemberJourney(
  memberCode: string,
): Promise<VisitorGroupMemberJourney> {
  const { data, error } = await createAdminClient().rpc("erp_visitor_group_member_journey", {
    p_tenant_id: TENANT_ID,
    p_member_code: memberCode.trim().toUpperCase(),
  });
  if (error) {
    if (isMissingDatabaseFunction(error)) {
      throw new VisitorGroupRepositoryError(
        "Bản đồ những nơi đã đi qua chưa mở ở bản đang chạy.",
        "JOURNEY_NOT_READY",
      );
    }
    throw mapRepositoryError(error);
  }
  const journey = memberJourneyFrom(data);
  if (!journey) {
    throw new VisitorGroupRepositoryError(
      "Không tìm thấy mã khách này trong đoàn nào.",
      "MEMBER_NOT_FOUND",
    );
  }
  return journey;
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
