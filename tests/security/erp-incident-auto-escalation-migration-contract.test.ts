import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608020024_erp_incident_auto_escalation.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP incident auto-escalation migration 024 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("keeps the escalation routine locked to service_role only", () => {
    expect(compact).toContain(
      "revoke all on function public.erp_incident_escalate_overdue() from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain(
      "grant execute on function public.erp_incident_escalate_overdue() to service_role;",
    );
    // No blanket grant to a browser-reachable role.
    expect(compact).not.toMatch(
      /grant execute on function public\.erp_incident_escalate_overdue\(\) to (anon|authenticated|public)/,
    );
  });

  it("follows the project's SECURITY DEFINER convention", () => {
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
  });

  it("never escalates a closed incident, and never re-escalates", () => {
    expect(compact).toContain("where status <> 'closed'");
    // Without this filter, every run would overwrite the reason and add a
    // duplicate timeline entry to the same incident once a minute.
    expect(compact).toContain("and escalated = false");
  });

  it("compares elapsed time against each incident's own SLA", () => {
    expect(compact).toContain(
      "and now() > reported_at_ts + make_interval(mins => sla_minutes)",
    );
  });

  it("records who escalated and why, newest entry first", () => {
    expect(compact).toContain("'actor', 'Hệ thống'");
    expect(compact).toContain("'action', 'Chuyển cấp tự động'");
    // New entry prepended to the existing timeline, matching how the seed
    // and the manager transitions order it.
    expect(compact).toContain("|| coalesce(v_row.timeline, '[]'::jsonb)");
  });

  it("leaves severity and next_action to humans", () => {
    // Escalation is not a severity judgement, and next_action belongs to the
    // manager transition state machine.
    expect(compact).not.toMatch(/update public\.erp_incidents set[^;]*severity =/);
    expect(compact).not.toMatch(/update public\.erp_incidents set[^;]*next_action =/);
  });

  it("schedules itself once a minute without stacking duplicate jobs", () => {
    expect(compact).toContain("create extension if not exists pg_cron;");
    expect(compact).toContain("perform cron.unschedule(v_job.jobid);");
    expect(compact).toContain("'erp-incident-escalate-overdue', '* * * * *'");
  });
});
