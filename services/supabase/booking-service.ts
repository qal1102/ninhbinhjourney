"use client";

import { DomainError } from "@/domain/errors";
import type { Booking, Quote } from "@/domain/models";
import type { BookingService } from "@/services/contracts";

type ApiError = { error?: { code?: string; message?: string } };

export class SupabaseBookingService implements BookingService {
  async quote(input: {
    itineraryId?: string;
    productSelections: Array<{ productId: string; quantity: number }>;
    visitDate: string;
    partySize: number;
  }) {
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ApiError & { quote?: Quote };
    if (!response.ok || !payload.quote) {
      throw new DomainError(
        payload.error?.code === "CAPACITY_UNAVAILABLE"
          ? "CAPACITY_UNAVAILABLE"
          : payload.error?.code === "DEMO_ROOM_NOT_JOINED"
            ? "DEMO_ROOM_NOT_JOINED"
            : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to create a server quote.",
        { retryable: response.status === 409 },
      );
    }
    return payload.quote;
  }

  async createBooking(input: {
    quoteId: string;
    customerDisplayName: string;
    contactKind: "email" | "phone";
    contactValue: string;
    consent: true;
    idempotencyKey: string;
  }) {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ApiError & {
      booking?: Pick<Booking, "id" | "code" | "status">;
      payment?: {
        providerIntentId: string;
        status: string;
        mode: "simulation";
      };
      pass?: { id: string; token: string; path: string };
      idempotentReplay?: boolean;
    };
    if (
      !response.ok ||
      !payload.booking ||
      !payload.payment ||
      !payload.pass
    ) {
      const code =
        payload.error?.code === "CAPACITY_UNAVAILABLE"
          ? "CAPACITY_UNAVAILABLE"
          : payload.error?.code === "QUOTE_EXPIRED"
            ? "QUOTE_EXPIRED"
            : "VALIDATION_ERROR";
      throw new DomainError(
        code,
        payload.error?.message ?? "Unable to confirm the sandbox booking.",
        { retryable: response.status === 409 },
      );
    }
    return {
      booking: payload.booking,
      payment: payload.payment,
      pass: payload.pass,
      idempotentReplay: payload.idempotentReplay ?? false,
    };
  }
}
