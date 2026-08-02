import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608020030_erp_ap_payment_settlement.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP supplier payment migration 030 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("opens the two steps that discharge a payable", () => {
    expect(compact).toContain("'payment-requested'");
    expect(compact).toContain("'paid'");
    expect(compact).toContain(
      "(old.status = 'posted' and new.status = 'payment-requested')",
    );
    expect(compact).toContain(
      "(old.status = 'payment-requested' and new.status in ('posted', 'paid'))",
    );
  });

  it("moves the point of no return from posted to paid", () => {
    // `posted` used to be terminal, which is exactly why nothing could ever be
    // recorded as settled.
    expect(compact).toContain("if old.status in ('paid', 'reversed') then");
    expect(compact).not.toContain("if old.status in ('posted', 'reversed') then");
    // The accounting facts of a posted invoice still cannot move.
    expect(compact).toContain("new.journal_id is distinct from old.journal_id");
  });

  it("keeps the person who asks for a payment away from the one who makes it", () => {
    // Enforced by the table, not only by the function that happens to write it.
    expect(compact).toContain("erp_ap_invoice_payment_separation_check");
    expect(compact).toContain(
      "paid_by_account_id <> payment_requested_by_account_id",
    );
    expect(compact).toContain("'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED'");
  });

  it("cannot record a payment without who, when, how much and how", () => {
    expect(compact).toContain("erp_ap_invoice_paid_shape_check");
    for (const column of [
      "paid_by_account_id is not null",
      "paid_at is not null",
      "paid_amount_vnd is not null",
      "payment_method is not null",
    ]) {
      expect(compact, `missing ${column}`).toContain(column);
    }
    expect(compact).toContain("'AP_PAYMENT_AMOUNT_INVALID'");
  });

  it("does not make an accounting period unlockable because a transfer is in flight", () => {
    // The journal is posted in this period; the money may well leave in the
    // next one. Without this the new states would block every period lock.
    expect(compact).toContain(
      "invoice.status not in ('posted', 'payment-requested', 'paid', 'reversed')",
    );
  });

  it("keeps both new functions hardened and service-role only", () => {
    for (const fn of [
      "erp_ap_request_supplier_payment",
      "erp_ap_settle_supplier_payment",
    ]) {
      const block = sql.split(`create or replace function public.${fn}`)[1];
      expect(block, `${fn} missing`).toBeDefined();
      expect(block?.slice(0, 4000)).toContain("security definer");
      expect(block?.slice(0, 4000)).toContain("set search_path = ''");
      expect(compact).toContain(`grant execute on function public.${fn}`);
      expect(compact).toContain(`revoke all on function public.${fn}`);
    }
    expect(compact).toContain("'AP_ACCOUNTANT_ROLE_REQUIRED'");
    expect(compact).toContain("'AP_CHECKER_ROLE_REQUIRED'");
    expect(compact).toContain("for update");
    expect(compact).toContain("'AP_INVOICE_VERSION_CONFLICT'");
  });
});
