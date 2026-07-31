import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpSiteId } from "@/domain/erp";
import {
  SUPPLIER_AP_EXCEPTION_LABELS,
  evaluateSupplierApMatch,
  supplierApLiabilityProposal,
  type SupplierApAuditEvent,
  type SupplierApExceptionCode,
  type SupplierApInvoice,
  type SupplierApJournalLine,
  type SupplierApLine,
  type SupplierApStatus,
  type SupplierApSupplier,
} from "@/domain/erp-supplier-ap";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const COOKIE_NAME = "nbj-erp-supplier-ap-v1";
const COOKIE_VERSION = 1;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_MAX_BYTES = 3_800;
const COOKIE_MAX_INFLATED_BYTES = 256 * 1024;
const MAX_ROWS = 200;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

type PersistenceMode = "supabase" | "demo-cookie";
type DatabaseRow = Record<string, unknown>;
type CommandContext = {
  actorAccountId: string;
  idempotencyKey: string;
  requestHash: string;
  note: string;
};

export type SubmitSupplierInvoiceInput = {
  siteId: ErpSiteId;
  supplierId: string;
  requestReference: string;
  purchaseOrderReference: string;
  contractReference: string;
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
  expenseCategory: string;
  description: string;
  costCenter: string;
  projectCode: string;
};

export type ResubmitSupplierInvoiceInput = {
  invoiceId: string;
  expectedVersion: number;
  purchaseOrderReference: string;
  purchaseOrderTotalVnd: number;
  acceptanceReference: string;
  acceptedTotalVnd: number;
};

type DemoState = {
  version: typeof COOKIE_VERSION;
  records: SupplierApInvoice[];
  receipts: Record<string, string>;
};

const DEMO_DIRECTOR_EXCEPTION_THRESHOLD_VND = 50_000_000;

function demoExceptionOwner(
  exceptionCodes: readonly SupplierApExceptionCode[],
  totalVnd: number,
  purchaseOrderTotalVnd: number,
  acceptedTotalVnd: number,
): SupplierApInvoice["ownerRole"] {
  const monetaryOnly =
    exceptionCodes.length > 0 &&
    exceptionCodes.every((code) =>
      [
        "invoice-over-purchase-order",
        "invoice-over-acceptance",
      ].includes(code),
    );
  const varianceVnd = Math.max(
    totalVnd - purchaseOrderTotalVnd,
    totalVnd - acceptedTotalVnd,
    0,
  );
  return monetaryOnly &&
    varianceVnd >= DEMO_DIRECTOR_EXCEPTION_THRESHOLD_VND
    ? "accountant"
    : "manager";
}

export class SupplierApRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SupplierApRepositoryError";
  }
}

export class SupplierApRepositoryConfigurationError extends SupplierApRepositoryError {
  readonly missingEnvironment: readonly string[];

  constructor(message: string, missingEnvironment: readonly string[] = []) {
    super(message);
    this.name = "SupplierApRepositoryConfigurationError";
    this.missingEnvironment = missingEnvironment;
  }
}

export class SupplierApRepositoryConflictError extends SupplierApRepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "SupplierApRepositoryConflictError";
  }
}

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  const mode = !raw ? "demo-cookie" : raw;
  if (mode !== "supabase" && mode !== "demo-cookie") {
    throw new SupplierApRepositoryConfigurationError(
      "ERP_PERSISTENCE_MODE phải là supabase hoặc demo-cookie.",
    );
  }
  if (process.env.VERCEL_ENV === "production" && mode !== "supabase") {
    throw new SupplierApRepositoryConfigurationError(
      "Môi trường production bắt buộc dùng kho dữ liệu Supabase.",
      ["ERP_PERSISTENCE_MODE"],
    );
  }
  return mode;
}

function createAdminClient(): SupabaseClient {
  if (readMode() !== "supabase") {
    throw new SupplierApRepositoryConfigurationError(
      "Không được mở Supabase client trong chế độ demo-cookie.",
    );
  }
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : null,
    !process.env.SUPABASE_SECRET_KEY?.trim()
      ? "SUPABASE_SECRET_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
  if (missing.length) {
    throw new SupplierApRepositoryConfigurationError(
      "Kho công nợ Supabase chưa được cấu hình đủ biến môi trường.",
      missing,
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SECRET_KEY!.trim(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-client-info": "ninhbinhjourney-erp-ap" } },
    },
  );
}

function asString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SupplierApRepositoryError(label + " trong kho dữ liệu không hợp lệ.");
  }
  return value;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asInteger(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new SupplierApRepositoryError(label + " trong kho dữ liệu không hợp lệ.");
  }
  return parsed;
}

function asSiteId(value: unknown) {
  const site = SITE_SLUG_BY_UUID.get(asString(value, "Cơ sở"));
  if (!site) {
    throw new SupplierApRepositoryError("Cơ sở trong kho công nợ không được hỗ trợ.");
  }
  return site;
}

function asStatus(value: unknown): SupplierApStatus {
  const statuses: readonly SupplierApStatus[] = [
    "match-exception",
    "ready-for-accounting",
    "accounting-review",
    "accounting-returned",
    "director-exception",
    "posted",
    "reversed",
  ];
  if (!statuses.includes(value as SupplierApStatus)) {
    throw new SupplierApRepositoryError(
      "Trạng thái hóa đơn nhà cung cấp không hợp lệ.",
    );
  }
  return value as SupplierApStatus;
}

function exceptionCodes(value: unknown) {
  const known = new Set(Object.keys(SUPPLIER_AP_EXCEPTION_LABELS));
  if (!Array.isArray(value)) return [] as SupplierApExceptionCode[];
  return value
    .filter(
      (item): item is SupplierApExceptionCode =>
        typeof item === "string" && known.has(item),
    )
    .filter((item, index, source) => source.indexOf(item) === index);
}

function supplierFromRow(row: DatabaseRow): SupplierApSupplier {
  const status = asString(row.status, "Trạng thái nhà cung cấp");
  return {
    id: asString(row.id, "Mã nhà cung cấp"),
    siteId: asSiteId(row.site_id),
    code: asString(row.supplier_code, "Mã nhà cung cấp"),
    name: asString(row.legal_name, "Tên nhà cung cấp"),
    taxCode: asString(row.tax_code, "Mã số thuế"),
    paymentTermsDays: asInteger(row.payment_terms_days, "Điều khoản thanh toán"),
    status: status === "suspended" ? "suspended" : "active",
  };
}

