import { describe, expect, it } from "vitest";
import {
  CustomerBookingConfirmationRequestSchema,
  CustomerBookingHoldRequestSchema,
} from "@/domain/customer-booking";

describe("CUS-06 customer booking request contract", () => {
  it("accepts an anonymous-first hold without contact or payment data", () => {
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects raw contact, card fields and oversized parties", () => {
    const base = {
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 21,
      email: "guest@example.com",
      card_number: "4111111111111111",
    };
    expect(CustomerBookingHoldRequestSchema.safeParse(base).success).toBe(false);
  });

  it("confirms only by payment request and owned hold IDs", () => {
    expect(CustomerBookingConfirmationRequestSchema.safeParse({
      payment_request_id: "30000000-0000-4000-8000-000000000001",
      hold_id: "40000000-0000-4000-8000-000000000001",
    }).success).toBe(true);
    expect(CustomerBookingConfirmationRequestSchema.safeParse({
      payment_request_id: "30000000-0000-4000-8000-000000000001",
      hold_id: "40000000-0000-4000-8000-000000000001",
      payment_token: "real-token-forbidden",
    }).success).toBe(false);
  });
});
