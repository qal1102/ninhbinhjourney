import { describe, expect, it } from "vitest";
import {
  containsDirectPii,
  CustomerEventRequestSchema,
} from "@/domain/customer-events";

const baseEvent = {
  event_id: "10000000-0000-4000-8000-000000000001",
  event_name: "page_viewed" as const,
  schema_version: 1 as const,
  occurred_at: "2026-08-18T06:00:00.000Z",
  anonymous_id: "10000000-0000-4000-8000-000000000002",
  session_id: "10000000-0000-4000-8000-000000000003",
  page_view_id: "10000000-0000-4000-8000-000000000004",
  source_context: {
    utm_source: "official-page",
    utm_medium: "social",
  },
  consent_snapshot: {
    product_analytics: "granted" as const,
    policy_version: "analytics-v1",
    marketing_communications: "not-requested" as const,
  },
  properties: {
    page_path: "/destination/tam-coc",
    page_type: "destination",
    referrer_class: "campaign",
  },
};

describe("customer event tracking contract", () => {
  it("accepts a known event with only its whitelisted properties", () => {
    expect(CustomerEventRequestSchema.safeParse(baseEvent).success).toBe(true);
  });

  it("rejects missing and unknown event properties", () => {
    const result = CustomerEventRequestSchema.safeParse({
      ...baseEvent,
      properties: {
        page_path: "/",
        page_type: "landing",
        debug_payload: "must not enter analytics",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown source fields", () => {
    const result = CustomerEventRequestSchema.safeParse({
      ...baseEvent,
      source_context: { ad_platform_blob: "opaque" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects direct email, phone and PII-shaped keys recursively", () => {
    expect(containsDirectPii({ nested: { email: "hidden" } })).toBe(true);
    expect(containsDirectPii({ value: "guest@example.com" })).toBe(true);
    expect(containsDirectPii({ value: "+84 912 345 678" })).toBe(true);
    expect(
      CustomerEventRequestSchema.safeParse({
        ...baseEvent,
        properties: {
          ...baseEvent.properties,
          page_path: "/?email=guest@example.com",
        },
      }).success,
    ).toBe(false);
  });

  it("blocks behavioral events after analytics consent is denied", () => {
    const result = CustomerEventRequestSchema.safeParse({
      ...baseEvent,
      consent_snapshot: {
        ...baseEvent.consent_snapshot,
        product_analytics: "denied",
      },
    });
    expect(result.success).toBe(false);
  });

  it("still accepts the consent update event that records a denial", () => {
    const result = CustomerEventRequestSchema.safeParse({
      ...baseEvent,
      event_name: "consent_updated",
      consent_snapshot: {
        ...baseEvent.consent_snapshot,
        product_analytics: "denied",
      },
      properties: {
        purpose: "product_analytics",
        status: "denied",
        policy_version: "analytics-v1",
        channel: "web",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts only declared scroll milestones", () => {
    const event = {
      ...baseEvent,
      event_name: "scroll_depth_reached",
      properties: { depth_percent: 50, page_path: "/" },
    };
    expect(CustomerEventRequestSchema.safeParse(event).success).toBe(true);
    expect(
      CustomerEventRequestSchema.safeParse({
        ...event,
        properties: { ...event.properties, depth_percent: 42 },
      }).success,
    ).toBe(false);
  });

  it("enforces active dwell and visibility thresholds", () => {
    const event = {
      ...baseEvent,
      event_name: "section_engaged",
      properties: {
        section_id: "destination-story",
        active_ms: 5_000,
        max_visible_ratio: 0.5,
      },
    };
    expect(CustomerEventRequestSchema.safeParse(event).success).toBe(true);
    expect(
      CustomerEventRequestSchema.safeParse({
        ...event,
        properties: { ...event.properties, active_ms: 4_999 },
      }).success,
    ).toBe(false);
  });
});
