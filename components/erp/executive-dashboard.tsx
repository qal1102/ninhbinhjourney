"use client";

import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import {
  ERP_DAILY_FINANCE,
  ERP_PROJECT_EVENTS,
  ERP_SITE_FINANCE,
  ERP_WORKFORCE_SUMMARY,
  formatFinanceAmount,
} from "@/domain/erp-operating-data";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { ExecutiveFinanceOverview } from "./executive-finance-overview";
import { ShiftCloseDirectorQueue } from "./shift-close-workflow";

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
};

const recentEvents = [
  { time: "10:18", site: "Tam Chúc", text: "Đoàn 46 khách đã qua cổng Khách Điện", tone: "bg-[#2e8566]" },
  { time: "10:16", site: "Tràng An", text: "Giao dịch vé trực tuyến +3,8 triệu", tone: "bg-[#39749a]" },
  { time: "10:14", site: "Bái Đính", text: "Xe điện 024 bắt đầu vòng tăng cường", tone: "bg-[#b48435]" },
  { time: "10:12", site: "Tam Cốc", text: "Ca bến đò đã bàn giao đủ 12/12 mục", tone: "bg-[#6c6f91]" },
] as const;

const siteNotes = {
  "tam-chuc": "Mở điểm chờ phụ trước 10:30",
  "trang-an": "Không có việc vượt ngưỡng",
  "bai-dinh": "Theo dõi lượt xe lúc 10:30",
  "tam-coc": "Mưa chiều có thể giảm khách tại chỗ",
} as const;

const operationalDecisions = [
  {
    id: "DEC-TC-028",
    severity: "P1",
    title: "Tăng cường 4 xe tại Tam Chúc",
    owner: "Trần Thu Hà · Quản lý Tam Chúc",
    due: "Còn 18 phút",
    impact: "Giảm thời gian chờ dự kiến từ 24 xuống 12 phút; vượt ngân sách ca 18 triệu.",
    recommendation: "Duyệt tăng cường đến 12:00 và đánh giá lại theo tải cổng lúc 11:30.",
    href: "/erp/tam-chuc/xe-trung-chuyen",
    tone: "bg-[#a94e3f] text-white",
  },
  {
    id: "DEC-TC-024",
    severity: "P1",
    title: "Chấp nhận rủi ro Go/No-Go",
    owner: "Chỉ huy ca Tam Chúc",
    due: "Trước 10:45",
    impact: "Một điểm mù liên lạc chưa đạt; ảnh hưởng phương án mở tuyến phụ.",
    recommendation: "Chỉ mở tuyến khi bố trí bộ đàm dự phòng và người chốt tại điểm mù.",
    href: "/erp/tam-chuc/sop-dien-tap",
    tone: "bg-[#b38137] text-white",
  },
] as const;

function RecentActivity() {
  return (
    <ol className="mt-4 divide-y divide-[#e5eae7]">
      {recentEvents.map((event) => (
        <li key={`${event.site}-${event.text}`} className="flex gap-3 py-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.tone}`} />
          <div className="min-w-0 flex-1"><p className="text-sm font-black text-[#2d4138]">{event.site}</p><p className="mt-1 text-xs leading-5 text-[#6f7d76]">{event.text}</p></div>
          <time className="shrink-0 text-[11px] text-[#8a958f]">{event.time}</time>
        </li>
      ))}
    </ol>
  );
}

