import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerJourneyIntentSummary,
  CustomerJourneyItinerarySnapshot,
  CustomerJourneySource,
} from "@/domain/customer-journey";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CustomerJourneyRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "PII_FORBIDDEN"
      | "ID_COLLISION"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomerJourneyRepositoryError";
  }
}

export function isCustomerJourneyPersistenceEnabled() {
  return process.env.CUSTOMER_JOURNEY_PERSISTENCE_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CustomerJourneyRepositoryError(
      "Kho hành trình khách hàng chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-customer-journeys-server" } },
  });
}

function mapRepositoryError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("CUSTOMER_JOURNEY_PII_FORBIDDEN")) {
    return new CustomerJourneyRepositoryError(
      "Hành trình chỉ lưu thông tin đã cấu trúc, không lưu nội dung liên hệ trực tiếp.",
      "PII_FORBIDDEN",
    );
  }
  if (message.includes("CUSTOMER_JOURNEY_ID_COLLISION")) {
    return new CustomerJourneyRepositoryError(
      "Mã hành trình đã được dùng cho một nội dung khác.",
      "ID_COLLISION",
    );
  }
  return new CustomerJourneyRepositoryError(
    "Kho hành trình khách hàng tạm thời chưa lưu được bản này.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

export async function createAnonymousCustomerJourney(input: {
  journeyId: string;
  anonymousId: string;
  intentSummary: CustomerJourneyIntentSummary;
  itinerarySnapshot: CustomerJourneyItinerarySnapshot;
  sourceContext: CustomerJourneySource;
}) {
  const client = createAdminClient();
  const { data, error } = await client.rpc("customer_create_anonymous_journey", {
    p_tenant_id: TENANT_ID,
    p_journey_id: input.journeyId,
    p_anonymous_id: input.anonymousId,
    p_intent_summary: input.intentSummary,
    p_itinerary_snapshot: input.itinerarySnapshot,
    p_source_context: input.sourceContext,
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !row) throw mapRepositoryError(error);
  return {
    journeyId: String(row.journey_id),
    profileId: String(row.profile_id),
    inserted: row.inserted === true,
  };
}

export type Customer360Journey = {
  journeyId: string;
  profileId: string;
  createdAt: string;
  intent: CustomerJourneyIntentSummary;
  itinerary: CustomerJourneyItinerarySnapshot;
  source: CustomerJourneySource;
  events: Array<{ eventName: string; occurredAt: string; properties: Record<string, unknown> }>;
};

export async function listCustomer360Journeys(limit = 50): Promise<Customer360Journey[]> {
  const client = createAdminClient();
  const { data: journeys, error: journeyError } = await client
    .from("customer_journeys")
    .select("id, profile_id, created_at, intent_summary, itinerary_snapshot, source_context")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (journeyError) throw mapRepositoryError(journeyError);

  const rows = (journeys ?? []) as Array<Record<string, unknown>>;
  const profileIds = [...new Set(rows.map((row) => String(row.profile_id)).filter(Boolean))];
  const eventsByProfile = new Map<string, Customer360Journey["events"]>();
  if (profileIds.length > 0) {
    const { data: events, error: eventError } = await client
      .from("customer_events")
      .select("profile_id, event_name, occurred_at, properties")
      .eq("tenant_id", TENANT_ID)
      .in("profile_id", profileIds)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (eventError) throw mapRepositoryError(eventError);
    for (const event of (events ?? []) as Array<Record<string, unknown>>) {
      const profileId = String(event.profile_id);
      const current = eventsByProfile.get(profileId) ?? [];
      if (current.length < 12) {
        current.push({
          eventName: String(event.event_name),
          occurredAt: String(event.occurred_at),
          properties: (event.properties ?? {}) as Record<string, unknown>,
        });
      }
      eventsByProfile.set(profileId, current);
    }
  }

  return rows.map((row) => {
    const profileId = String(row.profile_id);
    return {
      journeyId: String(row.id),
      profileId,
      createdAt: String(row.created_at),
      intent: row.intent_summary as CustomerJourneyIntentSummary,
      itinerary: row.itinerary_snapshot as CustomerJourneyItinerarySnapshot,
      source: row.source_context as CustomerJourneySource,
      events: eventsByProfile.get(profileId) ?? [],
    };
  });
}
