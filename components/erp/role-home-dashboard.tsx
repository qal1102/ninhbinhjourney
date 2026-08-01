import Link from "next/link";
import { ERP_MODULES, type ErpSite, type ErpSiteId } from "@/domain/erp";
import type { AccountingJournal } from "@/domain/erp-accounting";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type { WorkdayRecord } from "@/domain/erp-workday";
import {
  WorkdayLifecycle,
  type WorkdayEmployeeOption,
} from "@/components/erp/workday-lifecycle";

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  journals: readonly AccountingJournal[];
  supplierApInvoices: readonly SupplierApInvoice[];
  workdayEmployees: readonly WorkdayEmployeeOption[];
};

type WorkItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  href: string;
  tone: "red" | "amber" | "green" | "blue";
};

const toneClasses = {
  red: "bg-[#ffe5df] text-[#934336]",
  amber: "bg-[#fff0ce] text-[#77531c]",
  green: "bg-[#dff1e8] text-[#246249]",
  blue: "bg-[#e1edf4] text-[#315f79]",
} as const;

const accountingActionableStatuses = new Set<ShiftCloseRecord["status"]>([
  "manager-approved",
  "accounting-review",
  "director-approved",
  "director-rejected",
]);

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function journalValue(journal: AccountingJournal) {
  return journal.lines.reduce((total, line) => total + line.debitVnd, 0);
}

function latestRecordTime(values: readonly string[]) {
  return values.reduce((latest, value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > latest
      ? timestamp
      : latest;
  }, 0);
}

export function summarizeWorkdays(
  records: readonly WorkdayRecord[],
  now: number,
) {
  const open = records.filter((record) => record.status !== "approved");
  return {
    total: records.length,
    assigned: records.filter((record) => record.status === "assigned").length,
    active: records.filter((record) =>
      ["checked-in", "in-progress", "manager-returned"].includes(record.status),
    ).length,
    submitted: records.filter((record) => record.status === "submitted").length,
    approved: records.filter((record) => record.status === "approved").length,
    overdue: open.filter((record) => {
      const dueAt = Date.parse(record.dueAt);
      return Number.isFinite(dueAt) && dueAt < now;
    }).length,
  };
}

function firstSiteForModule(
  user: CurrentErpUser,
  moduleId: (typeof ERP_MODULES)[number]["id"],
  preferredSiteId?: ErpSiteId,
) {
  if (
    preferredSiteId &&
    (user.moduleIdsBySite[preferredSiteId] ?? []).includes(moduleId)
  ) {
    return preferredSiteId;
  }
  return user.siteIds.find((siteId) =>
    (user.moduleIdsBySite[siteId] ?? []).includes(moduleId),
  );
}

function moduleHref(
  user: CurrentErpUser,
  moduleId: (typeof ERP_MODULES)[number]["id"],
  preferredSiteId?: ErpSiteId,
) {
  const siteId = firstSiteForModule(user, moduleId, preferredSiteId);
  return siteId ? `/erp/${siteId}/${moduleId}` : "/erp";
}

function supplierApHref(user: CurrentErpUser, invoice: SupplierApInvoice) {
  if (user.role === "manager") {
    return moduleHref(user, "doi-tac-nha-cung-ung", invoice.siteId);
  }
  return `/erp/finance#ap-${invoice.id}`;
}