export function ExecutiveDashboard({ user, sites, records }: Props) {
  const visitors = sites.reduce((sum, site) => sum + site.snapshot.visitors, 0);
  const checkedIn = sites.reduce((sum, site) => sum + site.snapshot.checkedIn, 0);
  const incidents = sites.reduce((sum, site) => sum + site.snapshot.openIncidents, 0);
  const employeesOnShift = sites.reduce((sum, site) => sum + site.snapshot.employeesOnShift, 0);
  const visibleWorkforce = ERP_WORKFORCE_SUMMARY.filter((item) => sites.some((site) => site.id === item.siteId));
  const plannedEmployees = visibleWorkforce.reduce((sum, item) => sum + item.planned, 0);
  const seasonalEmployees = visibleWorkforce.reduce((sum, item) => sum + item.seasonalOnShift, 0);
  const attentionSites = sites.filter((site) => site.status === "attention");
  const pendingShiftCloseDecisions = records.filter(
    (record) => record.status === "exception-pending-director",
  );
  const decisionCount =
    operationalDecisions.length + pendingShiftCloseDecisions.length;
  const siteRows = [...ERP_SITE_FINANCE].sort((left, right) => {
    const leftAttention = sites.find((site) => site.id === left.id)?.status === "attention" ? 1 : 0;
    const rightAttention = sites.find((site) => site.id === right.id)?.status === "attention" ? 1 : 0;
    return rightAttention - leftAttention;
  });

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6d5ca]">Toàn vùng · {sites.length} cơ sở · 28/07/2026</p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">{visitors.toLocaleString("vi-VN")} khách dự kiến · {formatFinanceAmount(ERP_DAILY_FINANCE.revenueMillion)} doanh thu</h1>
            <p className="mt-3 text-sm text-white/65">{decisionCount} quyết định cần xem · {attentionSites.length} cơ sở cần chú ý</p>
          </div>
          <p className="text-xs font-bold text-[#c3ded4]">Dữ liệu đến {ERP_DAILY_FINANCE.asOf}</p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Khách dự kiến cả ngày", visitors.toLocaleString("vi-VN"), "Theo booking và kế hoạch đoàn"],
            ["Đã vào cổng", checkedIn.toLocaleString("vi-VN"), `${Math.round(checkedIn / visitors * 100)}% kế hoạch ngày`],
            ["Phủ ca", `${employeesOnShift}/${plannedEmployees}`, `${seasonalEmployees} thời vụ đang trong ca`],
            ["Sự cố đang mở", incidents.toLocaleString("vi-VN"), `${attentionSites.length} cơ sở gần ngưỡng vận hành`],
          ].map(([label, value, note]) => (
            <article key={label} className="rounded-xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-[11px] leading-4 text-white/50">{label}</p><p className="mt-2 text-xl font-black tracking-[-0.03em] sm:text-2xl">{value}</p><p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">{note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e2d4b9] bg-[#fffaf0] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#87642b]">Cần giám đốc quyết định</p><h2 className="mt-2 text-2xl font-black text-[#3f3524]">{decisionCount} hồ sơ cần xử lý</h2></div>
          <span className="w-fit rounded-full bg-[#f2dfba] px-2.5 py-1 text-xs font-black text-[#79551d]">Xếp theo hạn xử lý</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {operationalDecisions.map((decision) => (
            <details key={decision.id} className="rounded-xl border border-[#eadfc9] bg-white p-4 shadow-sm open:border-[#c9a96b]">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${decision.tone}`}>{decision.severity}</span><span className="text-xs font-black text-[#9a4d3c]">{decision.due}</span></div>
                <p className="mt-3 text-xs font-black text-[#897b68]">{decision.id}</p>
                <h3 className="mt-1 font-black text-[#493b2b]">{decision.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#7a6d5c]">{decision.owner}</p>
              </summary>
              <div className="mt-4 border-t border-[#eee5d5] pt-4 text-xs leading-5 text-[#665b4d]"><p><strong>Tác động:</strong> {decision.impact}</p><p className="mt-2"><strong>Đề xuất:</strong> {decision.recommendation}</p><Link href={decision.href} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#3f3524] px-4 font-black text-white">Mở hồ sơ & bằng chứng →</Link></div>
            </details>
          ))}
        </div>
        {pendingShiftCloseDecisions.length > 0 ? (
          <div className="mt-5 border-t border-[#e2d4b9] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#87642b]">
                  Ngoại lệ chốt ca
                </p>
                <h3 className="mt-1 text-lg font-black text-[#3f3524]">
                  {pendingShiftCloseDecisions.length} hồ sơ tài chính chờ quyết định
                </h3>
              </div>
              <Link href="/erp/finance" className="text-sm font-black text-[#76551f]">
                Mở sổ đối soát →
              </Link>
            </div>
            <ShiftCloseDirectorQueue records={records} user={user} />
          </div>
        ) : (
          <p className="mt-5 border-t border-[#e2d4b9] pt-4 text-sm text-[#756852]">
            Hiện không có ngoại lệ chốt ca tài chính nào đang chờ giám đốc.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Ma trận bốn cơ sở</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Khách, tiền, nguồn lực và rủi ro</h2></div><Link href="/erp/finance" className="hidden text-sm font-black text-[#286655] sm:block">So sánh tài chính →</Link></div>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {siteRows.map((item) => {
            const site = sites.find((candidate) => candidate.id === item.id)!;
            const workforce = ERP_WORKFORCE_SUMMARY.find((candidate) => candidate.siteId === item.id)!;
            return (
              <Link key={item.id} href={`/erp/${item.id}`} className="rounded-xl border border-[#e1e7e3] p-4 transition hover:border-[#9eb5aa] hover:bg-[#f8faf8]">
                <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[#2b4037]">{site.shortName}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${site.status === "attention" ? "bg-[#ffe4de] text-[#934336]" : "bg-[#dff1e8] text-[#246249]"}`}>{site.status === "attention" ? "Cần chú ý" : "Ổn định"}</span></div><p className="mt-1 text-xs text-[#76837d]">{siteNotes[item.id]}</p></div><span className={`text-xs font-black ${item.change.startsWith("−") ? "text-[#a04c3e]" : "text-[#2d735b]"}`}>DT kế hoạch {item.change}</span></div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  <div><dt className="text-[#849089]">Dự kiến</dt><dd className="mt-1 font-black">{site.snapshot.visitors.toLocaleString("vi-VN")}</dd></div>
                  <div><dt className="text-[#849089]">Đã vào</dt><dd className="mt-1 font-black">{site.snapshot.checkedIn.toLocaleString("vi-VN")}</dd></div>
                  <div><dt className="text-[#849089]">Doanh thu</dt><dd className="mt-1 font-black">{item.revenueMillion} tr</dd></div>
                  <div><dt className="text-[#849089]">Tải</dt><dd className="mt-1 font-black">{site.snapshot.capacityPercent}%</dd></div>
                  <div><dt className="text-[#849089]">Phủ ca</dt><dd className="mt-1 font-black">{workforce.onShift}/{workforce.planned}</dd></div>
                  <div><dt className="text-[#849089]">Sự cố</dt><dd className="mt-1 font-black">{site.snapshot.openIncidents}</dd></div>
                </dl>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className={`h-full rounded-full ${site.snapshot.capacityPercent >= 80 ? "bg-[#c0614e]" : "bg-[#397a62]"}`} style={{ width: `${site.snapshot.capacityPercent}%` }} /></div>
              </Link>
            );
          })}
        </div>
      </section>

      <ExecutiveFinanceOverview />

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#9a5f32]">Dự án & sự kiện</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Ngân sách, tiến độ và mốc gần nhất</h2></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {ERP_PROJECT_EVENTS.map((event) => (
            <Link href={`/erp/${event.siteId}/du-an-su-kien`} key={`${event.siteId}-${event.name}`} className="rounded-xl border border-[#e1e7e3] p-4 transition hover:border-[#b99575] hover:bg-[#fffaf5]">
              <div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#2b4037]">{event.name}</p><p className="mt-1 text-xs text-[#76837d]">{event.nextMilestone}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${event.urgentCount ? "bg-[#ffe4de] text-[#934336]" : "bg-[#dff1e8] text-[#246249]"}`}>{event.urgentCount ? `${event.urgentCount} việc khẩn` : "Đúng tiến độ"}</span></div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-[#849089]">Ngân sách</dt><dd className="mt-1 font-black">{event.budgetBillion.toLocaleString("vi-VN")} tỷ</dd></div><div><dt className="text-[#849089]">Đã cam kết</dt><dd className="mt-1 font-black">{event.committedBillion.toLocaleString("vi-VN")} tỷ</dd></div><div><dt className="text-[#849089]">Khách dự kiến</dt><dd className="mt-1 font-black">{event.expectedGuests.toLocaleString("vi-VN")}</dd></div></dl>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#9a5f32]" style={{ width: `${event.progress}%` }} /></div><div className="mt-2 flex justify-between text-xs text-[#7b8881]"><span>{event.progress}% hoàn thành</span><span>Còn {event.daysLeft} ngày</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">Nhật ký gần đây</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Hoạt động đã ghi nhận</h2></div><span className="text-xs font-bold text-[#7a8781]">Mốc gần nhất 10:18</span></div>
        <RecentActivity />
      </section>
    </div>
  );
}