function lineFromRow(
  row: DatabaseRow,
  invoice: DatabaseRow,
  rule: DatabaseRow,
): SupplierApLine {
  return {
    id: asString(row.id, "Mã dòng hóa đơn"),
    invoiceId: asString(row.invoice_id, "Mã hóa đơn"),
    lineNumber: asInteger(row.line_number, "Số thứ tự dòng"),
    description: asString(row.description, "Nội dung dòng"),
    quantity: Number(row.quantity),
    unitPriceVnd: asInteger(row.unit_price_vnd, "Đơn giá"),
    netVnd: asInteger(row.net_vnd, "Giá trị trước thuế"),
    vatVnd: asInteger(row.vat_vnd, "Thuế GTGT"),
    expenseCategory: asString(rule.expense_category, "Nhóm chi phí"),
    debitAccountCode: asString(rule.debit_account_code, "Tài khoản Nợ"),
    debitAccountName: asString(rule.debit_account_name, "Tên tài khoản Nợ"),
    costCenter: asString(invoice.cost_center, "Trung tâm chi phí"),
    projectCode: asNullableString(invoice.project_code),
  };
}

function auditFromRow(row: DatabaseRow): SupplierApAuditEvent {
  const role = asString(row.actor_role, "Vai trò nhật ký");
  if (
    !["manager", "accountant", "chief-accountant", "director", "system"].includes(
      role,
    )
  ) {
    throw new SupplierApRepositoryError("Vai trò nhật ký công nợ không hợp lệ.");
  }
  return {
    id: asString(row.id, "Mã nhật ký"),
    invoiceId: asString(row.invoice_id, "Mã hóa đơn nhật ký"),
    sequenceNumber: asInteger(row.sequence_number, "Thứ tự nhật ký"),
    eventType: asString(row.event_type, "Loại sự kiện"),
    fromStatus: row.from_status ? asStatus(row.from_status) : null,
    toStatus: asStatus(row.to_status),
    actorAccountId: asString(row.actor_account_id, "Người thao tác"),
    actorRole: role as SupplierApAuditEvent["actorRole"],
    note: typeof row.note === "string" ? row.note : "",
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    occurredAt: asString(row.occurred_at, "Thời điểm nhật ký"),
  };
}

function journalLineFromRow(row: DatabaseRow): SupplierApJournalLine {
  return {
    id: asString(row.id, "Mã dòng bút toán"),
    lineNumber: asInteger(row.line_number, "Số dòng bút toán"),
    accountCode: asString(row.account_code, "Tài khoản"),
    accountName: asString(row.account_name, "Tên tài khoản"),
    debitVnd: asInteger(row.debit_vnd, "Phát sinh Nợ"),
    creditVnd: asInteger(row.credit_vnd, "Phát sinh Có"),
  };
}

function invoiceFromRows(
  row: DatabaseRow,
  supplier: SupplierApSupplier,
  rule: DatabaseRow,
  lineRows: readonly DatabaseRow[],
  auditRows: readonly DatabaseRow[],
  journalRow?: DatabaseRow,
  journalLineRows: readonly DatabaseRow[] = [],
): SupplierApInvoice {
  const matchStatus = asString(row.match_status, "Trạng thái đối chiếu");
  const ownerRole = asString(row.owner_role, "Vai trò đang xử lý");
  const journalStatus = journalRow
    ? asString(journalRow.status, "Trạng thái bút toán")
    : null;
  if (
    !["manager", "accountant", "chief-accountant", "director", "none"].includes(
      ownerRole,
    ) ||
    (journalStatus &&
      !["draft", "pending-checker", "checker-returned", "posted"].includes(
        journalStatus,
      ))
  ) {
    throw new SupplierApRepositoryError("Quyền sở hữu hồ sơ công nợ không hợp lệ.");
  }
  return {
    id: asString(row.id, "Mã hóa đơn"),
    tenantId: asString(row.tenant_id, "Mã đơn vị"),
    siteId: asSiteId(row.site_id),
    caseCode: asString(row.case_code, "Mã hồ sơ"),
    supplier,
    requestReference: asString(row.request_reference, "Mã đề nghị mua"),
    purchaseOrderReference:
      typeof row.purchase_order_reference === "string"
        ? row.purchase_order_reference
        : "",
    contractReference: asNullableString(row.contract_reference),
    purchaseOrderTotalVnd: asInteger(
      row.purchase_order_total_vnd,
      "Giá trị PO",
    ),
    acceptanceReference:
      typeof row.acceptance_reference === "string"
        ? row.acceptance_reference
        : "",
    acceptedTotalVnd: asInteger(row.accepted_total_vnd, "Giá trị nghiệm thu"),
    invoiceSeries: asString(row.invoice_series, "Ký hiệu hóa đơn"),
    invoiceNumber: asString(row.invoice_number, "Số hóa đơn"),
    invoiceDate: asString(row.invoice_date, "Ngày hóa đơn"),
    dueDate: asString(row.due_date, "Hạn thanh toán"),
    netVnd: asInteger(row.net_vnd, "Giá trị trước thuế"),
    vatVnd: asInteger(row.vat_vnd, "Thuế GTGT"),
    totalVnd: asInteger(row.total_vnd, "Tổng thanh toán"),
    currency: "VND",
    matchStatus: matchStatus === "matched" ? "matched" : "exception",
    exceptionCodes: exceptionCodes(row.exception_codes),
    exceptionNote: asNullableString(row.exception_note),
    exceptionApprovedByAccountId: asNullableString(
      row.exception_approved_by_account_id,
    ),
    exceptionApprovedAt: asNullableString(row.exception_approved_at),
    status: asStatus(row.status),
    ownerRole: ownerRole as SupplierApInvoice["ownerRole"],
    version: asInteger(row.version, "Phiên bản hóa đơn"),
    managerAccountId: asString(row.manager_account_id, "Quản lý nguồn"),
    accountantAccountId: asNullableString(row.accountant_account_id),
    accountantNote: asNullableString(row.accountant_note),
    checkerAccountId: asNullableString(row.checker_account_id),
    checkerNote: asNullableString(row.checker_note),
    journalId: asNullableString(row.journal_id),
    journalCode: journalRow
      ? asString(journalRow.journal_code, "Số bút toán")
      : null,
    journalVersion: journalRow
      ? asInteger(journalRow.version, "Phiên bản bút toán")
      : null,
    journalStatus:
      journalStatus as SupplierApInvoice["journalStatus"],
    journalLines: journalLineRows
      .map(journalLineFromRow)
      .sort((left, right) => left.lineNumber - right.lineNumber),
    submittedAt: asString(row.submitted_at, "Thời điểm gửi"),
    postedAt: asNullableString(row.posted_at),
    createdAt: asString(row.created_at, "Thời điểm tạo"),
    updatedAt: asString(row.updated_at, "Thời điểm cập nhật"),
    lines: lineRows
      .map((line) => lineFromRow(line, row, rule))
      .sort((left, right) => left.lineNumber - right.lineNumber),
    auditTrail: auditRows
      .map(auditFromRow)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber),
  };
}

