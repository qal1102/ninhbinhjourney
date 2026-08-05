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

const migration = readMigration(
  "202608050036_erp_accounting_reverse_journal_cash_deposit.sql",
);

function functionBody(source: string, name: string) {
  const body = source.split(`create or replace function public.${name}`)[1];
  expect(body, `${name} is missing`).toBeDefined();
  return body ?? "";
}

describe("ERP accounting reverse-journal cash-deposit migration 036 contract", () => {
  it("applies atomically", () => {
    expect(migration).toContain("begin;");
    expect(migration.endsWith("commit;")).toBe(true);
  });

  it("branches source validation by source_type instead of always requiring a shift-close workflow", () => {
    // Bug that shipped to production 05/08: the pre-fix RPC always joined
    // erp_shift_close_workflows via source_workflow_id, which is NULL for
    // a cash-deposit sourced journal, so every cash-deposit reversal failed
    // with a misleading "record was updated by someone else" message.
    const body = functionBody(migration, "erp_accounting_reverse_journal");
    expect(body).toContain("v_original.source_type = 'shift-close'");
    expect(body).toContain("v_original.source_type = 'cash-deposit'");
    expect(body).toContain("from public.erp_cash_deposits deposit");
    expect(body).toContain("ACCOUNTING_CASH_DEPOSIT_NOT_FOUND");
  });

  it("refuses unsupported source types explicitly instead of silently misreporting them", () => {
    const body = functionBody(migration, "erp_accounting_reverse_journal");
    expect(body).toContain("ACCOUNTING_REVERSAL_SOURCE_TYPE_NOT_SUPPORTED");
  });

  it("stamps the reversal journal's own source-identity columns instead of leaving them at NULL defaults", () => {
    const body = functionBody(migration, "erp_accounting_reverse_journal");
    expect(body).toContain("source_supplier_invoice_id,");
    expect(body).toContain("source_cash_deposit_id,");
    expect(body).toContain("v_original.source_supplier_invoice_id,");
    expect(body).toContain("v_original.source_cash_deposit_id,");
  });

  it("only re-opens the shift-close workflow for a shift-close sourced reversal", () => {
    // Cash-deposit has no equivalent "reopen for rework" state in the
    // current spec -- the generic erp_accounting_write_audit calls already
    // cover it in /erp/nhat-ky regardless of source.
    const body = functionBody(migration, "erp_accounting_reverse_journal");
    const guardedUpdate = body.split("update public.erp_shift_close_workflows")[0];
    expect(guardedUpdate.trim().endsWith("if v_original.source_type = 'shift-close' then")).toBe(
      true,
    );
  });

  it("keeps every other guard from migration 202607290006 unchanged", () => {
    const body = functionBody(migration, "erp_accounting_reverse_journal");
    expect(body).toContain("ACCOUNTING_CHECKER_ROLE_REQUIRED");
    expect(body).toContain("ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED");
    expect(body).toContain("ACCOUNTING_JOURNAL_VERSION_CONFLICT");
    expect(body).toContain("ACCOUNTING_ONLY_POSTED_ORIGINAL_CAN_BE_REVERSED");
    expect(body).toContain("ACCOUNTING_JOURNAL_ALREADY_REVERSED");
    expect(body).toContain("ACCOUNTING_PERIOD_IS_LOCKED");
    expect(body).toContain("ACCOUNTING_REVERSAL_NOT_BALANCED");
  });
});
