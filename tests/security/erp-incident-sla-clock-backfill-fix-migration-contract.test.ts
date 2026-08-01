import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608010016_erp_incident_sla_clock_backfill_fix.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP incident SLA clock backfill-fix migration 016 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("re-anchors reported_at_ts on each row's own updated_at, not on now()", () => {
    // The bug in migration 015: it backfilled from now() (the moment the
    // migration happened to run), which can land after a row's real
    // updated_at for anything closed/touched before that moment -- see the
    // header comment for the production evidence. updated_at is the only
    // timestamp still available per row that reflects real history (seed
    // insert time if never transitioned, or the last real transition).
    expect(compact).toContain("set reported_at_ts = updated_at - (");
    expect(compact).not.toMatch(/reported_at_ts\s*=\s*now\(\)/);
  });

  it("only touches the 12 known seeded rows, using their stable id-suffix convention", () => {
    for (const suffix of ["071", "069", "064"]) {
      expect(compact).toContain(`id like '%-${suffix}'`);
    }
    // elapsed_minutes was already dropped by migration 015, so the original
    // per-suffix offsets (4 / 7 / 6 minutes) are the only source left for
    // this one-time correction -- they must match the values migration 011
    // originally seeded for -071 / -069 / -064 respectively.
    expect(compact).toContain("interval '4 minutes'");
    expect(compact).toContain("interval '7 minutes'");
    expect(compact).toContain("interval '6 minutes'");
  });
});
