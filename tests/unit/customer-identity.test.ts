import { describe, expect, it } from "vitest";
import {
  CustomerContactRequestSchema,
  normalizeCustomerContact,
} from "@/domain/customer-identity";

describe("CUS-05 customer identity contract", () => {
  it("normalizes email and Vietnamese phone without changing the identity type", () => {
    expect(normalizeCustomerContact("  Guest@Example.COM ")).toEqual({
      identityType: "email",
      normalized: "guest@example.com",
    });
    expect(normalizeCustomerContact("+84 912 345 678")).toEqual({
      identityType: "phone",
      normalized: "0912345678",
    });
  });

  it("rejects arbitrary text and accepts exactly one contact field", () => {
    expect(() => normalizeCustomerContact("xin chào")).toThrow("CONTACT_INVALID");
    expect(CustomerContactRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      journey_id: "10000000-0000-4000-8000-000000000002",
      contact: "guest@example.com",
      marketing_communications: false,
      phone: "0912345678",
    }).success).toBe(false);
  });
});
