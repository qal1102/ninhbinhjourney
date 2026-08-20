import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608200044_customer_recommendations_outbound_queue.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("CUS-07 transparent recommendations and outbound queue migration 044", () => {
  it("is atomic, PII-safe, RLS protected and has no direct writes", () => {
    expect(compact.startsWith("-- CUS-07:") && compact.endsWith("commit;")).toBe(true);
    for (const table of ["customer_recommendation_rules", "customer_recommendations", "customer_outbound_actions", "customer_outbound_action_events"]) {
      expect(compact).toContain(`create table if not exists public.${table} (`);
      expect(compact).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(compact).toContain("not public.customer_json_contains_pii(payload)");
    expect(compact).toContain("not public.customer_json_contains_pii(evidence)");
    expect(compact).not.toContain("grant insert on table");
  });

  it("keeps every recommendation explainable and derived only from explicit inputs", () => {
    expect(compact).toContain("rule_version text not null");
    expect(compact).toContain("reason_code text not null");
    expect(compact).toContain("when 'family-explicit'");
    expect(compact).toContain("party,children");
    expect(compact).toContain("when 'slow-pace'");
    expect(compact).toContain("walking_tolerance");
    expect(compact).toContain("when 'active-photography'");
    expect(compact).not.toMatch(/openai|anthropic|prompt|llm/i);
  });

  it("fails outbound closed on consent, identity and frequency policy", () => {
    expect(compact).toContain("CUSTOMER_OUTBOUND_DIRECTOR_REQUIRED");
    expect(compact).toContain("CUSTOMER_OUTBOUND_IDENTITY_REQUIRED");
    expect(compact).toContain("marketing_communications");
    expect(compact).toContain("v_marketing_status is distinct from 'granted'");
    expect(compact).toContain("interval '7 days'");
    expect(compact).toContain(">= 2");
    expect(compact).toContain("pg_advisory_xact_lock");
    expect(compact).toContain("unique (tenant_id, idempotency_key)");
  });

  it("ships only a simulation contract, not a sending provider or contact field", () => {
    expect(compact).toContain("'outbound-simulation', '1.0'");
    expect(compact).not.toMatch(/api[_-]?key|authorization: bearer|sendgrid|twilio|zalo.*token/i);
    expect(compact).not.toMatch(/email_address|phone_number|recipient_address/i);
  });
});