function repositoryError(operation: string, error: unknown) {
  const source =
    error && typeof error === "object"
      ? (error as { code?: string; message?: string })
      : {};
  const message = source.message ?? "";
  if (source.code === "40001" || message.includes("VERSION_CONFLICT")) {
    return new SupplierApRepositoryConflictError(
      "Hồ sơ vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
    );
  }
  if (
    source.code === "23505" ||
    message.includes("AP_DUPLICATE_INVOICE")
  ) {
    return new SupplierApRepositoryConflictError(
      "Hóa đơn này đã tồn tại theo mã số thuế, ký hiệu và số hóa đơn.",
    );
  }
  return new SupplierApRepositoryError(
    `Không thể ${operation} trong kho công nợ.`,
    { cause: error },
  );
}

function normalizeSiteScope(siteIds?: readonly ErpSiteId[]) {
  return siteIds?.length
    ? [...new Set(siteIds)]
    : (Object.keys(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG) as ErpSiteId[]);
}

async function listFromSupabase(siteIds?: readonly ErpSiteId[]) {
  const client = createAdminClient();
  const siteUuids = normalizeSiteScope(siteIds).map(
    (siteId) => ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId],
  );
  const [supplierResult, invoiceResult, ruleResult] = await Promise.all([
    client
      .from("erp_ap_suppliers")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .in("site_id", siteUuids)
      .order("supplier_code"),
    client
      .from("erp_ap_supplier_invoices")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .in("site_id", siteUuids)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS),
    client
      .from("erp_ap_posting_rules")
      .select("*")
      .eq("tenant_id", TENANT_ID),
  ]);
  if (supplierResult.error) {
    throw repositoryError("đọc danh mục nhà cung cấp", supplierResult.error);
  }
  if (invoiceResult.error) {
    throw repositoryError("đọc hóa đơn nhà cung cấp", invoiceResult.error);
  }
  if (ruleResult.error) {
    throw repositoryError("đọc quy tắc hạch toán", ruleResult.error);
  }

  const supplierRows = (supplierResult.data ?? []) as DatabaseRow[];
  const invoiceRows = (invoiceResult.data ?? []) as DatabaseRow[];
  const ruleRows = (ruleResult.data ?? []) as DatabaseRow[];
  if (!invoiceRows.length) {
    return {
      suppliers: supplierRows.map(supplierFromRow),
      invoices: [] as SupplierApInvoice[],
    };
  }
  const invoiceIds = invoiceRows.map((row) => asString(row.id, "Mã hóa đơn"));
  const journalIds = invoiceRows
    .map((row) => asNullableString(row.journal_id))
    .filter((value): value is string => Boolean(value));
  const [lineResult, auditResult, journalResult, journalLineResult] =
    await Promise.all([
      client
        .from("erp_ap_supplier_invoice_lines")
        .select("*")
        .in("invoice_id", invoiceIds),
      client
        .from("erp_ap_audit_events")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("sequence_number"),
      journalIds.length
        ? client
            .from("erp_accounting_journals")
            .select("*")
            .in("id", journalIds)
        : Promise.resolve({ data: [], error: null }),
      journalIds.length
        ? client
            .from("erp_accounting_journal_lines")
            .select("*")
            .in("journal_id", journalIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  for (const [operation, result] of [
    ["đọc dòng hóa đơn", lineResult],
    ["đọc nhật ký công nợ", auditResult],
    ["đọc bút toán công nợ", journalResult],
    ["đọc dòng bút toán công nợ", journalLineResult],
  ] as const) {
    if (result.error) throw repositoryError(operation, result.error);
  }

  const suppliers = supplierRows.map(supplierFromRow);
  const supplierById = new Map(suppliers.map((item) => [item.id, item]));
  const ruleById = new Map(
    ruleRows.map((row) => [asString(row.id, "Mã quy tắc"), row]),
  );
  const lines = (lineResult.data ?? []) as DatabaseRow[];
  const audits = (auditResult.data ?? []) as DatabaseRow[];
  const journals = (journalResult.data ?? []) as DatabaseRow[];
  const journalLines = (journalLineResult.data ?? []) as DatabaseRow[];
  const journalById = new Map(
    journals.map((row) => [asString(row.id, "Mã bút toán"), row]),
  );

  const invoices = invoiceRows.map((row) => {
    const supplierId = asString(row.supplier_id, "Mã nhà cung cấp");
    const ruleId = asString(row.posting_rule_id, "Mã quy tắc");
    const supplier = supplierById.get(supplierId);
    const rule = ruleById.get(ruleId);
    if (!supplier || !rule) {
      throw new SupplierApRepositoryError(
        "Hóa đơn thiếu danh mục nhà cung cấp hoặc quy tắc hạch toán.",
      );
    }
    const invoiceId = asString(row.id, "Mã hóa đơn");
    const journalId = asNullableString(row.journal_id);
    return invoiceFromRows(
      row,
      supplier,
      rule,
      lines.filter((line) => line.invoice_id === invoiceId),
      audits.filter((audit) => audit.invoice_id === invoiceId),
      journalId ? journalById.get(journalId) : undefined,
      journalId
        ? journalLines.filter((line) => line.journal_id === journalId)
        : [],
    );
  });
  return { suppliers, invoices };
}

function demoSuppliers(): SupplierApSupplier[] {
  return [
    {
      id: "86000000-0000-4000-8000-000000000001",
      siteId: "trang-an",
      code: "NCC-TA-018",
      name: "Công ty Dịch vụ Tràng An Xanh",
      taxCode: "2700123456",
      paymentTermsDays: 30,
      status: "active",
    },
    {
      id: "86000000-0000-4000-8000-000000000002",
      siteId: "tam-chuc",
      code: "NCC-TC-011",
      name: "Công ty Vận tải Minh Long",
      taxCode: "0700123456",
      paymentTermsDays: 30,
      status: "active",
    },
    {
      id: "86000000-0000-4000-8000-000000000003",
      siteId: "tam-coc",
      code: "NCC-TCO-006",
      name: "Hợp tác xã Dịch vụ Tam Cốc",
      taxCode: "2700765432",
      paymentTermsDays: 15,
      status: "active",
    },
    {
      id: "86000000-0000-4000-8000-000000000004",
      siteId: "bai-dinh",
      code: "NCC-BD-021",
      name: "Công ty Vận hành Bái Đính",
      taxCode: "2700987654",
      paymentTermsDays: 30,
      status: "active",
    },
  ];
}

function demoRecord(input: {
  id: string;
  siteId: ErpSiteId;
  supplierId: string;
  caseCode: string;
  requestReference: string;
  purchaseOrderReference: string;
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
  description: string;
  category: string;
  debitCode: string;
  debitName: string;
  costCenter: string;
  status: SupplierApStatus;
  ownerRole: SupplierApInvoice["ownerRole"];
  exceptionCodes?: SupplierApExceptionCode[];
  version?: number;
  journalStatus?: SupplierApInvoice["journalStatus"];
  journalId?: string;
  journalCode?: string;
}) {
  const supplier = demoSuppliers().find((item) => item.id === input.supplierId)!;
  const now = "2026-07-29T08:00:00.000Z";
  const journalId = input.journalId ?? null;
  const exceptionCodes = input.exceptionCodes ?? [];
  return {
    id: input.id,
    tenantId: TENANT_ID,
    siteId: input.siteId,
    caseCode: input.caseCode,
    supplier,
    requestReference: input.requestReference,
    purchaseOrderReference: input.purchaseOrderReference,
    contractReference: "HD-" + input.caseCode.slice(3),
    purchaseOrderTotalVnd: input.purchaseOrderTotalVnd,
    acceptanceReference: input.acceptanceReference,
    acceptedTotalVnd: input.acceptedTotalVnd,
    invoiceSeries: input.invoiceSeries,
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    netVnd: input.netVnd,
    vatVnd: input.vatVnd,
    totalVnd: input.totalVnd,
    currency: "VND",
    matchStatus: exceptionCodes.length ? "exception" : "matched",
    exceptionCodes,
    exceptionNote: exceptionCodes.length
      ? exceptionCodes.map((code) => SUPPLIER_AP_EXCEPTION_LABELS[code]).join("; ")
      : null,
    exceptionApprovedByAccountId:
      input.status === "ready-for-accounting" && exceptionCodes.length
        ? "director-001"
        : null,
    exceptionApprovedAt:
      input.status === "ready-for-accounting" && exceptionCodes.length
        ? now
        : null,
    status: input.status,
    ownerRole: input.ownerRole,
    version: input.version ?? 1,
    managerAccountId: "manager-trang-an",
    accountantAccountId:
      ["accounting-review", "accounting-returned", "posted"].includes(input.status)
        ? "accountant-001"
        : null,
    accountantNote: null,
    checkerAccountId: input.status === "posted" ? "chief-accountant-001" : null,
    checkerNote: input.status === "posted" ? "Đủ điều kiện ghi nhận công nợ." : null,
    journalId,
    journalCode: journalId ? (input.journalCode ?? "AP-" + input.caseCode) : null,
    journalVersion: journalId ? (input.journalStatus === "posted" ? 2 : 1) : null,
    journalStatus: input.journalStatus ?? null,
    journalLines: journalId
      ? [
          {
            id: journalId + ":1",
            lineNumber: 1,
            accountCode: input.debitCode,
            accountName: input.debitName,
            debitVnd: input.netVnd,
            creditVnd: 0,
          },
          ...(input.vatVnd
            ? [
                {
                  id: journalId + ":2",
                  lineNumber: 2,
                  accountCode: "1331",
                  accountName:
                    "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ",
                  debitVnd: input.vatVnd,
                  creditVnd: 0,
                },
              ]
            : []),
          {
            id: journalId + ":3",
            lineNumber: input.vatVnd ? 3 : 2,
            accountCode: "331",
            accountName: "Phải trả cho người bán",
            debitVnd: 0,
            creditVnd: input.totalVnd,
          },
        ]
      : [],
    submittedAt: now,
    postedAt: input.status === "posted" ? now : null,
    createdAt: now,
    updatedAt: now,
    lines: [
      {
        id: input.id + ":line:1",
        invoiceId: input.id,
        lineNumber: 1,
        description: input.description,
        quantity: 1,
        unitPriceVnd: input.netVnd,
        netVnd: input.netVnd,
        vatVnd: input.vatVnd,
        expenseCategory: input.category,
        debitAccountCode: input.debitCode,
        debitAccountName: input.debitName,
        costCenter: input.costCenter,
        projectCode: null,
      },
    ],
    auditTrail: [],
  } satisfies SupplierApInvoice;
}

function demoRecords(): SupplierApInvoice[] {
  return [
    demoRecord({
      id: "87000000-0000-4000-8000-000000000001",
      siteId: "tam-chuc",
      supplierId: "86000000-0000-4000-8000-000000000002",
      caseCode: "AP-TC-202607-018",
      requestReference: "PR-TC-2026-018",
      purchaseOrderReference: "PO-TC-2026-018",
      purchaseOrderTotalVnd: 220_000_000,
      acceptanceReference: "NT-TC-2026-018",
      acceptedTotalVnd: 220_000_000,
      invoiceSeries: "1C26TML",
      invoiceNumber: "000018",
      invoiceDate: "2026-07-20",
      dueDate: "2026-08-19",
      netVnd: 200_000_000,
      vatVnd: 20_000_000,
      totalVnd: 220_000_000,
      description: "Dịch vụ xe trung chuyển tháng 7",
      category: "transport-service",
      debitCode: "6277",
      debitName: "Chi phí dịch vụ mua ngoài",
      costCenter: "TC-VANHANH",
      status: "ready-for-accounting",
      ownerRole: "accountant",
    }),
    demoRecord({
      id: "87000000-0000-4000-8000-000000000002",
      siteId: "trang-an",
      supplierId: "86000000-0000-4000-8000-000000000001",
      caseCode: "AP-TA-202607-024",
      requestReference: "PR-TA-2026-024",
      purchaseOrderReference: "PO-TA-2026-024",
      purchaseOrderTotalVnd: 118_800_000,
      acceptanceReference: "",
      acceptedTotalVnd: 0,
      invoiceSeries: "1C26TAX",
      invoiceNumber: "000024",
      invoiceDate: "2026-07-24",
      dueDate: "2026-08-23",
      netVnd: 108_000_000,
      vatVnd: 10_800_000,
      totalVnd: 118_800_000,
      description: "Suất ăn đoàn và phục vụ tại điểm",
      category: "food-service",
      debitCode: "632",
      debitName: "Giá vốn dịch vụ",
      costCenter: "TA-DICHVU",
      status: "match-exception",
      ownerRole: "manager",
      exceptionCodes: ["missing-acceptance", "invoice-over-acceptance"],
    }),
    demoRecord({
      id: "87000000-0000-4000-8000-000000000003",
      siteId: "bai-dinh",
      supplierId: "86000000-0000-4000-8000-000000000004",
      caseCode: "AP-BD-202607-031",
      requestReference: "PR-BD-2026-031",
      purchaseOrderReference: "PO-BD-2026-031",
      purchaseOrderTotalVnd: 385_000_000,
      acceptanceReference: "NT-BD-2026-031",
      acceptedTotalVnd: 385_000_000,
      invoiceSeries: "1C26BDV",
      invoiceNumber: "000031",
      invoiceDate: "2026-07-25",
      dueDate: "2026-08-24",
      netVnd: 350_000_000,
      vatVnd: 35_000_000,
      totalVnd: 385_000_000,
      description: "Bảo dưỡng hệ thống xe điện tháng 7",
      category: "maintenance-service",
      debitCode: "6277",
      debitName: "Chi phí dịch vụ mua ngoài",
      costCenter: "BD-KYTHUAT",
      status: "accounting-review",
      ownerRole: "chief-accountant",
      version: 2,
      journalId: "88000000-0000-4000-8000-000000000003",
      journalStatus: "pending-checker",
    }),
    demoRecord({
      id: "87000000-0000-4000-8000-000000000004",
      siteId: "tam-coc",
      supplierId: "86000000-0000-4000-8000-000000000003",
      caseCode: "AP-TCO-202607-009",
      requestReference: "PR-TCO-2026-009",
      purchaseOrderReference: "PO-TCO-2026-009",
      purchaseOrderTotalVnd: 154_000_000,
      acceptanceReference: "NT-TCO-2026-009",
      acceptedTotalVnd: 154_000_000,
      invoiceSeries: "1C26TCO",
      invoiceNumber: "000009",
      invoiceDate: "2026-07-18",
      dueDate: "2026-08-02",
      netVnd: 140_000_000,
      vatVnd: 14_000_000,
      totalVnd: 154_000_000,
      description: "Điều phối thuyền và bến phục vụ tháng 7",
      category: "transport-service",
      debitCode: "6277",
      debitName: "Chi phí dịch vụ mua ngoài",
      costCenter: "TCO-VANHANH",
      status: "posted",
      ownerRole: "none",
      version: 3,
      journalId: "88000000-0000-4000-8000-000000000004",
      journalStatus: "posted",
    }),
    demoRecord({
      id: "87000000-0000-4000-8000-000000000005",
      siteId: "tam-chuc",
      supplierId: "86000000-0000-4000-8000-000000000002",
      caseCode: "AP-TC-202607-027",
      requestReference: "PR-TC-2026-027",
      purchaseOrderReference: "PO-TC-2026-027",
      purchaseOrderTotalVnd: 620_000_000,
      acceptanceReference: "NT-TC-2026-027",
      acceptedTotalVnd: 620_000_000,
      invoiceSeries: "1C26TML",
      invoiceNumber: "000027",
      invoiceDate: "2026-07-27",
      dueDate: "2026-08-26",
      netVnd: 620_000_000,
      vatVnd: 62_000_000,
      totalVnd: 682_000_000,
      description: "Dịch vụ vận hành sự kiện tháng 8",
      category: "event-service",
      debitCode: "6418",
      debitName: "Chi phí bán hàng khác",
      costCenter: "TC-SUKIEN",
      status: "director-exception",
      ownerRole: "director",
      version: 2,
      exceptionCodes: [
        "invoice-over-purchase-order",
        "invoice-over-acceptance",
      ],
    }),
  ];
}

function cookieSecret() {
  return (
    process.env.ERP_SESSION_SECRET?.trim() ||
    "ninh-binh-journey-local-ap-cookie-secret"
  );
}

function sign(value: string) {
  return createHmac("sha256", cookieSecret()).update(value).digest("base64url");
}

function encodeState(state: DemoState) {
  const payload = deflateRawSync(Buffer.from(JSON.stringify(state), "utf8"), {
    level: 9,
  }).toString("base64url");
  return payload + "." + sign(payload);
}

function decodeState(value: string): DemoState | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }
  try {
    const inflated = inflateRawSync(Buffer.from(payload, "base64url"), {
      maxOutputLength: COOKIE_MAX_INFLATED_BYTES,
    }).toString("utf8");
    const parsed = JSON.parse(inflated) as DemoState;
    return parsed.version === COOKIE_VERSION &&
      Array.isArray(parsed.records) &&
      parsed.receipts &&
      typeof parsed.receipts === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function readDemoState(): Promise<DemoState> {
  const store = await cookies();
  const state = decodeState(store.get(COOKIE_NAME)?.value ?? "");
  return (
    state ?? {
      version: COOKIE_VERSION,
      records: demoRecords(),
      receipts: {},
    }
  );
}

async function writeDemoState(state: DemoState) {
  const value = encodeState(state);
  if (Buffer.byteLength(value, "utf8") > COOKIE_MAX_BYTES) {
    throw new SupplierApRepositoryError(
      "Phiên demo công nợ đã vượt dung lượng lưu trữ. Hãy đăng xuất để đặt lại dữ liệu demo.",
    );
  }
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

function nextAudit(
  invoice: SupplierApInvoice,
  input: {
    eventType: string;
    fromStatus: SupplierApStatus;
    toStatus: SupplierApStatus;
    actorAccountId: string;
    actorRole: SupplierApAuditEvent["actorRole"];
    note: string;
  },
) {
  return {
    id: randomUUID(),
    invoiceId: invoice.id,
    sequenceNumber: invoice.auditTrail.length + 1,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorAccountId: input.actorAccountId,
    actorRole: input.actorRole,
    note: input.note,
    metadata: {},
    occurredAt: new Date().toISOString(),
  } satisfies SupplierApAuditEvent;
}

function receiptRecord(state: DemoState, key: string) {
  const id = state.receipts[key];
  return id ? state.records.find((record) => record.id === id) ?? null : null;
}

async function mutateDemo(
  key: string,
  mutation: (state: DemoState) => SupplierApInvoice,
) {
  const state = await readDemoState();
  const replay = receiptRecord(state, key);
  if (replay) return replay;
  const record = mutation(state);
  state.receipts[key] = record.id;
  await writeDemoState(state);
  return record;
}

function replaceRecord(state: DemoState, record: SupplierApInvoice) {
  const index = state.records.findIndex((item) => item.id === record.id);
  if (index < 0) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
  state.records[index] = record;
  return record;
}

function requireVersion(record: SupplierApInvoice, expectedVersion: number) {
  if (record.version !== expectedVersion) {
    throw new SupplierApRepositoryConflictError(
      "Hồ sơ đã thay đổi. Hãy tải lại trước khi tiếp tục.",
    );
  }
}

async function rpcMutation(
  functionName: string,
  args: Record<string, unknown>,
  invoiceId?: string,
) {
  const client = createAdminClient();
  const result = await client.rpc(functionName, args);
  if (result.error) throw repositoryError("cập nhật hồ sơ công nợ", result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as
    | DatabaseRow
    | null;
  const id = invoiceId ?? (row ? asString(row.id, "Mã hóa đơn") : null);
  if (!id) {
    throw new SupplierApRepositoryError(
      "Kho công nợ không trả về hồ sơ sau khi cập nhật.",
    );
  }
  const record = await getSupplierInvoice(id);
  if (!record) {
    throw new SupplierApRepositoryError(
      "Không thể đọc lại hồ sơ công nợ vừa cập nhật.",
    );
  }
  return record;
}

export async function listSupplierAp(
  options: { siteIds?: readonly ErpSiteId[] } = {},
) {
  if (readMode() === "supabase") return listFromSupabase(options.siteIds);
  const sites = new Set(normalizeSiteScope(options.siteIds));
  return {
    suppliers: demoSuppliers().filter((supplier) => sites.has(supplier.siteId)),
    invoices: (await readDemoState()).records
      .filter((record) => sites.has(record.siteId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  };
}

export async function getSupplierInvoice(id: string) {
  if (!id.trim()) throw new SupplierApRepositoryError("Mã hóa đơn không hợp lệ.");
  if (readMode() === "supabase") {
    const all = await listFromSupabase();
    return all.invoices.find((record) => record.id === id) ?? null;
  }
  return (await readDemoState()).records.find((record) => record.id === id) ?? null;
}

export async function submitSupplierInvoice(
  input: SubmitSupplierInvoiceInput,
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation("erp_ap_submit_supplier_invoice", {
      p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
      p_supplier_id: input.supplierId,
      p_request_reference: input.requestReference,
      p_purchase_order_reference: input.purchaseOrderReference,
      p_contract_reference: input.contractReference,
      p_purchase_order_total_vnd: input.purchaseOrderTotalVnd,
      p_acceptance_reference: input.acceptanceReference,
      p_accepted_total_vnd: input.acceptedTotalVnd,
      p_invoice_series: input.invoiceSeries,
      p_invoice_number: input.invoiceNumber,
      p_invoice_date: input.invoiceDate,
      p_due_date: input.dueDate,
      p_net_vnd: input.netVnd,
      p_vat_vnd: input.vatVnd,
      p_total_vnd: input.totalVnd,
      p_expense_category: input.expenseCategory,
      p_description: input.description,
      p_cost_center: input.costCenter,
      p_project_code: input.projectCode,
      p_actor_account_id: context.actorAccountId,
      p_note: context.note,
      p_idempotency_key: context.idempotencyKey,
      p_request_hash: context.requestHash,
    });
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const supplier = demoSuppliers().find(
      (item) => item.id === input.supplierId && item.siteId === input.siteId,
    );
    if (!supplier) throw new SupplierApRepositoryError("Nhà cung cấp không hợp lệ.");
    if (
      state.records.some(
        (record) =>
          record.supplier.taxCode === supplier.taxCode &&
          record.invoiceSeries.replace(/\W/g, "").toUpperCase() ===
            input.invoiceSeries.replace(/\W/g, "").toUpperCase() &&
          record.invoiceNumber.replace(/\W/g, "").toUpperCase() ===
            input.invoiceNumber.replace(/\W/g, "").toUpperCase(),
      )
    ) {
      throw new SupplierApRepositoryConflictError(
        "Hóa đơn này đã tồn tại theo mã số thuế, ký hiệu và số hóa đơn.",
      );
    }
    const match = evaluateSupplierApMatch({
      supplierTaxCode: supplier.taxCode,
      purchaseOrderReference: input.purchaseOrderReference,
      purchaseOrderTotalVnd: input.purchaseOrderTotalVnd,
      acceptanceReference: input.acceptanceReference,
      acceptedTotalVnd: input.acceptedTotalVnd,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      netVnd: input.netVnd,
      vatVnd: input.vatVnd,
      totalVnd: input.totalVnd,
      toleranceVnd: 500_000,
    });
    const id = randomUUID();
    const now = new Date().toISOString();
    const categoryMap: Record<string, [string, string]> = {
      "food-service": ["632", "Giá vốn dịch vụ"],
      "event-service": ["6418", "Chi phí bán hàng khác"],
      "tools-and-equipment": ["153", "Công cụ, dụng cụ"],
    };
    const [debitCode, debitName] =
      categoryMap[input.expenseCategory] ??
      (["6277", "Chi phí dịch vụ mua ngoài"] as const);
    const record: SupplierApInvoice = {
      id,
      tenantId: TENANT_ID,
      siteId: input.siteId,
      caseCode:
        "AP-" +
        supplier.code +
        "-" +
        input.invoiceDate.replaceAll("-", "").slice(0, 6) +
        "-" +
        id.slice(0, 6).toUpperCase(),
      supplier,
      requestReference: input.requestReference,
      purchaseOrderReference: input.purchaseOrderReference,
      contractReference: input.contractReference || null,
      purchaseOrderTotalVnd: input.purchaseOrderTotalVnd,
      acceptanceReference: input.acceptanceReference,
      acceptedTotalVnd: input.acceptedTotalVnd,
      invoiceSeries: input.invoiceSeries,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      netVnd: input.netVnd,
      vatVnd: input.vatVnd,
      totalVnd: input.totalVnd,
      currency: "VND",
      matchStatus: match.status,
      exceptionCodes: match.exceptionCodes,
      exceptionNote:
        match.status === "exception" ? context.note : null,
      exceptionApprovedByAccountId: null,
      exceptionApprovedAt: null,
      status:
        match.status === "matched"
          ? "ready-for-accounting"
          : "match-exception",
      ownerRole:
        match.status === "matched"
          ? "accountant"
          : demoExceptionOwner(
              match.exceptionCodes,
              input.totalVnd,
              input.purchaseOrderTotalVnd,
              input.acceptedTotalVnd,
            ),
      version: 1,
      managerAccountId: context.actorAccountId,
      accountantAccountId: null,
      accountantNote: null,
      checkerAccountId: null,
      checkerNote: null,
      journalId: null,
      journalCode: null,
      journalVersion: null,
      journalStatus: null,
      journalLines: [],
      submittedAt: now,
      postedAt: null,
      createdAt: now,
      updatedAt: now,
      lines: [
        {
          id: randomUUID(),
          invoiceId: id,
          lineNumber: 1,
          description: input.description,
          quantity: 1,
          unitPriceVnd: input.netVnd,
          netVnd: input.netVnd,
          vatVnd: input.vatVnd,
          expenseCategory: input.expenseCategory,
          debitAccountCode: debitCode,
          debitAccountName: debitName,
          costCenter: input.costCenter,
          projectCode: input.projectCode || null,
        },
      ],
      auditTrail: [],
    };
    record.auditTrail = [
      {
        id: randomUUID(),
        invoiceId: record.id,
        sequenceNumber: 1,
        eventType:
          match.status === "matched"
            ? "invoice.submitted-and-matched"
            : "invoice.submitted-with-exception",
        fromStatus: null,
        toStatus: record.status,
        actorAccountId: context.actorAccountId,
        actorRole: "manager",
        note: context.note,
        metadata: { exceptionCodes: match.exceptionCodes },
        occurredAt: now,
      },
    ];
    state.records.unshift(record);
    return record;
  });
}

export async function resubmitSupplierInvoice(
  input: ResubmitSupplierInvoiceInput,
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation(
      "erp_ap_resubmit_supplier_invoice",
      {
        p_invoice_id: input.invoiceId,
        p_expected_version: input.expectedVersion,
        p_purchase_order_reference: input.purchaseOrderReference,
        p_purchase_order_total_vnd: input.purchaseOrderTotalVnd,
        p_acceptance_reference: input.acceptanceReference,
        p_accepted_total_vnd: input.acceptedTotalVnd,
        p_actor_account_id: context.actorAccountId,
        p_note: context.note,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
      },
      input.invoiceId,
    );
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const current = state.records.find((record) => record.id === input.invoiceId);
    if (!current) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
    requireVersion(current, input.expectedVersion);
    if (current.status !== "match-exception" || current.ownerRole !== "manager") {
      throw new SupplierApRepositoryError(
        "Hóa đơn này không nằm trong hàng quản lý cần bổ sung.",
      );
    }
    const match = evaluateSupplierApMatch({
      supplierTaxCode: current.supplier.taxCode,
      purchaseOrderReference: input.purchaseOrderReference,
      purchaseOrderTotalVnd: input.purchaseOrderTotalVnd,
      acceptanceReference: input.acceptanceReference,
      acceptedTotalVnd: input.acceptedTotalVnd,
      invoiceDate: current.invoiceDate,
      dueDate: current.dueDate,
      netVnd: current.netVnd,
      vatVnd: current.vatVnd,
      totalVnd: current.totalVnd,
      toleranceVnd: 500_000,
    });
    const status =
      match.status === "matched"
        ? "ready-for-accounting"
        : "match-exception";
    const updated: SupplierApInvoice = {
      ...current,
      purchaseOrderReference: input.purchaseOrderReference,
      purchaseOrderTotalVnd: input.purchaseOrderTotalVnd,
      acceptanceReference: input.acceptanceReference,
      acceptedTotalVnd: input.acceptedTotalVnd,
      matchStatus: match.status,
      exceptionCodes: match.exceptionCodes,
      exceptionNote: match.status === "exception" ? context.note : null,
      status,
      ownerRole:
        match.status === "matched"
          ? "accountant"
          : demoExceptionOwner(
              match.exceptionCodes,
              current.totalVnd,
              input.purchaseOrderTotalVnd,
              input.acceptedTotalVnd,
            ),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...current.auditTrail,
        nextAudit(current, {
          eventType:
            match.status === "matched"
              ? "invoice.resubmitted-and-matched"
              : "invoice.resubmitted-with-exception",
          fromStatus: current.status,
          toStatus: status,
          actorAccountId: context.actorAccountId,
          actorRole: "manager",
          note: context.note,
        }),
      ],
    };
    return replaceRecord(state, updated);
  });
}

export async function escalateSupplierInvoice(
  invoiceId: string,
  expectedVersion: number,
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation(
      "erp_ap_escalate_supplier_invoice",
      {
        p_invoice_id: invoiceId,
        p_expected_version: expectedVersion,
        p_actor_account_id: context.actorAccountId,
        p_note: context.note,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
      },
      invoiceId,
    );
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const current = state.records.find((record) => record.id === invoiceId);
    if (!current) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
    requireVersion(current, expectedVersion);
    const monetaryOnly = current.exceptionCodes.every((code) =>
      ["invoice-over-purchase-order", "invoice-over-acceptance"].includes(code),
    );
    const variance = Math.max(
      current.totalVnd - current.purchaseOrderTotalVnd,
      current.totalVnd - current.acceptedTotalVnd,
      0,
    );
    if (
      current.status !== "match-exception" ||
      current.ownerRole !== "accountant" ||
      !monetaryOnly ||
      variance < DEMO_DIRECTOR_EXCEPTION_THRESHOLD_VND
    ) {
      throw new SupplierApRepositoryError(
        "Chỉ sai lệch tiền trọng yếu đã được kiểm tra mới chuyển giám đốc.",
      );
    }
    const updated: SupplierApInvoice = {
      ...current,
      status: "director-exception",
      ownerRole: "director",
      version: current.version + 1,
      accountantAccountId: context.actorAccountId,
      accountantNote: context.note,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...current.auditTrail,
        nextAudit(current, {
          eventType: "invoice.exception-escalated",
          fromStatus: current.status,
          toStatus: "director-exception",
          actorAccountId: context.actorAccountId,
          actorRole: "accountant",
          note: context.note,
        }),
      ],
    };
    return replaceRecord(state, updated);
  });
}

