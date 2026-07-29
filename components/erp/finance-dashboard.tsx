"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ErpSite } from "@/domain/erp";
import {
  ERP_COST_BREAKDOWN,
  ERP_DAILY_FINANCE,
  ERP_FINANCE_REPORT,
  ERP_SITE_FINANCE,
  formatFinanceAmount,
  type ErpFinancePeriodId,
} from "@/domain/erp-operating-data";

type SeriesPoint = {
  label: string;
  actual: number;
  target: number;
};

type Props = {
  sites: readonly ErpSite[];
};

const periods: Array<{ id: ErpFinancePeriodId; label: string }> = [
  { id: "today", label: "Hôm nay" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
  { id: "year", label: "Năm" },
];

const series: Record<ErpFinancePeriodId, SeriesPoint[]> = {
  today: [
    { label: "06:00", actual: 42, target: 38 },
    { label: "07:00", actual: 226, target: 204 },
    { label: "08:00", actual: 648, target: 580 },
    { label: "09:00", actual: 1216, target: 1120 },
    { label: "10:20", actual: 1840, target: 1720 },
  ],
  month: [
    { label: "01", actual: 1.12, target: 1.08 },
    { label: "05", actual: 6.48, target: 6.1 },
    { label: "10", actual: 13.6, target: 12.9 },
    { label: "15", actual: 20.9, target: 19.8 },
    { label: "20", actual: 28.7, target: 26.9 },
    { label: "27", actual: 38.6, target: 35.6 },
  ],
  quarter: [
    { label: "T4", actual: 31.4, target: 29.8 },
    { label: "T5", actual: 34.2, target: 32.0 },
    { label: "T6", actual: 42.6, target: 35.0 },
  ],
  year: [
    { label: "T1", actual: 35, target: 31 },
    { label: "T2", actual: 41, target: 37 },
    { label: "T3", actual: 44, target: 40 },
    { label: "T4", actual: 37, target: 35 },
    { label: "T5", actual: 34, target: 33 },
    { label: "T6", actual: 36, target: 34 },
    { label: "T7", actual: 59.4, target: 40.8 },
  ],
};

const channelColors = ["#1f6753", "#c59a4e", "#6d8baa", "#b56d58"];
const channels = ERP_FINANCE_REPORT.today.metrics.revenue.breakdown.map(
  (item, index) => ({
    name: item.label,
    value: formatFinanceAmount(item.valueMillion),
    share: Math.round(
      (item.valueMillion /
        ERP_FINANCE_REPORT.today.metrics.revenue.valueMillion) *
        100,
    ),
    color: channelColors[index],
  }),
);

function currency(value: number, period: ErpFinancePeriodId) {
  if (period === "today") return `${value.toLocaleString("vi-VN")} triệu`;
  return `${value.toLocaleString("vi-VN")} tỷ`;
}

function FinanceTrend({ period }: { period: ErpFinancePeriodId }) {
  const data = series[period];
  const [activeIndex, setActiveIndex] = useState(data.length - 1);
  const active = data[Math.min(activeIndex, data.length - 1)];
  const width = 720;
  const height = 270;
  const left = 34;
  const right = 18;
  const top = 25;
  const bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(...data.flatMap((point) => [point.actual, point.target])) * 1.12;
  const x = (index: number) => left + (index / Math.max(1, data.length - 1)) * plotWidth;
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const actualPoints = data.map((point, index) => `${x(index)},${y(point.actual)}`).join(" ");
  const targetPoints = data.map((point, index) => `${x(index)},${y(point.target)}`).join(" ");
  const area = `M ${x(0)} ${top + plotHeight} L ${data.map((point, index) => `${x(index)} ${y(point.actual)}`).join(" L ")} L ${x(data.length - 1)} ${top + plotHeight} Z`;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[#74827b]">{active.label}</p>
          <p className="mt-1 text-2xl font-black text-[#1f3e33]">{currency(active.actual, period)}</p>
        </div>
        <div className="flex gap-4 text-xs text-[#697770]">
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#1f6753]" />Thực tế</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#c5a260]" />Kế hoạch</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[16/7] min-h-48 w-full" role="img" aria-label="Biểu đồ doanh thu thực tế so với kế hoạch">
        <defs>
          <linearGradient id={`finance-area-${period}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a7861" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2a7861" stopOpacity="0.01" />
          </linearGradient>
          <filter id={`finance-glow-${period}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1={left} x2={width - right} y1={top + plotHeight * ratio} y2={top + plotHeight * ratio} stroke="#e4ebe6" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#finance-area-${period})`} />
        <polyline points={targetPoints} fill="none" stroke="#c5a260" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
        <polyline points={actualPoints} fill="none" stroke="#1f6753" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => (
          <g key={point.label} onPointerEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} className="cursor-pointer">
            <rect x={x(index) - plotWidth / data.length / 2} y={top} width={plotWidth / data.length} height={plotHeight} fill="transparent" />
            <circle cx={x(index)} cy={y(point.actual)} r={activeIndex === index ? 6 : 4} fill="#fff" stroke="#1f6753" strokeWidth="3" filter={activeIndex === index ? `url(#finance-glow-${period})` : undefined} />
            <text x={x(index)} y={height - 13} textAnchor="middle" fontSize="11" fill="#718078">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function FinanceDashboard({ sites }: Props) {
  const [period, setPeriod] = useState<ErpFinancePeriodId>("today");
  const selected = ERP_FINANCE_REPORT[period];
  const revenue = selected.metrics.revenue.valueMillion;
  const cost = selected.metrics.cost.valueMillion;
  const profit = selected.metrics.profit.valueMillion;
  const collected = selected.metrics.collected.valueMillion;
  const payables = selected.metrics.payables.valueMillion;
  const margin = ((profit / revenue) * 100).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  });
  const totalVisitors = useMemo(() => sites.reduce((sum, site) => sum + site.snapshot.visitors, 0), [sites]);

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#477565]">Tài chính toàn vùng</p>
          <h1 className="font-display mt-2 text-4xl text-[#183f34] sm:text-6xl">Doanh thu & hiệu quả</h1>
          <p className="mt-2 text-sm text-[#6e7b75]">Cập nhật {ERP_DAILY_FINANCE.asOf}</p>
        </div>
        <div className="grid grid-cols-4 rounded-xl border border-[#d5ded8] bg-white p-1" aria-label="Kỳ báo cáo">
          {periods.map((item) => (
            <button key={item.id} type="button" onClick={() => setPeriod(item.id)} className={`min-h-10 rounded-lg px-3 text-xs font-black transition sm:text-sm ${period === item.id ? "bg-[#183f34] text-white" : "text-[#65756e] hover:bg-[#f0f4f1]"}`}>{item.label}</button>
          ))}
        </div>
      </header>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="min-w-0 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#68776f]">Doanh thu {selected.subtitle}</p>
              <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#173f34] sm:text-6xl">{formatFinanceAmount(revenue)}</p>
              <p className="mt-2 text-sm font-bold text-[#2d735b]">{selected.delta} so với kế hoạch</p>
            </div>
            <div className="rounded-2xl bg-[#eef5f1] px-4 py-3 text-right">
              <p className="text-xs text-[#718078]">Khách dự kiến hôm nay</p>
              <p className="mt-1 text-xl font-black text-[#29443a]">{totalVisitors.toLocaleString("vi-VN")}</p>
            </div>
          </div>
          <div className="mt-5"><FinanceTrend period={period} /></div>
        </article>

        <aside className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          {[
            ["Chi phí đã ghi nhận", formatFinanceAmount(cost), "Nhân sự, vận chuyển, đối tác, bảo trì"],
            ["Lợi nhuận vận hành", formatFinanceAmount(profit), `Biên ${margin}%`],
            ["Tiền đã thu", formatFinanceAmount(collected), "Sau hoàn vé và phí kênh bán"],
            ["Phải trả đến hạn", formatFinanceAmount(payables), `${formatFinanceAmount(selected.reconciliationVarianceMillion)} đang chênh lệch đối soát`],
          ].map(([label, value, note], index) => (
            <article key={label} className={`rounded-2xl p-4 sm:p-5 ${index === 3 ? "border border-[#efd5ca] bg-[#fff5f1]" : "border border-[#d8e0db] bg-white"}`}>
              <p className="text-xs text-[#697770]">{label}</p>
              <p className={`mt-2 text-xl font-black tracking-[-0.03em] sm:text-2xl ${index === 3 ? "text-[#8c493d]" : "text-[#203a30]"}`}>{value}</p>
              <p className="mt-2 text-xs leading-5 text-[#849089]">{note}</p>
            </article>
          ))}
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Cơ cấu hôm nay</p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">Doanh thu theo nguồn</h2>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: "conic-gradient(#1f6753 0 49%, #c59a4e 49% 75%, #6d8baa 75% 91%, #b56d58 91% 100%)" }}>
              <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center"><div><p className="text-xs text-[#7c8882]">Tổng</p><p className="mt-1 text-xl font-black text-[#203a30]">{formatFinanceAmount(ERP_FINANCE_REPORT.today.metrics.revenue.valueMillion)}</p></div></div>
            </div>
            <ul className="w-full space-y-3">
              {channels.map((channel) => <li key={channel.name} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 text-[#566860]"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: channel.color }} />{channel.name}</span><span className="shrink-0 text-right"><strong className="block text-[#273c33]">{channel.value}</strong><small className="text-[#8a958f]">{channel.share}%</small></span></li>)}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Đóng góp theo cơ sở</p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">Doanh thu và lợi nhuận tháng</h2>
          <div className="mt-5 space-y-3">
            {ERP_SITE_FINANCE.map((item) => {
              const site = sites.find((candidate) => candidate.id === item.id)!;
              return <Link key={item.id} href={`/erp/${item.id}/tai-chinh-doi-soat`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-[#e2e8e4] p-4 transition hover:border-[#9eb5aa] hover:bg-[#f8faf8] sm:grid-cols-[1fr_0.8fr_0.8fr_auto] sm:items-center"><div><p className="font-black text-[#2b4037]">{site.shortName}</p><p className="mt-1 text-xs text-[#7c8882]">Hôm nay {item.revenueMillion.toLocaleString("vi-VN")} triệu</p></div><p className="hidden text-sm font-bold text-[#43574e] sm:block">{item.monthRevenueBillion.toLocaleString("vi-VN")} tỷ doanh thu</p><p className="hidden text-sm text-[#65756e] sm:block">{item.monthProfitBillion.toLocaleString("vi-VN")} tỷ lợi nhuận</p><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.change.startsWith("−") ? "bg-[#ffe8e2] text-[#94473a]" : "bg-[#e2f0e9] text-[#2c684f]"}`}>{item.change}</span><div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ee] sm:col-span-4"><div className="h-full rounded-full bg-[#286655]" style={{ width: `${item.share * 2.5}%` }} /></div></Link>;
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Chi phí hôm nay</p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">Doanh thu được giữ lại bao nhiêu</h2>
          <div className="mt-5 divide-y divide-[#e5eae7] text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-3 font-black text-[#1f4738]"><span>Doanh thu thuần</span><span>{ERP_DAILY_FINANCE.revenueMillion.toLocaleString("vi-VN")} triệu</span></div>
            {ERP_COST_BREAKDOWN.map((item) => <div key={item.label} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-[#53665d]"><span>{item.label}</span><span className="text-right font-bold">−{item.valueMillion.toLocaleString("vi-VN")} triệu</span></div>)}
            <div className="grid grid-cols-[1fr_auto] gap-3 py-3 font-black text-[#1f4738]"><span>Lợi nhuận vận hành · {ERP_DAILY_FINANCE.marginPercent.toLocaleString("vi-VN")}%</span><span>{ERP_DAILY_FINANCE.operatingProfitMillion.toLocaleString("vi-VN")} triệu</span></div>
          </div>
        </article>

        <aside className="rounded-2xl bg-[#203c33] p-5 text-white sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#aecfc3]">Đối soát cần xử lý</p>
          <h2 className="mt-2 text-2xl font-black">46 triệu đang chờ xác minh</h2>
          <ol className="mt-5 space-y-3 text-sm">
            <li className="rounded-xl bg-white/7 p-4"><strong>Quầy vé Tam Chúc</strong><p className="mt-1 text-white/60">Chênh 18 triệu · Trưởng ca nhận lúc 09:12</p></li>
            <li className="rounded-xl bg-white/7 p-4"><strong>Đại lý TA-018</strong><p className="mt-1 text-white/60">Chờ đối chiếu 12 triệu · Hạn 11:00</p></li>
            <li className="rounded-xl bg-white/7 p-4"><strong>Dịch vụ xe điện</strong><p className="mt-1 text-white/60">16 triệu chưa khớp chuyến · Kế toán đang xử lý</p></li>
          </ol>
        </aside>
      </section>

      <section id="forecast" className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Dự báo & hành động</p>
        <h2 className="mt-2 text-2xl font-black text-[#20342c]">90 ngày tới</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["30 ngày", "+9–12%", "Đặt đoàn tăng 14%; cần mở thêm ca xe điện cuối tuần."],
            ["60 ngày", "+4–7%", "Nhu cầu nội địa ổn định; theo dõi chi phí đối tác mùa cao điểm."],
            ["90 ngày", "−3–1%", "Mùa mưa và lịch bảo dưỡng thuyền có thể giảm công suất bán."],
          ].map(([range, value, reason], index) => <article key={range} className="rounded-xl border border-[#e1e7e3] p-4"><p className="text-xs font-bold text-[#74827b]">{range}</p><p className={`mt-2 text-2xl font-black ${index === 2 ? "text-[#9a4c3e]" : "text-[#25674f]"}`}>{value}</p><p className="mt-2 text-sm leading-6 text-[#67776f]">{reason}</p></article>)}
        </div>
      </section>
    </div>
  );
}

const siteOperating: Record<string, { target: number; transactions: number; average: number }> = {
  "trang-an": { target: 462, transactions: 2840, average: 171 },
  "tam-chuc": { target: 550, transactions: 3610, average: 171 },
  "tam-coc": { target: 266, transactions: 1740, average: 151 },
  "bai-dinh": { target: 440, transactions: 3260, average: 145 },
};

export function SiteFinanceWorkspace({ site }: { site: ErpSite }) {
  const operating = siteOperating[site.id];
  const finance = ERP_SITE_FINANCE.find((item) => item.id === site.id)!;
  const data = {
    ...operating,
    revenue: finance.revenueMillion,
    profit: finance.profitMillion,
  };
  const delta = ((data.revenue / data.target - 1) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  const hourly = [12, 21, 37, 56, 73, 92, 68, 48];

  return (
    <div className="min-w-0 space-y-5">
      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="min-w-0 rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
          <p className="text-sm text-white/55">Doanh thu hôm nay · đến 10:20</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><p className="text-4xl font-black tracking-[-0.04em] sm:text-6xl">{data.revenue.toLocaleString("vi-VN")} triệu</p><span className={`rounded-full px-3 py-1.5 text-xs font-black ${data.revenue >= data.target ? "bg-[#dff3e8] text-[#256047]" : "bg-[#ffe3db] text-[#934537]"}`}>{data.revenue >= data.target ? "+" : ""}{delta}% kế hoạch</span></div>
          <p className="mt-3 text-sm text-white/58">Kế hoạch cùng thời điểm: {data.target.toLocaleString("vi-VN")} triệu</p>
          <div className="mt-7 grid grid-cols-8 items-end gap-2" aria-label="Doanh thu theo giờ từ 6 giờ đến 13 giờ">
            {hourly.map((height, index) => <div key={height + index} className="flex flex-col items-center gap-2"><div className="flex h-28 w-full items-end rounded-md bg-white/6"><div className="w-full rounded-md bg-[#72caa2] transition" style={{ height: `${height}%` }} /></div><span className="text-[10px] text-white/38">{index + 6}h</span></div>)}
          </div>
        </article>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Lợi nhuận ước tính", `${data.profit.toLocaleString("vi-VN")} triệu`, `${Math.round(data.profit / data.revenue * 100)}% doanh thu`],
            ["Giao dịch", data.transactions.toLocaleString("vi-VN"), "Đã ghi nhận hôm nay"],
            ["Giá trị trung bình", `${data.average.toLocaleString("vi-VN")} nghìn`, "Mỗi lượt khách"],
            ["Chờ đối soát", site.id === "tam-chuc" ? "46 triệu" : "8 triệu", "Có người đang xử lý"],
          ].map(([label, value, note], index) => <article key={label} className={`rounded-2xl p-4 sm:p-5 ${index === 3 ? "border border-[#efd5ca] bg-[#fff5f1]" : "border border-[#d8e0db] bg-white"}`}><p className="text-xs text-[#6c7a73]">{label}</p><p className={`mt-2 text-xl font-black sm:text-2xl ${index === 3 ? "text-[#93483a]" : "text-[#263d33]"}`}>{value}</p><p className="mt-2 text-xs leading-5 text-[#849089]">{note}</p></article>)}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Theo nguồn thu</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Hôm nay tiền đến từ đâu?</h2>
          <div className="mt-5 space-y-4">
            {channels.map((channel) => <div key={channel.name}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-[#52655c]">{channel.name}</span><span className="font-black text-[#2a4037]">{Math.round(data.revenue * channel.share / 100).toLocaleString("vi-VN")} triệu</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full" style={{ width: `${channel.share}%`, backgroundColor: channel.color }} /></div></div>)}
          </div>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Đối soát trong ngày</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Khoản cần xác minh</h2>
          <div className="mt-5 divide-y divide-[#e5eae7]">
            {[
              ["Quầy vé ca sáng", site.id === "tam-chuc" ? "46 triệu" : "5,2 triệu", "Trưởng ca đang kiểm tra"],
              ["Kênh đại lý", "2,8 triệu", "Chờ bảng kê 11:00"],
              ["Dịch vụ phương tiện", "0 đồng", "Đã khớp đủ chuyến"],
            ].map(([label, value, state]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-3 py-4"><div><p className="text-sm font-black text-[#33483f]">{label}</p><p className="mt-1 text-xs text-[#7b8881]">{state}</p></div><p className="text-sm font-black text-[#5a6b63]">{value}</p></div>)}
          </div>
        </article>
      </section>
    </div>
  );
}
