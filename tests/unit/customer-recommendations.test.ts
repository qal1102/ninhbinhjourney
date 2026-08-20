import { describe, expect, it } from "vitest";
import { RECOMMENDATION_REASON_LABELS } from "@/domain/customer-recommendations";
import { simulatedOutboundAdapter } from "@/services/adapters/outbound/simulated-outbound-adapter";

describe("CUS-07 recommendation presentation and outbound adapter contract", () => {
  it("maps each supported explainable reason to visitor-safe Vietnamese copy", () => {
    expect(RECOMMENDATION_REASON_LABELS.explicit_party_children).toContain("chủ động");
    expect(RECOMMENDATION_REASON_LABELS.explicit_relaxed_or_low_walking).toContain("nhịp thư thả");
    expect(RECOMMENDATION_REASON_LABELS.explicit_active_photography).toContain("nhiếp ảnh");
  });

  it("uses a deterministic simulation result and exposes no recipient field", async () => {
    await expect(simulatedOutboundAdapter.deliver({
      actionId: "action-01", channel: "email", idempotencyKey: "key-01", templateCode: "recommendation-v1",
    })).resolves.toEqual({ outcome: "simulated-delivered", providerEventId: "sim-action-01" });
  });
});
