import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_RELEASE_PHASES,
  inspectCustomerReleaseEnvironment,
  inspectCustomerReleaseFlags,
  type CustomerReleasePhaseId,
} from "@/domain/customer-release-readiness";

const missingTables = vi.hoisted(() => new Set<string>());

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.limit = () => Promise.resolve(missingTables.has(table)
        ? { data: null, count: null, error: { message: "contract missing" } }
        : { data: null, count: 0, error: null });
      return builder;
    },
  }),
}));

import { getCustomerReleaseReadiness } from "@/lib/customer-data/release-readiness-repository";

const readyPhases = Object.fromEntries(CUSTOMER_RELEASE_PHASES.map((phase) => [phase.id, true])) as Record<CustomerReleasePhaseId, boolean>;

function stubReadyEnvironment() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ninhbinhjourney.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ninhbinhjourney.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_EXPERIENCE_MODE", "production");
  vi.stubEnv("NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret-key");
  vi.stubEnv("ERP_PERSISTENCE_MODE", "supabase");
  vi.stubEnv("CUSTOMER_ANALYTICS_POLICY_VERSION", "xuan-truong-analytics-v1");
  vi.stubEnv("CUSTOMER_SERVICE_POLICY_VERSION", "xuan-truong-service-v1");
  vi.stubEnv("CUSTOMER_MARKETING_POLICY_VERSION", "xuan-truong-marketing-v1");
  vi.stubEnv("CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("CUSTOMER_IDENTITY_HASH_KEY", "identity-hash-key-with-at-least-32-characters");
  vi.stubEnv("CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION", "production-v1");
}

describe("A6 customer release readiness", () => {
  beforeEach(() => {
    missingTables.clear();
    stubReadyEnvironment();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("locks the sequential migration contract from 039 through 045", () => {
    expect(CUSTOMER_RELEASE_PHASES.map((phase) => phase.migration.match(/(\d{3})_/)?.[1])).toEqual([
      "039", "040", "041", "042", "043", "044", "045",
    ]);
    expect(new Set(CUSTOMER_RELEASE_PHASES.flatMap((phase) => phase.probes.map((probe) => probe.table))).size).toBe(29);

    for (const phase of CUSTOMER_RELEASE_PHASES) {
      const sql = readFileSync(resolve(process.cwd(), "supabase", "migrations", phase.migration), "utf8");
      for (const probe of phase.probes) {
        const tableBlock = sql.match(new RegExp(
          `create table if not exists public\\.${probe.table} \\(([\\s\\S]*?)\\n\\);`,
          "i",
        ))?.[1];
        expect(tableBlock, `${phase.id}: missing table ${probe.table} in ${phase.migration}`).toBeDefined();
        for (const column of probe.columns.split(",")) {
          expect(tableBlock, `${phase.id}: missing column ${probe.table}.${column}`).toMatch(
            new RegExp(`^\\s*${column}\\s`, "m"),
          );
        }
      }
    }
  });

  it("accepts approved production configuration without exposing secret values", () => {
    const checks = inspectCustomerReleaseEnvironment(process.env);
    expect(checks.every((check) => check.ready)).toBe(true);
    expect(JSON.stringify(checks)).not.toContain(process.env.SUPABASE_SECRET_KEY);
    expect(JSON.stringify(checks)).not.toContain(process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64);
  });

  it("rejects a wrong Vercel project and draft policies", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "codex-cus00-app-sync.vercel.app");
    vi.stubEnv("CUSTOMER_MARKETING_POLICY_VERSION", "xuan-truong-marketing-draft-v1");
    const failed = inspectCustomerReleaseEnvironment(process.env).filter((check) => !check.ready).map((check) => check.id);
    expect(failed).toContain("production-project");
    expect(failed).toContain("marketing-policy");
  });

  it("blocks a downstream flag that is enabled before its dependencies", () => {
    vi.stubEnv("CUSTOMER_RECOMMENDATIONS_ENABLED", "true");
    const recommendation = inspectCustomerReleaseFlags(process.env, readyPhases)
      .find((flag) => flag.name === "CUSTOMER_RECOMMENDATIONS_ENABLED");
    expect(recommendation).toMatchObject({ enabled: true, ready: false });
    expect(recommendation?.blockers).toContain("CUSTOMER_CONSENT_MANAGEMENT_ENABLED chưa bật");
    expect(recommendation?.blockers).toContain("CUSTOMER_BOOKING_ENABLED chưa bật");
  });

  it("reports all schema contracts ready through read-only probes", async () => {
    const report = await getCustomerReleaseReadiness();
    expect(report.environmentReady).toBe(true);
    expect(report.schemaReady).toBe(true);
    expect(report.safeForCanary).toBe(true);
    expect(report.phases.every((phase) => phase.status === "ready")).toBe(true);
  });

  it("fails closed when one migration contract is absent", async () => {
    missingTables.add("erp_gate_offline_sync_items");
    vi.stubEnv("ERP_OFFLINE_GATE_ENABLED", "true");
    const report = await getCustomerReleaseReadiness();
    expect(report.schemaReady).toBe(false);
    expect(report.safeForCanary).toBe(false);
    expect(report.unsafeEnabledFlags).toContain("ERP_OFFLINE_GATE_ENABLED");
    expect(report.phases.find((phase) => phase.id === "CUS-08")?.missingContracts).toEqual(["erp_gate_offline_sync_items"]);
  });
});
