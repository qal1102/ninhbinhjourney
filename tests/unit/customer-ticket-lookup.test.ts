import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeCustomerOrderCode } from "@/domain/customer-booking";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("@/lib/customer-data/booking-repository", () => {
  class CustomerBookingRepositoryError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  return {
    CustomerBookingRepositoryError,
    isCustomerBookingEnabled: mocks.enabled,
    lookupCustomerOrderTickets: mocks.lookup,
  };
});

import { POST as lookupTickets } from "@/app/api/customer-ticket-lookup/route";

function request(body: unknown, origin = "https://ninhbinhjourney.test") {
  return new Request("https://ninhbinhjourney.test/api/customer-ticket-lookup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin.includes("ninhbinhjourney") ? "same-origin" : "cross-site",
    },
    body: JSON.stringify(body),
  });
}

const goodBody = { order_code: "NBJ-ABCDEF123456", contact: "0912345678" };

describe("TC-23 chuẩn hoá mã đặt chỗ khách gõ lại", () => {
  it("nhận mọi dạng khách chép được từ màn hình", () => {
    for (const raw of [
      "NBJ-ABCDEF123456",
      "nbj-abcdef123456",
      " NBJ ABCDEF123456 ",
      "NBJABCDEF123456",
      "abcdef123456",
      "NBJ–ABCDEF123456",
    ]) {
      expect(normalizeCustomerOrderCode(raw)).toBe("NBJ-ABCDEF123456");
    }
  });

  it("trả null khi không nắn nổi, thay vì đoán bừa một mã", () => {
    for (const raw of ["", "NBJ-", "ABC", "NBJ-ABCDEF12345", "NBJ-ABCDEF1234567", "NBJ-ABCDE!123456"]) {
      expect(normalizeCustomerOrderCode(raw)).toBeNull();
    }
  });
});

describe("TC-23 tuyến tra cứu vé", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
  });

  it("trả vé khi mã đặt chỗ và liên hệ cùng khớp", async () => {
    mocks.lookup.mockResolvedValue({
      found: true,
      throttled: false,
      orderCode: "NBJ-ABCDEF123456",
      productId: "40000000-0000-4000-8000-000000000001",
      visitDate: "2026-09-20",
      partySize: 2,
      adults: 2,
      children: 0,
      totalVnd: 1_780_000,
      currency: "VND",
      paymentMode: "pay-on-site",
      paymentStatus: "pending",
      amountDueVnd: 1_780_000,
      tickets: [
        {
          ticketId: "80000000-0000-4000-8000-000000000001",
          ticketCode: "WEB-ABCDEF123456",
          siteId: "10000000-0000-4000-8000-000000000001",
          validOn: "2026-09-20",
          entriesAllowed: 2,
          entriesUsed: 0,
          guestGroup: "adult",
          status: "issued",
        },
      ],
    });
    const response = await lookupTickets(request(goodBody));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.found).toBe(true);
    expect(payload.order.code).toBe("NBJ-ABCDEF123456");
    expect(payload.payment.amount_due_vnd).toBe(1_780_000);
    expect(payload.tickets[0].ticketCode).toBe("WEB-ABCDEF123456");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("gửi mã đã nắn về khuôn chuẩn xuống kho, không gửi nguyên chuỗi khách gõ", async () => {
    mocks.lookup.mockResolvedValue({ found: false, throttled: false });
    await lookupTickets(request({ order_code: " nbj abcdef123456 ", contact: "0912345678" }));
    expect(mocks.lookup).toHaveBeenCalledWith({
      orderCode: "NBJ-ABCDEF123456",
      contact: "0912345678",
    });
  });

  /**
   * Bài kiểm quan trọng nhất của cả tính năng. Sai mã và sai liên hệ phải ra
   * đúng một câu trả lời: một mã trạng thái, một thân phản hồi, không một chữ
   * nào phân biệt. Tách hai nhánh ấy ra là biến một mã nhặt được thành một
   * cuộc dò số điện thoại.
   */
  it("sai mã và sai liên hệ trả về y hệt nhau", async () => {
    mocks.lookup.mockResolvedValue({ found: false, throttled: false });
    const wrongCode = await lookupTickets(request({ order_code: "NBJ-000000000000", contact: "0912345678" }));
    const wrongContact = await lookupTickets(request({ order_code: "NBJ-ABCDEF123456", contact: "0900000000" }));
    expect(wrongCode.status).toBe(wrongContact.status);
    expect(wrongCode.status).toBe(404);
    expect(await wrongCode.json()).toEqual(await wrongContact.json());
  });

  it("không nhắc tới mã đặt chỗ hay liên hệ trong câu từ chối", async () => {
    mocks.lookup.mockResolvedValue({ found: false, throttled: false });
    const response = await lookupTickets(request(goodBody));
    const payload = await response.json();
    expect(payload.message).not.toMatch(/NBJ-ABCDEF123456|0912345678/);
    expect(payload.message).not.toMatch(/tồn tại|có thật|đúng mã|sai số/i);
    expect(payload).not.toHaveProperty("order");
    expect(payload).not.toHaveProperty("tickets");
  });

  it("báo riêng khi chạm trần số lần thử", async () => {
    mocks.lookup.mockResolvedValue({ found: false, throttled: true });
    const response = await lookupTickets(request(goodBody));
    expect(response.status).toBe(429);
    expect((await response.json()).throttled).toBe(true);
  });

  it("chặn mã sai khuôn ngay tại cửa, không phiền tới kho dữ liệu", async () => {
    const response = await lookupTickets(request({ order_code: "ABC", contact: "0912345678" }));
    expect(response.status).toBe(400);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("đòi đủ hai ô, một mình mã đặt chỗ thì không mở vé", async () => {
    const response = await lookupTickets(request({ order_code: "NBJ-ABCDEF123456" }));
    expect(response.status).toBe(400);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("từ chối yêu cầu khác origin", async () => {
    const response = await lookupTickets(request(goodBody, "https://ke-tan-cong.test"));
    expect(response.status).toBe(403);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("im lặng khi tính năng đặt chỗ đang tắt", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await lookupTickets(request(goodBody));
    expect(response.status).toBe(503);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