export async function decideSupplierException(
  invoiceId: string,
  expectedVersion: number,
  decision: "approve" | "return",
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation(
      "erp_ap_decide_supplier_exception",
      {
        p_invoice_id: invoiceId,
        p_expected_version: expectedVersion,
        p_actor_account_id: context.actorAccountId,
        p_decision: decision,
        p_note: context.note,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
      },
      invoiceId,
    );
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const current = state.records.find((record) => record.id === invoiceId);
    if (!current) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
    requireVersion(current, expectedVersion);
    if (current.status !== "director-exception") {
      throw new SupplierApRepositoryError(
        "Hồ sơ không còn chờ giám đốc quyết định.",
      );
    }
    const status =
      decision === "approve" ? "ready-for-accounting" : "match-exception";
    const updated: SupplierApInvoice = {
      ...current,
      status,
      ownerRole: decision === "approve" ? "accountant" : "manager",
      version: current.version + 1,
      exceptionApprovedByAccountId:
        decision === "approve" ? context.actorAccountId : null,
      exceptionApprovedAt:
        decision === "approve" ? new Date().toISOString() : null,
      exceptionNote: context.note,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...current.auditTrail,
        nextAudit(current, {
          eventType:
            decision === "approve"
              ? "invoice.exception-approved"
              : "invoice.exception-returned",
          fromStatus: current.status,
          toStatus: status,
          actorAccountId: context.actorAccountId,
          actorRole: "director",
          note: context.note,
        }),
      ],
    };
    return replaceRecord(state, updated);
  });
}

