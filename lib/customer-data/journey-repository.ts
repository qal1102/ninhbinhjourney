import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerJourneyIntentSummary,
  CustomerJourneyItinerarySnapshot,
  CustomerJourneySource,
} from "@/domain/customer-journey";
import { auditCustomer360Access } from "@/lib/customer-data/identity-repository";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { PACKAGES } from "@/content/packages";

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
  profileStatus: "anonymous" | "identified" | "merged";
  contactTypes: Array<"email" | "phone">;
  consents: Record<string, { status: string; occurredAt: string }>;
  segments: string[];
  deliveryRequests: Array<{ channel: string; status: string; createdAt: string }>;
  orders: Array<{
    orderId: string;
    orderCode: string;
    productName: string;
    visitDate: string;
    partySize: number;
    totalVnd: number;
    status: string;
    paymentStatus: string | null;
    createdAt: string;
    tickets: Array<{ ticketCode: string; siteId: string; entriesAllowed: number; status: string }>;
  }>;
  events: Array<{ eventName: string; occurredAt: string; properties: Record<string, unknown> }>;
};

export async function listCustomer360Journeys(
  actorAccountId: string,
  limit = 50,
): Promise<Customer360Journey[]> {
  await auditCustomer360Access(actorAccountId);
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
  const profileById = new Map<string, Record<string, unknown>>();
  let profileFrontier = profileIds;
  for (let depth = 0; depth < 8 && profileFrontier.length > 0; depth += 1) {
    const { data: profiles, error: profileError } = await client
      .from("customer_profiles")
      .select("id, status, canonical_profile_id")
      .eq("tenant_id", TENANT_ID)
      .in("id", profileFrontier);
    if (profileError) throw mapRepositoryError(profileError);
    for (const profile of (profiles ?? []) as Array<Record<string, unknown>>) {
      profileById.set(String(profile.id), profile);
    }
    profileFrontier = (profiles ?? [])
      .map((profile) => String((profile as Record<string, unknown>).canonical_profile_id ?? ""))
      .filter((id) => id && !profileById.has(id));
  }
  const canonicalFor = (profileId: string) => {
    let current = profileId;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const next = String(profileById.get(current)?.canonical_profile_id ?? "");
      if (!next) return current;
      current = next;
    }
    return profileId;
  };
  const canonicalProfileIds = [...new Set(profileIds.map(canonicalFor))];
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

  const contactTypesByProfile = new Map<string, Customer360Journey["contactTypes"]>();
  const consentsByProfile = new Map<string, Customer360Journey["consents"]>();
  const segmentsByProfile = new Map<string, string[]>();
  const deliveriesByProfile = new Map<string, Customer360Journey["deliveryRequests"]>();
  const ordersByProfile = new Map<string, Customer360Journey["orders"]>();
  if (canonicalProfileIds.length > 0) {
    const [identityResult, consentResult, segmentResult, deliveryResult] = await Promise.all([
      client.from("customer_identities").select("profile_id, identity_type").eq("tenant_id", TENANT_ID).in("profile_id", canonicalProfileIds),
      client.from("customer_consents").select("profile_id, purpose, status, occurred_at, sequence_no").eq("tenant_id", TENANT_ID).in("profile_id", canonicalProfileIds).order("occurred_at", { ascending: false }).order("sequence_no", { ascending: false }),
      client.from("customer_segments").select("profile_id, segment_key").eq("tenant_id", TENANT_ID).in("profile_id", canonicalProfileIds).eq("active", true),
      client.from("customer_itinerary_delivery_requests").select("profile_id, delivery_channel, status, created_at").eq("tenant_id", TENANT_ID).in("profile_id", canonicalProfileIds).order("created_at", { ascending: false }),
    ]);
    const failed = [identityResult, consentResult, segmentResult, deliveryResult].find((result) => result.error);
    if (failed?.error) throw mapRepositoryError(failed.error);
    for (const row of (identityResult.data ?? []) as Array<Record<string, unknown>>) {
      const profileId = String(row.profile_id);
      const type = String(row.identity_type) as "email" | "phone";
      const current = contactTypesByProfile.get(profileId) ?? [];
      if ((type === "email" || type === "phone") && !current.includes(type)) current.push(type);
      contactTypesByProfile.set(profileId, current);
    }
    for (const row of (consentResult.data ?? []) as Array<Record<string, unknown>>) {
      const profileId = String(row.profile_id);
      const purpose = String(row.purpose);
      const current = consentsByProfile.get(profileId) ?? {};
      if (!current[purpose]) current[purpose] = { status: String(row.status), occurredAt: String(row.occurred_at) };
      consentsByProfile.set(profileId, current);
    }
    for (const row of (segmentResult.data ?? []) as Array<Record<string, unknown>>) {
      const profileId = String(row.profile_id);
      const current = segmentsByProfile.get(profileId) ?? [];
      current.push(String(row.segment_key));
      segmentsByProfile.set(profileId, current);
    }
    for (const row of (deliveryResult.data ?? []) as Array<Record<string, unknown>>) {
      const profileId = String(row.profile_id);
      const current = deliveriesByProfile.get(profileId) ?? [];
      current.push({ channel: String(row.delivery_channel), status: String(row.status), createdAt: String(row.created_at) });
      deliveriesByProfile.set(profileId, current.slice(0, 12));
    }
  }

  if (isCustomerBookingEnabled() && profileIds.length > 0) {
    const commerceProfileIds = [...new Set([...profileIds, ...canonicalProfileIds])];
    const { data: orders, error: orderError } = await client
      .from("customer_orders")
      .select("id, profile_id, product_id, order_code, visit_date, party_size, total_vnd, status, created_at")
      .eq("tenant_id", TENANT_ID)
      .in("profile_id", commerceProfileIds)
      .order("created_at", { ascending: false });
    if (orderError) throw mapRepositoryError(orderError);

    const orderRows = (orders ?? []) as Array<Record<string, unknown>>;
    const orderIds = orderRows.map((row) => String(row.id));
    const paymentByOrder = new Map<string, string>();
    const bridgesByOrder = new Map<string, Array<{ ticketId: string; entriesAllowed: number }>>();
    const ticketsById = new Map<string, Record<string, unknown>>();
    if (orderIds.length > 0) {
      const [paymentResult, bridgeResult] = await Promise.all([
        client.from("customer_payment_attempts").select("order_id, status").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
        client.from("customer_order_tickets").select("order_id, ticket_id, entries_allowed").eq("tenant_id", TENANT_ID).in("order_id", orderIds),
      ]);
      if (paymentResult.error) throw mapRepositoryError(paymentResult.error);
      if (bridgeResult.error) throw mapRepositoryError(bridgeResult.error);
      for (const row of (paymentResult.data ?? []) as Array<Record<string, unknown>>) {
        paymentByOrder.set(String(row.order_id), String(row.status));
      }
      const ticketIds: string[] = [];
      for (const row of (bridgeResult.data ?? []) as Array<Record<string, unknown>>) {
        const orderId = String(row.order_id);
        const ticketId = String(row.ticket_id);
        const current = bridgesByOrder.get(orderId) ?? [];
        current.push({ ticketId, entriesAllowed: Number(row.entries_allowed) });
        bridgesByOrder.set(orderId, current);
        ticketIds.push(ticketId);
      }
      if (ticketIds.length > 0) {
        const { data: tickets, error: ticketError } = await client
          .from("erp_tickets")
          .select("id, ticket_code, site_id, status")
          .eq("tenant_id", TENANT_ID)
          .in("id", [...new Set(ticketIds)]);
        if (ticketError) throw mapRepositoryError(ticketError);
        for (const ticket of (tickets ?? []) as Array<Record<string, unknown>>) {
          ticketsById.set(String(ticket.id), ticket);
        }
      }
    }

    for (const row of orderRows) {
      const profileId = canonicalFor(String(row.profile_id));
      const orderId = String(row.id);
      const product = PACKAGES.find((item) => item.id === String(row.product_id));
      const current = ordersByProfile.get(profileId) ?? [];
      current.push({
        orderId,
        orderCode: String(row.order_code),
        productName: product?.name ?? "Gói dịch vụ",
        visitDate: String(row.visit_date),
        partySize: Number(row.party_size),
        totalVnd: Number(row.total_vnd),
        status: String(row.status),
        paymentStatus: paymentByOrder.get(orderId) ?? null,
        createdAt: String(row.created_at),
        tickets: (bridgesByOrder.get(orderId) ?? []).flatMap((bridge) => {
          const ticket = ticketsById.get(bridge.ticketId);
          return ticket ? [{
            ticketCode: String(ticket.ticket_code),
            siteId: String(ticket.site_id),
            entriesAllowed: bridge.entriesAllowed,
            status: String(ticket.status),
          }] : [];
        }),
      });
      ordersByProfile.set(profileId, current);
    }
  }

  return rows.map((row) => {
    const profileId = String(row.profile_id);
    const canonicalProfileId = canonicalFor(profileId);
    const profile = profileById.get(canonicalProfileId);
    return {
      journeyId: String(row.id),
      profileId,
      createdAt: String(row.created_at),
      intent: row.intent_summary as CustomerJourneyIntentSummary,
      itinerary: row.itinerary_snapshot as CustomerJourneyItinerarySnapshot,
      source: row.source_context as CustomerJourneySource,
      profileStatus: String(profile?.status ?? "anonymous") as Customer360Journey["profileStatus"],
      contactTypes: contactTypesByProfile.get(canonicalProfileId) ?? [],
      consents: consentsByProfile.get(canonicalProfileId) ?? {},
      segments: segmentsByProfile.get(canonicalProfileId) ?? [],
      deliveryRequests: deliveriesByProfile.get(canonicalProfileId) ?? [],
      orders: ordersByProfile.get(canonicalProfileId) ?? [],
      events: eventsByProfile.get(profileId) ?? [],
    };
  });
}
