import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CustomerEventRequest } from "@/domain/customer-events";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CustomerEventRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "PII_FORBIDDEN"
      | "CONSENT_REQUIRED"
      | "ID_COLLISION"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomerEventRepositoryError";
  }
}

export function isCustomerEventIngestionEnabled() {
  return process.env.CUSTOMER_DATA_INGESTION_ENABLED?.trim() === "true";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CustomerEventRepositoryError(
      "Kho dữ liệu khách hàng chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "ninh-binh-journey-customer-events-server" },
    },
  });
}

function mapRepositoryError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";

  if (message.includes("CUSTOMER_EVENT_PII_FORBIDDEN")) {
    return new CustomerEventRepositoryError(
      "Event analytics chứa dữ liệu định danh trực tiếp.",
      "PII_FORBIDDEN",
    );
  }
  if (message.includes("CUSTOMER_ANALYTICS_CONSENT_REQUIRED")) {
    return new CustomerEventRepositoryError(
      "Analytics consent không cho phép ghi event này.",
      "CONSENT_REQUIRED",
    );
  }
  if (
    message.includes("CUSTOMER_EVENT_ID_COLLISION") ||
    message.includes("CUSTOMER_SESSION_ID_COLLISION")
  ) {
    return new CustomerEventRepositoryError(
      "ID event hoặc session đã được dùng cho một payload khác.",
      "ID_COLLISION",
    );
  }
  return new CustomerEventRepositoryError(
    "Kho dữ liệu khách hàng chưa ghi nhận được event.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

export type IngestCustomerEventResult = {
  eventId: string;
  inserted: boolean;
};

export async function ingestCustomerEvent(
  input: CustomerEventRequest,
): Promise<IngestCustomerEventResult> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("customer_ingest_event", {
    p_tenant_id: TENANT_ID,
    p_event_id: input.event_id,
    p_event_name: input.event_name,
    p_schema_version: input.schema_version,
    p_occurred_at: input.occurred_at,
    p_anonymous_id: input.anonymous_id,
    p_session_id: input.session_id,
    p_page_view_id: input.page_view_id ?? null,
    p_source_context: input.source_context,
    p_consent_snapshot: input.consent_snapshot,
    p_properties: input.properties,
  });

  const row = Array.isArray(data)
    ? (data[0] as Record<string, unknown> | undefined)
    : undefined;
  if (error || !row) throw mapRepositoryError(error);

  return {
    eventId: String(row.event_id),
    inserted: row.inserted === true,
  };
}
