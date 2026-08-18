import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  ingest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/customer-data/event-repository", () => {
  class CustomerEventRepositoryError extends Error {
    constructor(
      message: string,
      readonly code: string,
    ) {
      super(message);
      this.name = "CustomerEventRepositoryError";
    }
  }

  return {
    CustomerEventRepositoryError,
    isCustomerEventIngestionEnabled: mocks.enabled,
    ingestCustomerEvent: mocks.ingest,
  };
});

import { POST } from "@/app/api/customer-events/route";
import { CustomerEventRepositoryError } from "@/lib/customer-data/event-repository";

const payload = {
  event_id: "10000000-0000-4000-8000-000000000001",
  event_name: "page_viewed",
  schema_version: 1,
  occurred_at: "2026-08-18T06:00:00.000Z",
  anonymous_id: "10000000-0000-4000-8000-000000000002",
  session_id: "10000000-0000-4000-8000-000000000003",
  page_view_id: "10000000-0000-4000-8000-000000000004",
  source_context: { utm_source: "official-page" },
  consent_snapshot: {
    product_analytics: "granted",
    policy_version: "analytics-v1",
  },
  properties: {
    page_path: "/",
    page_type: "landing",
    referrer_class: "direct",
  },
};

function request(body: unknown, origin = "https://ninhbinhjourney.test") {
  return new Request("https://ninhbinhjourney.test/api/customer-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin === "https://ninhbinhjourney.test" ? "same-origin" : "cross-site",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/customer-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.ingest.mockResolvedValue({ eventId: payload.event_id, inserted: true });
  });

  it("fails closed until the server feature flag is enabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await POST(request(payload));
    expect(response.status).toBe(503);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes", async () => {
    const response = await POST(request(payload, "https://attacker.test"));
    expect(response.status).toBe(403);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("rejects payloads outside the tracking contract", async () => {
    const response = await POST(
      request({
        ...payload,
        properties: { ...payload.properties, visitor_email: "a@example.com" },
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("accepts a new event without exposing the internal profile", async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      eventId: payload.event_id,
      duplicate: false,
    });
    expect(mocks.ingest).toHaveBeenCalledOnce();
  });

  it("returns an idempotent duplicate as success", async () => {
    mocks.ingest.mockResolvedValue({ eventId: payload.event_id, inserted: false });
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      duplicate: true,
    });
  });

  it("maps an ID collision without leaking database errors", async () => {
    mocks.ingest.mockRejectedValue(
      new CustomerEventRepositoryError("collision", "ID_COLLISION"),
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      accepted: false,
      error: { code: "CUSTOMER_EVENT_ID_COLLISION" },
    });
  });
});
