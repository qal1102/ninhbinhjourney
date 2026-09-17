import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  accountingJournalSourceLabel,
  summarisePostedTrialBalance,
  type AccountingJournal,
} from "@/domain/erp-accounting";
import { erpDataOriginLabel } from "@/domain/erp-data-origin";
import {
  SUPPLIER_AP_EXCEPTION_LABELS,
  type SupplierApInvoice,
} from "@/domain/erp-supplier-ap";
import { formatReportValue, type ErpReport, type ReportColumnKind, type ReportValue } from "./report";

/**
 * A15-ERP-02 — hai báo cáo tài chính kế toán hay phải đưa giám đốc:
 *
 * - **Sổ kế toán**: bảng cân đối phát sinh (con số tổng hợp) kèm sổ nhật ký
 *   từng dòng định khoản (chứng cứ đứng sau con số tổng).
 * - **Công nợ nhà cung cấp**: danh sách hóa đơn đang hiện với vai người xem,
 *   có hạn thanh toán, tiền trước thuế, thuế, tổng và trạng thái.
 *
 * Cả hai dựng từ đúng mảng màn hình đang vẽ; phép cộng cân đối dùng chung
 * `summarisePostedTrialBalance` với màn hình.
 */

function siteName(siteId: ErpSiteId) {
  return ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId;
}

function dateRange(values: readonly string[]): string | null {
  const days = values
    .map((value) => formatReportValue(value, "date"))
    .map((text) => {
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
      return match ? { key: `${match[3]}${match[2]}${match[1]}`, text } : null;
    })
    .filter((item): item is { key: string; text: string } => Boolean(item))
    .sort((left, right) => left.key.localeCompare(right.key));
  if (days.length === 0) return null;
  const first = days[0].text;
  const last = days[days.length - 1].text;
  return first === last ? first : `từ ${first} đến ${last}`;
}

export function buildAccountingLedgerReport(input: {
  journals: readonly AccountingJournal[];
  /** Chữ trạng thái bút toán đang hiện trên màn hình. */
  journalStatusLabel: (status: AccountingJournal["status"]) => string;
}): ErpReport {
  const { journals } = input;
  const { rows, totals } = summarisePostedTrialBalance(journals);
  const reversalTargets = new Set(
    journals.map((journal) => journal.reversalOfJournalId).filter((value): value is string => Boolean(value)),
  );
  const range = dateRange(journals.map((journal) => journal.businessDate));

  return {
    screen: "Sổ kế toán",
    site: "Toàn vùng",
    period: range ? `bút toán có ngày nghiệp vụ ${range}` : "chưa có bút toán nào",
    source: "sổ nhật ký kế toán trong hệ thống điều hành, đúng các bút toán tài khoản này đang xem. Số liệu lấy lúc mở trang.",
    fileSlug: "so-ke-toan",
    sheets: [
      {
        name: "Cân đối phát sinh",
        tables: [
          {
            title: "Cân đối phát sinh đã ghi sổ",
            note: "Chỉ cộng bút toán đã ghi sổ. Tổng Nợ và tổng Có phải bằng nhau trên toàn bộ bút toán.",
            columns: [
              { header: "Tài khoản", kind: "text" },
              { header: "Tên tài khoản", kind: "text" },
              { header: "Phát sinh Nợ (đ)", kind: "integer" },
              { header: "Phát sinh Có (đ)", kind: "integer" },
              { header: "Chênh lệch Nợ trừ Có (đ)", kind: "integer" },
            ],
            rows: rows.map((row) => [
              row.accountCode,
              row.accountName,
              row.debitVnd,
              row.creditVnd,
              row.debitVnd - row.creditVnd,
            ]),
            totalRow: ["Tổng cộng", null, totals.debitVnd, totals.creditVnd, null],
            emptyText: "Chưa có bút toán nào được kế toán trưởng ghi sổ.",
          },
        ],
      },
      {
        name: "Sổ nhật ký",
        tables: [
          {
            title: `${journals.length} bút toán có nguồn`,
            note: "Mỗi dòng là một dòng định khoản. Thứ tự giữ đúng như trên màn hình.",
            columns: [
              { header: "Số bút toán", kind: "text" },
              { header: "Cơ sở", kind: "text" },
              { header: "Nguồn", kind: "text" },
              { header: "Ngày nghiệp vụ", kind: "date" },
              { header: "Trạng thái", kind: "text" },
              { header: "Tài khoản", kind: "text" },
              { header: "Tên tài khoản", kind: "text" },
              { header: "Nợ (đ)", kind: "integer" },
              { header: "Có (đ)", kind: "integer" },
              { header: "Ghi sổ lúc", kind: "datetime" },
              { header: "Ghi chú", kind: "text" },
            ],
            rows: journals.flatMap((journal) => {
              const note = [
                erpDataOriginLabel(journal.dataOrigin),
                reversalTargets.has(journal.id) ? "đã có bút toán đảo" : null,
              ]
                .filter(Boolean)
                .join("; ");
              const head = [
                journal.journalCode,
                siteName(journal.siteId),
                accountingJournalSourceLabel(journal),
                journal.businessDate,
                input.journalStatusLabel(journal.status),
              ];
              if (journal.lines.length === 0) {
                return [[...head, null, null, null, null, journal.postedAt, note || null]];
              }
              return journal.lines.map((line) => [
                ...head,
                line.accountCode,
                line.accountName,
                line.debitVnd,
                line.creditVnd,
                journal.postedAt,
                note || null,
              ]);
            }),
            emptyText: "Chưa có bút toán. Kế toán bắt đầu từ một ca đã được quản lý duyệt.",
          },
        ],
      },
    ],
  };
}

