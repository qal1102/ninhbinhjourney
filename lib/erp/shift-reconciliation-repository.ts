import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import type { ErpDataOrigin } from "@/domain/erp-data-origin";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import {
  SHIFT_SCAN_RESULT_KEYS,
  reconcileShift,
  resolveShiftWindow,
  type ShiftCounterCash,
  type ShiftOnSiteCash,
  type ShiftReconciliation,
  type ShiftScanCounts,
  type ShiftScanResultKey,
} from "@/domain/erp-shift-reconciliation";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * TC-21 — đọc số cho bảng đối soát cuối ca.
 *
 * Chỉ đọc. Không hàm nào ở đây gọi `insert`, `update`, `delete` hay một RPC
 * ghi nào; hàm SQL duy nhất nó gọi là `erp_shift_on_site_cash`, khai `stable`
 * và thân chỉ có một câu `select`.
 *
 * **Đếm ở phía máy chủ, không kéo hàng về đếm.** Lượt quét đếm bằng
 * `count: "exact", head: true` — không có hàng nào rời cơ sở dữ liệu, nên
 * không có trần `limit` nào để chạm. Tiền thì cộng bằng `sum()` trong SQL.
 * Bài học nằm ở `lib/erp/ticket-overview-repository.ts`: kéo hàng về rồi đếm
 * thì tới ngày đông khách sẽ âm thầm báo thiếu.
 */

export type ShiftReconciliationSource = {
  shift: {
    id: string;
    shiftCode: string;
    shiftLabel: string;
    station: string;
    businessDate: string;
    status: ShiftCloseRecord["status"];
    submittedByName: string;
    /** ERP-FAKE-03 — hồ sơ gieo mẫu phải đeo nhãn, đừng để ai đọc nhầm là ca thật. */
    dataOrigin: ErpDataOrigin;
  };
  reconciliation: ShiftReconciliation;
  /** Lý do phần lượt quét chưa đọc được; rỗng khi đọc được. */
  scanUnavailableReason: string;
  /** Lý do phần tiền chưa đọc được; rỗng khi đọc được. */
  cashUnavailableReason: string;
  /** Lý do phần tiền bán tại quầy chưa đọc được; rỗng khi đọc được. */
  counterCashUnavailableReason: string;
};

export type ShiftReconciliationView = {
  /** Các ca gần đây của cơ sở, mới nhất trước — để người dùng chọn xem ca nào. */
  options: readonly {
    id: string;
    shiftCode: string;
    businessDate: string;
    station: string;
    dataOrigin: ErpDataOrigin;
  }[];
  selected: ShiftReconciliationSource | null;
  /** Rỗng khi không có ca nào để đối soát. */
  emptyReason: string;
};

const OPTION_LIMIT = 8;

function isSupabaseMode() {
  return process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase";
}

function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-shift-reconciliation" } },
  });
}

/**
 * Đếm lượt quét theo từng kết quả, mỗi kết quả một câu đếm ở phía máy chủ.
 *
 * Chín câu đếm nghe nhiều, nhưng mỗi câu là `head: true` — chỉ trả về con số,
 * không trả về hàng nào — và chạy song song. Đổi lại là con số đúng ở mọi cỡ
 * dữ liệu, thay vì đúng cho tới ngày đông khách.
 */
