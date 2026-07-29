import { describe, expect, it } from "vitest";
import {
  confirmJourneyIntent,
  generateItinerary,
  parseJourneyIntent,
  REQUIRED_VIETNAMESE_SAMPLE,
  revalidateEditedItinerary,
} from "@/domain/journey";
import { DESTINATIONS } from "@/content/destinations";

const ids = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
];

function sampleIntent() {
  const draft = parseJourneyIntent({
    text: REQUIRED_VIETNAMESE_SAMPLE,
    locale: "vi",
  });
  return confirmJourneyIntent({
    draft,
    demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    durationMinutes: draft.durationMinutes ?? 600,
    party: draft.party ?? { adults: 1, children: 0, seniors: 0 },
    partyContext: draft.partyContext ?? [],
    pace: draft.pace ?? "balanced",
    walkingTolerance: draft.walkingTolerance ?? "moderate",
    budgetVnd: draft.budgetVnd,
    visitDate: "2026-08-15",
  });
}

describe("deterministic journey domain", () => {
  it("NBJ-D01 extracts the required Vietnamese sample", () => {
    const draft = parseJourneyIntent({
      text: REQUIRED_VIETNAMESE_SAMPLE,
      locale: "vi",
    });

    expect(draft.durationMinutes).toBe(600);
    expect(draft.party).toEqual({ adults: 3, children: 0, seniors: 0 });
    expect(draft.partyContext).toEqual(["travelling-with-parents"]);
    expect(draft.pace).toBe("relaxed");
    expect(draft.walkingTolerance).toBe("low");
    expect(draft.budgetVnd).toEqual({
      target: 2_000_000,
      tolerancePercent: 20,
    });
  });

  it("NBJ-D02 does not fabricate unsupported intent fields", () => {
    const draft = parseJourneyIntent({
      text: "Tôi muốn ngắm thiên nhiên ở Ninh Bình.",
      locale: "vi",
    });

    expect(draft.interests).toEqual(["nature"]);
    expect(draft.durationMinutes).toBeUndefined();
    expect(draft.party).toBeUndefined();
    expect(draft.pace).toBeUndefined();
    expect(draft.walkingTolerance).toBeUndefined();
    expect(draft.budgetVnd).toBeUndefined();
    expect(draft.accessibilityNeeds).toEqual([]);
  });

  it("does not infer accessibility needs from travelling with parents", () => {
    const draft = parseJourneyIntent({
      text: "Tôi đi cùng bố mẹ và muốn xem di sản.",
      locale: "vi",
    });

    expect(draft.partyContext).toContain("travelling-with-parents");
    expect(draft.walkingTolerance).toBeUndefined();
    expect(draft.accessibilityNeeds).toEqual([]);
  });

  it("NBJ-D03 generates only configured site IDs", () => {
    let index = 0;
    const itinerary = generateItinerary(sampleIntent(), {
      idFactory: () => ids[index++],
    });
    const configured = new Set(DESTINATIONS.map((item) => item.id));

    expect(itinerary.items.length).toBeGreaterThan(0);
    for (const item of itinerary.items) {
      expect(configured.has(item.siteId)).toBe(true);
    }
  });

  it("NBJ-D04 never exceeds the confirmed duration", () => {
    let index = 0;
    const intent = sampleIntent();
    const itinerary = generateItinerary(intent, {
      idFactory: () => ids[index++],
    });

    expect(itinerary.validation.valid).toBe(true);
    expect(itinerary.totalMinutes).toBeLessThanOrEqual(intent.durationMinutes);
  });

  it("NBJ-D05 revalidation catches a closed or unavailable site", () => {
    let index = 0;
    const intent = sampleIntent();
    const itinerary = generateItinerary(intent, {
      idFactory: () => ids[index++],
    });
    const closedSiteId = itinerary.items[0].siteId;
    const result = revalidateEditedItinerary({
      itinerary,
      intent,
      unavailableSiteIds: new Set([closedSiteId]),
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SITE_UNAVAILABLE",
          itemId: itinerary.items[0].id,
        }),
      ]),
    );
  });
});
