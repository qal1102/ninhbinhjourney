import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607290004_erp_workday_lifecycle.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ").trim();
const hardeningMigrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607290005_erp_workday_resubmission_integrity.sql",
    import.meta.url,
  ),
);
const hardeningSql = readFileSync(hardeningMigrationPath, "utf8");

function functionBlock(name: string, source = sql) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  const end = source.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return source.slice(start, end + 4).replace(/\s+/g, " ");
}

describe("ERP workday migration 004 contract", () => {
  it("persists work, audit, location and site geofences", () => {
    for (const table of [
      "erp_workday_site_geofences",
      "erp_workday_workflows",
      "erp_workday_audit_events",
      "erp_workday_location_events",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table}`);
      expect(compact).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).not.toContain(`grant insert on table public.${table}`);
      expect(compact).not.toContain(`grant update on table public.${table}`);
      expect(compact).not.toContain(`grant delete on table public.${table}`);
    }
    expect(compact).toContain(
      "unique (tenant_id, site_id, business_date, employee_account_id)",
    );
    expect(compact).toContain(
      "foreign key (workday_id, tenant_id, site_id) references public.erp_workday_workflows(id, tenant_id, site_id)",
    );
  });

  it("keeps actor ownership and the complete lifecycle inside an atomic transition RPC", () => {
    const transition = functionBlock("erp_demo_transition_workday");
    expect(transition).toContain("for update;");
    expect(transition).toContain(
      "v_workday.version <> p_expected_version",
    );
    expect(transition).toContain("message = 'WORKDAY_VERSION_CONFLICT'");
    expect(transition).toContain(
      "p_actor_account_id <> v_workday.employee_account_id",
    );
    expect(transition).toContain(
      "p_actor_account_id <> v_workday.manager_account_id",
    );
    for (const action of [
      "employee.check-in",
      "employee.progress",
      "employee.submit",
      "manager.review",
    ]) {
      expect(transition).toContain(`'${action}'`);
    }
    expect(transition).toContain(
      "insert into public.erp_workday_audit_events",
    );
  });

  it("recomputes geofence distance for check-in, evidence and active-shift pings", () => {
    const transition = functionBlock("erp_demo_transition_workday");
    const location = functionBlock("erp_demo_record_workday_location");
    expect(transition.match(/public\.erp_workday_distance_meters/g)?.length).toBe(
      2,
    );
    expect(transition).toContain(
      "message = 'WORKDAY_CHECK_IN_OUTSIDE_GEOFENCE'",
    );
    expect(transition).toContain(
      "message = 'WORKDAY_EVIDENCE_OUTSIDE_GEOFENCE'",
    );
    expect(transition).toContain("v_accuracy > 250");
    expect(location).toContain(
      "v_workday.status not in ('checked-in', 'in-progress')",
    );
    expect(location).toContain("public.erp_workday_distance_meters");
    expect(location).toContain(
      "v_distance <= v_geofence.radius_meters",
    );
  });

  it("exposes mutation RPCs only to the server service role and keeps evidence private", () => {
    for (const signature of [
      "public.erp_demo_assign_workday(jsonb, text, text, text, text)",
      "public.erp_demo_transition_workday(uuid, integer, text, text, text, text, text, text, jsonb, text)",
      "public.erp_demo_record_workday_location(uuid, text, double precision, double precision, double precision, timestamptz, text)",
    ]) {
      expect(compact).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${signature} to service_role;`,
      );
    }
    expect(compact).toContain(
      "values ( 'erp-workday-evidence', 'erp-workday-evidence', false, 5242880",
    );
  });

  it("publishes only operational state and locations for future realtime subscriptions", () => {
    expect(compact).toContain("'erp_workday_workflows'");
    expect(compact).toContain("'erp_workday_location_events'");
    expect(compact).not.toContain(
      "array[ 'erp_workday_workflows', 'erp_workday_location_events', 'erp_workday_audit_events'",
    );
  });
});

