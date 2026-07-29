"use client";

import { DomainError } from "@/domain/errors";
import type { Booking, Pass } from "@/domain/models";
import type { PassService } from "@/services/contracts";

export class SupabasePassService implements PassService {
  async getByToken(input: { token: string }) {
    const response = await fetch(
      `/api/passes/${encodeURIComponent(input.token)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      snapshot?: { pass: Pass; booking: Booking };
      fetchedAt?: string;
      error?: { code?: string; message?: string };
    };
    if (!response.ok || !payload.snapshot || !payload.fetchedAt) {
      throw new DomainError(
        payload.error?.code === "PASS_UNKNOWN"
          ? "PASS_UNKNOWN"
          : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to load this pass.",
        { retryable: response.status >= 500 },
      );
    }
    return { snapshot: payload.snapshot, fetchedAt: payload.fetchedAt };
  }
}
