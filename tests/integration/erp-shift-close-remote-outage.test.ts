import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  cookies: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  getAttendanceState: vi.fn(),
  getCurrentErpUser: vi.fn(),
  rpc: vi.fn(),
  remote: {
    failNextWorkflowReloads: 0,
    insertCount: 0,
    rpcOutageBeforeCommit: false,
    rpcKeys: [] as string[],
    rowsByIdempotencyKey: new Map<
      string,
      {
        audit: Record<string, unknown>;
        row: Record<string, unknown>;
      }
    >(),
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: doubles.createClient,
}));

vi.mock("next/headers", () => ({
  cookies: doubles.cookies,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/attendance-repository", () => ({
  getAttendanceState: doubles.getAttendanceState,
}));

import { submitShiftCloseAction } from "@/app/erp/workflow-actions";
import { INITIAL_SHIFT_CLOSE_ACTION_STATE } from "@/domain/erp-shift-close-action-state";

type RemoteResult = {
  data: unknown;
  error: {
    code: string;
    message: string;
  } | null;
};

type RemoteQuery = {
  select: (...args: unknown[]) => RemoteQuery;
  eq: (field: string, value: unknown) => RemoteQuery;
  order: (...args: unknown[]) => RemoteQuery;
  limit: (...args: unknown[]) => Promise<RemoteResult>;
  single: () => Promise<RemoteResult>;
};

const WORKFLOW_ID = "91000000-0000-4000-8000-000000000001";
const AUDIT_ID = "92000000-0000-4000-8000-000000000001";

function remoteEntryFromCreateRpc(args: Record<string, unknown>) {
  const payload = args.p_payload as Record<string, unknown>;
  const idempotencyKey = String(args.p_idempotency_key);
  const occurredAt = String(payload.shift_ended_at);
  const row: Record<string, unknown> = {
    id: WORKFLOW_ID,
    tenant_id: payload.tenant_id,
    site_id: payload.site_id,
    business_code: payload.business_code,
    shift_date: payload.shift_date,
    shift_label: payload.shift_label,
    station_code: payload.station_code,
    employee_account_id: payload.employee_account_id,
    employee_display_name: payload.employee_display_name,
    shift_started_at: payload.shift_started_at,
    shift_ended_at: payload.shift_ended_at,
    tickets_sold: payload.tickets_sold,
    cash_vnd: payload.cash_vnd,
    card_vnd: payload.card_vnd,
    bank_transfer_vnd: payload.bank_transfer_vnd,
    qr_vnd: payload.qr_vnd,
    gross_sales_vnd: payload.gross_sales_vnd,
    refund_vnd: payload.refund_vnd,
    difference_vnd: payload.difference_vnd,
    finance_code: payload.finance_code,
    note: payload.note,
    status: payload.status,
    version: 1,
    idempotency_key: idempotencyKey,
    submitted_at: occurredAt,
    review_metadata: {},
    updated_at: occurredAt,
  };
  const audit: Record<string, unknown> = {
    id: AUDIT_ID,
    workflow_id: WORKFLOW_ID,
    sequence_number: 1,
    event_type: "employee.submit",
    from_status: null,
    to_status: "submitted",
    actor_account_id: args.p_actor_account_id,
    actor_display_name: args.p_actor_display_name,
    actor_role: args.p_actor_role,
    note: payload.note,
    metadata: {
      actorName: args.p_actor_display_name,
    },
    occurred_at: occurredAt,
  };
  return { audit, row };
}

function shiftCloseFormData() {
  const formData = new FormData();
  formData.set("siteId", "trang-an");
  formData.set("ticketsSold", "462");
  formData.set("grossVnd", "79400000");
  formData.set("refundVnd", "0");
  formData.set("cashVnd", "32000000");
  formData.set("cardVnd", "47400000");
  formData.set("financeCode", "OPS-TA-SHIFT");
  formData.set(
    "note",
    "Đã kiểm đếm vé, tiền và giao dịch điện tử; bàn giao đủ chứng từ ca.",
  );
  return formData;
}

