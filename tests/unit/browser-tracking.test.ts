import { describe, expect, it } from "vitest";
import {
  getVisitorPageType,
  parseCustomerAnalyticsConsent,
  sourceContextFromBrowser,
} from "@/lib/customer-data/browser-tracking";

describe("customer browser tracking contract", () => {
  it("limits collection to visitor-facing surfaces", () => {
    expect(getVisitorPageType("/")).toBe("home");
    expect(getVisitorPageType("/destination/tam-coc")).toBe("destination");
    expect(getVisitorPageType("/packages/mot-ngay")).toBe("package");
    expect(getVisitorPageType("/erp/finance")).toBeNull();
    expect(getVisitorPageType("/ops")).toBeNull();
  });

  it("keeps only declared attribution fields and classifies referrer without storing it", () => {
    const context = sourceContextFromBrowser(
      new URLSearchParams(
        "utm_source=facebook&utm_campaign=summer&source=ignored&email=guest%40example.com",
      ),
      "https://facebook.com/some-ad?email=guest@example.com",
      "https://ninhbinhjourney.test",
    );
    expect(context).toEqual({
      utm_source: "facebook",
      utm_campaign: "summer",
      referrer_class: "external",
    });
  });

  it("drops a source value that resembles direct PII", () => {
    const context = sourceContextFromBrowser(
      new URLSearchParams("source=guest%40example.com"),
      "",
      "https://ninhbinhjourney.test",
    );
    expect(context).toEqual({ referrer_class: "direct" });
  });

  it("requires an explicit granted analytics consent with a policy version", () => {
    expect(
      parseCustomerAnalyticsConsent(
        JSON.stringify({
          product_analytics: "granted",
          policy_version: "analytics-v1",
          marketing_communications: "not-requested",
        }),
      ),
    ).toMatchObject({
      product_analytics: "granted",
      policy_version: "analytics-v1",
    });
    expect(
      parseCustomerAnalyticsConsent(
        JSON.stringify({ product_analytics: "denied", policy_version: "analytics-v1" }),
      ),
    ).toBeNull();
    expect(parseCustomerAnalyticsConsent("not-json")).toBeNull();
  });
});
