import { describe, expect, it } from "vitest";
import {
  MarketingDestinationPathSchema,
  destinationPathWithAttribution,
} from "@/domain/marketing-qr";

describe("CUS-04 dynamic QR domain contract", () => {
  it("accepts an internal path and appends only declared attribution", () => {
    const destination = destinationPathWithAttribution(
      {
        destinationPath: "/plan?lang=vi",
        sourceCode: "TC-WHARF-01",
        campaignCode: "TAMCOC-AUG",
        placementId: "TAMCOC-WHARF",
      },
      "https://ninhbinhjourney.test",
    );

    expect(destination.toString()).toBe(
      "https://ninhbinhjourney.test/plan?lang=vi&qr_source_id=TC-WHARF-01&campaign_id=TAMCOC-AUG&placement_id=TAMCOC-WHARF&utm_source=qr&utm_medium=offline&utm_campaign=TAMCOC-AUG",
    );
  });

  it("refuses every external or protocol-relative destination", () => {
    for (const value of ["https://attacker.test", "//attacker.test", "javascript:alert(1)"]) {
      expect(MarketingDestinationPathSchema.safeParse(value).success).toBe(false);
    }
    expect(() =>
      destinationPathWithAttribution(
        {
          destinationPath: "//attacker.test",
          sourceCode: "TC-WHARF-01",
          campaignCode: "TAMCOC-AUG",
          placementId: "TAMCOC-WHARF",
        },
        "https://ninhbinhjourney.test",
      ),
    ).toThrow("first-party origin");
  });
});
