import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607280003_erp_shift_close_workflow.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");
const compactSql = sql.replace(/\s+/g, " ").trim();

function blockBetween(startMarker: string, endMarker: string, fromIndex = 0) {
  const start = sql.indexOf(startMarker, fromIndex);
  if (start < 0) {
    throw new Error(`Missing migration marker: ${startMarker}`);
  }
  const end = sql.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`Missing migration marker: ${endMarker}`);
  }
  return sql.slice(start, end + endMarker.length);
}

function functionBlock(name: string) {
  return blockBetween(
    `create or replace function public.${name}(`,
    "\n$$;",
  );
}

function tableBlock(name: string) {
  return blockBetween(
    `create table if not exists public.${name} (`,
    "\n);",
  );
}

describe("ERP shift-close migration 003 contract", () => {
  it("creates the exact tenant/site-scoped workflow and append-only audit tables", () => {
    const workflow = tableBlock("erp_shift_close_workflows");
    const audit = tableBlock("erp_shift_close_audit_events");

    expect(workflow).toContain(
      "tenant_id uuid not null references public.tenants(id)",
    );
    expect(workflow).toContain(
      "site_id uuid not null references public.sites(id)",
    );
    expect(workflow).toContain("employee_account_id text not null");
    expect(workflow).toContain("created_by_account_id text not null");
    expect(workflow).toContain("updated_by_account_id text not null");
    expect(workflow).toContain("version integer not null default 1");
    expect(workflow).toContain("idempotency_key text not null");

    expect(audit).toContain("workflow_id uuid not null");
    expect(audit).toContain("sequence_number integer not null");
    expect(audit).toContain("actor_account_id text not null");
    expect(audit).toContain("actor_display_name text not null");
    expect(audit).toContain(
      "foreign key (workflow_id, tenant_id, site_id)",
    );
    expect(audit).toContain(
      "references public.erp_shift_close_workflows(id, tenant_id, site_id)",
    );
    expect(audit).toContain("unique (workflow_id, sequence_number)");
    expect(audit).toContain("unique (workflow_id, idempotency_key)");
  });

  it("exposes only the two exact service bridge RPC contracts", () => {
    const create = functionBlock("erp_demo_create_shift_close").replace(
      /\s+/g,
      " ",
    );
    const transition = functionBlock(
      "erp_demo_transition_shift_close",
    ).replace(/\s+/g, " ");

    expect(create).toContain(
      "public.erp_demo_create_shift_close( p_payload jsonb, p_actor_account_id text, p_actor_display_name text, p_actor_role text, p_idempotency_key text ) returns public.erp_shift_close_workflows",
    );
    expect(transition).toContain(
      "public.erp_demo_transition_shift_close( p_workflow_id uuid, p_expected_version integer, p_to_status text, p_actor_account_id text, p_actor_display_name text, p_actor_role text, p_action text, p_note text, p_review_metadata jsonb, p_idempotency_key text ) returns public.erp_shift_close_workflows",
    );
    for (const block of [create, transition]) {
      expect(block).toContain("security definer");
      expect(block).toContain("set search_path = ''");
    }

    expect(compactSql).toContain(
      "revoke all on function public.erp_demo_create_shift_close(jsonb, text, text, text, text) from public, anon, authenticated, service_role;",
    );
    expect(compactSql).toContain(
      "revoke all on function public.erp_demo_transition_shift_close(uuid, integer, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated, service_role;",
    );
    expect(compactSql).toContain(
      "grant execute on function public.erp_demo_create_shift_close(jsonb, text, text, text, text) to service_role;",
    );
    expect(compactSql).toContain(
      "grant execute on function public.erp_demo_transition_shift_close(uuid, integer, text, text, text, text, text, text, jsonb, text) to service_role;",
    );
  });

  it("enables RLS and denies every direct client mutation", () => {
    for (const table of [
      "erp_shift_close_workflows",
      "erp_shift_close_audit_events",
    ]) {
      expect(compactSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compactSql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compactSql).toContain(
        `grant select on table public.${table} to service_role;`,
      );
      expect(compactSql).not.toContain(
        `grant insert on table public.${table}`,
      );
      expect(compactSql).not.toContain(
        `grant update on table public.${table}`,
      );
      expect(compactSql).not.toContain(
        `grant delete on table public.${table}`,
      );
    }

    expect(compactSql).toContain(
      "create policy erp_shift_close_service_read on public.erp_shift_close_workflows for select to service_role using (true);",
    );
    expect(compactSql).toContain(
      "create policy erp_shift_close_audit_service_read on public.erp_shift_close_audit_events for select to service_role using (true);",
    );
    expect(compactSql).not.toMatch(
      /create policy \S+ on public\.erp_shift_close_(?:workflows|audit_events) [^;]* to authenticated/i,
    );
  });

  it("keeps the application state machine and actor/action pairs in the database", () => {
    const workflow = tableBlock("erp_shift_close_workflows");
    const transition = functionBlock(
      "erp_demo_transition_shift_close",
    ).replace(/\s+/g, " ");

    for (const status of [
      "submitted",
      "manager-returned",
      "manager-approved",
      "accounting-review",
      "posted",
      "exception-pending-director",
      "director-approved",
      "director-rejected",
    ]) {
      expect(workflow).toContain(`'${status}'`);
    }
    for (const staleStatus of [
      "manager-rejected",
      "matched",
      "director-review",
    ]) {
      expect(workflow).not.toContain(`'${staleStatus}'`);
    }

    expect(transition).toContain(
      "(v_actor_role = 'employee' and v_action = 'employee.submit')",
    );
    expect(transition).toContain(
      "(v_actor_role = 'manager' and v_action = 'manager.review')",
    );
    expect(transition).toContain(
      "(v_actor_role = 'accountant' and v_action = 'accountant.reconcile')",
    );
    expect(transition).toContain(
      "(v_actor_role = 'director' and v_action = 'director.decide')",
    );
    expect(transition).toContain(
      "v_actor_account_id = v_workflow.employee_account_id and v_from_status = 'manager-returned' and v_to_status = 'submitted'",
    );
    expect(transition).toContain(
      "(v_decision = 'approve' and v_to_status = 'manager-approved')",
    );
    expect(transition).toContain(
      "(v_decision = 'return' and v_to_status = 'manager-returned')",
    );
    expect(transition).toContain(
      "v_decision = 'escalate' and v_to_status = 'exception-pending-director' and abs(v_workflow.difference_vnd) > 1000",
    );
    expect(transition).toContain(
      "v_decision = 'post' and v_to_status = 'posted'",
    );
    expect(transition).toContain(
      "v_from_status = 'exception-pending-director'",
    );
    expect(transition).toContain(
      "(v_decision = 'reject' and v_to_status = 'director-rejected')",
    );
    expect(transition).toContain(
      "message = 'SHIFT_CLOSE_TRANSITION_NOT_ALLOWED'",
    );
  });

  it("uses row locking, optimistic versioning and request idempotency", () => {
    const workflow = tableBlock("erp_shift_close_workflows");
    const create = functionBlock("erp_demo_create_shift_close").replace(
      /\s+/g,
      " ",
    );
    const transition = functionBlock(
      "erp_demo_transition_shift_close",
    ).replace(/\s+/g, " ");
    const versionTrigger = functionBlock(
      "erp_validate_shift_close_scope_and_version",
    ).replace(/\s+/g, " ");

    expect(workflow).toContain("unique (tenant_id, idempotency_key)");
    expect(create).toContain(
      "on conflict (tenant_id, idempotency_key) do nothing",
    );
    expect(create).toContain("message = 'SHIFT_CLOSE_IDEMPOTENCY_CONFLICT'");

    expect(transition).toContain("for update;");
    expect(transition).toContain(
      "where workflow_id = p_workflow_id and idempotency_key = v_idempotency_key;",
    );
    expect(transition).toContain(
      "if v_workflow.version <> p_expected_version then",
    );
    expect(transition).toContain("message = 'SHIFT_CLOSE_VERSION_CONFLICT'");
    expect(transition).toContain("version = version + 1");

    expect(versionTrigger).toContain(
      "if new.version <> old.version + 1 then",
    );
    expect(versionTrigger).toContain(
      "message = 'SHIFT_CLOSE_VERSION_MUST_INCREMENT'",
    );
    expect(versionTrigger).toContain(
      "message = 'SHIFT_CLOSE_IDENTITY_IS_IMMUTABLE'",
    );
  });

  it("writes workflow state and audit events inside each atomic RPC", () => {
    const create = functionBlock("erp_demo_create_shift_close").replace(
      /\s+/g,
      " ",
    );
    const transition = functionBlock(
      "erp_demo_transition_shift_close",
    ).replace(/\s+/g, " ");

    expect(create).toContain(
      "insert into public.erp_shift_close_workflows",
    );
    expect(create).toContain(
      "insert into public.erp_shift_close_audit_events",
    );
    expect(create).toContain("'employee.submit'");
    expect(create).toContain("1, 'employee.submit', null, v_status");

    expect(transition).toContain(
      "update public.erp_shift_close_workflows",
    );
    expect(transition).toContain(
      "select coalesce(max(sequence_number), 0) + 1",
    );
    expect(transition).toContain(
      "insert into public.erp_shift_close_audit_events",
    );
    expect(transition).toContain(
      "'previousVersion', p_expected_version, 'newVersion', v_workflow.version",
    );
    expect(transition).toContain(
      "review_metadata || v_review_metadata || jsonb_build_object(v_actor_role, v_role_review)",
    );
  });

  it("enforces the settlement arithmetic used by matched and exception cases", () => {
    const workflow = tableBlock("erp_shift_close_workflows").replace(
      /\s+/g,
      " ",
    );

    expect(workflow).toContain(
      "check (cash_vnd + card_vnd + bank_transfer_vnd + qr_vnd = actual_settlement_vnd)",
    );
    expect(workflow).toContain(
      "check (net_sales_vnd = gross_sales_vnd - refund_vnd)",
    );
    expect(workflow).toContain(
      "check (expected_settlement_vnd = net_sales_vnd)",
    );
    expect(workflow).toContain(
      "check (difference_vnd = actual_settlement_vnd - expected_settlement_vnd)",
    );
  });

  it("replaces the nullable-site decision mutation policies with role-gated policies", () => {
    expect(compactSql).toContain(
      "drop policy if exists erp_decision_insert on public.erp_decision_items;",
    );
    expect(compactSql).toContain(
      "drop policy if exists erp_decision_update on public.erp_decision_items;",
    );
    expect(compactSql).toContain(
      "site_id is null and public.has_tenant_role(tenant_id, array['admin'])",
    );
    expect(compactSql).toContain(
      "site_id is not null and public.has_tenant_role( tenant_id, array['site-supervisor', 'icc-operator', 'admin'] ) and public.can_manage_erp_site(site_id)",
    );
    expect(compactSql).toContain(
      "where s.id = erp_decision_items.site_id and s.tenant_id = erp_decision_items.tenant_id",
    );
    expect(compactSql).not.toContain(
      "using (site_id is null or public.can_manage_erp_site(site_id))",
    );
    expect(compactSql).not.toContain(
      "with check (site_id is null or public.can_manage_erp_site(site_id))",
    );
  });

  it("keeps the three deterministic demo cases and their audit timelines", () => {
    const workflowSeedStart = sql.lastIndexOf(
      "insert into public.erp_shift_close_workflows (",
    );
    const auditSeedStart = sql.lastIndexOf(
      "insert into public.erp_shift_close_audit_events (",
    );
    const workflowSeed = sql.slice(workflowSeedStart, auditSeedStart);
    const auditSeed = sql.slice(auditSeedStart);

    expect(workflowSeed.match(/'61000000-0000-4000-8000-00000000000[1-3]'/g))
      .toHaveLength(3);
    expect(workflowSeed).toContain("'SC-TA-20260728-01'");
    expect(workflowSeed).toContain("'SC-TC-20260728-01'");
    expect(workflowSeed).toContain("'SC-BD-20260728-01'");
    expect(workflowSeed).toContain("462");
    expect(workflowSeed).toContain("79400000");
    expect(workflowSeed).toContain("'manager-approved'");
    expect(workflowSeed).toContain("'exception-pending-director'");
    expect(workflowSeed).toContain("-18000000");

    expect(auditSeed.match(/'62000000-0000-4000-8000-00000000000[1-6]'/g))
      .toHaveLength(6);
    expect(auditSeed).toContain("'employee.submit'");
    expect(auditSeed).toContain("'manager.review'");
    expect(auditSeed).toContain("'accountant.reconcile'");
  });
});
