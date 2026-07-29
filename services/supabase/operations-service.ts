"use client";

import { DomainError } from "@/domain/errors";
import type { IncidentDraft } from "@/domain/models";

export class SupabaseOperationsService {
  async confirmIncident(draft: IncidentDraft) {
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as {
      incident?: { id: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.incident) {
      throw new DomainError(
        response.status === 403 ? "PERMISSION_DENIED" : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to confirm this incident.",
      );
    }
    return payload.incident;
  }

  async updateIncident(input: {
    id: string;
    status: string;
    assignedTo?: string | null;
    resourceStatus?: string | null;
  }) {
    const response = await fetch(`/api/incidents/${input.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: input.status,
        assignedTo: input.assignedTo,
        resourceStatus: input.resourceStatus,
      }),
    });
    const payload = (await response.json()) as {
      incident?: { id: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.incident) {
      throw new DomainError(
        response.status === 403 ? "PERMISSION_DENIED" : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to update this incident.",
      );
    }
    return payload.incident;
  }
}
