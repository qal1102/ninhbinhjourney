import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607290006_erp_accounting_maker_checker.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function blockBetween(startMarker: string, endMarker: string) {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Missing migration block: ${startMarker}`);
  }
  return sql.slice(start, end + endMarker.length);
}

function functionBlock(name: string) {
  return blockBetween(
    `create or replace function public.${name}(`,
    "\n$$;",
  ).replace(/\s+/g, " ");
}

function tableBlock(name: string) {
  return blockBetween(
    `create table if not exists public.${name} (`,
    "\n);",
  );
}

describe("ERP accounting migration 006 contract", () => {
  it("applies atomically and persists the accounting control model", () => {
    expect(compact).toMatch(/^-- ERP accounting maker-checker slice\./);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);

    for (const table of [
      "erp_account_registry",
      "erp_account_role_assignments",
      "erp_accounting_periods",
      "erp_accounting_journals",
      "erp_accounting_journal_lines",
      "erp_accounting_audit_events",
      "erp_accounting_command_receipts",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table}`);
    }

    const roleAssignments = tableBlock("erp_account_role_assignments");
    for (const role of [
      "employee",
      "regional-manager",
      "accountant-maker",
      "accounting-checker",
      "director",
    ]) {
      expect(roleAssignments).toContain(`'${role}'`);
    }
    expect(roleAssignments).not.toContain("'accountant'");
    expect(roleAssignments).toContain("effective_from timestamptz not null");
    expect(roleAssignments).toContain("effective_until timestamptz");
    expect(roleAssignments).toContain("site_id uuid references public.sites(id)");

    const journals = tableBlock("erp_accounting_journals");
    for (const status of [
      "draft",
      "pending-checker",
      "checker-returned",
      "posted",
    ]) {
      expect(journals).toContain(`'${status}'`);
    }
    expect(journals).toContain("reversal_of_journal_id uuid");
    expect(journals).toContain("supersedes_journal_id uuid");
    expect(journals).toContain("source_workflow_id uuid not null");

    const periods = tableBlock("erp_accounting_periods");
    expect(periods).toContain("status in ('open', 'locked')");
    expect(periods).toContain("version integer not null default 1");

    const audit = tableBlock("erp_accounting_audit_events");
    for (const column of [
      "sequence_number integer not null",
      "actor_account_id text not null",
      "actor_role text not null",
      "from_status text",
      "to_status text not null",
      "metadata jsonb not null",
      "idempotency_key text not null",
      "request_hash text not null",
      "occurred_at timestamptz not null",
    ]) {
      expect(audit).toContain(column);
    }
    expect(audit).toContain(
      "actor_role in ('accountant-maker', 'accounting-checker', 'system')",
    );
    expect(audit).toContain("request_hash ~ '^[0-9a-f]{64}$'");

    const receipts = tableBlock("erp_accounting_command_receipts");
    expect(receipts).toContain(
      "unique (tenant_id, command_scope, idempotency_key)",
    );
    expect(receipts).toContain(
      "entity_type text not null check (entity_type in ('journal', 'period'))",
    );
    expect(receipts).toContain("response jsonb not null");
  });

  it("seeds real role assignments without seeding fake stock journals", () => {
    const preFunctions = sql.slice(
      0,
      sql.indexOf(
        "create or replace function public.erp_account_has_active_role(",
      ),
    );
    for (const accountId of [
      "director-001",
      "manager-trang-an",
      "accountant-001",
      "chief-accountant-001",
      "employee-trang-an-01",
      "employee-trang-an-02",
      "employee-trang-an-seasonal-01",
      "employee-tam-chuc-01",
      "employee-tam-coc-01",
      "employee-bai-dinh-01",
    ]) {
      expect(preFunctions).toContain(`'${accountId}'`);
    }
    expect(
      preFunctions.match(/'manager-trang-an',\s*'regional-manager'/g),
    ).toHaveLength(4);
    expect(preFunctions).toContain(
      "'employee-trang-an-seasonal-01',\n    'employee',",
    );
    expect(preFunctions).toContain("'2026-08-31T23:59:59+07:00'");
    expect(preFunctions).toContain("'2026-07',");
    expect(preFunctions).toContain("'open',");
    expect(preFunctions).not.toContain(
      "insert into public.erp_accounting_journals",
    );
    expect(preFunctions.toLowerCase()).not.toContain("stock");
  });

  it("exposes only the four exact server-side command contracts", () => {
    const contracts = [
      {
        name: "erp_accounting_prepare_shift_close",
        signature:
          "public.erp_accounting_prepare_shift_close( p_workflow_id uuid, p_expected_source_version integer, p_actor_account_id text, p_note text, p_idempotency_key text, p_request_hash text ) returns public.erp_accounting_journals",
        grant:
          "public.erp_accounting_prepare_shift_close( uuid, integer, text, text, text, text )",
      },
      {
        name: "erp_accounting_review_journal",
        signature:
          "public.erp_accounting_review_journal( p_journal_id uuid, p_expected_version integer, p_actor_account_id text, p_decision text, p_note text, p_idempotency_key text, p_request_hash text ) returns public.erp_accounting_journals",
        grant:
          "public.erp_accounting_review_journal( uuid, integer, text, text, text, text, text )",
      },
      {
        name: "erp_accounting_reverse_journal",
        signature:
          "public.erp_accounting_reverse_journal( p_journal_id uuid, p_expected_version integer, p_actor_account_id text, p_reason text, p_idempotency_key text, p_request_hash text ) returns public.erp_accounting_journals",
        grant:
          "public.erp_accounting_reverse_journal( uuid, integer, text, text, text, text )",
      },
      {
        name: "erp_accounting_change_period",
        signature:
          "public.erp_accounting_change_period( p_period_key text, p_expected_version integer, p_actor_account_id text, p_action text, p_reason text, p_idempotency_key text, p_request_hash text ) returns public.erp_accounting_periods",
        grant:
          "public.erp_accounting_change_period( text, integer, text, text, text, text, text )",
      },
    ];

    for (const contract of contracts) {
      const block = functionBlock(contract.name);
      expect(block).toContain(contract.signature);
      expect(block).toContain("security definer");
      expect(block).toContain("set search_path = ''");
      expect(compact).toContain(
        `revoke all on function ${contract.grant} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${contract.grant} to service_role;`,
      );
    }
  });

  it("builds shift-close journals only from locked server-side source data", () => {
    const prepare = functionBlock("erp_accounting_prepare_shift_close");
    const signature = prepare.slice(0, prepare.indexOf(") returns"));

    expect(signature).not.toMatch(
      /p_(?:cash|card|bank|qr|refund|difference|gross|amount)/,
    );
    expect(prepare).toContain(
      "from public.erp_shift_close_workflows workflow",
    );
    expect(prepare).toContain("for update;");
    expect(prepare).toContain("'accountant-maker'");
    expect(prepare).toContain("ACCOUNTING_MAKER_ROLE_REQUIRED");
    expect(prepare).toContain(
      "v_workflow.version <> p_expected_source_version",
    );
    expect(prepare).toContain("v_source_from_status := v_workflow.status");
    expect(prepare).toContain("v_period.status <> 'open'");
    expect(prepare).toContain("v_receipt.request_hash <> v_hash");

    const receiptReplay = prepare.indexOf("if v_receipt.id is not null then");
    const versionCheck = prepare.indexOf(
      "if v_workflow.version <> p_expected_source_version then",
    );
    expect(receiptReplay).toBeGreaterThan(0);
    expect(receiptReplay).toBeLessThan(versionCheck);

    for (const sourceColumn of [
      "v_workflow.cash_vnd",
      "v_workflow.card_vnd",
      "v_workflow.bank_transfer_vnd",
      "v_workflow.qr_vnd",
      "v_workflow.refund_vnd",
      "v_workflow.difference_vnd",
      "v_workflow.gross_sales_vnd",
    ]) {
      expect(prepare).toContain(sourceColumn);
    }
    for (const accountCode of ["1111", "1121", "5212", "1388", "5111", "3388"]) {
      expect(prepare).toContain(`'${accountCode}'`);
    }
    expect(prepare).toContain("greatest(-v_workflow.difference_vnd");
    expect(prepare).toContain("greatest(v_workflow.difference_vnd");
    expect(prepare).toContain("ACCOUNTING_JOURNAL_NOT_BALANCED");
    expect(prepare).toContain(
      "v_journal.status = 'checker-returned'",
    );
    expect(prepare).toContain("status = 'pending-checker'");
    expect(prepare).toContain("'journal.resubmitted'");
    expect(prepare).toContain("v_supersedes_journal_id := v_journal.id");
  });

  it("enforces checker separation and atomically approves, returns or posts", () => {
    const review = functionBlock("erp_accounting_review_journal");

    expect(review).toContain("v_decision not in ('approve', 'return')");
    expect(review).toContain("'accounting-checker'");
    expect(review).toContain("ACCOUNTING_CHECKER_ROLE_REQUIRED");
    expect(review).toContain(
      "v_actor.account_id = v_journal.maker_account_id",
    );
    expect(review).toContain(
      "ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED",
    );
    expect(review).toContain(
      "not public.erp_accounting_journal_is_balanced(v_journal.id)",
    );
    expect(review).toContain("status = 'checker-returned'");
    expect(review).toContain("v_workflow.status <> 'accounting-review'");
    expect(review).toContain(
      "v_workflow.director_decision is distinct from 'approve'",
    );
    expect(review).toContain(
      "ACCOUNTING_DIRECTOR_APPROVAL_REQUIRED_FOR_DIFFERENCE",
    );

    const postJournal = review.indexOf(
      "update public.erp_accounting_journals set status = 'posted'",
    );
    const postSource = review.indexOf(
      "update public.erp_shift_close_workflows set status = 'posted'",
    );
    expect(postJournal).toBeGreaterThan(0);
    expect(postSource).toBeGreaterThan(postJournal);
    expect(review).toContain("'journal.approved-and-posted'");
    expect(review).toContain("'journal.returned'");
    expect(review).toContain("insert into public.erp_accounting_command_receipts");
  });

  it("reverses with opposite lines, preserves originals and reopens the source", () => {
    const reverse = functionBlock("erp_accounting_reverse_journal");

    expect(reverse).toContain("v_original.status <> 'posted'");
    expect(reverse).toContain(
      "v_original.reversal_of_journal_id is not null",
    );
    expect(reverse).toContain("'accounting-checker'");
    expect(reverse).toContain(
      "v_actor.account_id = v_original.maker_account_id",
    );
    expect(reverse).toContain(
      "original_line.credit_vnd, original_line.debit_vnd",
    );
    expect(reverse).toContain("reversal_of_journal_id");
    expect(reverse).toContain("where id = v_reversal.id");
    expect(reverse).not.toMatch(
      /update public\.erp_accounting_journals set [\s\S]*?where id = v_original\.id/,
    );
    expect(reverse).toContain(
      "update public.erp_shift_close_workflows set status = 'accounting-review'",
    );
    expect(reverse).toContain("'journal.reversal-created'");
    expect(reverse).toContain("'journal.reversal-posted'");
  });

  it("locks and reopens the correct tenant period with reason and versioning", () => {
    const changePeriod = functionBlock("erp_accounting_change_period");

    expect(changePeriod).toContain("v_action not in ('lock', 'reopen')");
    expect(changePeriod).toContain("char_length(v_reason) not between 4 and 2000");
    expect(changePeriod).toContain(
      "where account.account_id = trim(p_actor_account_id)",
    );
    expect(changePeriod).toContain(
      "where period.tenant_id = v_actor.tenant_id and period.period_key = trim(p_period_key)",
    );
    expect(changePeriod).toContain("'accounting-checker'");
    expect(changePeriod).toContain(
      "v_period.version <> p_expected_version",
    );
    expect(changePeriod).toContain("ACCOUNTING_PERIOD_HAS_OPEN_JOURNALS");
    expect(changePeriod).toContain("status = 'locked'");
    expect(changePeriod).toContain("status = 'open'");
    expect(changePeriod).toContain("'period.locked'");
    expect(changePeriod).toContain("'period.reopened'");
  });

  it("makes posted accounting and audits immutable and blocks legacy direct posting", () => {
    const journalGuard = functionBlock(
      "erp_validate_accounting_journal_update",
    );
    const lineGuard = functionBlock(
      "erp_protect_accounting_journal_lines",
    );
    const auditGuard = functionBlock("erp_protect_accounting_audit");
    const sourceGuard = functionBlock(
      "erp_require_posted_accounting_journal",
    );

    expect(journalGuard).toContain("ACCOUNTING_POSTED_JOURNAL_IMMUTABLE");
    expect(journalGuard).toContain(
      "ACCOUNTING_JOURNAL_VERSION_MUST_INCREMENT",
    );
    expect(journalGuard).toContain(
      "ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED",
    );
    expect(lineGuard).toContain(
      "ACCOUNTING_POSTED_JOURNAL_LINES_IMMUTABLE",
    );
    expect(lineGuard).toContain(
      "v_old_status = 'posted' or v_new_status = 'posted'",
    );
    expect(auditGuard).toContain("ACCOUNTING_AUDIT_IS_APPEND_ONLY");
    expect(sourceGuard).toContain(
      "new.status = 'posted' and old.status is distinct from 'posted'",
    );
    expect(sourceGuard).toContain("journal.status = 'posted'");
    expect(sourceGuard).toContain(
      "journal.reversal_of_journal_id is null",
    );
    expect(sourceGuard).toContain(
      "SHIFT_CLOSE_POST_REQUIRES_CHECKER_APPROVED_JOURNAL",
    );
  });

  it("enables RLS and allows service-role reads plus RPC execution only", () => {
    for (const table of [
      "erp_account_registry",
      "erp_account_role_assignments",
      "erp_accounting_periods",
      "erp_accounting_journals",
      "erp_accounting_journal_lines",
      "erp_accounting_audit_events",
      "erp_accounting_command_receipts",
    ]) {
      expect(compact).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant select on table public.${table} to service_role;`,
      );
      expect(compact).not.toContain(`grant insert on table public.${table}`);
      expect(compact).not.toContain(`grant update on table public.${table}`);
      expect(compact).not.toContain(`grant delete on table public.${table}`);
    }
    expect(compact).not.toMatch(
      /create policy \S+ on public\.erp_account(?:ing)?_\S+ [^;]* to (?:anon|authenticated)/i,
    );
  });
});