export async function prepareSupplierInvoiceJournal(
  invoiceId: string,
  expectedVersion: number,
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation(
      "erp_accounting_prepare_supplier_invoice",
      {
        p_invoice_id: invoiceId,
        p_expected_source_version: expectedVersion,
        p_actor_account_id: context.actorAccountId,
        p_note: context.note,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
      },
      invoiceId,
    );
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const current = state.records.find((record) => record.id === invoiceId);
    if (!current) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
    requireVersion(current, expectedVersion);
    if (
      !["ready-for-accounting", "accounting-returned"].includes(current.status) ||
      current.ownerRole !== "accountant"
    ) {
      throw new SupplierApRepositoryError(
        "Hóa đơn không nằm trong hàng kế toán được lập công nợ.",
      );
    }
    const proposal = supplierApLiabilityProposal(current);
    const journalId = current.journalId ?? randomUUID();
    const updated: SupplierApInvoice = {
      ...current,
      status: "accounting-review",
      ownerRole: "chief-accountant",
      version: current.version + 1,
      accountantAccountId: context.actorAccountId,
      accountantNote: context.note,
      checkerAccountId: null,
      checkerNote: null,
      journalId,
      journalCode: current.journalCode ?? "AP-" + current.caseCode,
      journalVersion: (current.journalVersion ?? 0) + 1,
      journalStatus: "pending-checker",
      journalLines: proposal.map((line, index) => ({
        id: journalId + ":" + (index + 1),
        lineNumber: index + 1,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debitVnd: line.debitVnd,
        creditVnd: line.creditVnd,
      })),
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...current.auditTrail,
        nextAudit(current, {
          eventType: "invoice.liability-prepared",
          fromStatus: current.status,
          toStatus: "accounting-review",
          actorAccountId: context.actorAccountId,
          actorRole: "accountant",
          note: context.note,
        }),
      ],
    };
    return replaceRecord(state, updated);
  });
}

