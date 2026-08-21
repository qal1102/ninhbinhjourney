import { describe, expect, it } from "vitest";
import {
  getVisitorPageType,
  isCustomerConsentSurface,
  parseCustomerAnalyticsConsent,
  parseCustomerConsentPreferences,
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

  it("shows the consent center on customer surfaces without blocking ERP or operations", () => {
    expect(isCustomerConsentSurface("/")).toBe(true);
    expect(isCustomerConsentSurface("/checkout")).toBe(true);
    expect(isCustomerConsentSurface("/journey/demo")).toBe(true);
    expect(isCustomerConsentSurface("/quyen-rieng-tu")).toBe(true);
    expect(isCustomerConsentSurface("/erp/login")).toBe(false);
    expect(isCustomerConsentSurface("/erp/release")).toBe(false);
    expect(isCustomerConsentSurface("/ops")).toBe(false);
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

  it("retains an explicit denial so the privacy center can avoid prompting again", () => {
    expect(
      parseCustomerConsentPreferences(
        JSON.stringify({
          product_analytics: "denied",
          marketing_communications: "revoked",
          policy_version: "staged-analytics-v1",
          marketing_policy_version: "staged-marketing-v1",
        }),
      ),
    ).toMatchObject({
      product_analytics: "denied",
      marketing_communications: "revoked",
    });
  });
});