describe("ERP workday migration 005 hardening contract", () => {
  it("applies the forward hardening atomically and keeps old evidence immutable", () => {
    const compactHardening = hardeningSql.replace(/\s+/g, " ").trim();
    const integrity = functionBlock(
      "erp_enforce_workday_resubmission_integrity",
      hardeningSql,
    );
    expect(compactHardening.startsWith("-- Forward-only")).toBe(true);
    expect(compactHardening).toContain("begin;");
    expect(compactHardening.endsWith("commit;")).toBe(true);
    expect(integrity).toContain("message = 'WORKDAY_EVIDENCE_IMMUTABLE'");
    expect(integrity).toContain(
      "(new.evidence - (v_new_evidence_count - 1)) <> old.evidence",
    );
  });

  it("reopens a returned shift and records a new checkout on resubmission", () => {
    const integrity = functionBlock(
      "erp_enforce_workday_resubmission_integrity",
      hardeningSql,
    );
    expect(integrity).toContain(
      "old.status = 'submitted' and new.status = 'manager-returned'",
    );
    expect(integrity).toContain("new.check_out_at := null");
    expect(integrity).toContain(
      "old.status = 'manager-returned' and new.status = 'submitted'",
    );
    expect(integrity).toContain("new.check_out_at := now()");
  });

  it("requires one new final photo and fresh returned evidence", () => {
    const integrity = functionBlock(
      "erp_enforce_workday_resubmission_integrity",
      hardeningSql,
    );
    expect(integrity).toContain(
      "v_new_evidence_count <> v_old_evidence_count + 1",
    );
    expect(integrity).toContain("message = 'WORKDAY_FINAL_EVIDENCE_REQUIRED'");
    expect(integrity).toContain("message = 'WORKDAY_EVIDENCE_MUST_BE_NEW'");
    expect(integrity).toContain("v_captured_at <= old.updated_at");
    expect(integrity).toContain(
      "message = 'WORKDAY_RETURNED_EVIDENCE_NOT_FRESH'",
    );
  });

  it("requires positive GPS accuracy up to 250 metres everywhere", () => {
    const integrity = functionBlock(
      "erp_enforce_workday_resubmission_integrity",
      hardeningSql,
    );
    const location = functionBlock(
      "erp_demo_record_workday_location",
      hardeningSql,
    );
    expect(integrity).toContain(
      "new.check_in_accuracy_meters > 0 and new.check_in_accuracy_meters <= 250",
    );
    expect(integrity).toContain(
      "v_accuracy > 0 and v_accuracy <= 250",
    );
    expect(location).toContain("p_accuracy_meters is null");
    expect(location).toContain(
      "p_accuracy_meters > 0 and p_accuracy_meters <= 250",
    );
    expect(location).toContain(
      "v_workday.status not in ('checked-in', 'in-progress', 'manager-returned')",
    );
  });

  it("validates evidence identity, coordinates, freshness and server geofence", () => {
    const integrity = functionBlock(
      "erp_enforce_workday_resubmission_integrity",
      hardeningSql,
    );
    expect(integrity).toContain("v_evidence->>'id'");
    expect(integrity).toContain("v_evidence->>'storagePath'");
    expect(integrity).toContain("v_latitude not between -90 and 90");
    expect(integrity).toContain("v_longitude not between -180 and 180");
    expect(integrity).toContain("v_captured_at < now() - interval '10 minutes'");
    expect(integrity).toContain("public.erp_workday_distance_meters");
    expect(integrity).toContain("v_distance > v_geofence.radius_meters");
    expect(integrity).toContain(
      "message = 'WORKDAY_EVIDENCE_OUTSIDE_GEOFENCE'",
    );
    expect(integrity).toContain("'siteVerified', true");
  });

  it("normalizes location idempotency and persists the workflow employee id", () => {
    const location = functionBlock(
      "erp_demo_record_workday_location",
      hardeningSql,
    );
    expect(location).toContain(
      "v_key text := trim(coalesce(p_idempotency_key, ''))",
    );
    expect(location).toContain("idempotency_key = v_key");
    expect(location).toContain("v_workday.employee_account_id");
  });
});