export function buildSupplierApReport(input: {
  /** Tên cơ sở khi xem trong một cơ sở; bỏ trống là toàn vùng. */
  siteName?: string;
  /** Đúng danh sách hồ sơ đang hiện với vai người xem. */
  invoices: readonly SupplierApInvoice[];
  /** Chữ trạng thái hồ sơ đang hiện trên màn hình. */
  statusLabel: (status: SupplierApInvoice["status"]) => string;
}): ErpReport {
  const { invoices } = input;
  // Cột nào cũng phải đáng chỗ trên khổ A4 dọc: xem trong một cơ sở thì bỏ cột
  // "Cơ sở"; không hồ sơ nào đeo nhãn mẫu/chạy thử thì bỏ cột "Ghi chú".
  const columns: { header: string; kind: ReportColumnKind; value: (invoice: SupplierApInvoice) => ReportValue }[] = [
    { header: "Mã hồ sơ", kind: "text", value: (invoice) => invoice.caseCode },
    ...(input.siteName
      ? []
      : [{ header: "Cơ sở", kind: "text" as const, value: (invoice: SupplierApInvoice) => siteName(invoice.siteId) }]),
    { header: "Nhà cung cấp", kind: "text", value: (invoice) => invoice.supplier.name },
    { header: "Mã số thuế", kind: "text", value: (invoice) => invoice.supplier.taxCode },
    // Màn hình ghi "HĐ ký hiệu/số"; tệp giữ đúng cách ghi ấy.
    { header: "Số hóa đơn", kind: "text", value: (invoice) => `${invoice.invoiceSeries}/${invoice.invoiceNumber}` },
    { header: "Hạn thanh toán", kind: "date", value: (invoice) => invoice.dueDate },
    { header: "Trước thuế (đ)", kind: "integer", value: (invoice) => invoice.netVnd },
    { header: "Thuế GTGT (đ)", kind: "integer", value: (invoice) => invoice.vatVnd },
    { header: "Tổng thanh toán (đ)", kind: "integer", value: (invoice) => invoice.totalVnd },
    { header: "Trạng thái", kind: "text", value: (invoice) => input.statusLabel(invoice.status) },
    {
      header: "Phần chưa đạt",
      kind: "text",
      value: (invoice) =>
        invoice.exceptionCodes.map((code) => SUPPLIER_AP_EXCEPTION_LABELS[code] ?? code).join("; ") || null,
    },
    ...(invoices.some((invoice) => erpDataOriginLabel(invoice.dataOrigin))
      ? [
          {
            header: "Ghi chú",
            kind: "text" as const,
            value: (invoice: SupplierApInvoice) => erpDataOriginLabel(invoice.dataOrigin),
          },
        ]
      : []),
  ];
  return {
    screen: "Công nợ nhà cung cấp",
    site: input.siteName ?? "Toàn vùng",
    period: "mọi hồ sơ đang hiện trên màn hình, chưa lọc theo kỳ",
    source: "hồ sơ hóa đơn nhà cung cấp trong hệ thống điều hành, đúng phạm vi tài khoản này đang xem. Số liệu lấy lúc mở trang.",
    fileSlug: "cong-no-nha-cung-cap",
    sheets: [
      {
        name: "Hóa đơn nhà cung cấp",
        tables: [
          {
            title: `${invoices.length} hồ sơ có dữ liệu nguồn`,
            columns: columns.map(({ header, kind }) => ({ header, kind })),
            rows: invoices.map((invoice) => columns.map((column) => column.value(invoice))),
            emptyText: "Hiện không có hồ sơ nào thuộc phạm vi cần xử lý của tài khoản này.",
          },
        ],
      },
    ],
  };
}
