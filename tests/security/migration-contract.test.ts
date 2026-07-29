import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607240001_secure_shared_core.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");

const requiredTables = [
  "tenants",
  "regions",
  "operators",
  "sites",
  "campaigns",
  "qr_sources",
  "products",
  "product_sites",
  "sops",
  "user_profiles",
  "tenant_memberships",
  "demo_runs",
  "demo_run_members",
  "demo_join_tokens",
  "capacity_slots",
  "journey_intents",
  "itineraries",
  "itinerary_items",
  "quotes",
  "bookings",
  "booking_contacts",
  "booking_lines",
  "payment_intents",
  "payment_events",
  "passes",
  "pass_entitlements",
  "redemptions",
  "incidents",
  "resource_requests",
  "audit_events",
  "analytics_events",
] as const;

describe("Supabase migration security contract", () => {
  it("NBJ-D13 enables RLS on every public table", () => {
    for (const table of requiredTables) {
      expect(sql).toContain(`create table if not exists public.${table} (`);
      expect(sql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("NBJ-D13 contains no blanket true policy", () => {
    expect(sql).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bwith\s+check\s*\(\s*true\s*\)/i);
  });

  it("NBJ-D14 scopes shared mutable reads and writes to active room membership", () => {
    expect(sql).toContain(
      "create policy booking_scoped_read on public.bookings",
    );
    expect(sql).toContain(
      "using (public.can_read_run_row(demo_run_id, created_by));",
    );
    expect(sql).toContain(
      "create policy incident_operator_read on public.incidents",
    );
    expect(sql).toContain(
      "public.is_internal_run_member(demo_run_id",
    );
    expect(sql).toContain(
      "create policy capacity_member_read on public.capacity_slots",
    );
    expect(sql).toContain(
      "using (public.is_active_run_member(demo_run_id));",
    );
  });

  it("NBJ-D16 stores only one-time token digests", () => {
    const tokenTable = sql.match(
      /create table if not exists public\.demo_join_tokens \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(tokenTable).toBeDefined();
    expect(tokenTable).toContain("token_hash text not null unique");
    expect(tokenTable).not.toMatch(/\braw_token\b/);
    expect(sql).toContain(
      "token_hash = encode(extensions.digest(p_raw_token, 'sha256'), 'hex')",
    );
    expect(sql).toContain("or v_token.used_at is not null");
    expect(sql).toContain("or v_token.expires_at <= now()");
  });

  it("NBJ-D17 makes reset admin-only and active-room-only", () => {
    expect(sql).toMatch(
      /if v_run\.owner_user_id <> v_user_id\s+or not public\.has_tenant_role\(v_run\.tenant_id, array\['admin'\]\)/,
    );
    expect(sql).toMatch(
      /if v_run\.status <> 'active' or v_run\.expires_at <= now\(\)/,
    );
    expect(sql).toContain(
      "delete from public.bookings where demo_run_id = p_demo_run_id;",
    );
    expect(sql).not.toMatch(/delete\s+from\s+public\.tenants/i);
    expect(sql).not.toMatch(/truncate\s+/i);
  });

  it("hardens function search paths and keeps privileged helpers explicit", () => {
    const functionBlocks = sql.match(
      /create or replace function[\s\S]*?\n\$\$;/g,
    );
    expect(functionBlocks?.length).toBeGreaterThanOrEqual(21);
    for (const block of functionBlocks ?? []) {
      expect(block).toContain("set search_path = ''");
    }
    expect(
      functionBlocks?.filter((block) => block.includes("security definer"))
        .length,
    ).toBe((functionBlocks?.length ?? 1) - 1);
    expect(functionBlocks?.[0]).toContain("security invoker");
  });

  it("enforces commerce and redemption idempotency in the database", () => {
    expect(sql).toContain("unique (demo_run_id, idempotency_key)");
    expect(sql).toContain("unique (provider, provider_intent_id)");
    expect(sql).toContain("unique (provider, provider_event_id)");
    expect(sql).toContain(
      "unique (demo_run_id, idempotency_key)",
    );
    expect(sql).toContain("callback_secret_hash text not null");
    expect(sql).toContain("for update");
    expect(sql).toContain("'ALREADY_REDEEMED'");
  });

  it("routes sensitive operational mutations through role-checked RPCs", () => {
    expect(sql).toContain(
      "revoke insert, update, delete on public.redemptions, public.capacity_slots from authenticated;",
    );
    expect(sql).toContain(
      "revoke insert, update, delete on public.incidents, public.resource_requests from authenticated;",
    );
    expect(sql).toContain(
      "create or replace function public.confirm_incident_draft",
    );
    expect(sql).toContain(
      "create or replace function public.update_incident_coordination",
    );
    expect(sql).toContain(
      "P1/P2 confirmation requires supervisor or ICC authority",
    );
  });

  it("routes authoritative journey writes through validated RPCs", () => {
    expect(sql).toContain("create or replace function public.save_generated_journey");
    expect(sql).toContain("create or replace function public.update_saved_journey");
    expect(sql).toContain(
      "revoke insert, update, delete on public.journey_intents, public.itineraries, public.itinerary_items from authenticated;",
    );
    expect(sql).toContain("raise exception using errcode = '22023', message = 'Itinerary items overlap'");
  });

  it("keeps reference seeds deterministic", () => {
    expect(sql).toContain(
      "'00000000-0000-4000-8000-000000000001'",
    );
    expect(sql).toContain(
      "'00000000-0000-4000-8000-000000000002'",
    );
    expect(sql).toContain(
      "'00000000-0000-4000-8000-000000000003'",
    );
    expect(sql.match(/on conflict/gi)?.length ?? 0).toBeGreaterThanOrEqual(9);
  });
});
