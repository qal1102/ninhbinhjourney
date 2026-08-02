"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId } from "@/domain/erp";
import { hasErpCapability } from "@/domain/erp-role-policy";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
  type CurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  SupplierApRepositoryConfigurationError,
  SupplierApRepositoryConflictError,
  SupplierApRepositoryError,
  decideSupplierException,
  escalateSupplierInvoice,
  getSupplierInvoice,
  listSupplierAp,
  prepareSupplierInvoiceJournal,
  requestSupplierPayment,
  resubmitSupplierInvoice,
  reviewSupplierInvoiceJournal,
  settleSupplierPayment,
  submitSupplierInvoice,
} from "@/lib/erp/supplier-ap-repository";

export type SupplierApActionState = {
  status: "idle" | "success" | "error";
  message: string;
  record?: SupplierApInvoice;
};

const IdSchema = z.uuid("Mã hồ sơ không hợp lệ.");
const VersionSchema = z.coerce
  .number()
  .int("Phiên bản hồ sơ không hợp lệ.")
  .min(1, "Phiên bản hồ sơ không hợp lệ.");
const MoneySchema = z.coerce
  .number()
  .int("Số tiền phải là số nguyên.")
  .min(0, "Số tiền không được âm.")
  .max(1_000_000_000_000, "Số tiền vượt giới hạn của hệ thống.");
const TextSchema = (label: string, min = 3, max = 200) =>
  z
    .string()
    .trim()
    .min(min, `${label} phải có ít nhất ${min} ký tự.`)
    .max(max, `${label} không được vượt quá ${max} ký tự.`);
const NoteSchema = TextSchema("Nội dung xử lý", 4, 2_000);
const DateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD.");

function currentVietnamDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}

