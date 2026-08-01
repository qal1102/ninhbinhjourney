import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608010015_erp_incident_sla_clock.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP incident SLA clock migration 015 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("adds a real report timestamp and backfills every existing row before making it required", () => {
    expect(compact).toContain(
      "alter table public.erp_incidents add column if not exists reported_at_ts timestamptz;",
    );
    expect(compact).toContain("where reported_at_ts is null;");
    expect(compact).toContain("alter column reported_at_ts set not null,");
    expect(compact).toContain("alter column reported_at_ts set default now();");
  });

  it("backfills from the frozen elapsed_minutes value before dropping it, not from a fresh now()", () => {
    const updateStart = compact.indexOf("update public.erp_incidents");
    const updateEnd = compact.indexOf(";", updateStart);
    const updateStatement = compact.slice(updateStart, updateEnd);
    expect(updateStatement).toContain("now() - (elapsed_minutes || ' minutes')::interval");
  });

  it("drops the frozen elapsed_minutes column so nothing can read a stale value again", () => {
    expect(compact).toContain("alter table public.erp_incidents drop column elapsed_minutes;");
  });

  it("does not touch RLS or grants -- erp_incidents is already locked down by migration 011", () => {
    expect(compact).not.toContain("row level security");
    expect(compact).not.toContain("revoke");
    expect(compact).not.toContain("grant");
  });
});
