import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608180039_customer_data_backbone.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-01 customer data backbone migration 039 contract", () => {
  it("applies atomically", () => {
    expect(compact.startsWith("-- CUS-01:")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("creates one anonymous-first profile, identity, consent, session and event backbone", () => {
    for (const table of [
      "customer_profiles",
      "customer_identities",
      "customer_consents",
      "customer_sessions",
      "customer_events",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("unique (tenant_id, anonymous_id)");
    expect(compact).toContain("status in ('anonymous', 'identified', 'merged')");
  });

  it("stores direct identities only as a digest plus ciphertext", () => {
    const identityTable = sql.match(
      /create table if not exists public\.customer_identities \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(identityTable).toBeDefined();
    expect(identityTable).toContain("identity_digest text not null");
    expect(identityTable).toContain("identity_ciphertext text not null");
    expect(identityTable).toContain("encryption_key_version text not null");
    expect(identityTable).not.toMatch(/\b(email|phone|normalized_value)\s+text\b/);
    expect(compact).toContain("CUSTOMER_IDENTITY_MERGE_REQUIRED");
  });

  it("keeps service, analytics and marketing consent separate and immutable", () => {
    expect(compact).toContain(
      "purpose in ('essential_service', 'product_analytics', 'marketing_communications')",
    );
    expect(compact).toContain("status in ('granted', 'denied', 'revoked')");
    expect(compact).toContain(
      "create trigger customer_consents_append_only before update or delete",
    );
    expect(compact).toContain("CUSTOMER_HISTORY_IMMUTABLE");
  });

  it("rejects direct PII recursively in source, consent evidence and event properties", () => {
    expect(compact).toContain(
      "create or replace function public.customer_json_contains_pii(p_value jsonb)",
    );
    expect(compact).toContain("public.customer_json_contains_pii(v_child)");
    expect(compact).toContain("CUSTOMER_EVENT_PII_FORBIDDEN");
    expect(compact).toContain("CUSTOMER_CONSENT_PII_FORBIDDEN");
    expect(compact).toContain("not public.customer_json_contains_pii(source_context)");
    expect(compact).toContain("not public.customer_json_contains_pii(properties)");
  });

  it("makes ingestion idempotent and rejects collisions", () => {
    expect(compact).toContain("create or replace function public.customer_ingest_event(");
    expect(compact).toContain("on conflict on constraint customer_events_pkey do nothing");
    expect(compact).toContain("CUSTOMER_EVENT_ID_COLLISION");
    expect(compact).toContain("CUSTOMER_SESSION_ID_COLLISION");
    expect(compact).toContain("v_inserted_event_id is not null");
    expect(compact).toContain("p_occurred_at < now() - interval '7 days'");
    expect(compact).toContain("p_occurred_at > now() + interval '5 minutes'");
  });

  it("requires an analytics consent snapshot before behavioral events", () => {
    expect(compact).toContain("v_analytics_status := v_consent ->> 'product_analytics'");
    expect(compact).toContain("p_event_name <> 'consent_updated'");
    expect(compact).toContain("('granted', 'not-required')");
    expect(compact).toContain("CUSTOMER_ANALYTICS_CONSENT_REQUIRED");
  });

  it("allows reads only to the server role and writes only through RPCs", () => {
    for (const table of [
      "customer_profiles",
      "customer_identities",
      "customer_consents",
      "customer_sessions",
      "customer_events",
    ]) {
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant select on table public.${table} to service_role;`,
      );
    }
    expect(compact).not.toContain("grant insert on table public.customer_events");
    expect(compact).toContain("security definer set search_path = ''");
    expect(compact).toContain(
      "grant execute on function public.customer_ingest_event(",
    );
  });
});
