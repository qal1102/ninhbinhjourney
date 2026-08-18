import { describe, expect, it } from "vitest";
import {
  canViewCustomer360,
  customerJourneyIntentSummary,
  customerJourneyItinerarySnapshot,
  customerJourneySourceFromRequest,
} from "@/domain/customer-journey";
import {
  confirmJourneyIntent,
  generateItinerary,
  parseJourneyIntent,
} from "@/domain/journey";

function sampleJourney() {
  const draft = parseJourneyIntent({
    text: "Tôi đi cùng bố mẹ, muốn xem di sản và chụp ảnh trong một ngày.",
    locale: "vi",
  });
  const intent = confirmJourneyIntent({
    draft,
    demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    durationMinutes: 600,
    party: { adults: 2, children: 0, seniors: 1 },
    partyContext: ["travelling-with-parents"],
    pace: "relaxed",
    walkingTolerance: "low",
    budgetVnd: { target: 2_000_000, tolerancePercent: 20 },
    visitDate: "2026-08-15",
  });
  return { intent, itinerary: generateItinerary(intent) };
}

describe("CUS-03 anonymous journey contract", () => {
  it("projects only structured planner signals and omits the raw prompt", () => {
    const { intent, itinerary } = sampleJourney();
    const summary = customerJourneyIntentSummary(intent);
    const snapshot = customerJourneyItinerarySnapshot(itinerary);

    expect(summary).toMatchObject({
      locale: "vi",
      party: { adults: 2, seniors: 1 },
      budget_band: "1m-to-3m",
    });
    expect(JSON.stringify(summary)).not.toContain(intent.rawText);
    expect(JSON.stringify(summary)).not.toContain("accessibilityNeeds");
    expect(JSON.stringify(snapshot)).not.toContain("reason");
    expect(snapshot.items).toHaveLength(itinerary.items.length);
  });

  it("keeps only declared same-origin attribution values", () => {
    const source = customerJourneySourceFromRequest(
      new Request("https://ninhbinhjourney.test/api/journeys", {
        headers: {
          referer:
            "https://ninhbinhjourney.test/plan?utm_source=qr-hoa-lu&utm_medium=offline&ignored=secret",
        },
      }),
    );

    expect(source).toEqual({
      entry_path: "/plan",
      referrer_class: "internal",
      utm_source: "qr-hoa-lu",
      utm_medium: "offline",
    });
  });

  it("rejects contact-shaped attribution before it reaches persistence", () => {
    expect(() =>
      customerJourneySourceFromRequest(
        new Request("https://ninhbinhjourney.test/api/journeys", {
          headers: {
            referer: "https://ninhbinhjourney.test/plan?utm_source=guest%40example.com",
          },
        }),
      ),
    ).toThrow();
  });

  it("limits Customer 360 to the director role", () => {
    expect(canViewCustomer360("director")).toBe(true);
    expect(canViewCustomer360("accountant")).toBe(false);
    expect(canViewCustomer360("employee")).toBe(false);
  });
});