function errorState(error: unknown): SupplierApActionState {
  if (error instanceof SupplierApRepositoryConfigurationError) {
    return {
      status: "error",
      message:
        "Kho công nợ chưa được cấu hình đủ trên máy chủ. Vui lòng báo bộ phận hệ thống.",
    };
  }
  if (error instanceof SupplierApRepositoryConflictError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof SupplierApRepositoryError) {
    console.error("Supplier AP persistence failed", {
      name: error.name,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "Kho công nợ chưa phản hồi đầy đủ. Vui lòng thử lại; nếu lỗi lặp lại, báo bộ phận hệ thống kèm mã hồ sơ.",
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof Error) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Không thể xử lý hồ sơ công nợ lúc này." };
}

function requireUser(user: CurrentErpUser | null) {
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  return user;
}

function requireSiteModuleAccess(
  user: CurrentErpUser,
  siteId: SupplierApInvoice["siteId"],
) {
  if (
    !accountCanAccessSite(user, siteId) ||
    !accountCanAccessModule(user, siteId, "doi-tac-nha-cung-ung")
  ) {
    throw new Error(
      "Bạn không được phân quyền nghiệp vụ nhà cung cấp tại cơ sở này.",
    );
  }
}

function requireCapability(
  user: CurrentErpUser,
  capability:
    | "ap.source.submit"
    | "ap.invoice.review"
    | "ap.liability.prepare"
    | "ap.liability.check"
    | "ap.liability.post"
    | "ap.exception.decide"
    | "accounting.payment.prepare"
    | "accounting.journal.check",
) {
  if (!hasErpCapability(user.role, capability)) {
    throw new Error("Tài khoản không có quyền thực hiện bước nghiệp vụ này.");
  }
}

function requestEnvelope(
  command: string,
  actorAccountId: string,
  payload: Record<string, string | number>,
) {
  const canonical = JSON.stringify({
    command,
    actorAccountId,
    payload: Object.fromEntries(
      Object.entries(payload).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  });
  const requestHash = createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
  return {
    requestHash,
    idempotencyKey:
      "ap:" +
      command.replace(/[^a-z-]/g, "") +
      ":" +
      requestHash.slice(0, 48),
  };
}

function revalidateSupplierAp(siteId: SupplierApInvoice["siteId"]) {
  revalidatePath("/erp");
  revalidatePath("/erp/finance");
  revalidatePath(`/erp/${siteId}`);
  revalidatePath(`/erp/${siteId}/doi-tac-nha-cung-ung`);
}

async function loadInvoiceForUser(
  user: CurrentErpUser,
  invoiceId: string,
) {
  const invoice = await getSupplierInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Không tìm thấy hóa đơn trong phạm vi được giao.");
  }
  requireSiteModuleAccess(user, invoice.siteId);
  return invoice;
}

export async function submitSupplierInvoiceAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        siteId: z.string().trim(),
        supplierId: IdSchema,
        requestReference: TextSchema("Mã đề nghị mua", 3, 100),
        purchaseOrderReference: z.string().trim().max(100),
        contractReference: z.string().trim().max(100),
        purchaseOrderTotalVnd: MoneySchema,
        acceptanceReference: z.string().trim().max(100),
        acceptedTotalVnd: MoneySchema,
        invoiceSeries: TextSchema("Ký hiệu hóa đơn", 1, 50),
        invoiceNumber: TextSchema("Số hóa đơn", 1, 50),
        invoiceDate: DateSchema,
        dueDate: DateSchema,
        netVnd: MoneySchema,
        vatVnd: MoneySchema,
        totalVnd: MoneySchema,
        expenseCategory: z.enum([
          "transport-service",
          "food-service",
          "maintenance-service",
          "event-service",
          "tools-and-equipment",
        ]),
        description: TextSchema("Nội dung hàng hóa/dịch vụ", 3, 500),
        costCenter: TextSchema("Trung tâm chi phí", 2, 80),
        projectCode: z.string().trim().max(80),
        note: NoteSchema,
      })
      .superRefine((value, context) => {
        if (value.netVnd + value.vatVnd !== value.totalVnd) {
          context.addIssue({
            code: "custom",
            path: ["totalVnd"],
            message:
              "Tổng thanh toán phải bằng giá trị trước thuế cộng thuế GTGT.",
          });
        }
        if (value.dueDate < value.invoiceDate) {
          context.addIssue({
            code: "custom",
            path: ["dueDate"],
            message: "Hạn thanh toán không được trước ngày hóa đơn.",
          });
        }
        if (value.invoiceDate > currentVietnamDate()) {
          context.addIssue({
            code: "custom",
            path: ["invoiceDate"],
            message: "Ngày hóa đơn không được sau ngày hiện tại.",
          });
        }
      })
      .parse({
        siteId: formData.get("siteId"),
        supplierId: formData.get("supplierId"),
        requestReference: formData.get("requestReference"),
        purchaseOrderReference: formData.get("purchaseOrderReference") ?? "",
        contractReference: formData.get("contractReference") ?? "",
        purchaseOrderTotalVnd: formData.get("purchaseOrderTotalVnd"),
        acceptanceReference: formData.get("acceptanceReference") ?? "",
        acceptedTotalVnd: formData.get("acceptedTotalVnd"),
        invoiceSeries: formData.get("invoiceSeries"),
        invoiceNumber: formData.get("invoiceNumber"),
        invoiceDate: formData.get("invoiceDate"),
        dueDate: formData.get("dueDate"),
        netVnd: formData.get("netVnd"),
        vatVnd: formData.get("vatVnd"),
        totalVnd: formData.get("totalVnd"),
        expenseCategory: formData.get("expenseCategory"),
        description: formData.get("description"),
        costCenter: formData.get("costCenter"),
        projectCode: formData.get("projectCode") ?? "",
        note: formData.get("note"),
      });
    const siteId = input.siteId;
    if (!isErpSiteId(siteId)) {
      throw new Error("Cơ sở không hợp lệ.");
    }
    const validatedInput = {
      ...input,
      siteId,
    };
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.source.submit");
    requireSiteModuleAccess(user, siteId);
    const supplier = (await listSupplierAp({ siteIds: [siteId] })).suppliers.find(
      (item) =>
        item.id === input.supplierId &&
        item.siteId === siteId &&
        item.status === "active",
    );
    if (!supplier) {
      throw new Error("Nhà cung cấp không hoạt động tại cơ sở này.");
    }
    const envelope = requestEnvelope("submit-supplier-invoice", user.id, {
      ...validatedInput,
    });
    const record = await submitSupplierInvoice(validatedInput, {
      actorAccountId: user.id,
      note: input.note,
      ...envelope,
    });
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message:
        record.matchStatus === "matched"
          ? `${record.caseCode} đã khớp PO–nghiệm thu–hóa đơn và chuyển kế toán.`
          : `${record.caseCode} đã lưu; hệ thống chỉ rõ phần cần bổ sung trước khi hạch toán.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function resubmitSupplierInvoiceAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        purchaseOrderReference: z.string().trim().max(100),
        purchaseOrderTotalVnd: MoneySchema,
        acceptanceReference: z.string().trim().max(100),
        acceptedTotalVnd: MoneySchema,
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        purchaseOrderReference: formData.get("purchaseOrderReference") ?? "",
        purchaseOrderTotalVnd: formData.get("purchaseOrderTotalVnd"),
        acceptanceReference: formData.get("acceptanceReference") ?? "",
        acceptedTotalVnd: formData.get("acceptedTotalVnd"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.source.submit");
    const current = await loadInvoiceForUser(user, input.invoiceId);
    if (current.version !== input.expectedVersion) {
      throw new SupplierApRepositoryConflictError(
        "Hồ sơ vừa được cập nhật. Hãy tải lại trước khi gửi lại.",
      );
    }
    const envelope = requestEnvelope("resubmit-supplier-invoice", user.id, input);
    const record = await resubmitSupplierInvoice(input, {
      actorAccountId: user.id,
      note: input.note,
      ...envelope,
    });
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message:
        record.matchStatus === "matched"
          ? "Hồ sơ đã đủ PO và nghiệm thu, kế toán đã nhận được ngay."
          : "Đã lưu phần bổ sung; hồ sơ vẫn còn sai lệch cần xử lý.",
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function escalateSupplierInvoiceAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.invoice.review");
    const current = await loadInvoiceForUser(user, input.invoiceId);
    if (current.version !== input.expectedVersion) {
      throw new SupplierApRepositoryConflictError(
        "Hồ sơ vừa được cập nhật. Hãy tải lại trước khi chuyển cấp.",
      );
    }
    if (
      current.status !== "match-exception" ||
      current.ownerRole !== "accountant"
    ) {
      throw new Error(
        "Hồ sơ này chưa được chuyển cho kế toán xác minh ngoại lệ.",
      );
    }
    const envelope = requestEnvelope("escalate-supplier-invoice", user.id, input);
    const record = await escalateSupplierInvoice(
      current.id,
      input.expectedVersion,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message: `${record.caseCode} đã chuyển giám đốc cùng số tiền và lý do sai lệch.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function decideSupplierExceptionAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        decision: z.enum(["approve", "return"]),
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        decision: formData.get("decision"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.exception.decide");
    const current = await loadInvoiceForUser(user, input.invoiceId);
    if (current.version !== input.expectedVersion) {
      throw new SupplierApRepositoryConflictError(
        "Hồ sơ vừa được cập nhật. Hãy tải lại trước khi quyết định.",
      );
    }
    const envelope = requestEnvelope("decide-supplier-exception", user.id, input);
    const record = await decideSupplierException(
      current.id,
      input.expectedVersion,
      input.decision,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message:
        input.decision === "approve"
          ? "Đã chấp thuận ngoại lệ; hồ sơ chuyển sang kế toán lập công nợ."
          : "Đã trả hồ sơ về quản lý cơ sở để xử lý nguồn.",
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function prepareSupplierInvoiceJournalAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.liability.prepare");
    const current = await loadInvoiceForUser(user, input.invoiceId);
    if (current.version !== input.expectedVersion) {
      throw new SupplierApRepositoryConflictError(
        "Hồ sơ vừa được cập nhật. Hãy tải lại trước khi lập công nợ.",
      );
    }
    const envelope = requestEnvelope("prepare-supplier-invoice", user.id, input);
    const record = await prepareSupplierInvoiceJournal(
      current.id,
      input.expectedVersion,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message: `${record.journalCode ?? "Bút toán công nợ"} đã chuyển kế toán trưởng kiểm tra.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function reviewSupplierInvoiceJournalAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedSourceVersion: VersionSchema,
        expectedJournalVersion: VersionSchema,
        decision: z.enum(["approve", "return"]),
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedSourceVersion: formData.get("expectedSourceVersion"),
        expectedJournalVersion: formData.get("expectedJournalVersion"),
        decision: formData.get("decision"),
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "ap.liability.check");
    if (input.decision === "approve") {
      requireCapability(user, "ap.liability.post");
    }
    const current = await loadInvoiceForUser(user, input.invoiceId);
    if (
      current.version !== input.expectedSourceVersion ||
      current.journalVersion !== input.expectedJournalVersion
    ) {
      throw new SupplierApRepositoryConflictError(
        "Hồ sơ hoặc bút toán vừa được cập nhật. Hãy tải lại trước khi kiểm tra.",
      );
    }
    if (current.accountantAccountId === user.id) {
      throw new Error(
        "Người lập không được tự kiểm tra hoặc ghi sổ bút toán của mình.",
      );
    }
    const envelope = requestEnvelope("review-supplier-invoice", user.id, input);
    const record = await reviewSupplierInvoiceJournal(
      current.id,
      input.expectedSourceVersion,
      input.expectedJournalVersion,
      input.decision,
      {
        actorAccountId: user.id,
        note: input.note,
        ...envelope,
      },
    );
    revalidateSupplierAp(record.siteId);
    return {
      status: "success",
      message:
        input.decision === "approve"
          ? `${record.journalCode ?? "Bút toán"} đã ghi sổ; công nợ 331 được ghi nhận.`
          : "Đã trả bút toán về kế toán và ghi rõ nội dung cần sửa.",
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

/**
 * T10. The two steps that finally discharge a payable. Capability names mirror
 * the ones already used for the journal: the accountant prepares, the chief
 * accountant checks. The database refuses if they are the same person, and so
 * does the repository in demo mode -- this rule is not allowed to hold in only
 * one of the two persistence paths.
 */
export async function requestSupplierPaymentAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        paymentMethod: z.enum(["bank-transfer", "cash", "offset"]),
        paymentReference: z.string().trim().max(100),
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        paymentMethod: formData.get("paymentMethod"),
        paymentReference: formData.get("paymentReference") ?? "",
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "accounting.payment.prepare");
    const invoice = await loadInvoiceForUser(user, input.invoiceId);
    const envelope = requestEnvelope("request-supplier-payment", user.id, {
      invoiceId: input.invoiceId,
      expectedVersion: input.expectedVersion,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
    });
    const record = await requestSupplierPayment(
      input.invoiceId,
      input.expectedVersion,
      input.paymentMethod,
      input.paymentReference,
      { actorAccountId: user.id, note: input.note, ...envelope },
    );
    revalidateSupplierAp(invoice.siteId);
    return {
      status: "success",
      message: `${record.caseCode} đã chuyển kế toán trưởng duyệt chi.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function settleSupplierPaymentAction(
  _previous: SupplierApActionState,
  formData: FormData,
): Promise<SupplierApActionState> {
  try {
    const decision = String(formData.get("decision") ?? "");
    if (decision !== "settle" && decision !== "return") {
      throw new Error("Quyết định duyệt chi không hợp lệ.");
    }
    const input = z
      .object({
        invoiceId: IdSchema,
        expectedVersion: VersionSchema,
        paidAmountVnd: MoneySchema.optional(),
        note: NoteSchema,
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        expectedVersion: formData.get("expectedVersion"),
        paidAmountVnd: formData.get("paidAmountVnd") ?? undefined,
        note: formData.get("note"),
      });
    const user = requireUser(await getCurrentErpUser());
    requireCapability(user, "accounting.journal.check");
    const invoice = await loadInvoiceForUser(user, input.invoiceId);
    const envelope = requestEnvelope("settle-supplier-payment", user.id, {
      invoiceId: input.invoiceId,
      expectedVersion: input.expectedVersion,
      decision,
      paidAmountVnd: input.paidAmountVnd ?? 0,
    });
    const record = await settleSupplierPayment(
      input.invoiceId,
      input.expectedVersion,
      decision === "settle",
      decision === "settle" ? (input.paidAmountVnd ?? null) : null,
      { actorAccountId: user.id, note: input.note, ...envelope },
    );
    revalidateSupplierAp(invoice.siteId);
    return {
      status: "success",
      message:
        decision === "settle"
          ? `${record.caseCode} đã ghi nhận thanh toán cho nhà cung cấp.`
          : `${record.caseCode} đã trả lại kế toán để bổ sung đề nghị chi.`,
      record,
    };
  } catch (error) {
    return errorState(error);
  }
}
