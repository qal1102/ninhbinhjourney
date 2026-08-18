import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), enabled: vi.fn(), submit: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/customer-data/identity-repository", () => {
  class CustomerIdentityRepositoryError extends Error {
    constructor(message: string, readonly code: string) { super(message); }
  }
  return {
    CustomerIdentityRepositoryError,
    isCustomerIdentityCollectionEnabled: mocks.enabled,
    submitCustomerContact: mocks.submit,
  };
});

import { POST } from "@/app/api/customer-contact/route";

const payload = {
  request_id: "10000000-0000-4000-8000-000000000001",
  journey_id: "10000000-0000-4000-8000-000000000002",
  contact: "guest@example.com",
  marketing_communications: false,
};

function request(origin = "https://ninhbinhjourney.test", requestBody: unknown = payload) {
  return new Request("https://ninhbinhjourney.test/api/customer-contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "sec-fetch-site": origin.includes("ninhbinhjourney") ? "same-origin" : "cross-site" },
    body: JSON.stringify(requestBody),
  });
}

describe("POST /api/customer-contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "10000000-0000-4000-8000-000000000003" }) });
    mocks.submit.mockResolvedValue({
      requestId: payload.request_id,
      deliveryStatus: "staged",
      contactType: "email",
      marketingStatus: "denied",
      marketingPolicyVersion: "staged-marketing-v1",
      duplicate: false,
    });
  });

  it("requires the HttpOnly journey identity instead of trusting a profile id", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      accepted: true,
      duplicate: false,
      request_id: payload.request_id,
      delivery_status: "staged",
      contact_type: "email",
      marketing_status: "denied",
      marketing_policy_version: "staged-marketing-v1",
    });
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      anonymousId: "10000000-0000-4000-8000-000000000003",
      contact: "guest@example.com",
      marketingCommunications: false,
    }));
    expect(JSON.stringify(responseBody)).not.toContain("guest@example.com");
  });

  it("does not collect contact while the feature flag is off", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("requires an existing anonymous journey cookie", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("rejects cross-origin contact writes", async () => {
    const response = await POST(request("https://attacker.test"));
    expect(response.status).toBe(403);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("enforces the body limit even without a trusted content-length header", async () => {
    const response = await POST(request("https://ninhbinhjourney.test", { ...payload, padding: "x".repeat(9_000) }));
    expect(response.status).toBe(413);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
