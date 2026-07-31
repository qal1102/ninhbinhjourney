import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202607310013_erp_project_workflow.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function functionBlock(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return sql.slice(start, end + 4).replace(/\s+/g, " ");
}

const TABLES = [
  "erp_project_events",
  "erp_project_milestones",
  "erp_project_action_items",
  "erp_project_work_item_dependencies",
  "erp_project_change_requests",
  "erp_project_settlements",
  "erp_project_audit_events",
];

describe("ERP project workflow migration 013 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("locks down every project table to service-role read only", () => {
    for (const table of TABLES) {
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
  });

  it("gates work item transitions by role and requires the dependency chain to be done before acceptance", () => {
    const fn = functionBlock("erp_project_update_work_item_progress");
    expect(fn).toContain("v_role not in ('employee', 'manager')");
    expect(fn).toContain("v_role not in ('manager', 'director')");
    expect(fn).toContain(
      "join public.erp_project_action_items dep_item on dep_item.id = dep.depends_on_work_item_id",
    );
    expect(fn).toContain("message = 'PROJECT_WORK_ITEM_DEPENDENCY_NOT_DONE'");
  });

  it("blocks an actor from accepting their own submitted-for-acceptance work item", () => {
    const fn = functionBlock("erp_project_update_work_item_progress");
    expect(fn).toContain(
      "v_row.submitted_for_acceptance_by is not distinct from v_actor_id",
    );
    expect(fn).toContain("message = 'PROJECT_WORK_ITEM_SELF_ACCEPT'");
  });

  it("requires a non-empty reason to block a work item", () => {
    const fn = functionBlock("erp_project_report_blocker");
    expect(fn).toContain("char_length(v_reason) < 1");
    expect(fn).toContain("message = 'PROJECT_BLOCKER_REASON_REQUIRED'");
  });

  it("only lets a manager submit a change request and a director decide it", () => {
    const submit = functionBlock("erp_project_submit_change_request");
    expect(submit).toContain("v_role <> 'manager'");
    const decide = functionBlock("erp_project_decide_change_request");
    expect(decide).toContain("v_role <> 'director'");
    expect(decide).toContain("v_row.status <> 'pending'");
    expect(decide).toContain("message = 'PROJECT_CHANGE_ALREADY_DECIDED'");
  });

  it("approving a change request applies the proposed budget/date onto the event", () => {
    const decide = functionBlock("erp_project_decide_change_request");
    expect(decide).toContain("budget_billion = coalesce(v_row.proposed_budget_billion, budget_billion)");
    expect(decide).toContain("event_date = coalesce(v_row.proposed_event_date, event_date)");
  });

  it("only lets an accountant record a settlement, only for a done+requires_settlement work item, and accumulates committed_billion", () => {
    const fn = functionBlock("erp_project_record_settlement");
    expect(fn).toContain("v_role <> 'accountant'");
    expect(fn).toContain("v_item.status <> 'done' or not v_item.requires_settlement");
    expect(fn).toContain("message = 'PROJECT_SETTLEMENT_NOT_ELIGIBLE'");
    expect(fn).toContain("committed_billion = committed_billion + p_amount_billion");
  });

  it("exposes mutation RPCs only to the server service role", () => {
    for (const signature of [
      "public.erp_project_update_work_item_progress(uuid, text, text, text, text, text, integer)",
      "public.erp_project_report_blocker(uuid, text, text, text, text, text)",
      "public.erp_project_submit_change_request(uuid, uuid, text, text, text, text, text, numeric, date, text)",
      "public.erp_project_decide_change_request(uuid, uuid, text, text, text, text, text)",
      "public.erp_project_record_settlement(uuid, text, text, text, text, numeric, text, text)",
    ]) {
      expect(compact).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${signature} to service_role;`,
      );
    }
  });

  it("seeds exactly 4 events, 16 milestones and 12 work items with 2 sample dependencies", () => {
    const eventMatches = sql.match(/'20000000-0000-4000-8000-00000000000[1-4]'/g) ?? [];
    expect(new Set(eventMatches).size).toBe(4);
    const milestoneMatches = sql.match(/'21000000-0000-4000-8000-0000000000(0[1-9]|1[0-6])'/g) ?? [];
    expect(new Set(milestoneMatches).size).toBe(16);
    const workItemMatches = sql.match(/'EV-(TA|TC|TM|BD)-\d{3}'/g) ?? [];
    expect(new Set(workItemMatches).size).toBe(12);
    expect(compact).toContain("values ('EV-TC-021', 'EV-TC-026'), ('EV-TM-016', 'EV-TM-019')");
  });

  it("seeds no work item already at ready-for-acceptance, done or blocked", () => {
    const start = sql.indexOf("with inserted_items as (");
    const end = sql.indexOf("on conflict (code) do nothing", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const seedBlock = sql.slice(start, end);
    expect(seedBlock).not.toContain("'done'");
    expect(seedBlock).not.toContain("'blocked'");
    expect(seedBlock).not.toContain("'ready-for-acceptance'");
  });

  it("grants the demo module to at least one employee per site without overwriting other modules", () => {
    expect(compact).toContain("module_ids = array_append(module_ids, 'du-an-su-kien')");
    expect(compact).toContain("not ('du-an-su-kien' = any(module_ids))");
  });
});
