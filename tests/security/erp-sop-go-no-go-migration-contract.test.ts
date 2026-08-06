import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608070038_erp_sop_go_no_go.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP SOP Go/No-Go migration 038 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("never represents the seeded summaries as approved policy", () => {
    expect(compact).toContain(
      "Demo operational summary — requires organizational approval",
    );
    expect(compact).toContain("approval_status in ('demo-unapproved', 'approved', 'retired')");
    expect(compact).toContain("'demo-unapproved'");
    expect(compact).toContain("effective_from");
    expect(compact).toContain("approved_by_account_id");
  });

  it("makes the manager the maker and the director the checker", () => {
    expect(compact).toContain("'regional-manager', p_site_id");
    expect(compact).toContain("'SOP_MANAGER_ROLE_REQUIRED'");
    expect(compact).toContain("'director', v_assessment.site_id");
    expect(compact).toContain("'SOP_DIRECTOR_ROLE_REQUIRED'");
    expect(compact).toContain("v_actor = v_assessment.submitted_by_account_id");
    expect(compact).toContain("'SOP_MAKER_CHECKER_SEPARATION_REQUIRED'");
  });

  it("blocks GO on a critical failure and requires written risk acceptance", () => {
    expect(compact).toContain("item.is_critical = true");
    expect(compact).toContain("v_decision = 'go' and v_critical_failures > 0");
    expect(compact).toContain("'SOP_CRITICAL_ITEM_BLOCKS_GO'");
    expect(compact).toContain("char_length(v_risk) not between 40 and 4000");
    expect(compact).toContain("'SOP_RISK_ACCEPTANCE_INVALID'");
  });

  it("serializes decisions and makes retries safe", () => {
    expect(compact).toContain("for update;");
    expect(compact).toContain("'SOP_ASSESSMENT_VERSION_CONFLICT'");
    expect(compact).toContain("last_submit_idempotency_key");
    expect(compact).toContain("decision_idempotency_key");
    expect(compact).toContain("'SOP_IDEMPOTENCY_CONFLICT'");
  });

  it("keeps a complete immutable decision trail", () => {
    for (const action of [
      "assessment.submitted",
      "assessment.resubmitted",
      "assessment.go",
      "assessment.no-go",
      "assessment.risk-accepted",
    ]) {
      expect(compact).toContain(`'${action}'`);
    }
    expect(compact).toContain("before update or delete on public.erp_sop_audit_events");
    expect(compact).toContain("'SOP_AUDIT_IMMUTABLE'");
  });

  it("adds the daily gate to active site-manager grants without replacing them", () => {
    expect(compact).toContain("array_append(access.module_ids, 'sop-dien-tap')");
    expect(compact).toContain("not access.module_ids @> array['sop-dien-tap']::text[]");
    expect(compact).toContain("assignment.role = 'regional-manager'");
    expect(compact).toContain("from changed_grants grant_row");
  });

  it("keeps all workflow tables behind RLS and service-role RPCs", () => {
    for (const table of [
      "erp_sop_opening_items",
      "erp_sop_opening_assessments",
      "erp_sop_opening_results",
      "erp_sop_audit_events",
    ]) {
      expect(compact).toContain(`alter table public.${table} enable row level security`);
      expect(compact).toContain(`revoke all on table public.${table} from public, anon, authenticated, service_role`);
      expect(compact).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(compact).toContain("grant execute on function public.erp_sop_submit_opening_assessment(");
    expect(compact).toContain("grant execute on function public.erp_sop_decide_opening_assessment(");
  });
});
