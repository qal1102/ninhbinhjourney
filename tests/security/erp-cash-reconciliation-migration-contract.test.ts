import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readMigration(fileName: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../supabase/migrations/${fileName}`, import.meta.url)),
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

const schema = readMigration("202608050034_erp_cash_reconciliation.sql");
const rpc = readMigration("202608050035_erp_cash_reconciliation_rpc.sql");
const combined = `${schema} ${rpc}`;

function functionBody(source: string, name: string) {
  const body = source.split(`create or replace function public.${name}`)[1];
  expect(body, `${name} is missing`).toBeDefined();
  return body ?? "";
}

describe("ERP cash reconciliation migration 034 (schema) contract", () => {
  it("applies atomically", () => {
    expect(schema).toContain("begin;");
    expect(schema.endsWith("commit;")).toBe(true);
  });

  it("never lets a shift's cash be claimed by more than one deposit", () => {
    // Bẫy đếm trùng: mỗi ca chỉ được gộp vào đúng một lượt nộp, vĩnh viễn.
    expect(schema).toContain("unique (shift_close_id)");
  });

  it("forces maker and checker apart at the table level, not only in the RPC", () => {
    expect(schema).toContain(
      "reconciled_by_account_id is null or reconciled_by_account_id <> submitted_by_account_id",
    );
  });

  it("requires an owner and a deadline before a deposit can sit in exception state", () => {
    expect(schema).toContain(
      "status <> 'exception' or (exception_owner_account_id is not null and exception_due_at is not null)",
    );
  });

  it("requires a posted journal and a reconciler before a deposit can be posted", () => {
    expect(schema).toContain(
      "status <> 'posted' or ( journal_id is not null and reconciled_by_account_id is not null and reconciled_at is not null )",
    );
  });

  it("widens the shared journal table to a third source type without dropping the first two", () => {
    expect(schema).toContain(
      "check (source_type in ('shift-close', 'supplier-invoice', 'cash-deposit'))",
    );
    expect(schema).toContain("source_type = 'shift-close'");
    expect(schema).toContain("source_type = 'supplier-invoice'");
    expect(schema).toContain("source_type = 'cash-deposit'");
  });

  it("blocks direct writes to a cash-deposit journal outside this module's own RPCs", () => {
    const body = functionBody(schema, "erp_validate_accounting_journal_update()");
    expect(body).toContain("app.erp_cash_mutation");
    expect(body).toContain("CASH_JOURNAL_REQUIRES_CASH_WORKFLOW");
    // La bàn cũ (supplier-invoice) phải còn nguyên, không bị migration này gỡ.
    expect(body).toContain("app.erp_ap_mutation");
  });

  it("only allows one open (non-reversed) journal per deposit at a time", () => {
    expect(schema).toContain("erp_accounting_one_open_journal_per_deposit_idx");
  });

  it("lets cash-deposit events into the shared entity_type enum used by T15's timeline", () => {
    expect(schema).toContain(
      "check (entity_type in ('journal', 'period', 'shift-close', 'cash-deposit'))",
    );
  });
});

describe("ERP cash reconciliation migration 035 (RPC) contract", () => {
  it("applies atomically", () => {
    expect(rpc).toContain("begin;");
    expect(rpc.endsWith("commit;")).toBe(true);
  });

  it("only bundles shifts that are actually posted, at the right site, into a deposit", () => {
    const body = functionBody(rpc, "erp_cash_submit_deposit(");
    expect(body).toContain("w.status = 'posted'");
    expect(body).toContain("CASH_SHIFT_NOT_POSTED_OR_NOT_FOUND");
    expect(body).toContain("CASH_SHIFT_ALREADY_DEPOSITED");
    expect(body).toContain("erp_account_has_active_role");
    expect(body).toContain("'accountant-maker'");
  });

  it("statement lines recorded here are always manual, never a bank-api claim", () => {
    const body = functionBody(rpc, "erp_cash_record_statement_line(");
    expect(body).toContain("'manual'");
    expect(body).not.toMatch(/'bank-api'\s*,?\s*$/m);
  });

  it("an exact match posts a balanced draft journal and moves straight to review", () => {
    const body = functionBody(rpc, "erp_cash_match_deposit(");
    expect(body).toContain("v_diff = 0");
    expect(body).toContain("erp_cash_build_deposit_journal");
    expect(body).toContain("'accounting-review'");
  });

  it("a mismatch creates an exception with an owner and a deadline, and never silently drops it", () => {
    const body = functionBody(rpc, "erp_cash_match_deposit(");
    expect(body).toContain("'exception'");
    expect(body).toContain("exception_owner_account_id = v_actor");
    expect(body).toContain("exception_due_at = now() + interval '24 hours'");
    // Dòng sao kê không bị khoá vào một lượt nộp sai — vẫn 'unmatched' để thử lại.
    expect(body).not.toContain("status = 'matched'\n    where id = v_line.id");
  });

  it("an approved exception posts the honest difference to 1388/3388, never absorbs it silently", () => {
    const body = functionBody(rpc, "erp_cash_decide_exception(");
    expect(body).toContain("'1388'");
    expect(body).toContain("Chênh lệch thiếu chờ xử lý");
    expect(body).toContain("'3388'");
    expect(body).toContain("Chênh lệch thừa chờ xử lý");
  });

  it("only chief-accountant or director may decide an exception", () => {
    const body = functionBody(rpc, "erp_cash_decide_exception(");
    expect(body).toContain("'accounting-checker'");
    expect(body).toContain("'director'");
  });

  it("the checker who posts a deposit's journal can never be the maker who submitted it", () => {
    const body = functionBody(rpc, "erp_accounting_review_cash_deposit_journal(");
    expect(body).toContain("ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED");
    expect(body).toContain("v_actor = v_deposit.submitted_by_account_id");
  });

  it("a returned journal frees the statement line back to unmatched instead of leaving it stranded", () => {
    const body = functionBody(rpc, "erp_accounting_review_cash_deposit_journal(");
    expect(body).toContain("status = 'unmatched', matched_deposit_id = null");
  });

  it("posts a balanced journal or refuses, for both the exact-match and exception paths", () => {
    const body = functionBody(rpc, "erp_cash_build_deposit_journal(");
    expect(body).toContain("erp_accounting_journal_is_balanced");
    expect(body).toContain("CASH_JOURNAL_NOT_BALANCED");
  });

  it("runs every function with a pinned search path and hands them only to service_role", () => {
    for (const fn of [
      "erp_cash_next_deposit_code",
      "erp_cash_build_deposit_journal",
      "erp_cash_submit_deposit",
      "erp_cash_record_statement_line",
      "erp_cash_match_deposit",
      "erp_cash_decide_exception",
      "erp_accounting_review_cash_deposit_journal",
    ]) {
      expect(rpc, `${fn} missing revoke`).toContain(
        `revoke all on function public.${fn}`,
      );
      expect(rpc, `${fn} not granted to service_role`).toMatch(
        new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`),
      );
    }
    const definers = combined.match(/security definer\s*set search_path = ''/g) ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(6);
  });
});
