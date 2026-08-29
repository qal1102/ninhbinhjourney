import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  enabled: vi.fn(),
  createHold: vi.fn(),
  confirm: vi.fn(),
  listSlots: vi.fn(),
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
    listCustomerProductSlots: mocks.listSlots,
  };
});

import { POST as createHold } from "@/app/api/customer-booking-holds/route";
import { POST as confirmBooking } from "@/app/api/customer-booking-confirmations/route";
import { GET as listSlots } from "@/app/api/customer-booking-slots/route";

const anonymousId = "20000000-0000-4000-8000-000000000001";
const slotStartsAt = "2026-08-22T02:00:00.000Z";
const holdBody = {
  request_id: "10000000-0000-4000-8000-000000000001",
  anonymous_id: anonymousId,
  product_id: "40000000-0000-4000-8000-000000000001",
  visit_date: "2026-08-21",
  party_size: 2,
  slot_starts_at: slotStartsAt,
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

function getRequest(path: string) {
  return new Request(`https://ninhbinhjourney.test${path}`, { method: "GET" });
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
    mocks.listSlots.mockResolvedValue([
      {
        siteId: "10000000-0000-4000-8000-000000000001",
        departureStartsAt: slotStartsAt,
        localStartTime: "09:00:00",
        startsAt: slotStartsAt,
        endsAt: "2026-08-22T04:00:00.000Z",
        effectiveCapacity: 40,
        reserved: 10,
        remaining: 30,
        capacitySourceKind: "estimate",
        slotStatus: "open",
      },
    ]);
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
      slotStartsAt,
    }));
  });

  it("TC-02: rejects a hold with no chosen time slot", async () => {
    const { slot_starts_at: _omitted, ...bodyWithoutSlot } = holdBody;
    void _omitted;
    const response = await createHold(request("/api/customer-booking-holds", bodyWithoutSlot));
    expect(response.status).toBe(400);
    expect(mocks.createHold).not.toHaveBeenCalled();
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

  it("TC-02: lists and merges slots across sites of the same package", async () => {
    mocks.listSlots.mockResolvedValue([
      {
        siteId: "10000000-0000-4000-8000-000000000001",
        departureStartsAt: slotStartsAt,
        localStartTime: "09:00:00",
        startsAt: slotStartsAt,
        endsAt: "2026-08-22T04:00:00.000Z",
        effectiveCapacity: 40,
        reserved: 10,
        remaining: 30,
        capacitySourceKind: "estimate",
        slotStatus: "open",
      },
      {
        siteId: "10000000-0000-4000-8000-000000000002",
        departureStartsAt: slotStartsAt,
        localStartTime: "09:00:00",
        startsAt: slotStartsAt,
        endsAt: "2026-08-22T04:00:00.000Z",
        effectiveCapacity: 40,
        reserved: 35,
        remaining: 5,
        capacitySourceKind: "measured",
        slotStatus: "open",
      },
    ]);
    const response = await listSlots(getRequest(
      "/api/customer-booking-slots?product_id=40000000-0000-4000-8000-000000000001&visit_date=2026-08-22",
    ));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.slots).toEqual([
      expect.objectContaining({
        startsAt: slotStartsAt,
        remaining: 5,
        capacitySourceKind: "estimate",
        bookable: true,
        siteIds: [
          "10000000-0000-4000-8000-000000000001",
          "10000000-0000-4000-8000-000000000002",
        ],
      }),
    ]);
  });

  it("TC-02: fails closed on bad slot query input and disabled flag", async () => {
    const badInput = await listSlots(getRequest("/api/customer-booking-slots?product_id=not-a-uuid&visit_date=2026-08-22"));
    expect(badInput.status).toBe(400);
    expect(mocks.listSlots).not.toHaveBeenCalled();

    mocks.enabled.mockReturnValue(false);
    const disabled = await listSlots(getRequest(
      "/api/customer-booking-slots?product_id=40000000-0000-4000-8000-000000000001&visit_date=2026-08-22",
    ));
    expect(disabled.status).toBe(503);
  });
});
