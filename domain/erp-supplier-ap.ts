import type { ErpRole, ErpSiteId } from "@/domain/erp";

export type SupplierApStatus =
  | "match-exception"
  | "ready-for-accounting"
  | "accounting-review"
  | "accounting-returned"
  | "director-exception"
  | "posted"
  | "reversed";

export type SupplierApMatchStatus = "matched" | "exception";

export type SupplierApExceptionCode =
  | "missing-purchase-order"
  | "missing-acceptance"
  | "invalid-supplier-tax-code"
  | "invalid-invoice-date"
  | "invoice-total-mismatch"
  | "invoice-over-purchase-order"
  | "invoice-over-acceptance";

export type SupplierApOwnerRole =
  | "manager"
  | "accountant"
  | "chief-accountant"
  | "director"
  | "none";

export type SupplierApSupplier = {
  id: string;
  siteId: ErpSiteId;
  code: string;
  name: string;
  taxCode: string;
  paymentTermsDays: number;
  status: "active" | "suspended";
};

export type SupplierApLine = {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPriceVnd: number;
  netVnd: number;
  vatVnd: number;
  expenseCategory: string;
  debitAccountCode: string;
  debitAccountName: string;
  costCenter: string;
  projectCode: string | null;
};

export type SupplierApAuditEvent = {
  id: string;
  invoiceId: string;
  sequenceNumber: number;
  eventType: string;
  fromStatus: SupplierApStatus | null;
  toStatus: SupplierApStatus;
  actorAccountId: string;
  actorRole: ErpRole | "system";
  note: string;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt: string;
};

export type SupplierApJournalLine = {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debitVnd: number;
  creditVnd: number;
};

export type SupplierApInvoice = {
  id: string;
  tenantId: string;
  siteId: ErpSiteId;
  caseCode: string;
  supplier: SupplierApSupplier;
  requestReference: string;
  purchaseOrderReference: string;
  contractReference: string | null;
  purchaseOrderTotalVnd: number;
  acceptanceReference: string;
  acceptedTotalVnd: number;
  invoiceSeries: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  netVnd: number;
  vatVnd: number;
  totalVnd: number;
  currency: "VND";
  matchStatus: SupplierApMatchStatus;
  exceptionCodes: readonly SupplierApExceptionCode[];
  exceptionNote: string | null;
  exceptionApprovedByAccountId: string | null;
  exceptionApprovedAt: string | null;
  status: SupplierApStatus;
  ownerRole: SupplierApOwnerRole;
  version: number;
  managerAccountId: string;
  accountantAccountId: string | null;
  accountantNote: string | null;
  checkerAccountId: string | null;
  checkerNote: string | null;
  journalId: string | null;
  journalCode: string | null;
  journalVersion: number | null;
  journalStatus:
    | "draft"
    | "pending-checker"
    | "checker-returned"
    | "posted"
    | null;
  journalLines: readonly SupplierApJournalLine[];
  submittedAt: string;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: readonly SupplierApLine[];
  auditTrail: readonly SupplierApAuditEvent[];
};

export type SupplierApMatchInput = {
  supplierTaxCode: string;
  purchaseOrderReference: string;
  purchaseOrderTotalVnd: number;
  acceptanceReference: string;
  acceptedTotalVnd: number;
  invoiceDate: string;
  dueDate: string;
  netVnd: number;
  vatVnd: number;
  totalVnd: number;
  toleranceVnd?: number;
  today?: string;
};

const TAX_CODE_PATTERN = /^(?:\d{10}|\d{13})$/;

function normalizedTaxCode(value: string) {
  return value.replace(/\D/g, "");
}

function isSafeMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function evaluateSupplierApMatch(
  input: SupplierApMatchInput,
): {
  status: SupplierApMatchStatus;
  exceptionCodes: SupplierApExceptionCode[];
} {
  const exceptions: SupplierApExceptionCode[] = [];
  const toleranceVnd = Math.max(0, Math.trunc(input.toleranceVnd ?? 0));
  const today = input.today ?? new Date().toISOString().slice(0, 10);

  if (!input.purchaseOrderReference.trim()) {
    exceptions.push("missing-purchase-order");
  }
  if (!input.acceptanceReference.trim()) {
    exceptions.push("missing-acceptance");
  }
  if (!TAX_CODE_PATTERN.test(normalizedTaxCode(input.supplierTaxCode))) {
    exceptions.push("invalid-supplier-tax-code");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.invoiceDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
    input.invoiceDate > today ||
    input.dueDate < input.invoiceDate
  ) {
    exceptions.push("invalid-invoice-date");
  }
  if (
    !isSafeMoney(input.netVnd) ||
    !isSafeMoney(input.vatVnd) ||
    !isSafeMoney(input.totalVnd) ||
    input.totalVnd <= 0 ||
    input.netVnd + input.vatVnd !== input.totalVnd
  ) {
    exceptions.push("invoice-total-mismatch");
  }
  if (
    !isSafeMoney(input.purchaseOrderTotalVnd) ||
    input.totalVnd > input.purchaseOrderTotalVnd + toleranceVnd
  ) {
    exceptions.push("invoice-over-purchase-order");
  }
  if (
    !isSafeMoney(input.acceptedTotalVnd) ||
    input.totalVnd > input.acceptedTotalVnd + toleranceVnd
  ) {
    exceptions.push("invoice-over-acceptance");
  }

  return {
    status: exceptions.length === 0 ? "matched" : "exception",
    exceptionCodes: [...new Set(exceptions)],
  };
}

