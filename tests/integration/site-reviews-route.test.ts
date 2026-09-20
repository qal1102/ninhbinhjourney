import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TC-12 — GET `/api/site-reviews`.
 *
 * Đường công khai duy nhất của bảng điểm. Hai điều bài này canh: nó không bao
 * giờ để lọt một thứ lần ra được người viết, và nó không bao giờ dựng một khối
 * lỗi giữa trang điểm đến khi kho chưa sẵn sàng.
 */

vi.mock("server-only", () => ({}));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

const TRANG_AN = "10000000-0000-4000-8000-000000000001";

async function goi(query: string) {
  const { GET } = await import("@/app/api/site-reviews/route");
  const response = await GET(new Request(`http://127.0.0.1/api/site-reviews${query}`));
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

describe("bảng điểm công khai từng nơi", () => {
  it("trả số đếm, điểm trung bình và vài lời gần đây", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          site_id: TRANG_AN,
          so_luot: 12,
          diem_trung_binh: 4.58,
          pho_diem: { "1": 0, "2": 1, "3": 1, "4": 2, "5": 8 },
          loi_gan_day: [{ rating: 5, comment: "Đi sớm thì thuyền vắng", created_at: "2026-09-19T01:00:00Z" }],
        },
      ],
      error: null,
    });
    const ra = await goi(`?site_id=${TRANG_AN}`);
    expect(ra.status).toBe(200);
    expect(ra.body.summaries[0].count).toBe(12);
    expect(ra.body.summaries[0].recentVoices).toHaveLength(1);
  });

  it("không để lọt tên, mã hay giờ vào cổng của ai", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          site_id: TRANG_AN,
          so_luot: 3,
          diem_trung_binh: 4,
          pho_diem: { "5": 3 },
          loi_gan_day: [{ rating: 5, comment: "Hay", created_at: "2026-09-19T01:00:00Z" }],
          display_name: "Nguyễn Thị B",
          member_code: "TV-AB12CD34EF",
          scanned_at: "2026-09-19T01:00:00Z",
        },
      ],
      error: null,
    });
    const ra = await goi(`?site_id=${TRANG_AN}`);
    const chuoi = JSON.stringify(ra.body);
    expect(chuoi).not.toContain("Nguyễn Thị B");
    expect(chuoi).not.toContain("TV-AB12CD34EF");
    expect(chuoi).not.toContain("scanned_at");
  });

  it("hàm chưa được áp thì trả danh sách rỗng, không dựng khối lỗi", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const ra = await goi(`?site_id=${TRANG_AN}`);
    expect(ra.status).toBe(200);
    expect(ra.body.summaries).toEqual([]);
  });

  it("mã nơi sai khuôn thì trả 400 mà không gọi cơ sở dữ liệu", async () => {
    const ra = await goi("?site_id=khong-phai-uuid");
    expect(ra.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hỏi quá hai mươi nơi một lượt thì từ chối", async () => {
    const query = Array.from({ length: 21 }, () => `site_id=${TRANG_AN}`).join("&");
    const ra = await goi(`?${query}`);
    expect(ra.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("giữ bản sao ở biên, vì bảng điểm chậm vài phút không hại ai", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const ra = await goi(`?site_id=${TRANG_AN}`);
    expect(ra.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
