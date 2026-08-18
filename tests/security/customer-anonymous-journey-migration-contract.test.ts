import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608180040_customer_anonymous_journeys.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-03 anonymous journey migration 040 contract", () => {
  it("applies atomically and uses the existing anonymous customer profile", () => {
    expect(compact.startsWith("-- CUS-03:")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).toContain("create table if not exists public.customer_journeys (");
    expect(compact).toContain("references public.customer_profiles(id, tenant_id)");
    expect(compact).toContain("unique (id, tenant_id)");
  });

  it("forbids direct PII and makes the saved journey append-only", () => {
    expect(compact).toContain("not public.customer_json_contains_pii(intent_summary)");
    expect(compact).toContain("not public.customer_json_contains_pii(itinerary_snapshot)");
    expect(compact).toContain("not public.customer_json_contains_pii(source_context)");
    expect(compact).toContain("customer_journeys_append_only before update or delete");
    expect(compact).toContain("CUSTOMER_JOURNEY_PII_FORBIDDEN");
  });

  it("writes only through a service-role RPC and detects ID collisions", () => {
    expect(compact).toContain("create or replace function public.customer_create_anonymous_journey(");
    expect(compact).toContain("security definer set search_path = ''");
    expect(compact).toContain("on conflict on constraint customer_journeys_pkey do nothing");
    expect(compact).toContain("CUSTOMER_JOURNEY_ID_COLLISION");
    expect(compact).toContain(
      "revoke all on table public.customer_journeys from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain("grant select on table public.customer_journeys to service_role;");
    expect(compact).not.toContain("grant insert on table public.customer_journeys");
    expect(compact).toContain(
      "grant execute on function public.customer_create_anonymous_journey(",
    );
  });
});
