import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608010017_erp_incident_camera_report.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function functionBlock(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return sql.slice(start, end + 4).replace(/\s+/g, " ");
}

describe("ERP incident camera-report migration 017 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("does not create a new table -- reuses erp_incidents from migration 011", () => {
    expect(compact).not.toContain("create table");
  });

  it("validates actor identity, tenant and camera input before inserting", () => {
    const fn = functionBlock("erp_incident_report_from_camera");
    expect(fn).toContain("message = 'INCIDENT_ACTOR_INVALID'");
    expect(fn).toContain("message = 'INCIDENT_TENANT_MISMATCH'");
    expect(fn).toContain("message = 'INCIDENT_CAMERA_INPUT_INVALID'");
    expect(fn).toContain("message = 'INCIDENT_SITE_INVALID'");
    for (const role of ["director", "manager", "employee"]) {
      expect(fn).toContain(`'${role}'`);
    }
  });

  it("only ever creates a low-severity, non-escalated incident (P3/P4), never P1/P2", () => {
    const fn = functionBlock("erp_incident_report_from_camera");
    expect(fn).toContain("'attention' then 'P3' else 'P4'");
    expect(fn).toMatch(/'reported',\s*false/);
    expect(fn).not.toContain("'P1'");
    expect(fn).not.toContain("'P2'");
  });

  it("starts every camera-created incident unassigned, for a manager to triage", () => {
    const fn = functionBlock("erp_incident_report_from_camera");
    expect(fn).toContain("null, 'Chưa giao', 'Chưa giao'");
  });

  it("exposes the RPC only to the server service role", () => {
    const signature =
      "public.erp_incident_report_from_camera( uuid, uuid, text, text, text, text, text, text, integer, text )";
    expect(compact).toContain(
      `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
    );
    expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
  });
});
