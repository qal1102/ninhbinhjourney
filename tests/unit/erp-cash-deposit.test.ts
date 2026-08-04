import { describe, expect, it } from "vitest";
import {
  formatCashDifference,
  isCashDepositOverdue,
  type CashDeposit,
} from "@/domain/erp-cash-deposit";

function baseDeposit(
  overrides: Partial<Pick<CashDeposit, "status" | "exceptionDueAt">> = {},
): Pick<CashDeposit, "status" | "exceptionDueAt"> {
  return {
    status: "exception",
    exceptionDueAt: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("isCashDepositOverdue", () => {
  it("is false for a deposit that isn't in exception status, even past the date", () => {
    expect(
      isCashDepositOverdue(
        baseDeposit({ status: "submitted" }),
        new Date("2026-08-10T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is false while an exception is still within its SLA window", () => {
    expect(
      isCashDepositOverdue(baseDeposit(), new Date("2026-08-05T00:00:00.000Z")),
    ).toBe(false);
  });

  it("is true once an exception's deadline has passed", () => {
    expect(
      isCashDepositOverdue(baseDeposit(), new Date("2026-08-07T00:00:00.000Z")),
    ).toBe(true);
  });

  it("is false for an exception with no deadline recorded", () => {
    expect(
      isCashDepositOverdue(
        baseDeposit({ exceptionDueAt: null }),
        new Date("2026-08-10T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("formatCashDifference", () => {
  it("says the deposit matches exactly at zero", () => {
    expect(formatCashDifference(0)).toBe("Khớp đúng số");
  });

  it("names a positive difference as the bank receiving less than the shift reported", () => {
    expect(formatCashDifference(50_000)).toContain("nhận thiếu");
    expect(formatCashDifference(50_000)).toContain("50.000");
  });

  it("names a negative difference as the bank receiving more than the shift reported", () => {
    expect(formatCashDifference(-20_000)).toContain("nhận thừa");
    expect(formatCashDifference(-20_000)).toContain("20.000");
  });
});