export function supplierApLiabilityProposal(invoice: SupplierApInvoice) {
  const approvedMonetaryException =
    Boolean(invoice.exceptionApprovedAt) &&
    invoice.exceptionCodes.length > 0 &&
    invoice.exceptionCodes.every((code) =>
      [
        "invoice-over-purchase-order",
        "invoice-over-acceptance",
      ].includes(code),
    );
  if (
    !(
      (invoice.matchStatus === "matched" &&
        invoice.exceptionCodes.length === 0) ||
      approvedMonetaryException
    ) ||
    !["ready-for-accounting", "accounting-returned"].includes(invoice.status)
  ) {
    throw new Error(
      "Hóa đơn phải khớp PO, nghiệm thu và tổng tiền trước khi lập bút toán.",
    );
  }
  if (!invoice.lines.length) {
    throw new Error("Hóa đơn chưa có dòng chi phí để hạch toán.");
  }
  const debitLines = invoice.lines.map((line) => {
    if (
      !line.debitAccountCode.trim() ||
      !line.debitAccountName.trim() ||
      !isSafeMoney(line.netVnd) ||
      line.netVnd <= 0
    ) {
      throw new Error("Dòng chi phí của hóa đơn chưa hợp lệ.");
    }
    return {
      accountCode: line.debitAccountCode,
      accountName: line.debitAccountName,
      debitVnd: line.netVnd,
      creditVnd: 0,
      dimensions: {
        siteId: invoice.siteId,
        supplierId: invoice.supplier.id,
        supplierCode: invoice.supplier.code,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrderReference: invoice.purchaseOrderReference,
        acceptanceReference: invoice.acceptanceReference,
        expenseCategory: line.expenseCategory,
        costCenter: line.costCenter,
        ...(line.projectCode ? { projectCode: line.projectCode } : {}),
      },
    };
  });
  const netFromLines = invoice.lines.reduce(
    (total, line) => total + line.netVnd,
    0,
  );
  if (netFromLines !== invoice.netVnd) {
    throw new Error(
      "Tổng dòng chi phí không khớp giá trị trước thuế của hóa đơn.",
    );
  }
  return [
    ...debitLines,
    ...(invoice.vatVnd > 0
      ? [
          {
            accountCode: "1331",
            accountName: "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ",
            debitVnd: invoice.vatVnd,
            creditVnd: 0,
            dimensions: {
              siteId: invoice.siteId,
              supplierId: invoice.supplier.id,
              supplierCode: invoice.supplier.code,
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              taxTreatment: "input-vat-review-required",
            },
          },
        ]
      : []),
    {
      accountCode: "331",
      accountName: "Phải trả cho người bán",
      debitVnd: 0,
      creditVnd: invoice.totalVnd,
      dimensions: {
        siteId: invoice.siteId,
        supplierId: invoice.supplier.id,
        supplierCode: invoice.supplier.code,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
      },
    },
  ];
}

export function canActOnSupplierAp(
  role: ErpRole,
  invoice: SupplierApInvoice,
) {
  if (role === "manager") {
    return (
      invoice.ownerRole === "manager" &&
      invoice.status === "match-exception"
    );
  }
  if (role === "accountant") {
    return (
      invoice.ownerRole === "accountant" &&
      [
        "match-exception",
        "ready-for-accounting",
        "accounting-returned",
      ].includes(invoice.status)
    );
  }
  if (role === "chief-accountant") {
    return (
      invoice.ownerRole === "chief-accountant" &&
      invoice.status === "accounting-review"
    );
  }
  if (role === "director") {
    return (
      invoice.ownerRole === "director" &&
      invoice.status === "director-exception"
    );
  }
  return false;
}

export const SUPPLIER_AP_EXCEPTION_LABELS: Readonly<
  Record<SupplierApExceptionCode, string>
> = {
  "missing-purchase-order": "Thiếu mã PO/hợp đồng mua",
  "missing-acceptance": "Thiếu biên bản nhận hàng/nghiệm thu",
  "invalid-supplier-tax-code": "Mã số thuế nhà cung cấp chưa hợp lệ",
  "invalid-invoice-date": "Ngày hóa đơn hoặc hạn thanh toán chưa hợp lệ",
  "invoice-total-mismatch": "Tổng trước thuế, thuế và thanh toán không khớp",
  "invoice-over-purchase-order": "Giá trị hóa đơn vượt PO",
  "invoice-over-acceptance": "Giá trị hóa đơn vượt phần đã nghiệm thu",
};
