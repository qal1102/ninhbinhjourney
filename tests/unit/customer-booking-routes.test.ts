import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  enabled: vi.fn(),
  createHold: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/customer-data/booking-repository", () => {
  class CustomerBookingRepositoryError extends Error {
    constructor(message: string, readonly code: string) { super(message); }
  }
  return {
    CustomerBookingRepositoryError,
    isCustomerBookingEnabled: mocks.enabled,
    createCustomerBookingHold: mocks.createHold,
    confirmCustomerSimulatedBooking: mocks.confirm,
  };
});

import { POST as createHold } from "@/app/api/customer-booking-holds/route";
import { POST as confirmBooking } from "@/app/api/customer-booking-confirmations/route";

const anonymousId = "20000000-0000-4000-8000-000000000001";
const holdBody = {
  request_id: "10000000-0000-4000-8000-000000000001",
  anonymous_id: anonymousId,
  product_id: "40000000-0000-4000-8000-000000000001",
  visit_date: "2026-08-21",
  party_size: 2,
};

function request(path: string, body: unknown, origin = "https://ninhbinhjourney.test") {
  return new Request(`https://ninhbinhjourney.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin.includes("ninhbinhjourney") ? "same-origin" : "cross-site",
    },
    body: JSON.stringify(body),
  });
}

describe("CUS-06 booking routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    mocks.createHold.mockResolvedValue({
      orderId: "50000000-0000-4000-8000-000000000001",
      orderCode: "NBJ-ABCDEF123456",
      holdId: "60000000-0000-4000-8000-000000000001",
      holdStatus: "active",
      expiresAt: "2026-08-20T09:15:00.000Z",
      totalVnd: 1_780_000,
      currency: "VND",
      slots: [],
      duplicate: false,
    });
    mocks.confirm.mockResolvedValue({
      orderId: "50000000-0000-4000-8000-000000000001",
      orderCode: "NBJ-ABCDEF123456",
      orderStatus: "confirmed",
      paymentAttemptId: "70000000-0000-4000-8000-000000000001",
      paymentStatus: "succeeded",
      tickets: [{ ticketCode: "WEB-ABCDEF123456", entriesAllowed: 2 }],
      duplicate: false,
    });
  });

  it("fails closed and rejects cross-origin writes", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await createHold(request("/api/customer-booking-holds", holdBody))).status).toBe(503);
    mocks.enabled.mockReturnValue(true);
    expect((await createHold(request("/api/customer-booking-holds", holdBody, "https://attacker.test"))).status).toBe(403);
    expect(mocks.createHold).not.toHaveBeenCalled();
  });

  it("creates the anonymous profile boundary and sets an HttpOnly cookie", async () => {
    const response = await createHold(request("/api/customer-booking-holds", holdBody));
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain(`${anonymousId};`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.createHold).toHaveBeenCalledWith(expect.objectContaining({
      requestId: holdBody.request_id,
      anonymousId,
      partySize: 2,
    }));
  });

  it("uses the established cookie instead of allowing a body identity swap", async () => {
    const cookieAnonymousId = "20000000-0000-4000-8000-000000000002";
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: cookieAnonymousId }) });
    await createHold(request("/api/customer-booking-holds", holdBody));
    expect(mocks.createHold).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: cookieAnonymousId }));
  });

  it("confirms only against the HttpOnly anonymous cookie", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: anonymousId }) });
    const response = await confirmBooking(request("/api/customer-booking-confirmations", {
      payment_request_id: "30000000-0000-4000-8000-000000000001",
      hold_id: "60000000-0000-4000-8000-000000000001",
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      payment: { status: "succeeded", mode: "simulation" },
      tickets: [{ ticketCode: "WEB-ABCDEF123456", entriesAllowed: 2 }],
    });
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ anonymousId }));
  });
});
