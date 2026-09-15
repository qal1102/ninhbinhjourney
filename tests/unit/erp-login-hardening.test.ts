import { afterEach, describe, expect, it, vi } from "vitest";
import { LOGIN_UNKNOWN_CLIENT, resolveLoginClientIp } from "@/domain/erp-login-throttle";
import { resolveDemoPassword } from "@/lib/erp/demo-data";

/*
 * A15-ACC-02 — audit 15/09/2026 (LOI-05, TK-08).
 */

function headersOf(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("A15-ACC-02 — địa chỉ máy dùng để đếm lượt đăng nhập sai", () => {
  it("ngoài Vercel không tin header khách tự gửi, kể cả khi có đủ ba header", () => {
    const h = headersOf({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "203.0.113.8",
      "x-vercel-forwarded-for": "203.0.113.9",
    });
    expect(resolveLoginClientIp(h, false)).toBe(LOGIN_UNKNOWN_CLIENT);
  });

  it("trên Vercel đọc x-vercel-forwarded-for trước, rồi x-real-ip, rồi x-forwarded-for", () => {
    expect(
      resolveLoginClientIp(
        headersOf({ "x-vercel-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2", "x-forwarded-for": "198.51.100.3" }),
        true,
      ),
    ).toBe("198.51.100.1");
    expect(resolveLoginClientIp(headersOf({ "x-real-ip": " 198.51.100.2 ", "x-forwarded-for": "198.51.100.3" }), true)).toBe(
      "198.51.100.2",
    );
    expect(resolveLoginClientIp(headersOf({ "x-forwarded-for": "198.51.100.3, 10.0.0.1" }), true)).toBe("198.51.100.3");
  });

  it("trên Vercel mà không có header nào thì cũng coi như không rõ máy", () => {
    expect(resolveLoginClientIp(headersOf({ "x-forwarded-for": " , " }), true)).toBe(LOGIN_UNKNOWN_CLIENT);
  });
});

describe("A15-ACC-02 — chuỗi mật khẩu mặc định trong repo công khai", () => {
  afterEach(() => vi.restoreAllMocks());

  it("biến môi trường có giá trị thì dùng đúng giá trị đó, không cắt khoảng trắng", () => {
    expect(resolveDemoPassword("ERP_DEMO_X", "Mat khau that ", "Mac@dinh", true)).toBe("Mat khau that ");
    expect(resolveDemoPassword("ERP_DEMO_X", "Mat khau that", "Mac@dinh", false)).toBe("Mat khau that");
  });

  it("chạy cục bộ thiếu biến thì dùng chuỗi mặc định để bộ kiểm cục bộ còn đăng nhập được", () => {
    expect(resolveDemoPassword("ERP_DEMO_X", undefined, "Mac@dinh", false)).toBe("Mac@dinh");
  });

  it("trên Vercel thiếu biến, hoặc biến rỗng, thì khoá vai đó và ghi lỗi máy chủ — không rơi về chuỗi công khai", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(resolveDemoPassword("ERP_DEMO_X", undefined, "Mac@dinh", true)).toBe("");
    expect(resolveDemoPassword("ERP_DEMO_X", "   ", "Mac@dinh", true)).toBe("");
    expect(log).toHaveBeenCalledTimes(2);
    expect(String(log.mock.calls[0][0])).toContain("ERP_DEMO_X");
    expect(String(log.mock.calls[0][0])).not.toContain("Mac@dinh");
  });
});
