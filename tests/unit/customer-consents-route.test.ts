import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), enabled: vi.fn(), record: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/customer-data/identity-repository", () => {
  class CustomerIdentityRepositoryError extends Error {
    constructor(message: string, readonly code: string) { super(message); }
  }
  return {
    CustomerIdentityRepositoryError,
    isCustomerConsentManagementEnabled: mocks.enabled,
    recordCustomerPreferences: mocks.record,
  };
});

import { POST } from "@/app/api/customer-consents/route";

const body = {
  anonymous_id: "10000000-0000-4000-8000-000000000001",
  product_analytics: true,
  marketing_communications: false,
};

function request(origin = "https://ninhbinhjourney.test", requestBody: unknown = body) {
  return new Request("https://ninhbinhjourney.test/api/customer-consents", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "sec-fetch-site": origin.includes("ninhbinhjourney") ? "same-origin" : "cross-site" },
    body: JSON.stringify(requestBody),
  });
}

describe("POST /api/customer-consents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    mocks.record.mockResolvedValue({
      product_analytics: "granted",
      marketing_communications: "denied",
      policy_version: "staged-analytics-v1",
      marketing_policy_version: "staged-marketing-v1",
      inserted: true,
    });
  });

  it("fails closed while server-side consent is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("records separate preferences and establishes the HttpOnly anonymous cookie", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      consent: { product_analytics: "granted", marketing_communications: "denied" },
    });
    expect(response.headers.get("set-cookie")).toContain("nbj-customer-journey-anonymous-id=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      anonymousId: body.anonymous_id,
      productAnalytics: true,
      marketingCommunications: false,
    }));
  });

  it("rejects cross-origin preference writes", async () => {
    const response = await POST(request("https://attacker.test"));
    expect(response.status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("enforces the body limit even without a trusted content-length header", async () => {
    const response = await POST(request("https://ninhbinhjourney.test", { ...body, padding: "x".repeat(9_000) }));
    expect(response.status).toBe(413);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
