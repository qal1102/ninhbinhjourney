import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findRpcBusinessMessage,
  isBusinessRuleCode,
} from "@/lib/erp/rpc-error-messages";

describe("RPC business-error translation", () => {
  it("turns a permission refusal into an instruction, not an outage report", () => {
    // The exact shape PostgREST returns for `raise exception using message=...`.
    const message = findRpcBusinessMessage({
      code: "42501",
      message: "AP_MANAGER_ROLE_REQUIRED",
      details: null,
      hint: null,
    });
    expect(message).toContain("quản lý vận hành của cơ sở này");
    // It must name who fixes it. "Báo bộ phận hệ thống" was the old answer and
    // it sent people to the wrong place -- a director grants this, not IT.
    expect(message).toContain("giám đốc");
  });

  it("reads the code out of details or hint, not just message", () => {
    expect(
      findRpcBusinessMessage({
        message: "unexpected error",
        details: "ACCOUNTING_PERIOD_IS_LOCKED",
      }),
    ).toContain("Kỳ kế toán đã khóa");
    expect(
      findRpcBusinessMessage({ hint: "AP_DUPLICATE_INVOICE" }),
    ).toContain("đã tồn tại");
  });

  it("prefers the longest matching code so near-identical prefixes cannot collide", () => {
    // AP_INVOICE_NOT_READY_FOR_ACCOUNTING must never be reported as
    // AP_INVOICE_NOT_FOUND; both start with AP_INVOICE_NOT.
    expect(
      findRpcBusinessMessage({
        message: "AP_INVOICE_NOT_READY_FOR_ACCOUNTING",
      }),
    ).toContain("chưa ở trạng thái sẵn sàng cho kế toán");
  });

  it("leaves genuinely unknown failures to the generic path", () => {
    expect(findRpcBusinessMessage({ message: "connection reset" })).toBeNull();
    expect(findRpcBusinessMessage(null)).toBeNull();
    expect(findRpcBusinessMessage("AP_MANAGER_ROLE_REQUIRED")).toBeNull();
    expect(isBusinessRuleCode("SOMETHING_ELSE")).toBe(false);
  });

  it("covers every code the ERP migrations actually raise", () => {
    // The value of this table is that a refusal reaches the user in words. A
    // code added to a migration without a sentence here silently regresses to
    // "contact support", so the test reads the migrations rather than a list
    // somebody has to remember to update.
    const migrationDir = fileURLToPath(
      new URL("../../supabase/migrations/", import.meta.url),
    );
    const raised = new Set<string>();
    for (const file of readdirSync(migrationDir).filter((name) =>
      name.endsWith(".sql"),
    )) {
      const sql = readFileSync(migrationDir + file, "utf8");
      for (const match of sql.matchAll(/message = '([A-Z][A-Z_]{4,})'/g)) {
        raised.add(match[1]);
      }
    }
    expect(raised.size).toBeGreaterThan(40);

    const untranslated = [...raised]
      .filter((code) => !isBusinessRuleCode(code))
      .sort();
    expect(untranslated, "codes with no Vietnamese sentence").toEqual([]);
  });
});
