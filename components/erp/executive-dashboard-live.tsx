import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import type { AccountingJournal } from "@/domain/erp-accounting";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import type { WorkdayRecord } from "@/domain/erp-workday";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { ShiftCloseDirectorQueue } from "./shift-close-workflow";

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  journals: readonly AccountingJournal[];
  supplierApInvoices: readonly SupplierApInvoice[];
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function journalValue(journal: AccountingJournal) {
  return journal.lines.reduce((total, line) => total + line.debitVnd, 0);
}

function latestUpdatedAt(
  records: readonly ShiftCloseRecord[],
  workdays: readonly WorkdayRecord[],
  journals: readonly AccountingJournal[],
  supplierApInvoices: readonly SupplierApInvoice[],
) {
  const values = [
    ...records.map((record) => record.updatedAt),
    ...workdays.map((record) => record.updatedAt),
    ...journals.map((journal) => journal.updatedAt),
    ...supplierApInvoices.map((invoice) => invoice.updatedAt),
  ]
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (values.length === 0) return "Chưa có bản ghi";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(Math.max(...values)));
}

export function ExecutiveDashboard({
  user,
  sites,
  records,
  workdays,
  journals,
  supplierApInvoices,
}: Props) {
  const referenceNow = [
    ...records.map((record) => record.updatedAt),
    ...workdays.map((record) => record.updatedAt),
    ...journals.map((journal) => journal.updatedAt),
    ...supplierApInvoices.map((invoice) => invoice.updatedAt),
  ].reduce((latest, value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > latest
      ? timestamp
      : latest;
  }, 0);
  const businessDates = records
    .map((record) => record.businessDate)
    .sort((left, right) => right.localeCompare(left));
  const latestBusinessDate = businessDates[0] ?? null;
  const currentShiftRecords = latestBusinessDate
    ? records.filter((record) => record.businessDate === latestBusinessDate)
    : [];
  const ticketsSold = currentShiftRecords.reduce(
    (total, record) => total + record.ticketsSold,
    0,
  );
  const declaredRevenueVnd = currentShiftRecords.reduce(
    (total, record) =>
      total + record.amounts.grossVnd - record.amounts.refundVnd,
    0,
  );
  const declaredDifferenceVnd = currentShiftRecords.reduce(
    (total, record) => total + Math.abs(record.differenceVnd),
    0,
  );
  const activeWorkdays = workdays.filter((record) =>
    ["checked-in", "in-progress", "manager-returned"].includes(record.status),
  );
  const submittedWorkdays = workdays.filter(
    (record) => record.status === "submitted",
  );
  const overdueWorkdays = workdays.filter(
    (record) =>
      record.status !== "approved" &&
      Number.isFinite(Date.parse(record.dueAt)) &&
      Date.parse(record.dueAt) < referenceNow,
  );
  const postedJournals = journals.filter(
    (journal) => journal.status === "posted",
  );
  const postedValueVnd = postedJournals.reduce(
    (total, journal) => total + journalValue(journal),
    0,
  );
  const pendingShiftCloseDecisions = records.filter(
    (record) => record.status === "exception-pending-director",
  );
  const directorSupplierAp = supplierApInvoices.filter(
    (invoice) =>
      invoice.status === "director-exception" || invoice.status === "posted",
  );
  const pendingSupplierDecisions = directorSupplierAp.filter(
    (invoice) =>
      invoice.status === "director-exception" &&
      invoice.ownerRole === "director",
  );
  const pendingSupplierDecisionValue = pendingSupplierDecisions.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const postedSupplierAp = directorSupplierAp.filter(
    (invoice) => invoice.status === "posted",
  );
  const postedSupplierPayable = postedSupplierAp.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const directorDecisionCount =
    pendingShiftCloseDecisions.length + pendingSupplierDecisions.length;
  const asOf = latestUpdatedAt(
    records,
    workdays,
    journals,
    supplierApInvoices,
  );

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6d5ca]">
              Toàn vùng · {sites.length} cơ sở
              {latestBusinessDate ? ` · hồ sơ ca ${latestBusinessDate}` : ""}
            </p>
            <h1 className="mt-2 break-words text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">
              {currentShiftRecords.length} ca ·{" "}
              {workdays.length.toLocaleString("vi-VN")} phiếu công việc
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {directorDecisionCount} hồ sơ cần quyết định ·{" "}
              {postedSupplierAp.length} hóa đơn nhà cung cấp đã ghi nhận
            </p>
          </div>
          <p className="shrink-0 text-xs font-bold text-[#c3ded4]">
            Cập nhật gần nhất {asOf}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            [
              "Vé trong hồ sơ ca",
              ticketsSold.toLocaleString("vi-VN"),
              `${currentShiftRecords.length} ca đã gửi`,
            ],
            [
              "Doanh thu ca khai báo",
              formatVnd(declaredRevenueVnd),
              `Chênh lệch ${formatVnd(declaredDifferenceVnd)}`,
            ],
            [
              "Công việc hiện trường",
              activeWorkdays.length.toLocaleString("vi-VN"),
              `${submittedWorkdays.length} chờ duyệt · ${overdueWorkdays.length} quá hạn`,
            ],
            [
              "Bút toán đã ghi sổ",
              postedJournals.length.toLocaleString("vi-VN"),
              `${formatVnd(postedValueVnd)} · NCC đã ghi nhận ${formatVnd(postedSupplierPayable)}`,
            ],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-xl font-black tracking-[-0.03em] sm:text-2xl">
                {value}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">
                {note}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e2d4b9] bg-[#fffaf0] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#87642b]">
              Cần giám đốc quyết định
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#3f3524]">
              {pendingShiftCloseDecisions.length} ngoại lệ chốt ca ·{" "}
              {pendingSupplierDecisions.length} hồ sơ nhà cung cấp
            </h2>
          </div>
          <Link
            href="/erp/finance"
            className="text-sm font-black text-[#76551f]"
          >
            Mở sổ đối soát →
          </Link>
        </div>
        {directorDecisionCount > 0 ? (
          <div className="mt-5 space-y-4">
            {pendingShiftCloseDecisions.length > 0 ? (
              <ShiftCloseDirectorQueue records={records} user={user} />
            ) : null}
            {pendingSupplierDecisions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#4c3c23]">
                    Ngoại lệ hóa đơn đã được chuyển cấp
                  </p>
                  <p className="text-sm font-black text-[#7a5923]">
                    {formatVnd(pendingSupplierDecisionValue)}
                  </p>
                </div>
                {pendingSupplierDecisions.slice(0, 4).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/erp/finance#ap-${invoice.id}`}
                    className="grid gap-2 rounded-xl border border-[#e5d7bb] bg-white p-4 transition hover:border-[#c9a768] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#403727]">
                        {invoice.caseCode} · {invoice.supplier.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6d55]">
                        HĐ {invoice.invoiceSeries}/{invoice.invoiceNumber} ·{" "}
                        {invoice.exceptionCodes.length} điểm vượt hồ sơ nguồn
                      </p>
                    </div>
                    <span className="font-black text-[#76551f]">
                      {formatVnd(invoice.totalVnd)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[#756852]">
            Không có ngoại lệ đã xác minh nào đang chờ giám đốc quyết định.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-[#e4e9e6] p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">
              Ma trận bốn cơ sở
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Ca bán vé, công việc và sổ kế toán
            </h2>
          </div>
          <Link
            href="/erp/finance"
            className="text-sm font-black text-[#286655]"
          >
            Mở kiểm soát kế toán →
          </Link>
        </div>
        <div className="grid gap-px bg-[#e7ece9] sm:grid-cols-2">
          {sites.map((site) => {
            const siteShifts = currentShiftRecords.filter(
              (record) => record.siteId === site.id,
            );
            const siteTickets = siteShifts.reduce(
              (total, record) => total + record.ticketsSold,
              0,
            );
            const siteRevenue = siteShifts.reduce(
              (total, record) =>
                total + record.amounts.grossVnd - record.amounts.refundVnd,
              0,
            );
            const siteDifference = siteShifts.reduce(
              (total, record) => total + Math.abs(record.differenceVnd),
              0,
            );
            const siteWorkdays = workdays.filter(
              (record) => record.siteId === site.id,
            );
            const siteActive = siteWorkdays.filter((record) =>
              ["checked-in", "in-progress", "manager-returned"].includes(
                record.status,
              ),
            ).length;
            const siteSubmitted = siteWorkdays.filter(
              (record) => record.status === "submitted",
            ).length;
            const siteOverdue = siteWorkdays.filter(
              (record) =>
                record.status !== "approved" &&
                Number.isFinite(Date.parse(record.dueAt)) &&
                Date.parse(record.dueAt) < referenceNow,
            ).length;
            const siteJournals = journals.filter(
              (journal) => journal.siteId === site.id,
            );
            const sitePosted = siteJournals.filter(
              (journal) => journal.status === "posted",
            );
            const sitePostedValue = sitePosted.reduce(
              (total, journal) => total + journalValue(journal),
              0,
            );
            const siteSupplierAp = directorSupplierAp.filter(
              (invoice) => invoice.siteId === site.id,
            );
            const siteSupplierExceptions = siteSupplierAp.filter(
              (invoice) => invoice.status === "director-exception",
            ).length;
            const siteSupplierPayable = siteSupplierAp
              .filter((invoice) => invoice.status === "posted")
              .reduce((total, invoice) => total + invoice.totalVnd, 0);

            return (
              <Link
                key={site.id}
                href={`/erp/${site.id}`}
                className="min-w-0 bg-white p-5 transition hover:bg-[#f7faf8] sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-[#2b4037]">
                    {site.shortName}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                      siteOverdue > 0 ||
                      siteDifference > 0 ||
                      siteSupplierExceptions > 0
                        ? "bg-[#ffe4de] text-[#934336]"
                        : "bg-[#dff1e8] text-[#246249]"
                    }`}
                  >
                    {siteOverdue > 0 ||
                    siteDifference > 0 ||
                    siteSupplierExceptions > 0
                      ? "Cần kiểm tra"
                      : "Không có ngoại lệ"}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-[#849089]">Vé trong ca</dt>
                    <dd className="mt-1 font-black">
                      {siteTickets.toLocaleString("vi-VN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Doanh thu khai báo</dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteRevenue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Chênh lệch ca</dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteDifference)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Công việc</dt>
                    <dd className="mt-1 font-black">
                      {siteActive} đang làm · {siteSubmitted} chờ duyệt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Quá hạn</dt>
                    <dd className="mt-1 font-black">{siteOverdue}</dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Sổ kế toán</dt>
                    <dd className="mt-1 break-words font-black">
                      {sitePosted.length} bút toán ·{" "}
                      {formatVnd(sitePostedValue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">
                      Công nợ NCC đã ghi nhận
                    </dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteSupplierPayable)}
                    </dd>
                    {siteSupplierExceptions > 0 ? (
                      <p className="mt-1 text-[#934336]">
                        {siteSupplierExceptions} ngoại lệ cần quyết định
                      </p>
                    ) : null}
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
