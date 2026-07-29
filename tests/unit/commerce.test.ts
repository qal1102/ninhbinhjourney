import { describe, expect, it } from "vitest";
import { PACKAGES } from "@/content/packages";
import {
  buildPrivacySafePassPath,
  calculateQuoteLines,
  maskContact,
  reduceSandboxPaymentStatus,
} from "@/domain/commerce";
import { SandboxPaymentAdapter } from "@/services/adapters/sandbox-payment";

describe("commerce domain", () => {
  it("NBJ-D06 uses integer VND and exact line totals", () => {
    const quote = calculateQuoteLines({
      selections: [
        { product: PACKAGES[1], quantity: 3 },
        { product: PACKAGES[0], quantity: 1 },
      ],
    });

    expect(quote.lines[0].totalVnd).toBe(790_000 * 3);
    expect(Number.isInteger(quote.totalVnd)).toBe(true);
    expect(quote.totalVnd).toBe(3_260_000);
    expect(quote.currency).toBe("VND");
  });

  it("NBJ-D08 keeps customer PII out of the QR path", () => {
    const token = "opaque_pass_token_1234567890_ABCDEFG";
    const path = buildPrivacySafePassPath(token);
    expect(path).toBe(`/pass/${token}`);
    expect(path).not.toContain("@");
    expect(path).not.toContain("Nguyen");
    expect(path).not.toContain("090");
  });

  it("NBJ-D13 totals service-commerce separately", () => {
    const quote = calculateQuoteLines({
      selections: [{ product: PACKAGES[0], quantity: 2 }],
    });
    expect(quote.lines.every((line) => line.ledgerType === "service-commerce")).toBe(
      true,
    );
    expect(quote.totalVnd).toBe(1_780_000);
  });

  it("masks email and phone contacts for operations lists", () => {
    expect(maskContact("demo.guest@example.com")).toBe("d***@example.com");
    expect(maskContact("+84 900 123 456")).toBe("***3456");
  });

  it("NBJ-D18 verifies signatures and keeps approved terminal under reordering", () => {
    const adapter = new SandboxPaymentAdapter();
    const callback = {
      providerEventId: "evt-1",
      providerIntentId: "pi-1",
      event: "approved" as const,
      occurredAt: "2026-08-15T01:00:00.000Z",
    };
    const signature = adapter.sign(callback, "one-time-secret");
    expect(adapter.verify(callback, signature, "one-time-secret")).toBe(true);
    expect(() =>
      adapter.verify(callback, "00".repeat(32), "one-time-secret"),
    ).toThrow("signature is invalid");

    const afterApproval = reduceSandboxPaymentStatus("pending", "approved");
    expect(reduceSandboxPaymentStatus(afterApproval, "declined")).toBe(
      "succeeded",
    );
    expect(
      reduceSandboxPaymentStatus(
        reduceSandboxPaymentStatus("pending", "declined"),
        "approved",
      ),
    ).toBe("succeeded");
  });
});
