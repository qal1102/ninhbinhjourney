import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TC-10 — GET `/api/customer-group-members?member_code=…`.
 *
 * Chạy thật route và kho, chỉ giả lập đúng một chỗ: lời gọi `rpc` của
 * Supabase. Nhờ vậy bài kiểm thấy được cả đường "hàm chưa được áp" mà
 * production sẽ đi qua trước khi migration `202609180077` lên.
 */

vi.mock("server-only", () => ({}));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

const MA = "TV-AB12CD34EF";
const TRANG_AN = "10000000-0000-4000-8000-000000000001";

async function goi(query: string) {
  const { GET } = await import("@/app/api/customer-group-members/route");
  const response = await GET(new Request(`http://127.0.0.1/api/customer-group-members${query}`));
  return { status: response.status, body: await response.json(), headers: response.headers };
}

beforeEach(() => {
  vi.stubEnv("CUSTOMER_BOOKING_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  rpc.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET hành trình của một thành viên", () => {
  it("trả đúng năm trường của người cầm mã, bỏ mọi trường lạ", async () => {
    rpc.mockResolvedValue({
      data: {
        member_code: MA,
        guest_group: "adult",
        display_name: "Nguyễn Thị B",
        visit_date: "2026-09-18",
        entries: [{ site_id: TRANG_AN, scanned_at: "2026-09-18T02:42:00+00:00" }],
        // Giả sử có ai đó lỡ nới hàm SQL: trường lạ không được đi tiếp.
        leader_phone: "0912345678",
        members: [{ display_name: "Người khác" }],
      },
      error: null,
    });

    const { status, body, headers } = await goi(`?member_code=${MA.toLowerCase()}`);

    expect(status).toBe(200);
    expect(headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      accepted: true,
      journey: {
        memberCode: MA,
        guestGroup: "adult",
        displayName: "Nguyễn Thị B",
        visitDate: "2026-09-18",
        entries: [{ siteId: TRANG_AN, scannedAt: "2026-09-18T02:42:00+00:00" }],
      },
    });
    expect(rpc).toHaveBeenCalledWith("erp_visitor_group_member_journey", {
      p_tenant_id: "00000000-0000-4000-8000-000000000001",
      p_member_code: MA,
    });
  });

  it.each(["PGRST202", "42883"])(
    "hàm chưa có trên cơ sở dữ liệu (%s) thì nói rõ là chưa mở, không phải lỗi kết nối",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { code, message: "function not found" } });
      const { status, body } = await goi(`?member_code=${MA}`);
      expect(status).toBe(503);
      expect(body.accepted).toBe(false);
      expect(body.error.code).toBe("VISITOR_GROUP_JOURNEY_NOT_READY");
    },
  );

  it("mã không có thật thì 404", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "GROUP_MEMBER_NOT_FOUND" },
    });
    const { status, body } = await goi(`?member_code=${MA}`);
    expect(status).toBe(404);
    expect(body.error.code).toBe("VISITOR_GROUP_MEMBER_NOT_FOUND");
  });

  it("lỗi khác của cơ sở dữ liệu là 503 thường, không bị gọi nhầm thành 'chưa mở'", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "canceling statement" } });
    const { status, body } = await goi(`?member_code=${MA}`);
    expect(status).toBe(503);
    expect(body.error.code).toBe("VISITOR_GROUP_PERSISTENCE_FAILED");
  });

  it.each(["", "?member_code=", "?member_code=DOAN-AB12CD34EF", "?member_code=TV-ABC", "?member_code=TV-AB12CD34EF1"])(
    "mã sai khuôn (%s) bị chặn trước khi gọi cơ sở dữ liệu",
    async (query) => {
      const { status, body } = await goi(query);
      expect(status).toBe(400);
      expect(body.error.code).toBe("VISITOR_GROUP_INPUT_INVALID");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("đặt chỗ trực tuyến đang tắt thì không gọi gì cả", async () => {
    vi.stubEnv("CUSTOMER_BOOKING_ENABLED", "false");
    const { status, body } = await goi(`?member_code=${MA}`);
    expect(status).toBe(503);
    expect(body.error.code).toBe("CUSTOMER_BOOKING_DISABLED");
    expect(rpc).not.toHaveBeenCalled();
  });
});