function ManagerDashboard({
  user,
  sites,
  records,
  workdays,
  supplierApInvoices,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  supplierApInvoices: readonly SupplierApInvoice[];
}) {
  if (sites.length === 0) {
    return <EmptyAssignment name={user.name} />;
  }

  const referenceNow = latestRecordTime([
    ...workdays.map((record) => record.updatedAt),
    ...records.map((record) => record.updatedAt),
    ...supplierApInvoices.map((invoice) => invoice.updatedAt),
  ]);
  const summary = summarizeWorkdays(workdays, referenceNow);
  const pendingShiftClosures = records.filter(
    (record) => record.status === "submitted",
  );
  const supplierApToFix = supplierApInvoices.filter(
    (invoice) =>
      invoice.ownerRole === "manager" && invoice.status === "match-exception",
  );
  const pendingWork: WorkItem[] = workdays
    .filter(
      (record) =>
        record.status === "submitted" ||
        record.status === "manager-returned" ||
        (record.status !== "approved" &&
          Date.parse(record.dueAt) < referenceNow),
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .slice(0, 8)
    .map((record) => ({
      id: record.id,
      title:
        record.status === "submitted"
          ? `Duyệt: ${record.taskTitle}`
          : record.taskTitle,
      detail: `${record.employee.name} · ${record.station} · ${record.code}`,
      time:
        record.status === "manager-returned"
          ? "Đã trả lại"
          : Date.parse(record.dueAt) < referenceNow
            ? `Quá hạn ${formatDue(record.dueAt)}`
            : `Hạn ${formatDue(record.dueAt)}`,
      href: "#workday-lifecycle",
      tone:
        record.status === "manager-returned" ||
        Date.parse(record.dueAt) < referenceNow
          ? "red"
          : record.status === "submitted"
            ? "blue"
            : "amber",
    }));
  const pendingShiftWork: WorkItem[] = pendingShiftClosures
    .slice(0, 4)
    .map((record) => ({
      id: record.id,
      title: `Xác nhận chốt ca ${record.shiftCode}`,
      detail: `${record.station} · ${record.ticketsSold.toLocaleString("vi-VN")} vé · ${formatVnd(
        record.amounts.grossVnd - record.amounts.refundVnd,
      )}`,
      time:
        record.differenceVnd === 0
          ? "Tiền thu đã khớp"
          : `Chênh ${formatVnd(Math.abs(record.differenceVnd))}`,
      href: moduleHref(user, "ve-dat-cho", record.siteId),
      tone: record.differenceVnd === 0 ? "green" : "red",
    }));
  const supplierApWork: WorkItem[] = supplierApToFix.map((invoice) => ({
    id: invoice.id,
    title: `Bổ sung hồ sơ ${invoice.caseCode}`,
    detail: `${invoice.supplier.name} · HĐ ${invoice.invoiceSeries}/${invoice.invoiceNumber} · ${formatVnd(invoice.totalVnd)}`,
    time: `${invoice.exceptionCodes.length} điểm chưa khớp`,
    href: supplierApHref(user, invoice),
    tone: "red",
  }));
  const work = [
    ...supplierApWork,
    ...pendingWork,
    ...pendingShiftWork,
  ].slice(0, 10);

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
          {sites.length > 1
            ? `Điều hành toàn vùng · ${sites.length} cơ sở`
            : sites[0]
              ? `Điều hành ${sites[0].shortName}`
              : "Chưa được phân công cơ sở"}
        </p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              Chào {user.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
              {summary.submitted} công việc chờ duyệt ·{" "}
              {pendingShiftClosures.length} ca chờ xác nhận ·{" "}
              {supplierApToFix.length} hóa đơn cần bổ sung
            </p>
          </div>
          <Link
            href={`/erp/${sites[0].id}`}
            className="w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-[#183f34]"
          >
            Mở danh sách nghiệp vụ →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [
              "Việc trong ngày",
              summary.total.toLocaleString("vi-VN"),
              `${summary.active} đang làm`,
            ],
            [
              "Chờ quản lý duyệt",
              summary.submitted.toLocaleString("vi-VN"),
              `${summary.approved} đã duyệt`,
            ],
            [
              "Việc quá hạn",
              summary.overdue.toLocaleString("vi-VN"),
              `${summary.assigned} chưa bắt đầu`,
            ],
            [
              "Ca chờ xác nhận",
              pendingShiftClosures.length.toLocaleString("vi-VN"),
              `${sites.length} cơ sở phụ trách`,
            ],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-2xl font-black">{value}</p>
              {note ? (
                <p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">
                  {note}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Điều phối trong ca
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Việc cần xử lý tiếp theo
          </h2>
        </div>
        <div className="divide-y divide-[#e7ece9]">
          {work.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="grid min-w-0 gap-2 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <p className="font-black text-[#293d34]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#748079]">
                  {item.detail}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneClasses[item.tone]}`}
              >
                {item.time}
              </span>
            </Link>
          ))}
          {work.length === 0 ? (
            <p className="p-6 text-sm leading-6 text-[#748079]">
              Không có công việc hoặc ca bán vé nào đang chờ quản lý xử lý.
            </p>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Theo cơ sở
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Khối lượng công việc thực tế
          </h2>
        </div>
        <div className="grid gap-px bg-[#e7ece9] sm:grid-cols-2 xl:grid-cols-4">
          {sites.map((site) => {
            const siteWorkdays = workdays.filter(
              (record) => record.siteId === site.id,
            );
            const siteSummary = summarizeWorkdays(
              siteWorkdays,
              referenceNow,
            );
            const siteShifts = pendingShiftClosures.filter(
              (record) => record.siteId === site.id,
            );
            const siteSupplierAp = supplierApToFix.filter(
              (invoice) => invoice.siteId === site.id,
            );
            return (
              <Link
                key={site.id}
                href={`/erp/${site.id}`}
                className="min-w-0 bg-white p-5 transition hover:bg-[#f7faf8]"
              >
                <p className="font-black text-[#263b32]">{site.shortName}</p>
                <p className="mt-3 text-sm text-[#66756e]">
                  {siteSummary.active} đang làm · {siteSummary.submitted} chờ
                  duyệt
                </p>
                <p className="mt-1 text-sm text-[#66756e]">
                  {siteSummary.overdue} quá hạn · {siteShifts.length} ca chờ xác
                  nhận · {siteSupplierAp.length} hóa đơn cần bổ sung
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EmployeeDashboard({
  user,
  sites,
  workdays,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  workdays: readonly WorkdayRecord[];
}) {
  const site = sites[0];
  if (!site) {
    return <EmptyAssignment name={user.name} />;
  }

  const moduleIds = user.moduleIdsBySite[site.id] ?? [];
  const modules = ERP_MODULES.filter((module) => moduleIds.includes(module.id));
  const referenceNow = latestRecordTime(
    workdays.map((record) => record.updatedAt),
  );
  const summary = summarizeWorkdays(workdays, referenceNow);
  const work = [...workdays].sort(
    (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt),
  );
  const activeStatuses = new Set<WorkdayRecord["status"]>([
    "checked-in",
    "in-progress",
    "manager-returned",
  ]);
  const inShift = workdays.some((record) => activeStatuses.has(record.status));
  const averageProgress =
    workdays.length > 0
      ? Math.round(
          workdays.reduce(
            (total, record) => total + record.progressPercent,
            0,
          ) / workdays.length,
        )
      : 0;
  const nearestDeadline = work.find((record) => record.status !== "approved");
  const workforce = user.workforceProfile;
  const employmentLabel =
    workforce?.employmentType === "seasonal"
      ? "Nhân viên thời vụ"
      : "Nhân viên chính thức";

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
          {employmentLabel} · {site.shortName}
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              {user.name}
            </h1>
            <p className="mt-3 text-sm text-white/65">
              {user.jobTitle}
              {workforce ? ` · ${workforce.primaryStation}` : ""}
            </p>
            {workforce?.accessEndsAt ? (
              <p className="mt-1 text-xs text-[#b6d5ca]">
                Quyền làm việc có hiệu lực đến{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date(workforce.accessEndsAt))}
              </p>
            ) : null}
          </div>
          <span className="w-fit rounded-full bg-[#dff1e8] px-3 py-1.5 text-xs font-black text-[#246249]">
            {inShift ? "Đang trong ca" : "Ngoài ca"}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Ca làm", workforce?.shiftLabel ?? "Theo phân công"],
            ["Đã hoàn thành", `${summary.approved} / ${summary.total} việc`],
            ["Tiến độ bình quân", `${averageProgress}%`],
            [
              "Hạn gần nhất",
              nearestDeadline
                ? formatDue(nearestDeadline.dueAt)
                : "Chưa có việc",
            ],
          ].map(([label, value]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-lg font-black sm:text-xl">
                {value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Công việc được giao
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Việc của tôi hôm nay
            </h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {work.map((item, index) => {
              const itemSite =
                sites.find((candidate) => candidate.id === item.siteId) ?? site;
              const isOverdue =
                item.status !== "approved" &&
                Date.parse(item.dueAt) < referenceNow;
              return (
                <Link
                  key={item.id}
                  href={moduleHref(user, item.moduleId, item.siteId)}
                  className="grid min-w-0 gap-3 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8f1ec] text-xs font-black text-[#2b6651]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#293d34]">
                      {item.taskTitle}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#748079]">
                      {item.code} · {itemSite.shortName} · {item.station}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#87918c]">
                      {item.instructions}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                      isOverdue
                        ? toneClasses.red
                        : item.status === "approved"
                          ? toneClasses.green
                          : item.status === "submitted"
                            ? toneClasses.blue
                            : toneClasses.amber
                    }`}
                  >
                    {item.status === "approved"
                      ? "Đã duyệt"
                      : item.status === "submitted"
                        ? "Chờ quản lý duyệt"
                        : isOverdue
                          ? "Quá hạn"
                          : formatDue(item.dueAt)}
                  </span>
                </Link>
              );
            })}
            {work.length === 0 ? (
              <p className="p-6 text-sm leading-6 text-[#748079]">
                Quản lý chưa giao việc cụ thể cho ca này.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Mở nhanh
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Nghiệp vụ được giao
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/erp/${site.id}/${module.id}`}
                className="min-w-0 rounded-xl border border-[#e0e6e2] p-3 transition hover:border-[#9db5aa] hover:bg-[#f7faf8]"
              >
                <span
                  className="block h-2 w-8 rounded-full"
                  style={{ backgroundColor: module.accent }}
                />
                <p className="mt-3 break-words text-sm font-black text-[#34473f]">
                  {module.shortName}
                </p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function AccountantDashboard({
  user,
  sites,
  records,
  journals,
  supplierApInvoices,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
  journals: readonly AccountingJournal[];
  supplierApInvoices: readonly SupplierApInvoice[];
}) {
  const isChief = user.role === "chief-accountant";
  const visibleJournals = isChief
    ? journals
    : journals.filter((journal) => journal.makerAccountId === user.id);
  const visibleShiftJournals = visibleJournals.filter(
    (journal) => journal.sourceType === "shift-close",
  );
  const pendingChecker = visibleShiftJournals.filter(
    (journal) => journal.status === "pending-checker",
  );
  const returnedJournals = visibleShiftJournals.filter(
    (journal) => journal.status === "checker-returned",
  );
  const draftJournals = visibleShiftJournals.filter(
    (journal) => journal.status === "draft",
  );
  const postedJournals = visibleJournals.filter(
    (journal) => journal.status === "posted",
  );
  const postedValueVnd = postedJournals.reduce(
    (total, journal) => total + journalValue(journal),
    0,
  );
  const actionableShiftClosures = records.filter((record) =>
    accountingActionableStatuses.has(record.status),
  );
  const differenceShiftClosures = actionableShiftClosures.filter(
    (record) => record.differenceVnd !== 0,
  );
  const pendingDirector = records.filter(
    (record) => record.status === "exception-pending-director",
  );
  const supplierApToAct = supplierApInvoices.filter((invoice) =>
    isChief
      ? invoice.ownerRole === "chief-accountant" &&
        invoice.status === "accounting-review"
      : invoice.ownerRole === "accountant" &&
        [
          "match-exception",
          "ready-for-accounting",
          "accounting-returned",
        ].includes(invoice.status),
  );
  const supplierApReturned = supplierApToAct.filter(
    (invoice) => invoice.status === "accounting-returned",
  );
  const supplierApActionValue = supplierApToAct.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const supplierApQueue: WorkItem[] = supplierApToAct
    .slice(0, 8)
    .map((invoice) => ({
      id: invoice.id,
      title: `${invoice.caseCode} · ${formatVnd(invoice.totalVnd)}`,
      detail: `${invoice.supplier.name} · HĐ ${invoice.invoiceSeries}/${invoice.invoiceNumber}`,
      time: isChief
        ? "Chờ kiểm tra công nợ"
        : invoice.status === "match-exception"
          ? "Chênh lệch cần chuyển giám đốc"
        : invoice.status === "accounting-returned"
          ? "Bút toán bị trả"
          : "Đủ hồ sơ hạch toán",
      href: supplierApHref(user, invoice),
      tone:
        invoice.status === "accounting-returned"
          ? "red"
          : isChief
            ? "blue"
            : "green",
    }));
  const journalQueue: WorkItem[] = (
    isChief ? pendingChecker : [...returnedJournals, ...draftJournals]
  )
    .slice(0, 8)
    .map((journal) => ({
      id: journal.id,
      title: `${journal.journalCode} · ${formatVnd(journalValue(journal))}`,
      detail: `${journal.businessDate} · ${journal.lines.length} dòng · nguồn ${journal.sourceWorkflowId}`,
      time:
        journal.status === "pending-checker"
          ? "Chờ kiểm tra"
          : journal.status === "checker-returned"
            ? "Bị trả lại"
            : "Bản nháp",
      href: "/erp/finance",
      tone:
        journal.status === "checker-returned"
          ? "red"
          : journal.status === "pending-checker"
            ? "blue"
            : "amber",
    }));
  const shiftQueue: WorkItem[] = actionableShiftClosures
    .slice(0, 8)
    .map((record) => ({
      id: record.id,
      title: `Đối soát ca ${record.shiftCode}`,
      detail: `${record.station} · ${record.ticketsSold.toLocaleString("vi-VN")} vé · ${formatVnd(
        record.amounts.grossVnd - record.amounts.refundVnd,
      )}`,
      time:
        record.differenceVnd === 0
          ? "Tiền thu đã khớp"
          : `Chênh ${formatVnd(Math.abs(record.differenceVnd))}`,
      href: "/erp/finance",
      tone: record.differenceVnd === 0 ? "blue" : "red",
    }));
  const queue = [...supplierApQueue, ...journalQueue, ...shiftQueue].slice(
    0,
    12,
  );

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
              {isChief ? "Bàn kiểm soát kế toán" : "Bàn làm việc kế toán"}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              {user.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
              {isChief
                ? `${pendingChecker.length + supplierApToAct.length} hồ sơ chờ kiểm tra`
                : `${actionableShiftClosures.length} ca cần đối soát · ${supplierApToAct.length} hồ sơ công nợ cần xử lý`}{" "}
              · {returnedJournals.length + supplierApReturned.length} hồ sơ bị
              trả lại
            </p>
          </div>
          <Link
            href="/erp/finance"
            className="w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-[#183f34]"
          >
            Mở tài chính toàn vùng →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [
              isChief ? "Chờ kiểm tra" : "Hồ sơ cần xử lý",
              (isChief
                ? pendingChecker.length + supplierApToAct.length
                : actionableShiftClosures.length + supplierApToAct.length
              ).toLocaleString("vi-VN"),
              isChief
                ? `${pendingChecker.length} bút toán ca · ${supplierApToAct.length} hóa đơn`
                : `${actionableShiftClosures.length} ca · ${supplierApToAct.length} hóa đơn`,
            ],
            [
              isChief ? "Công nợ chờ kiểm tra" : "Công nợ cần xử lý",
              formatVnd(supplierApActionValue),
              `${supplierApToAct.length} hồ sơ nhà cung cấp`,
            ],
            [
              isChief ? "Đã ghi sổ" : "Bút toán của tôi",
              (isChief
                ? journals.length
                : visibleJournals.length
              ).toLocaleString("vi-VN"),
              `${postedJournals.length} đã ghi sổ`,
            ],
            [
              "Giá trị đã ghi sổ",
              formatVnd(postedValueVnd),
              `${differenceShiftClosures.length} ca lệch · ${pendingDirector.length} ngoại lệ đã chuyển cấp`,
            ],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-xl font-black sm:text-2xl">
                {value}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">
                {note}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#8a6b27]">
              Hồ sơ cần làm
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Hàng việc hôm nay
            </h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {queue.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="grid min-w-0 gap-2 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <p className="font-black text-[#293d34]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#748079]">
                    {item.detail}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneClasses[item.tone]}`}
                >
                  {item.time}
                </span>
              </Link>
            ))}
            {queue.length === 0 ? (
              <p className="p-6 text-sm leading-6 text-[#748079]">
                Không có hồ sơ nào đang chờ tài khoản này xử lý.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Theo cơ sở
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Hồ sơ đang mở
          </h2>
          <div className="mt-5 space-y-2">
            {sites.map((site) => {
              const siteActionable = actionableShiftClosures.filter(
                (record) => record.siteId === site.id,
              );
              const siteJournals = visibleJournals.filter(
                (journal) => journal.siteId === site.id,
              );
              const sitePendingChecker = siteJournals.filter(
                (journal) =>
                  journal.sourceType === "shift-close" &&
                  journal.status === "pending-checker",
              );
              const sitePosted = siteJournals.filter(
                (journal) => journal.status === "posted",
              );
              const sitePendingDirector = pendingDirector.filter(
                (record) => record.siteId === site.id,
              );
              const siteSupplierAp = supplierApToAct.filter(
                (invoice) => invoice.siteId === site.id,
              );
              const siteDifferenceVnd = siteActionable.reduce(
                (sum, record) => sum + Math.abs(record.differenceVnd),
                0,
              );
              const detail = `${siteActionable.length} ca cần đối soát · ${
                sitePendingChecker.length
              } bút toán chờ kiểm tra · ${siteSupplierAp.length} hóa đơn nhà cung cấp · ${sitePosted.length} đã ghi sổ${
                siteDifferenceVnd > 0
                  ? ` · chênh ${formatVnd(siteDifferenceVnd)}`
                  : sitePendingDirector.length > 0
                    ? ` · ${sitePendingDirector.length} ngoại lệ chờ giám đốc`
                    : ""
              }`;
              return (
                <Link
                  key={site.id}
                  href="/erp/finance"
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e0e6e2] p-4 transition hover:border-[#9db5aa] hover:bg-[#f7faf8]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#34473f]">
                      {site.shortName}
                    </p>
                    <p className="mt-1 text-xs text-[#7b8881]">{detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[#286655]">
                    Mở →
                  </span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}

function EmptyAssignment({ name }: { name: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-[#b8c6bf] bg-white p-8 text-center sm:p-12">
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
        Phân công công việc
      </p>
      <h1 className="mt-3 text-3xl font-black text-[#183f34]">{name}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#66756e]">
        Tài khoản chưa được gán cơ sở. Hãy liên hệ quản lý trực tiếp để nhận ca
        và nghiệp vụ phụ trách.
      </p>
    </section>
  );
}

export function RoleHomeDashboard({
  user,
  sites,
  records,
  workdays,
  journals,
  supplierApInvoices,
  workdayEmployees,
}: Props) {
  if (user.role === "manager") {
    return (
      <div className="space-y-5">
        <ManagerDashboard
          user={user}
          sites={sites}
          records={records}
          workdays={workdays}
          supplierApInvoices={supplierApInvoices}
        />
        <div id="workday-lifecycle">
          <WorkdayLifecycle
            user={user}
            sites={sites}
            initialRecords={workdays}
            employees={workdayEmployees}
          />
        </div>
      </div>
    );
  }
  if (user.role === "employee") {
    return (
      <div className="space-y-5">
        <EmployeeDashboard user={user} sites={sites} workdays={workdays} />
        <div id="workday-lifecycle">
          <WorkdayLifecycle
            user={user}
            sites={sites}
            initialRecords={workdays}
          />
        </div>
      </div>
    );
  }
  if (user.role === "accountant" || user.role === "chief-accountant") {
    return (
      <AccountantDashboard
        user={user}
        sites={sites}
        records={records}
        journals={journals}
        supplierApInvoices={supplierApInvoices}
      />
    );
  }
  return null;
}
