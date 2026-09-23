import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import type { VisitorGroupMember, VisitorGroupStatus } from "@/domain/visitor-group";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * TC-18 — đoàn mua tại quầy.
 *
 * File riêng, không nhét chung vào `lib/customer-data/visitor-group-repository.ts`:
 * file đó đọc/ghi qua RPC dành cho phiên khách web (`p_anonymous_id`), còn ở
 * đây gọi từ server action ERP với danh tính nhân viên đã đăng nhập
 * (`p_actor_account_id`). Hai luồng khác hình dạng đầu vào, gộp chung dễ lẫn
 * quyền của bên này sang bên kia.
 *
 * Cách đọc JSON trả về (`statusFrom`/`membersFrom`/`careNeedFrom`) cố ý lặp
 * lại đúng logic của `lib/customer-data/visitor-group-repository.ts` thay vì
 * import — giữ hai track (khách hàng / ERP nội bộ) không phụ thuộc chéo vào
 * nhau, tránh việc sửa một bên vô tình đổi hình dạng dữ liệu của bên kia.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CounterVisitorGroupRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "INPUT_INVALID"
      | "ACTOR_NOT_ALLOWED"
      | "SITE_INVALID"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CounterVisitorGroupRepositoryError";
  }
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CounterVisitorGroupRepositoryError(
      "Kho khách đoàn chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-visitor-group-counter" } },
  });
}

function mapRepositoryError(error: unknown): CounterVisitorGroupRepositoryError {
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const mappings: Array<[string, CounterVisitorGroupRepositoryError["code"], string]> = [
    ["GROUP_COUNTER_INPUT_INVALID", "INPUT_INVALID", "Số người hoặc nhãn đoàn chưa hợp lệ."],
    [
      "GROUP_COUNTER_ACTOR_REQUIRED",
      "ACTOR_NOT_ALLOWED",
      "Tài khoản này chưa được phân công bán vé tại cơ sở này.",
    ],
    ["GATE_SCAN_SITE_TENANT_MISMATCH", "SITE_INVALID", "Cơ sở không hợp lệ."],
  ];
  for (const [needle, code, safeMessage] of mappings) {
    if (message.includes(needle)) return new CounterVisitorGroupRepositoryError(safeMessage, code);
  }
  return new CounterVisitorGroupRepositoryError(
    "Chưa lập được phiếu đoàn tại quầy. Xin thử lại.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

function careNeedFrom(value: unknown): VisitorGroupMember["careNeed"] {
  const raw = String(value);
  return raw === "young-child" || raw === "elderly" || raw === "mobility" ? raw : "none";
}

function membersFrom(value: unknown): VisitorGroupMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const nhom = String(row.guest_group);
    if (nhom !== "adult" && nhom !== "child") return [];
    const entries = Array.isArray(row.entries) ? row.entries : [];
    return [
      {
        memberIndex: Number(row.member_index ?? 0),
        memberCode: String(row.member_code ?? ""),
        guestGroup: nhom,
        displayName: String(row.display_name ?? ""),
        careNeed: careNeedFrom(row.care_need),
        activated: row.activated === true,
        entries: entries.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const e = entry as Record<string, unknown>;
          return [{ siteId: String(e.site_id ?? ""), scannedAt: String(e.scanned_at ?? "") }];
        }),
      },
    ];
  });
}

/**
 * `order_code`/`visit_date` có thể rỗng: một đoàn quầy không có đơn web,
 * `erp_visitor_group_status` (migration `202609060063`) trả `null` cho
 * `order_code` và lấy `visit_date` từ chính vé quầy. `String(x ?? "")` đã đủ
 * an toàn cho cả hai trường hợp.
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

export async function createCounterVisitorGroup(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  partySize: number;
  groupLabel: string;
  /**
   * Khoá chống lập trùng, do màn hình sinh ra một lần cho mỗi tấm phiếu.
   *
   * Gửi lại cùng khoá thì máy chủ trả về đúng tấm phiếu cũ chứ không lập tấm
   * thứ hai. Cần thật, vì máy ở quầy chạy 4G: kết nối rơi giữa chừng, nhân
   * viên bấm lại, và tấm phiếu thừa sẽ cộng thẳng vào ô "vé đã bán" của giám
   * đốc mà không ai biết là sai.
   */
  idempotencyKey: string;
}): Promise<VisitorGroupStatus> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_counter_visitor_group", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_party_size: input.partySize,
    p_group_label: input.groupLabel,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapRepositoryError(error);
  const status = statusFrom(data);
  if (!status) {
    throw new CounterVisitorGroupRepositoryError(
      "Chưa lập được phiếu đoàn tại quầy. Xin thử lại.",
      "PERSISTENCE_FAILED",
    );
  }
  return status;
}
