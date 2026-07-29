import { describe, expect, it } from "vitest";
import {
  parseIncidentDraft,
  REQUIRED_INCIDENT_SAMPLE,
} from "@/domain/incident";

describe("incident draft parser", () => {
  it("NBJ-D11 creates an editable human-confirmed draft from the required sample", () => {
    const draft = parseIncidentDraft({
      id: "draft-1",
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      text: REQUIRED_INCIDENT_SAMPLE,
    });

    expect(draft.humanConfirmationRequired).toBe(true);
    expect(draft.siteId).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(draft.category).toBe("crowd-capacity");
    expect(draft.suggestedSeverity).toBe("P3");
    expect(draft.waitTimeMinutes).toBe(20);
    expect(draft.resourceRequest).toEqual({
      resourceType: "queue-support-staff",
      quantity: 3,
    });
    expect(draft.sopId).toBe(
      "50000000-0000-4000-8000-000000000001",
    );
  });

  it("NBJ-D12 leaves unknown fields absent before human confirmation", () => {
    const draft = parseIncidentDraft({
      id: "draft-2",
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      text: "Có một vấn đề cần kiểm tra thêm.",
    });

    expect(draft.humanConfirmationRequired).toBe(true);
    expect(draft.siteId).toBeUndefined();
    expect(draft.category).toBeUndefined();
    expect(draft.suggestedSeverity).toBeUndefined();
    expect(draft.resourceRequest).toBeUndefined();
  });
});
