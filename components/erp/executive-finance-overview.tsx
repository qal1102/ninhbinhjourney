"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ERP_FINANCE_REPORT,
  formatFinanceAmount,
  type ErpFinanceMetricId,
  type ErpFinancePeriodId,
} from "@/domain/erp-operating-data";

const periods: Array<{ id: ErpFinancePeriodId; label: string }> = [
  { id: "today", label: "Ngày" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
  { id: "year", label: "Năm" },
];

const metricOrder: ErpFinanceMetricId[] = [
  "revenue",
  "cost",
  "profit",
  "collected",
  "payables",
];

export function ExecutiveFinanceOverview() {
  const [periodId, setPeriodId] = useState<ErpFinancePeriodId>("today");
  const [selectedMetricId, setSelectedMetricId] =
    useState<ErpFinanceMetricId | null>(null);
  const period = ERP_FINANCE_REPORT[periodId];
  const selectedMetric = selectedMetricId
    ? period.metrics[selectedMetricId]
    : null;

  function changePeriod(nextPeriod: ErpFinancePeriodId) {
    setPeriodId(nextPeriod);
    setSelectedMetricId(null);
  }

  return (
    <section
      aria-labelledby="executive-finance-title"
      className="rounded-2xl bg-[#f8fbf9] p-4 text-[#203a30] sm:p-6"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">
            Toàn vùng
          </p>
          <h2
            id="executive-finance-title"
            className="mt-2 text-2xl font-black sm:text-3xl"
          >
            Tài chính hợp nhất
          </h2>
          <h3 className="mt-1 text-base font-black text-[#53665d]">
            {period.label} · {period.range}
          </h3>
          <p className="mt-1 text-xs text-[#74827b]">Cập nhật {period.asOf}</p>
        </div>
        <div
          className="grid grid-cols-4 rounded-xl border border-[#d5ded8] bg-white p-1"
          aria-label="Kỳ tài chính tổng quan"
        >
          {periods.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changePeriod(item.id)}
              aria-pressed={periodId === item.id}
              className={`min-h-10 rounded-lg px-3 text-xs font-black transition sm:text-sm ${
                periodId === item.id
                  ? "bg-[#173f34] text-white"
                  : "text-[#65756e] hover:bg-[#edf3ef]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {metricOrder.map((metricId, index) => {
          const metric = period.metrics[metricId];
          const selected = selectedMetricId === metricId;
          return (
            <button
              key={metricId}
              type="button"
              aria-expanded={selected}
              aria-controls="executive-finance-detail"
              onClick={() => setSelectedMetricId(selected ? null : metricId)}
              className={`min-w-0 rounded-xl border p-3 text-left transition sm:p-4 ${
                index === 4 ? "col-span-2 lg:col-span-1" : ""
              } ${
                selected
                  ? "border-[#2c715b] bg-[#e6f2ec] ring-2 ring-[#2c715b]/10"
                  : "border-[#dbe4de] bg-white hover:border-[#8eaa9e]"
              }`}
            >
              <span className="block text-[11px] leading-4 text-[#6e7c75]">
                {metric.label}
              </span>
              <strong className="mt-2 block text-xl tracking-[-0.03em] sm:text-2xl">
                {formatFinanceAmount(metric.valueMillion)}
              </strong>
              <span
                className={`mt-2 block text-[11px] font-bold leading-4 ${
                  metricId === "payables" ? "text-[#9a5b45]" : "text-[#2d735b]"
                }`}
              >
                {metric.pulse}
              </span>
              <span className="mt-3 block text-[10px] font-black uppercase tracking-[0.12em] text-[#7a8881]">
                {selected ? "Thu gọn ↑" : "Xem chi tiết ↓"}
              </span>
            </button>
          );
        })}
      </div>

      {selectedMetric && selectedMetricId ? (
        <div
          id="executive-finance-detail"
          role="region"
          aria-label={`Chi tiết ${selectedMetric.label}`}
          className="mt-4 rounded-2xl border border-[#ccd9d2] bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#477565]">
                Chi tiết {selectedMetric.label}
              </p>
              <h3 className="mt-1 text-xl font-black">{period.range}</h3>
            </div>
            <Link
              href="/erp/finance"
              className="rounded-lg border border-[#cfdbd4] px-3 py-2 text-xs font-black text-[#286655]"
            >
              Mở chứng từ & đối soát →
            </Link>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {selectedMetric.comparisons.map((comparison) => (
              <div key={comparison.label} className="rounded-xl bg-[#f2f6f3] p-3">
                <p className="text-[11px] text-[#78857f]">{comparison.label}</p>
                <p
                  className={`mt-1 text-sm font-black ${
                    comparison.favorable ? "text-[#286b53]" : "text-[#99513f]"
                  }`}
                >
                  {comparison.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {selectedMetric.breakdown.map((item) => {
              const share = Math.min(
                100,
                Math.max(
                  4,
                  (Math.abs(item.valueMillion) /
                    Math.abs(selectedMetric.valueMillion)) *
                    100,
                ),
              );
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-[#52645b]">{item.label}</span>
                    <span className="shrink-0 font-black">
                      {formatFinanceAmount(item.valueMillion)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]">
                    <div
                      className="h-full rounded-full bg-[#397a62]"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 border-t border-[#e2e8e4] pt-3 text-xs leading-5 text-[#73817a]">
            <strong>Nguồn:</strong> {selectedMetric.source}
          </p>
        </div>
      ) : null}
    </section>
  );
}
