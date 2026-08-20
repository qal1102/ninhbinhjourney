import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  enabled: vi.fn(),
  create: vi.fn(),
  recommendationsEnabled: vi.fn(),
  refreshRecommendations: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/customer-data/journey-repository", () => {
  class CustomerJourneyRepositoryError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
      this.name = "CustomerJourneyRepositoryError";
    }
  }
  return {
    CustomerJourneyRepositoryError,
    isCustomerJourneyPersistenceEnabled: mocks.enabled,
    createAnonymousCustomerJourney: mocks.create,
  };
});
vi.mock("@/lib/customer-data/recommendation-repository", () => ({
  isCustomerRecommendationsEnabled: mocks.recommendationsEnabled,
  refreshCustomerRecommendations: mocks.refreshRecommendations,
}));

import { POST } from "@/app/api/journeys/route";
import { CustomerJourneyRepositoryError } from "@/lib/customer-data/journey-repository";

const payload = {
  text: "Tôi đi cùng bố mẹ, muốn xem di sản và chụp ảnh trong một ngày.",
  locale: "vi",
  durationMinutes: 600,
  party: { adults: 2, children: 0, seniors: 1 },
  partyContext: ["travelling-with-parents"],
  pace: "relaxed",
  walkingTolerance: "low",
  budgetVnd: { target: 2_000_000, tolerancePercent: 20 },
  visitDate: "2026-08-15",
};

function request(origin = "https://ninhbinhjourney.test") {
  return new Request("https://ninhbinhjourney.test/api/journeys", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin === "https://ninhbinhjourney.test" ? "same-origin" : "cross-site",
      referer: "https://ninhbinhjourney.test/plan?utm_source=official-qr",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/journeys CUS-03 persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    mocks.enabled.mockReturnValue(true);
    mocks.recommendationsEnabled.mockReturnValue(false);
    mocks.create.mockResolvedValue({
      journeyId: "10000000-0000-4000-8000-000000000001",
      profileId: "10000000-0000-4000-8000-000000000002",
      inserted: true,
    });
  });

  it("persists a first-party anonymous planner result without returning a profile id", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      persisted: true,
      persistence: "anonymous",
    });
    expect(response.headers.get("set-cookie")).toContain("nbj-customer-journey-anonymous-id=");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      sourceContext: { utm_source: "official-qr", referrer_class: "internal" },
    });
    expect(JSON.stringify(mocks.create.mock.calls[0][0])).not.toContain(payload.text);
  });

  it("does not turn on persistence when its feature flag is off", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await POST(request("https://attacker.test"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      persisted: false,
      persistence: "browser",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin anonymous write", async () => {
    const response = await POST(request("https://attacker.test"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CUSTOMER_JOURNEY_ORIGIN_REJECTED" },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("maps journey ID collisions without exposing the database error", async () => {
    mocks.create.mockRejectedValue(
      new CustomerJourneyRepositoryError("collision", "ID_COLLISION"),
    );
    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CUSTOMER_JOURNEY_PERSISTENCE_FAILED" },
    });
  });
});