async function countScansByResult(
  client: SupabaseClient,
  siteUuid: string,
  window: { from: Date; to: Date },
): Promise<ShiftScanCounts> {
  const entries = await Promise.all(
    SHIFT_SCAN_RESULT_KEYS.map(async (key) => {
      const { count, error } = await client
        .from("erp_gate_scan_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", TENANT_ID)
        .eq("site_id", siteUuid)
        .eq("result", key)
        .gte("scanned_at", window.from.toISOString())
        .lt("scanned_at", window.to.toISOString());
      if (error) throw error;
      return [key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ShiftScanResultKey, number>;
}

function readCounterCashRow(value: unknown): ShiftCounterCash | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sellers = Array.isArray(row.sellers) ? row.sellers : [];
  return {
    count: Number(row.sale_count ?? 0),
    totalVnd: Number(row.total_vnd ?? 0),
    voidedCount: Number(row.voided_count ?? 0),
    voidedVnd: Number(row.voided_vnd ?? 0),
    sellers: sellers.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const accountId = String(item.account_id ?? "");
      return {
        accountId,
        displayName: String(item.display_name ?? accountId),
        count: Number(item.count ?? 0),
        totalVnd: Number(item.total_vnd ?? 0),
      };
    }),
  };
}

/**
 * QA-ERP-POS-04 — tiền bán vé tại quầy có phiếu trong khung giờ của ca.
 *
 * Cùng khuôn với `readOnSiteCash`: chỉ nuốt đúng lỗi "chưa có hàm" để nói
 * thật là migration 069 chưa áp; mọi lỗi khác vẫn ném ra.
 */
async function readCounterCash(
  client: SupabaseClient,
  siteUuid: string,
  window: { from: Date; to: Date },
): Promise<{ counterCash: ShiftCounterCash | null; reason: string }> {
  const { data, error } = await client.rpc("erp_shift_counter_cash", {
    p_tenant_id: TENANT_ID,
    p_site_id: siteUuid,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
  });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return {
        counterCash: null,
        reason:
          "Phần tiền bán tại quầy chưa đối soát được vì migration 202609130069 chưa" +
          " áp lên máy chủ. Hệ thống xin phép để trống thay vì hiện 0 đồng.",
      };
    }
    throw error;
  }
  const counterCash = readCounterCashRow(data);
  if (!counterCash) {
    return { counterCash: null, reason: "Máy chủ trả về dữ liệu tiền quầy không đọc được." };
  }
  return { counterCash, reason: "" };
}

function readCash(value: unknown): ShiftOnSiteCash | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const collectors = Array.isArray(row.collectors) ? row.collectors : [];
  return {
    count: Number(row.collection_count ?? 0),
    totalVnd: Number(row.collected_vnd ?? 0),
    outstandingCount: Number(row.outstanding_count ?? 0),
    outstandingVnd: Number(row.outstanding_vnd ?? 0),
    collectors: collectors.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const accountId = String(item.account_id ?? "");
      return {
        accountId,
        displayName: String(item.display_name ?? accountId),
        count: Number(item.count ?? 0),
        totalVnd: Number(item.total_vnd ?? 0),
      };
    }),
  };
}

/**
 * Hỏi trước đúng một câu xem hàm đối soát đã có trên máy chủ chưa.
 *
 * Migration `202609060062` chưa áp thì hàm chưa tồn tại. Lúc ấy phải **nói
 * thẳng là chưa đọc được**, chứ không trả về 0 đồng — 0 đồng và "chưa đọc
 * được" là hai chuyện khác hẳn nhau, trộn vào nhau đúng là cách dựng ra một
 * con số bịa (bài học `ERP-FAKE-01`). Chỉ nuốt đúng mã lỗi "không có hàm ấy";
 * mọi lỗi khác vẫn ném ra, vì im lặng nuốt lỗi kho dữ liệu là cách để một màn
 * hình sai trông y như một màn hình đúng.
 */
async function readOnSiteCash(
  client: SupabaseClient,
  siteUuid: string,
  window: { from: Date; to: Date },
): Promise<{ cash: ShiftOnSiteCash | null; reason: string }> {
  const { data, error } = await client.rpc("erp_shift_on_site_cash", {
    p_tenant_id: TENANT_ID,
    p_site_id: siteUuid,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
  });
  if (error) {
    const missing = error.code === "42883" || error.code === "PGRST202";
    if (missing) {
      return {
        cash: null,
        reason:
          "Phần tiền thu tại cổng chưa đối soát được vì migration 202609060062 chưa" +
          " áp lên máy chủ. Hệ thống xin phép để trống thay vì hiện 0 đồng.",
      };
    }
    throw error;
  }
  const cash = readCash(data);
  if (!cash) {
    return {
      cash: null,
      reason: "Máy chủ trả về một hình dạng dữ liệu tiền không đọc được.",
    };
  }
  return { cash, reason: "" };
}

/**
 * Bảng đối soát cho **một ca tại một cơ sở**.
 *
 * Cố ý chỉ dựng cho đúng một ca mỗi lượt xem. Đối soát mười ca cùng lúc nghĩa
 * là chín mươi câu đếm cho một trang, mà người chốt ca thì mỗi lần chỉ hỏi về
 * đúng ca vừa xong.
 */
