import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { boHieuDangDung, hieuCauNoi } from "@/lib/erp/tro-ly-hieu";
import type { NguoiTrongDanhBa } from "@/domain/tro-ly-ghi";

const danhBa: NguoiTrongDanhBa[] = [{ id: "staff-hoa", ten: "Nguyễn Thị Hoa", vai: "employee", coSo: ["trang-an"] }];
const bayGio = new Date("2026-10-08T02:00:00Z");

function traLoi(noiDung: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(noiDung) } }] }), { status });
}

describe("trợ lý hiểu câu qua mô hình chuẩn OpenAI", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "khoa-thu");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("chọn tầng theo biến môi trường: Claude trước, rồi AI, rồi luật", () => {
    expect(boHieuDangDung()).toBe("ai");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(boHieuDangDung()).toBe("claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_API_KEY", " ");
    expect(boHieuDangDung()).toBe("luat");
  });

  it("dùng bản nháp mô hình trả về, gọi Gemini mặc định", async () => {
    const fetchGia = vi.fn(async () =>
      traLoi({
        loai: "viec",
        noi_dung: "Kiểm lại áo phao bến Tràng An",
        nguoi_nhan_id: "staff-hoa",
        ten_nghe: "chị Hoa",
        han: "2026-10-09T15:00:00+07:00",
        ngay: "2026-10-08",
        co_so: "trang-an",
        khan: true,
      }),
    );
    vi.stubGlobal("fetch", fetchGia);

    const { banNhap, boHieu } = await hieuCauNoi("nhắc chị Hoa kiểm lại áo phao bến Tràng An 3 giờ chiều mai, gấp", { bayGio, danhBa });

    expect(boHieu).toBe("ai");
    expect(banNhap).toMatchObject({ loai: "viec", nguoiNhanId: "staff-hoa", han: "2026-10-09T08:00:00.000Z", coSo: "trang-an", khan: true });
    const [url, init] = fetchGia.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(JSON.parse(String(init.body)).model).toBe("gemini-3.5-flash-lite");
  });

  it("mô hình lỗi hay trả sai khuôn thì quay về hiểu theo luật", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await hieuCauNoi("ghi chú mai gọi nhà xe", { bayGio, danhBa })).boHieu).toBe("luat");

    vi.stubGlobal("fetch", vi.fn(async () => traLoi({ loai: "sai" })));
    expect((await hieuCauNoi("ghi chú mai gọi nhà xe", { bayGio, danhBa })).boHieu).toBe("luat");
  });

  it("không có khoá thì không gọi ra ngoài", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const fetchGia = vi.fn();
    vi.stubGlobal("fetch", fetchGia);
    expect((await hieuCauNoi("ghi chú mai gọi nhà xe", { bayGio, danhBa })).boHieu).toBe("luat");
    expect(fetchGia).not.toHaveBeenCalled();
  });
});
