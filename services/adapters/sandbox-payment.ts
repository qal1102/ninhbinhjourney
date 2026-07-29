import { createHmac, timingSafeEqual } from "node:crypto";
import { AdapterUnavailableError, DomainError } from "@/domain/errors";
import { reduceSandboxPaymentStatus } from "@/domain/commerce";

export type SandboxCallback = {
  providerEventId: string;
  providerIntentId: string;
  event: "approved" | "declined" | "cancelled";
  occurredAt: string;
};

function payload(callback: SandboxCallback) {
  return JSON.stringify(callback);
}

export class SandboxPaymentAdapter {
  sign(callback: SandboxCallback, secret: string) {
    return createHmac("sha256", secret).update(payload(callback)).digest("hex");
  }

  verify(callback: SandboxCallback, signature: string, secret: string) {
    const expected = this.sign(callback, secret);
    const providedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new DomainError(
        "PERMISSION_DENIED",
        "Sandbox callback signature is invalid.",
      );
    }
    return true;
  }

  nextStatus(
    current: "pending" | "failed" | "cancelled" | "succeeded",
    callback: SandboxCallback,
  ) {
    return reduceSandboxPaymentStatus(current, callback.event);
  }
}

export class LivePaymentAdapter {
  createPayment() {
    throw new AdapterUnavailableError("Live payment adapter");
  }
}
