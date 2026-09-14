import { describe, expect, it } from "vitest";
import {
  LOGIN_THROTTLE_LIMITS,
  LOGIN_THROTTLE_WINDOW_MS,
  decideLoginThrottle,
  loginLockedMessage,
  normalizeLoginIdentifier,
} from "@/domain/erp-login-throttle";

const BAY_GIO = Date.parse("2026-09-14T08:00:00Z");
const phutTruoc = (phut: number) => BAY_GIO - phut * 60_000;

describe("QA-P2-09 — chặn dò mật khẩu", () => {
  it("chưa sai lần nào, hoặc sai dưới trần, thì cho thử", () => {
    expect(decideLoginThrottle({}, BAY_GIO)).toEqual({ allowed: true });
    expect(decideLoginThrottle({ "account-ip": [1, 2, 3, 4].map(phutTruoc) }, BAY_GIO)).toEqual({ allowed: true });
  });

  it("sai 5 lần trên một máy cho một tài khoản thì khoá, mở lại khi lần sai cũ nhất rơi khỏi 15 phút", () => {
    const ketQua = decideLoginThrottle({ "account-ip": [1, 2, 3, 4, 5].map(phutTruoc) }, BAY_GIO);
    // Lần sai thứ 5 tính từ mới nhất là 5 phút trước, nên còn 10 phút.
    expect(ketQua).toEqual({ allowed: false, scope: "account-ip", retryAfterMinutes: 10 });
  });

  it("lần sai cũ hơn 15 phút không tính", () => {
    const ketQua = decideLoginThrottle({ "account-ip": [1, 2, 3, 4, 16, 20].map(phutTruoc) }, BAY_GIO);
    expect(ketQua.allowed).toBe(true);
  });

  it("một máy dò nhiều tài khoản, và nhiều máy dò một tài khoản, đều bị chặn ở trần riêng", () => {
    const hai = Array.from({ length: LOGIN_THROTTLE_LIMITS.ip }, (_, i) => phutTruoc(i % 14));
    expect(decideLoginThrottle({ ip: hai }, BAY_GIO)).toMatchObject({ allowed: false, scope: "ip" });
    const ba = Array.from({ length: LOGIN_THROTTLE_LIMITS.account }, () => phutTruoc(2));
    expect(decideLoginThrottle({ account: ba }, BAY_GIO)).toMatchObject({ allowed: false, scope: "account" });
    // Trần tài khoản để cao: 20 lần sai rải nhiều máy chưa khoá chân chủ tài khoản.
    expect(decideLoginThrottle({ account: hai }, BAY_GIO).allowed).toBe(true);
  });

  it("chạm nhiều trần thì chờ theo trần mở muộn nhất", () => {
    const ketQua = decideLoginThrottle(
      {
        "account-ip": [1, 1, 1, 1, 1].map(phutTruoc),
        ip: Array.from({ length: 20 }, () => phutTruoc(1)),
      },
      BAY_GIO,
    );
    expect(ketQua).toMatchObject({ allowed: false, retryAfterMinutes: 14 });
  });

  it("mốc hỏng hay mốc ở tương lai xa không lọt thành một lần sai", () => {
    const ketQua = decideLoginThrottle(
      { "account-ip": [Number.NaN, BAY_GIO + LOGIN_THROTTLE_WINDOW_MS, phutTruoc(1), phutTruoc(2), phutTruoc(3), phutTruoc(4)] },
      BAY_GIO,
    );
    expect(ketQua.allowed).toBe(true);
  });

  it("tên đăng nhập không phân biệt hoa thường, để GIAMDOC và giamdoc chung một bộ đếm", () => {
    expect(normalizeLoginIdentifier("  GiamDoc ")).toBe("giamdoc");
  });

  it("câu báo khoá là tiếng Việt, số phút luôn nằm trong 1 tới 15", () => {
    expect(loginLockedMessage(12)).toContain("12 phút");
    expect(loginLockedMessage(Number.NaN)).toContain("15 phút");
    expect(loginLockedMessage(900)).toContain("15 phút");
    expect(loginLockedMessage(0)).toContain("1 phút");
  });
});
