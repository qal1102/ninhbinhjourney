import { describe, expect, it } from "vitest";
import { DAU_TRANG_BAO_MAT, dungCsp, laLenhTuTrangKhac, nhomGioiHan } from "@/domain/bao-mat";

function headers(gt: Record<string, string>) {
  return { get: (ten: string) => gt[ten.toLowerCase()] ?? null };
}

const GOC = "https://ninhbinhjourney.vercel.app";

describe("CSP", () => {
  const csp = dungCsp({ nonce: "abc123", dangPhatTrien: false, supabaseUrl: "https://xyz.supabase.co", nangHttps: true });
  const chiThi = (ten: string) => csp.split("; ").find((d) => d.startsWith(`${ten} `)) ?? "";

  it("script chỉ chạy khi mang nonce, không unsafe-inline hay unsafe-eval", () => {
    expect(chiThi("script-src")).toContain("'nonce-abc123'");
    expect(chiThi("script-src")).toContain("'strict-dynamic'");
    expect(chiThi("script-src")).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it("next dev mới được unsafe-eval", () => {
    const dev = dungCsp({ nonce: "n", dangPhatTrien: true, nangHttps: false });
    expect(dev).toContain("'unsafe-eval'");
  });

  it("chặn plugin, base, khung nhúng ngược và form gửi ra ngoài", () => {
    expect(chiThi("object-src")).toBe("object-src 'none'");
    expect(chiThi("base-uri")).toBe("base-uri 'self'");
    expect(chiThi("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(chiThi("form-action")).toBe("form-action 'self'");
  });

  it("chỉ gọi ra Supabase (https và wss) và nguồn bản đồ", () => {
    expect(chiThi("connect-src")).toContain("https://xyz.supabase.co");
    expect(chiThi("connect-src")).toContain("wss://xyz.supabase.co");
    expect(chiThi("connect-src")).not.toMatch(/\*|https:(?!\/\/)/);
  });

  it("nâng https chỉ khi bật, và luôn báo vi phạm về máy chủ", () => {
    expect(csp).toContain("upgrade-insecure-requests");
    expect(dungCsp({ nonce: "n", dangPhatTrien: false, nangHttps: false })).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("report-uri /api/bao-cao-csp");
  });

  it("bỏ qua địa chỉ Supabase hỏng thay vì nhét chữ lạ vào CSP", () => {
    const c = dungCsp({ nonce: "n", dangPhatTrien: false, supabaseUrl: "javascript:alert(1)", nangHttps: false });
    expect(c).not.toContain("javascript");
  });
});

describe("đầu trang cố định", () => {
  const theo = (ten: string) => DAU_TRANG_BAO_MAT.find((h) => h.key === ten)?.value ?? "";

  it("có HSTS hai năm, nosniff, chặn nhúng khung", () => {
    expect(theo("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(theo("X-Content-Type-Options")).toBe("nosniff");
    expect(theo("X-Frame-Options")).toBe("DENY");
  });

  it("chỉ cho trang này dùng máy ảnh, micro, định vị; tắt thanh toán và cổng phần cứng", () => {
    const p = theo("Permissions-Policy");
    for (const quyen of ["camera=(self)", "microphone=(self)", "geolocation=(self)", "payment=()", "usb=()"]) {
      expect(p).toContain(quyen);
    }
  });
});

describe("nhóm giới hạn lượt gọi", () => {
  it("chỉ áp cho lệnh ghi vào /api", () => {
    expect(nhomGioiHan("/api/customer-booking-holds", "GET")).toBeNull();
    expect(nhomGioiHan("/erp", "POST")).toBeNull();
    expect(nhomGioiHan("/api/customer-booking-holds", "POST")?.ten).toBe("dat-cho");
  });

  it("AI chặt nhất, sự kiện trang rộng nhất, ERP rộng cho nhân viên chung mạng", () => {
    expect(nhomGioiHan("/api/hoi-dap", "POST")?.toiDa).toBeLessThanOrEqual(40);
    expect(nhomGioiHan("/api/erp/assistant", "POST")?.ten).toBe("ai");
    expect(nhomGioiHan("/api/customer-events", "POST")?.toiDa).toBeGreaterThanOrEqual(300);
    expect(nhomGioiHan("/api/erp/tro-chuyen/abc", "POST")?.ten).toBe("erp");
  });

  it("ô nhận số điện thoại vào nhóm chống dò số", () => {
    for (const d of ["/api/customer-ticket-lookup", "/api/khach-than-thiet", "/api/thi-anh"]) {
      expect(nhomGioiHan(d, "POST")?.ten, d).toBe("tra-so");
    }
  });

  it("API chưa liệt kê vẫn có hạn mức mặc định", () => {
    expect(nhomGioiHan("/api/moi-them", "PATCH")?.ten).toBe("api");
  });
});

describe("lệnh ghi từ trang khác", () => {
  const HOST = "ninhbinhjourney.vercel.app";

  it("chặn Origin lạ, Origin null và Sec-Fetch-Site cross-site", () => {
    expect(laLenhTuTrangKhac(headers({ host: HOST, origin: "https://ke-xau.example" }))).toBe(true);
    expect(laLenhTuTrangKhac(headers({ host: HOST, origin: "null" }))).toBe(true);
    expect(laLenhTuTrangKhac(headers({ host: HOST, "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(laLenhTuTrangKhac(headers({ host: HOST, "sec-fetch-site": "same-site", origin: GOC }))).toBe(true);
    expect(laLenhTuTrangKhac(headers({ host: HOST, origin: "https://ninhbinhjourney.vercel.app.ke-xau.example" }))).toBe(true);
  });

  it("cho trang này (kể cả sau proxy) và máy không phải trình duyệt", () => {
    expect(laLenhTuTrangKhac(headers({ host: HOST, origin: GOC, "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(laLenhTuTrangKhac(headers({ host: "noi-bo:3000", "x-forwarded-host": HOST, origin: GOC }))).toBe(false);
    expect(laLenhTuTrangKhac(headers({ host: HOST }))).toBe(false);
  });
});
