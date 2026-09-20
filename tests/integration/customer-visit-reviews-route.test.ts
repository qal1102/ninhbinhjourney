import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TC-12 — `/api/customer-visit-reviews`.
 *
 * Chạy thật route và kho, chỉ giả lập lời gọi `rpc` của Supabase. Nhờ vậy bài
 * thấy được cả đường "hàm chưa được áp" mà production đi qua trước khi
 * migration `202609200079` lên.
 */

vi.mock("server-only", () => ({}));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

const MA = "TV-AB12CD34EF";
const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const GOC = "http://127.0.0.1";

async function guiLoi(body: unknown, headers: Record<string, string> = { Origin: GOC }) {
  const { POST } = await import("@/app/api/customer-visit-reviews/route");
  const response = await POST(
    new Request(`${GOC}/api/customer-visit-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "127.0.0.1", ...headers },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

async function docLoi(query: string) {
  const { GET } = await import("@/app/api/customer-visit-reviews/route");
  const response = await GET(new Request(`${GOC}/api/customer-visit-reviews${query}`));
  return { status: response.status, body: await response.json() };
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

describe("POST một lời về nơi vừa tới", () => {
  it("gửi đúng năm tham số xuống hàm SQL và trả lại lời đã lưu", async () => {
    rpc.mockResolvedValue({
      data: { site_id: TRANG_AN, rating: 5, comment: "Đi sớm thì vắng", updated_at: "2026-09-19T04:00:00Z" },
      error: null,
    });
    const ra = await guiLoi({ member_code: MA, site_id: TRANG_AN, rating: 5, comment: "Đi sớm thì vắng" });
    expect(ra.status).toBe(200);
    expect(ra.body.review.rating).toBe(5);
    expect(rpc).toHaveBeenCalledWith("erp_submit_visit_review", {
      p_tenant_id: "00000000-0000-4000-8000-000000000001",
      p_member_code: MA,
      p_site_id: TRANG_AN,
      p_rating: 5,
      p_comment: "Đi sớm thì vắng",
    });
  });

  it("không có dấu chân ở nơi ấy thì từ chối, và nói đúng lý do", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "REVIEW_KHONG_CO_DAU_CHAN" } });
    const ra = await guiLoi({ member_code: MA, site_id: TRANG_AN, rating: 5, comment: "" });
    expect(ra.status).toBe(403);
    expect(ra.body.error.code).toBe("VISIT_REVIEW_KHONG_CO_DAU_CHAN");
  });

  it("mã không có trong đoàn nào thì trả 404", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "REVIEW_MEMBER_NOT_FOUND" } });
    const ra = await guiLoi({ member_code: MA, site_id: TRANG_AN, rating: 3, comment: "" });
    expect(ra.status).toBe(404);
  });

  it("hàm chưa được áp thì nói 'sắp mở', không báo lỗi kết nối", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function not found" } });
    const ra = await guiLoi({ member_code: MA, site_id: TRANG_AN, rating: 3, comment: "" });
    expect(ra.status).toBe(503);
    expect(ra.body.error.code).toBe("VISIT_REVIEW_NOT_READY");
  });

  it("từ chối yêu cầu ghi đến từ origin khác", async () => {
    const ra = await guiLoi(
      { member_code: MA, site_id: TRANG_AN, rating: 5, comment: "" },
      { Origin: "https://ke-khac.example" },
    );
    expect(ra.status).toBe(403);
    expect(ra.body.error.code).toBe("VISIT_REVIEW_ORIGIN_REJECTED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("số sao ngoài thang thì dừng ngay ở route, không xuống tới cơ sở dữ liệu", async () => {
    const ra = await guiLoi({ member_code: MA, site_id: TRANG_AN, rating: 9, comment: "" });
    expect(ra.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("GET những lời của chính người cầm mã", () => {
  it("trả danh sách đã đọc sạch hình dạng", async () => {
    rpc.mockResolvedValue({
      data: [
        { site_id: TRANG_AN, rating: 4, comment: "Mát", updated_at: "2026-09-19T04:00:00Z" },
        { site_id: TRANG_AN, rating: 99, comment: "hỏng" },
      ],
      error: null,
    });
    const ra = await docLoi(`?member_code=${MA}`);
    expect(ra.status).toBe(200);
    expect(ra.body.reviews).toHaveLength(1);
  });

  it("mã sai khuôn thì trả 400 mà không gọi cơ sở dữ liệu", async () => {
    const ra = await docLoi("?member_code=khong-phai-ma");
    expect(ra.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
