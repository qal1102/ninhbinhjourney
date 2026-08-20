import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608200043_customer_booking_on_erp_core.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-06 ERP-backed customer booking migration 043", () => {
  it("is atomic, RLS protected and exposes writes only through service-role RPCs", () => {
    expect(compact.startsWith("-- CUS-06:")).toBe(true);
    expect(compact.startsWith("-- CUS-06:") && compact.endsWith("commit;")).toBe(true);
    for (const table of [
      "customer_product_capacity_templates", "customer_booking_slots", "customer_orders",
      "customer_order_lines", "customer_booking_holds", "customer_booking_hold_slots",
      "customer_payment_attempts", "customer_order_tickets", "customer_commerce_audit_events",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("from public, anon, authenticated, service_role;");
    expect(compact).toContain("customer_create_booking_hold(uuid, uuid, uuid, uuid, date, integer, timestamptz)");
    expect(compact).toContain("customer_confirm_simulated_booking(uuid, uuid, uuid, uuid, timestamptz)");
    expect(compact).not.toContain("grant insert on table");
  });

  it("shares one locked capacity slot across packages and derives it from T11a", () => {
    expect(compact).toContain("unique (tenant_id, site_id, starts_at)");
    expect(compact).not.toContain("unique (tenant_id, product_id, site_id, starts_at)");
    expect(compact).toContain("from public.erp_capacity_thresholds threshold");
    expect(compact).toContain("order by threshold.hourly_capacity asc");
    expect(compact).toContain("for update;");
    expect(compact).toContain("v_reserved + p_party_size > v_slot.capacity_snapshot");
    expect(compact).toContain("CUSTOMER_CAPACITY_UNAVAILABLE");
  });

  it("serializes retries, expires holds and never models a real payment", () => {
    expect(compact.match(/pg_advisory_xact_lock/g)?.length).toBe(2);
    expect(compact).toContain("now() + interval '15 minutes'");
    expect(compact).toContain("hold.status = 'active' and hold.expires_at > now()");
    expect(compact).toContain("provider = 'destinationos-simulation'");
    expect(compact).toContain("mode text not null default 'simulation'");
    expect(compact).not.toMatch(/card_number|bank_account|payment_token/i);
  });

  it("issues the existing T8 group ticket without altering T8 or T11a core schemas", () => {
    expect(compact).toContain("insert into public.erp_tickets (");
    expect(compact).toContain("'group', '', ''");
    expect(compact).toContain("v_order.order_code, 'website', v_order.visit_date");
    expect(compact).toContain("v_order.party_size, 0, 'issued'");
    expect(compact).not.toContain("alter table public.erp_tickets");
    expect(compact).not.toContain("alter table public.erp_capacity_thresholds");
  });
});
