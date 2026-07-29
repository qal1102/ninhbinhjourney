import { describe, expect, it } from "vitest";
import {
  ERP_ACCOUNTANT_MODULE_IDS,
  canDecideTicketShiftException,
  canCreateCommercialQuote,
  canManageStaffAccess,
  canReconcileTicketShift,
  canReviewTicketShift,
  canSubmitFieldOperation,
  canSubmitTicketShift,
  canViewRegionalFinance,
  hasErpCapability,
} from "@/domain/erp-role-policy";

describe("ERP role policy", () => {
  it("keeps the accountant on financial source records, not field control", () => {
    expect(ERP_ACCOUNTANT_MODULE_IDS).toEqual(expect.arrayContaining([
      "ve-dat-cho",
      "bao-cao-hien-truong",
      "du-an-su-kien",
      "tai-san-bao-tri",
      "doi-tac-nha-cung-ung",
      "tai-chinh-doi-soat",
      "bao-cao",
    ]));
    expect(ERP_ACCOUNTANT_MODULE_IDS).not.toEqual(expect.arrayContaining([
      "camera-ai",
      "suc-chua",
      "su-co",
      "nhan-su",
      "cham-cong",
      "xe-trung-chuyen",
    ]));
  });

  it("separates maker, checker and operating actions", () => {
    expect(canViewRegionalFinance("accountant")).toBe(true);
    expect(hasErpCapability("accountant", "accounting.document.verify")).toBe(true);
    expect(hasErpCapability("accountant", "accounting.journal.prepare")).toBe(true);
    expect(hasErpCapability("accountant", "accounting.exception.approve")).toBe(false);
    expect(hasErpCapability("director", "accounting.exception.approve")).toBe(true);

    expect(canSubmitTicketShift("employee")).toBe(true);
    expect(canSubmitTicketShift("manager")).toBe(false);
    expect(canReviewTicketShift("manager")).toBe(true);
    expect(canReviewTicketShift("employee")).toBe(false);
    expect(canReconcileTicketShift("accountant")).toBe(true);
    expect(canReconcileTicketShift("manager")).toBe(false);
    expect(canDecideTicketShiftException("director")).toBe(true);
    expect(canDecideTicketShiftException("accountant")).toBe(false);
    expect(canCreateCommercialQuote("accountant")).toBe(false);
    expect(canSubmitFieldOperation("accountant")).toBe(false);
    expect(canManageStaffAccess("accountant")).toBe(false);
    expect(canManageStaffAccess("manager")).toBe(true);
  });
});