export async function reviewSupplierInvoiceJournal(
  invoiceId: string,
  expectedSourceVersion: number,
  expectedJournalVersion: number,
  decision: "approve" | "return",
  context: CommandContext,
) {
  if (readMode() === "supabase") {
    return rpcMutation(
      "erp_accounting_review_supplier_invoice_journal",
      {
        p_invoice_id: invoiceId,
        p_expected_source_version: expectedSourceVersion,
        p_expected_journal_version: expectedJournalVersion,
        p_actor_account_id: context.actorAccountId,
        p_decision: decision,
        p_note: context.note,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
      },
      invoiceId,
    );
  }
  return mutateDemo(context.idempotencyKey, (state) => {
    const current = state.records.find((record) => record.id === invoiceId);
    if (!current) throw new SupplierApRepositoryError("Không tìm thấy hóa đơn.");
    requireVersion(current, expectedSourceVersion);
    if (
      current.status !== "accounting-review" ||
      current.ownerRole !== "chief-accountant" ||
      current.journalStatus !== "pending-checker" ||
      current.journalVersion !== expectedJournalVersion
    ) {
      throw new SupplierApRepositoryConflictError(
        "Bút toán không còn chờ kế toán trưởng kiểm tra.",
      );
    }
    if (current.accountantAccountId === context.actorAccountId) {
      throw new SupplierApRepositoryError(
        "Người lập không được tự kiểm tra hoặc ghi sổ bút toán.",
      );
    }
    const status = decision === "approve" ? "posted" : "accounting-returned";
    const updated: SupplierApInvoice = {
      ...current,
      status,
      ownerRole: decision === "approve" ? "none" : "accountant",
      version: current.version + 1,
      checkerAccountId: context.actorAccountId,
      checkerNote: context.note,
      journalVersion: current.journalVersion + 1,
      journalStatus: decision === "approve" ? "posted" : "checker-returned",
      postedAt: decision === "approve" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...current.auditTrail,
        nextAudit(current, {
          eventType:
            decision === "approve"
              ? "invoice.liability-posted"
              : "invoice.liability-returned",
          fromStatus: current.status,
          toStatus: status,
          actorAccountId: context.actorAccountId,
          actorRole: "chief-accountant",
          note: context.note,
        }),
      ],
    };
    return replaceRecord(state, updated);
  });
}
