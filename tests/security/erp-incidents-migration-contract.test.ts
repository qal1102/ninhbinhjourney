import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202607310011_erp_incidents.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function functionBlock(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return sql.slice(start, end + 4).replace(/\s+/g, " ");
}

describe("ERP incidents migration 011 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("locks down erp_incidents to service-role read only", () => {
    expect(compact).toContain("create table if not exists public.erp_incidents");
    expect(compact).toContain(
      "alter table public.erp_incidents enable row level security;",
    );
    expect(compact).toContain(
      "revoke all on table public.erp_incidents from public, anon, authenticated, service_role;",
    );
    expect(compact).not.toContain("grant insert on table public.erp_incidents");
    expect(compact).not.toContain("grant update on table public.erp_incidents");
    expect(compact).not.toContain("grant delete on table public.erp_incidents");
  });

  it("does not reuse the unrelated demo_runs/operator confirm_incident_draft subsystem", () => {
    // A pre-existing `confirm_incident_draft` RPC and `incidents` table
    // already exist for the public-facing QR check-in demo (demo_runs,
    // operators). This migration must not touch that table, redefine that
    // RPC, or reuse its schema -- that subsystem has no tenant/site/
    // director concept and is not a fit. The word "confirm_incident_draft"
    // is allowed to appear in the explanatory header comment only.
    expect(compact).not.toMatch(/\bpublic\.incidents\b/);
    expect(compact).not.toContain("create or replace function public.confirm_incident_draft");
    expect(compact).not.toContain("create table if not exists public.incidents");
    expect(compact).not.toContain("demo_run_id");
  });

  it("only lets a manager transition an incident, one step at a time", () => {
    const fn = functionBlock("erp_incident_manager_transition");
    expect(fn).toContain("v_role <> 'manager'");
    expect(fn).toContain("message = 'INCIDENT_ACTOR_INVALID'");
    expect(fn).toContain("message = 'INCIDENT_NOT_FOUND'");
    expect(fn).toContain("message = 'INCIDENT_NO_TRANSITION'");
    for (const status of ["reported", "acknowledged", "in-progress", "verification"]) {
      expect(fn).toContain(`v_row.status = '${status}'`);
    }
    expect(fn).toContain("for update");
    expect(fn).toContain("version = v_row.version + 1");
  });

  it("only lets the assigned employee report progress, and not on a closed/verifying case", () => {
    const fn = functionBlock("erp_incident_employee_progress");
    expect(fn).toContain("v_row.assignee_id is null or v_row.assignee_id <> v_actor_id");
    expect(fn).toContain("message = 'INCIDENT_NOT_ASSIGNED'");
    expect(fn).toContain("v_row.status in ('closed', 'verification')");
    expect(fn).toContain("message = 'INCIDENT_NO_TRANSITION'");
    expect(fn).toContain("sop_completed_steps = sop_total_steps");
    expect(fn).toContain("for update");
  });

  it("writes every transition into the incident's own timeline atomically with the status change", () => {
    for (const fn of [
      functionBlock("erp_incident_manager_transition"),
      functionBlock("erp_incident_employee_progress"),
    ]) {
      expect(fn).toContain("jsonb_build_array(v_entry) || v_row.timeline");
    }
  });

  it("exposes mutation RPCs only to the server service role", () => {
    for (const signature of [
      "public.erp_incident_manager_transition(uuid, text, text, text, text)",
      "public.erp_incident_employee_progress(uuid, text, text, text)",
    ]) {
      expect(compact).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${signature} to service_role;`,
      );
    }
  });

  it("seeds exactly 3 demo incidents for each of the 4 sites", () => {
    const matches = sql.match(/'INC-(TA|TC|TCO|BD)-(071|069|064)'/g) ?? [];
    expect(matches.length).toBe(12);
    expect(compact).toContain("on conflict (id) do nothing;");
  });
});