export async function readShiftReconciliation(input: {
  siteId: ErpSiteId;
  shifts: readonly ShiftCloseRecord[];
  selectedShiftId?: string;
}): Promise<ShiftReconciliationView> {
  const scoped = [...input.shifts]
    .filter((record) => record.siteId === input.siteId)
    .sort((left, right) => {
      const byDate = right.businessDate.localeCompare(left.businessDate);
      if (byDate !== 0) return byDate;
      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .slice(0, OPTION_LIMIT);

  const options = scoped.map((record) => ({
    id: record.id,
    shiftCode: record.shiftCode,
    businessDate: record.businessDate,
    station: record.station,
    dataOrigin: record.dataOrigin,
  }));

  const selected =
    scoped.find((record) => record.id === input.selectedShiftId) ?? scoped[0] ?? null;

  if (!selected) {
    return {
      options,
      selected: null,
      emptyReason:
        "Chưa có hồ sơ chốt ca nào ở cơ sở này, nên chưa có ca nào để đối soát.",
    };
  }

  const declaration = {
    businessDate: selected.businessDate,
    shiftStartedAt: selected.shiftStartedAt,
    shiftEndedAt: selected.shiftEndedAt,
    ticketsSold: selected.ticketsSold,
    cashVnd: selected.amounts.cashVnd,
  };
  const window = resolveShiftWindow(declaration);

  const shift = {
    id: selected.id,
    shiftCode: selected.shiftCode,
    shiftLabel: selected.shiftLabel,
    station: selected.station,
    businessDate: selected.businessDate,
    status: selected.status,
    submittedByName: selected.submittedBy.name,
    dataOrigin: selected.dataOrigin,
  };

  const offline = (reason: string): ShiftReconciliationView => ({
    options,
    selected: {
      shift,
      reconciliation: reconcileShift({ shift: declaration, scanCounts: null, cash: null }),
      scanUnavailableReason: reason,
      cashUnavailableReason: reason,
      counterCashUnavailableReason: reason,
    },
    emptyReason: "",
  });

  if (window.dayKeys.length === 0) {
    return offline(window.fallbackReason);
  }

  const client = isSupabaseMode() ? createAdminClient() : null;
  if (!client) {
    return offline(
      "Bản chạy thử cục bộ chưa nối kho dữ liệu thật, nên chưa đối soát được ca nào.",
    );
  }

  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId];

  const [scanResult, cashResult, counterResult] = await Promise.allSettled([
    countScansByResult(client, siteUuid, window),
    readOnSiteCash(client, siteUuid, window),
    readCounterCash(client, siteUuid, window),
  ]);

  let counterCash: ShiftCounterCash | null = null;
  let counterCashUnavailableReason = "";
  if (counterResult.status === "fulfilled") {
    counterCash = counterResult.value.counterCash;
    counterCashUnavailableReason = counterResult.value.reason;
  } else {
    console.error("Shift reconciliation counter cash read failed", counterResult.reason);
    counterCashUnavailableReason = "Chưa đọc được tiền bán tại quầy của ca này.";
  }

  let scanCounts: ShiftScanCounts | null = null;
  let scanUnavailableReason = "";
  if (scanResult.status === "fulfilled") {
    scanCounts = scanResult.value;
  } else {
    console.error("Shift reconciliation scan count failed", scanResult.reason);
    scanUnavailableReason = "Chưa đọc được nhật ký quét cổng của ca này.";
  }

  let cash: ShiftOnSiteCash | null = null;
  let cashUnavailableReason = "";
  if (cashResult.status === "fulfilled") {
    cash = cashResult.value.cash;
    cashUnavailableReason = cashResult.value.reason;
  } else {
    console.error("Shift reconciliation cash read failed", cashResult.reason);
    cashUnavailableReason = "Chưa đọc được khoản thu tại cổng của ca này.";
  }

  return {
    options,
    selected: {
      shift,
      reconciliation: reconcileShift({ shift: declaration, scanCounts, cash, counterCash }),
      scanUnavailableReason,
      cashUnavailableReason,
      counterCashUnavailableReason,
    },
    emptyReason: "",
  };
}