function formSnapshot(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-29T03:15:00.000Z"));
  vi.stubEnv("ERP_PERSISTENCE_MODE", "supabase");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://remote-outage-test.supabase.co",
  );
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  doubles.remote.failNextWorkflowReloads = 0;
  doubles.remote.insertCount = 0;
  doubles.remote.rpcOutageBeforeCommit = false;
  doubles.remote.rpcKeys.length = 0;
  doubles.remote.rowsByIdempotencyKey.clear();
  doubles.cookies.mockReset();
  doubles.createClient.mockReset();
  doubles.from.mockReset();
  doubles.getAttendanceState.mockReset();
  doubles.getCurrentErpUser.mockReset();
  doubles.rpc.mockReset();
  doubles.accountCanAccessModule.mockReset();
  doubles.accountCanAccessSite.mockReset();

  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
  doubles.getCurrentErpUser.mockResolvedValue({
    id: "employee-trang-an-01",
    name: "Đỗ Thị Lan",
    role: "employee",
    siteIds: ["trang-an"],
    managedSiteIds: [],
    workforceProfile: {
      primaryStation: "Cổng A",
      shiftLabel: "07:30–12:15",
    },
  });
  doubles.getAttendanceState.mockResolvedValue({
    events: [
      {
        id: "attendance-test-01",
        userId: "employee-trang-an-01",
        siteId: "trang-an",
        type: "check-in",
        createdAt: "2026-07-29T00:30:00.000Z",
      },
    ],
  });

  doubles.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("erp_demo_create_shift_close");
      const idempotencyKey = String(args.p_idempotency_key);
      doubles.remote.rpcKeys.push(idempotencyKey);

      if (doubles.remote.rpcOutageBeforeCommit) {
        return {
          data: null,
          error: {
            code: "ETIMEDOUT",
            message: "simulated Supabase RPC outage",
          },
        };
      }

      let entry =
        doubles.remote.rowsByIdempotencyKey.get(idempotencyKey);
      if (!entry) {
        entry = remoteEntryFromCreateRpc(args);
        doubles.remote.rowsByIdempotencyKey.set(idempotencyKey, entry);
        doubles.remote.insertCount += 1;
      }
      return { data: entry.row, error: null };
    },
  );

  doubles.from.mockImplementation((table: string) => {
    let selectedId = "";
    const query: RemoteQuery = {
      select: () => query,
      eq: (_field, value) => {
        selectedId = String(value);
        return query;
      },
      order: () => query,
      limit: async () => {
        const entry = [...doubles.remote.rowsByIdempotencyKey.values()]
          .find((candidate) => candidate.row.id === selectedId);
        if (table !== "erp_shift_close_audit_events" || !entry) {
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "simulated remote row not found",
            },
          };
        }
        return { data: [entry.audit], error: null };
      },
      single: async () => {
        if (doubles.remote.failNextWorkflowReloads > 0) {
          doubles.remote.failNextWorkflowReloads -= 1;
          return {
            data: null,
            error: {
              code: "ETIMEDOUT",
              message: "simulated reload outage after commit",
            },
          };
        }
        const entry = [...doubles.remote.rowsByIdempotencyKey.values()]
          .find((candidate) => candidate.row.id === selectedId);
        if (table !== "erp_shift_close_workflows" || !entry) {
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "simulated remote row not found",
            },
          };
        }
        return { data: entry.row, error: null };
      },
    };
    return query;
  });
  doubles.createClient.mockReturnValue({
    from: doubles.from,
    rpc: doubles.rpc,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ERP shift-close remote outage and retry", () => {
  it("fails closed when the Supabase RPC is unavailable", async () => {
    doubles.remote.rpcOutageBeforeCommit = true;
    const formData = shiftCloseFormData();
    const submittedValues = formSnapshot(formData);

    const result = await submitShiftCloseAction(
      INITIAL_SHIFT_CLOSE_ACTION_STATE,
      formData,
    );

    expect(result.status).toBe("error");
    expect(result.recordId).toBeUndefined();
    expect(result.record).toBeUndefined();
    expect(doubles.remote.insertCount).toBe(0);
    expect(doubles.remote.rowsByIdempotencyKey).toHaveLength(0);
    expect(doubles.cookies).not.toHaveBeenCalled();
    expect(formSnapshot(formData)).toEqual(submittedValues);
  });

  it("retries an acknowledged-late commit with one stable idempotency key and one record", async () => {
    doubles.remote.failNextWorkflowReloads = 1;
    const formData = shiftCloseFormData();
    const submittedValues = formSnapshot(formData);

    const firstResult = await submitShiftCloseAction(
      INITIAL_SHIFT_CLOSE_ACTION_STATE,
      formData,
    );

    expect(firstResult.status).toBe("error");
    expect(firstResult.recordId).toBeUndefined();
    expect(doubles.remote.insertCount).toBe(1);
    expect(doubles.remote.rowsByIdempotencyKey).toHaveLength(1);
    expect(formSnapshot(formData)).toEqual(submittedValues);

    const retryResult = await submitShiftCloseAction(
      firstResult,
      formData,
    );
    const repeatedRetryResult = await submitShiftCloseAction(
      retryResult,
      formData,
    );

    expect(retryResult.status).toBe("success");
    expect(retryResult.recordId).toBe(WORKFLOW_ID);
    expect(repeatedRetryResult.status).toBe("success");
    expect(repeatedRetryResult.recordId).toBe(WORKFLOW_ID);
    expect(doubles.remote.insertCount).toBe(1);
    expect(doubles.remote.rowsByIdempotencyKey).toHaveLength(1);
    expect(new Set(doubles.remote.rpcKeys)).toHaveLength(1);
    expect(doubles.remote.rpcKeys).toHaveLength(3);
    expect(doubles.cookies).not.toHaveBeenCalled();
    expect(formSnapshot(formData)).toEqual(submittedValues);
  });
});
