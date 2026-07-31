import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607290007_erp_supplier_ap_workflow.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");
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

describe("ERP supplier AP migration 007 contract", () => {
  it("adds a normalized AP source, audit and idempotency model atomically", () => {
    expect(compact).toMatch(
      /^-- ERP supplier invoice to accounts-payable liability workflow\./,
    );
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    for (const table of [
      "erp_ap_suppliers",
      "erp_ap_posting_rules",
      "erp_ap_supplier_invoices",
      "erp_ap_supplier_invoice_lines",
      "erp_ap_audit_events",
      "erp_ap_command_receipts",
    ]) {
      expect(compact).toContain(`create table if not exists public.${table}`);
      expect(compact).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant select on table public.${table} to service_role;`,
      );
    }
    expect(compact).not.toMatch(
      /grant (?:insert|update|delete)[^;]*erp_ap_/i,
    );
    expect(compact).toContain(
      "unique ( tenant_id, supplier_tax_code_normalized, invoice_series_normalized, invoice_number_normalized )",
    );
    expect(compact).toContain(
      "unique (tenant_id, site_id, tax_code_normalized)",
    );
    expect(compact).toContain(
      "unique (tenant_id, command_scope, idempotency_key)",
    );
    expect(compact).toContain(
      "foreign key (invoice_id, tenant_id, site_id) references public.erp_ap_supplier_invoices",
    );
    expect(compact).toContain(
      "foreign key (journal_id, tenant_id, site_id) references public.erp_accounting_journals",
    );
    expect(compact).toContain(
      "before update or delete on public.erp_ap_audit_events",
    );
  });

  it("extends journal identity without weakening the shift-close foreign key", () => {
    expect(compact).toContain(
      "alter column source_workflow_id drop not null",
    );
    expect(compact).toContain(
      "add column if not exists source_supplier_invoice_id uuid",
    );
    expect(compact).toContain(
      "source_type = 'shift-close' and source_workflow_id is not null and source_supplier_invoice_id is null",
    );
    expect(compact).toContain(
      "source_type = 'supplier-invoice' and source_workflow_id is null and source_supplier_invoice_id is not null",
    );
    expect(compact).toContain(
      "foreign key (source_supplier_invoice_id, tenant_id, site_id) references public.erp_ap_supplier_invoices",
    );
    expect(compact).toContain(
      "erp_accounting_one_open_journal_per_ap_invoice_idx",
    );
    const guard = functionBlock("erp_validate_accounting_journal_update");
    expect(guard).toContain(
      "new.source_workflow_id is distinct from old.source_workflow_id",
    );
    expect(guard).toContain(
      "new.source_supplier_invoice_id is distinct from old.source_supplier_invoice_id",
    );
    expect(guard).toContain("AP_JOURNAL_REQUIRES_AP_WORKFLOW");
    expect(guard).toContain("ACCOUNTING_POSTED_JOURNAL_IMMUTABLE");
  });

  it("builds liability journals only from locked server-side invoice data", () => {
    const prepare = functionBlock(
      "erp_accounting_prepare_supplier_invoice",
    );
    const signature = prepare.slice(0, prepare.indexOf(") returns"));
    expect(signature).toBe(
      "create or replace function public.erp_accounting_prepare_supplier_invoice( p_invoice_id uuid, p_expected_source_version integer, p_actor_account_id text, p_note text, p_idempotency_key text, p_request_hash text ",
    );
    expect(signature).not.toMatch(
      /p_(?:net_vnd|vat_vnd|total_vnd|amount_vnd|debit_account|credit_account|cost_center|supplier_id)/,
    );
    expect(prepare).toContain(
      "from public.erp_ap_supplier_invoices invoice",
    );
    expect(prepare).toContain("for update;");
    expect(prepare).toContain("'accountant-maker'");
    expect(prepare).toContain("v_invoice.version <> p_expected_source_version");
    expect(prepare).toContain("v_period.status <> 'open'");
    expect(prepare).toContain(
      "from public.erp_ap_supplier_invoice_lines line",
    );
    expect(prepare).toContain("v_rule.debit_account_code");
    expect(prepare).toContain("v_rule.input_vat_account_code");
    expect(prepare).toContain("v_rule.payable_account_code");
    expect(prepare).toContain(
      "select coalesce(max(line.line_number), 0) into v_last_line_number",
    );
    expect(prepare).toContain(
      "set_config('app.erp_ap_mutation', 'allowed', true)",
    );
    expect(prepare).toContain("AP_JOURNAL_NOT_BALANCED");
    expect(prepare).toContain("status = 'accounting-review'");
    expect(prepare).toContain("owner_role = 'chief-accountant'");
    const replay = prepare.indexOf("if v_receipt.id is not null then");
    const version = prepare.indexOf(
      "if v_invoice.version <> p_expected_source_version then",
    );
    expect(replay).toBeGreaterThan(0);
    expect(replay).toBeLessThan(version);
  });

  it("keeps manager, accountant, checker and director decisions separated", () => {
    const submit = functionBlock("erp_ap_submit_supplier_invoice");
    expect(submit).toContain("'regional-manager'");
    expect(submit).toContain("AP_MANAGER_ROLE_REQUIRED");
    expect(submit).toContain(
      "public.erp_ap_match_exception_codes(",
    );
    expect(submit).toContain("AP_DUPLICATE_INVOICE");

    const escalate = functionBlock("erp_ap_escalate_supplier_invoice");
    expect(escalate).toContain("'accountant-maker'");
    expect(escalate).toContain(
      "v_rule.director_exception_threshold_vnd",
    );
    expect(escalate).toContain("status = 'director-exception'");

    const director = functionBlock("erp_ap_decide_supplier_exception");
    expect(director).toContain("'director'");
    expect(director).toContain("v_decision not in ('approve', 'return')");
    expect(director).toContain(
      "exception_approved_by_account_id",
    );

    const checker = functionBlock(
      "erp_accounting_review_supplier_invoice_journal",
    );
    expect(checker).toContain("'accounting-checker'");
    expect(checker).toContain(
      "v_actor.account_id = v_journal.maker_account_id",
    );
    expect(checker).toContain(
      "ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED",
    );
    expect(checker).toContain("status = 'checker-returned'");
    expect(checker).toContain("status = 'posted'");
    expect(checker).toContain("owner_role = 'none'");
  });

  it("prevents hidden close blockers and exposes mutation only through exact RPCs", () => {
    const closeGuard = functionBlock("erp_ap_block_period_lock");
    expect(closeGuard).toContain(
      "invoice.status not in ('posted', 'reversed')",
    );
    expect(closeGuard).toContain(
      "ACCOUNTING_PERIOD_HAS_OPEN_AP_INVOICES",
    );

    const rpcGrants = [
      "erp_ap_submit_supplier_invoice( uuid, uuid, text, text, text, bigint, text, bigint, text, text, date, date, bigint, bigint, bigint, text, text, text, text, text, text, text, text )",
      "erp_ap_resubmit_supplier_invoice( uuid, integer, text, bigint, text, bigint, text, text, text, text )",
      "erp_ap_escalate_supplier_invoice( uuid, integer, text, text, text, text )",
      "erp_ap_decide_supplier_exception( uuid, integer, text, text, text, text, text )",
      "erp_accounting_prepare_supplier_invoice( uuid, integer, text, text, text, text )",
      "erp_accounting_review_supplier_invoice_journal( uuid, integer, integer, text, text, text, text, text )",
    ];
    for (const signature of rpcGrants) {
      expect(compact).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }
  });
});
