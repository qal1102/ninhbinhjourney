import { describe, expect, it } from "vitest";
import {
  ERP_COST_BREAKDOWN,
  ERP_DAILY_FINANCE,
  ERP_FINANCE_REPORT,
  ERP_SITE_FINANCE,
} from "@/domain/erp-operating-data";

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

describe("ERP finance data", () => {
  it("keeps every reporting period internally balanced", () => {
    for (const period of Object.values(ERP_FINANCE_REPORT)) {
      const { revenue, cost, profit, collected } = period.metrics;

      expect(cost.valueMillion + profit.valueMillion).toBe(
        revenue.valueMillion,
      );
      expect(collected.valueMillion).toBeLessThanOrEqual(revenue.valueMillion);

      for (const metric of Object.values(period.metrics)) {
        expect(sum(metric.breakdown.map((item) => item.valueMillion))).toBe(
          metric.valueMillion,
        );
      }
    }
  });

  it("keeps the daily regional totals equal to the four sites", () => {
    expect(sum(ERP_SITE_FINANCE.map((site) => site.revenueMillion))).toBe(
      ERP_DAILY_FINANCE.revenueMillion,
    );
    expect(sum(ERP_SITE_FINANCE.map((site) => site.costMillion))).toBe(
      ERP_DAILY_FINANCE.operatingCostMillion,
    );
    expect(sum(ERP_SITE_FINANCE.map((site) => site.profitMillion))).toBe(
      ERP_DAILY_FINANCE.operatingProfitMillion,
    );
    expect(sum(ERP_COST_BREAKDOWN.map((item) => item.valueMillion))).toBe(
      ERP_DAILY_FINANCE.operatingCostMillion,
    );
  });

  it("keeps the monthly site contribution equal to the consolidated report", () => {
    expect(
      sum(ERP_SITE_FINANCE.map((site) => site.monthRevenueBillion * 1000)),
    ).toBe(ERP_FINANCE_REPORT.month.metrics.revenue.valueMillion);
    expect(
      sum(ERP_SITE_FINANCE.map((site) => site.monthProfitBillion * 1000)),
    ).toBe(ERP_FINANCE_REPORT.month.metrics.profit.valueMillion);
  });
});
