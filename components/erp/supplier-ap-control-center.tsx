"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  decideSupplierExceptionAction,
  escalateSupplierInvoiceAction,
  prepareSupplierInvoiceJournalAction,
  resubmitSupplierInvoiceAction,
  requestSupplierPaymentAction,
  reviewSupplierInvoiceJournalAction,
  settleSupplierPaymentAction,
  submitSupplierInvoiceAction,
  type SupplierApActionState,
} from "@/app/erp/supplier-ap-actions";
import { ERP_SITES, type ErpSite } from "@/domain/erp";
import {
  SUPPLIER_AP_EXCEPTION_LABELS,
  type SupplierApInvoice,
  type SupplierApSupplier,
} from "@/domain/erp-supplier-ap";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

const INITIAL_ACTION_STATE: SupplierApActionState = {
  status: "idle",
  message: "",
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function siteName(siteId: SupplierApInvoice["siteId"]) {
  return ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId;
}

function statusMeta(status: SupplierApInvoice["status"]) {
  const values = {
    "match-exception": {
      label: "Cần bổ sung nguồn",
      className: "bg-[#ffe5df] text-[#934336]",
    },
    "ready-for-accounting": {
      label: "Sẵn sàng hạch toán",
      className: "bg-[#e3edf4] text-[#315f79]",
    },
    "accounting-review": {
      label: "Chờ kế toán trưởng",
      className: "bg-[#fff0ce] text-[#77531c]",
    },
    "accounting-returned": {
      label: "Trả về kế toán",
      className: "bg-[#ffe5df] text-[#934336]",
    },
    "director-exception": {
      label: "Chờ giám đốc quyết định",
      className: "bg-[#f3dfef] text-[#77446f]",
    },
    posted: {
      label: "Đã ghi nhận công nợ",
      className: "bg-[#dff1e8] text-[#246249]",
    },
    "payment-requested": {
      label: "Chờ duyệt chi",
      className: "bg-[#fff0ce] text-[#77531c]",
    },
    paid: {
      label: "Đã thanh toán",
      className: "bg-[#dff1e8] text-[#246249]",
    },
    reversed: {
      label: "Đã hoàn bút",
      className: "bg-[#ececea] text-[#59635e]",
    },
  } as const;
  return values[status];
}

function ActionMessage({ state }: { state: SupplierApActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${
        state.status === "error"
          ? "bg-[#fff0eb] text-[#91483a]"
          : "bg-[#e3f2eb] text-[#245e48]"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  name,
  value,
  tone = "primary",
}: {
  children: ReactNode;
  name?: string;
  value?: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "danger"
      ? "bg-[#a94e3f] text-white"
      : tone === "secondary"
        ? "border border-[#b9c8c1] bg-white text-[#385047]"
        : "bg-[#183f34] text-white";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

function MoneyField({
  name,
  label,
  defaultValue,
  required = true,
}: {
  name: string;
  label: string;
  defaultValue?: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
      {label}
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        required={required}
        defaultValue={defaultValue}
        className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
      />
    </label>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required = true,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "date";
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium outline-none focus:border-[#4f806f]"
      />
    </label>
  );
}

function CreateInvoiceForm({
  site,
  suppliers,
}: {
  site: ErpSite;
  suppliers: readonly SupplierApSupplier[];
}) {
  const [state, action] = useActionState(
    submitSupplierInvoiceAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <details className="rounded-2xl border border-[#ccd9d3] bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Hồ sơ mới · {site.shortName}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#20342c]">
            Gửi hóa đơn kèm PO và nghiệm thu
          </h2>
          <span className="rounded-full bg-[#eaf1ed] px-3 py-1 text-xs font-black text-[#426456]">
            Mở biểu mẫu
          </span>
        </div>
      </summary>
      <form
        action={action}
        className="border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6"
      >
        <input type="hidden" name="siteId" value={site.id} />
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Nhà cung cấp
            <select
              name="supplierId"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            >
              <option value="">Chọn nhà cung cấp</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} · {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <TextField name="requestReference" label="Mã đề nghị mua (PR)" />
          <TextField
            name="purchaseOrderReference"
            label="Mã PO/hợp đồng mua"
            required={false}
          />
          <TextField
            name="contractReference"
            label="Mã hợp đồng/phụ lục"
            required={false}
          />
          <MoneyField
            name="purchaseOrderTotalVnd"
            label="Giá trị PO (đ)"
          />
          <TextField
            name="acceptanceReference"
            label="Mã biên bản nghiệm thu"
            required={false}
          />
          <MoneyField
            name="acceptedTotalVnd"
            label="Giá trị đã nghiệm thu (đ)"
          />
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Nhóm chi phí
            <select
              name="expenseCategory"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            >
              <option value="transport-service">Vận chuyển/điều phối</option>
              <option value="food-service">Ẩm thực/phục vụ đoàn</option>
              <option value="maintenance-service">Bảo trì/kỹ thuật</option>
              <option value="event-service">Sự kiện/kinh doanh</option>
              <option value="tools-and-equipment">Công cụ/thiết bị</option>
            </select>
          </label>
          <TextField name="invoiceSeries" label="Ký hiệu hóa đơn" />
          <TextField name="invoiceNumber" label="Số hóa đơn" />
          <TextField name="invoiceDate" label="Ngày hóa đơn" type="date" />
          <TextField name="dueDate" label="Hạn thanh toán" type="date" />
          <MoneyField name="netVnd" label="Giá trị trước thuế (đ)" />
          <MoneyField name="vatVnd" label="Thuế GTGT (đ)" />
          <MoneyField name="totalVnd" label="Tổng thanh toán (đ)" />
          <TextField name="costCenter" label="Trung tâm chi phí" />
          <TextField
            name="projectCode"
            label="Mã dự án/sự kiện"
            required={false}
          />
          <label className="grid gap-1 text-xs font-bold text-[#5f7068] md:col-span-2 xl:col-span-3">
            Nội dung hàng hóa/dịch vụ
            <input
              name="description"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
          Ghi chú bàn giao
          <textarea
            name="note"
            required
            minLength={4}
            maxLength={2_000}
            rows={2}
            defaultValue="Đã đối chiếu hồ sơ mua, biên bản nghiệm thu và hóa đơn nhà cung cấp."
            className="min-w-0 rounded-xl border border-[#ced8d1] bg-white p-3 text-sm font-medium outline-none focus:border-[#4f806f]"
          />
        </label>
        <div className="mt-4">
          <SubmitButton>Gửi hồ sơ và chạy đối chiếu</SubmitButton>
        </div>
        <ActionMessage state={state} />
      </form>
    </details>
  );
}

/**
 * T10. A liability the system can recognise but never discharge leaves every
 * payables figure a gross total. These two forms are the discharge: the
 * accountant asks, the chief accountant settles -- and never the same person.
 */
function PaymentRequestForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    requestSupplierPaymentAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
        Đề nghị chi · {formatVnd(invoice.totalVnd)}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Hình thức chi
          <select
            name="paymentMethod"
            required
            defaultValue="bank-transfer"
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
          >
            <option value="bank-transfer">Chuyển khoản</option>
            <option value="cash">Tiền mặt</option>
            <option value="offset">Bù trừ công nợ</option>
          </select>
        </label>
        <TextField
          name="paymentReference"
          label="Số uỷ nhiệm chi / chứng từ"
          required={false}
        />
      </div>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
        Lý do đề nghị chi
        <textarea
          name="note"
          required
          minLength={4}
          maxLength={2_000}
          rows={2}
          defaultValue="Hóa đơn đã ghi nhận công nợ, đến hạn thanh toán theo hợp đồng."
          className="min-w-0 rounded-xl border border-[#ced8d1] bg-white p-3 text-sm font-medium"
        />
      </label>
      <div className="mt-3">
        <SubmitButton>Trình kế toán trưởng duyệt chi</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function PaymentSettleForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    settleSupplierPaymentAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
        Duyệt chi · đề nghị bởi {invoice.paymentRequestedByAccountId ?? "—"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MoneyField
          name="paidAmountVnd"
          label="Số tiền thực chi (đ)"
          defaultValue={invoice.totalVnd}
        />
      </div>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
        Ý kiến kiểm soát
        <textarea
          name="note"
          required
          minLength={4}
          maxLength={2_000}
          rows={2}
          className="min-w-0 rounded-xl border border-[#ced8d1] bg-white p-3 text-sm font-medium"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton name="decision" value="settle">
          Xác nhận đã chi
        </SubmitButton>
        <SubmitButton name="decision" value="return" tone="danger">
          Trả lại kế toán
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function ManagerResubmitForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    resubmitSupplierInvoiceAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a5138]">
        Bổ sung đúng hồ sơ nguồn
      </p>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <TextField
          name="purchaseOrderReference"
          label="Mã PO/hợp đồng mua"
          defaultValue={invoice.purchaseOrderReference}
          required={false}
        />
        <MoneyField
          name="purchaseOrderTotalVnd"
          label="Giá trị PO (đ)"
          defaultValue={invoice.purchaseOrderTotalVnd}
        />
        <TextField
          name="acceptanceReference"
          label="Mã biên bản nghiệm thu"
          defaultValue={invoice.acceptanceReference}
          required={false}
        />
        <MoneyField
          name="acceptedTotalVnd"
          label="Giá trị nghiệm thu (đ)"
          defaultValue={invoice.acceptedTotalVnd}
        />
      </div>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
        Nội dung đã bổ sung
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          className="rounded-xl border border-[#ced8d1] bg-white p-3 text-sm"
          defaultValue="Đã bổ sung biên bản nghiệm thu và xác nhận lại giá trị thực hiện."
        />
      </label>
      <div className="mt-3">
        <SubmitButton>Gửi lại cho kế toán</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function AccountantPrepareForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    prepareSupplierInvoiceJournalAction,
    INITIAL_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Kết luận kiểm tra
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          defaultValue={
            invoice.status === "accounting-returned"
              ? "Đã sửa nội dung kế toán trưởng yêu cầu và kiểm tra lại bút toán."
              : "Đã kiểm tra MST, số/ký hiệu/ngày hóa đơn, PO, nghiệm thu, tổng tiền và mã chi phí."
          }
          className="rounded-xl border border-[#ced8d1] bg-white p-3 text-sm"
        />
      </label>
      <div className="mt-3">
        <SubmitButton>
          {invoice.status === "accounting-returned"
            ? "Lập lại và gửi kiểm tra"
            : "Lập công nợ và gửi kiểm tra"}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function AccountantEscalateForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    escalateSupplierInvoiceAction,
    INITIAL_ACTION_STATE,
  );
  const variance = Math.max(
    invoice.totalVnd - invoice.purchaseOrderTotalVnd,
    invoice.totalVnd - invoice.acceptedTotalVnd,
    0,
  );
  const monetaryOnly = invoice.exceptionCodes.every((code) =>
    ["invoice-over-purchase-order", "invoice-over-acceptance"].includes(code),
  );
  if (variance < 50_000_000 || !monetaryOnly) return null;
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <p className="text-xs font-bold leading-5 text-[#77531c]">
        Sai lệch trọng yếu {formatVnd(variance)}; chỉ chuyển cấp sau khi đã kiểm
        tra nguyên nhân và phương án.
      </p>
      <textarea
        name="note"
        required
        minLength={4}
        rows={2}
        defaultValue="Đã xác minh phần phát sinh ngoài PO và đề nghị chấp thuận ngoại lệ kèm báo cáo tác động."
        className="mt-2 w-full rounded-xl border border-[#d8c9a7] bg-white p-3 text-sm"
      />
      <div className="mt-3">
        <SubmitButton tone="secondary">Chuyển giám đốc quyết định</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function ChiefReviewForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    reviewSupplierInvoiceJournalAction,
    INITIAL_ACTION_STATE,
  );
  if (!invoice.journalVersion) return null;
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input
        type="hidden"
        name="expectedSourceVersion"
        value={invoice.version}
      />
      <input
        type="hidden"
        name="expectedJournalVersion"
        value={invoice.journalVersion}
      />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Kết luận kiểm soát
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          defaultValue="Đã kiểm tra độc lập nguồn, kỳ kế toán, thuế và bút toán công nợ."
          className="rounded-xl border border-[#ced8d1] bg-white p-3 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve">
          Duyệt và ghi sổ
        </SubmitButton>
        <SubmitButton name="decision" value="return" tone="danger">
          Trả kế toán
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function DirectorDecisionForm({ invoice }: { invoice: SupplierApInvoice }) {
  const [state, action] = useActionState(
    decideSupplierExceptionAction,
    INITIAL_ACTION_STATE,
  );
  const variance = Math.max(
    invoice.totalVnd - invoice.purchaseOrderTotalVnd,
    invoice.totalVnd - invoice.acceptedTotalVnd,
    0,
  );
  return (
    <form action={action} className="mt-4 border-t border-[#e0e7e3] pt-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="expectedVersion" value={invoice.version} />
      <p className="rounded-xl bg-[#fff7e7] px-4 py-3 text-sm font-black text-[#76521d]">
        Giá trị cần quyết định: {formatVnd(variance)}
      </p>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[#5f7068]">
        Căn cứ quyết định
        <textarea
          name="note"
          required
          minLength={4}
          rows={2}
          defaultValue="Đã xem nguyên nhân phát sinh, tác động ngân sách và phương án của bộ phận phụ trách."
          className="rounded-xl border border-[#ced8d1] bg-white p-3 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve">
          Chấp thuận ngoại lệ
        </SubmitButton>
        <SubmitButton name="decision" value="return" tone="danger">
          Trả về xử lý nguồn
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function InvoiceCard({
  invoice,
  user,
}: {
  invoice: SupplierApInvoice;
  user: CurrentErpUser;
}) {
  const meta = statusMeta(invoice.status);
  const totals = invoice.journalLines.reduce(
    (sum, line) => ({
      debit: sum.debit + line.debitVnd,
      credit: sum.credit + line.creditVnd,
    }),
    { debit: 0, credit: 0 },
  );
  return (
    <details
      id={`ap-${invoice.id}`}
      className="min-w-0 rounded-2xl border border-[#d8e0db] bg-white shadow-sm open:border-[#8eaa9e]"
      open={
        (user.role === "chief-accountant" &&
          invoice.status === "accounting-review") ||
        (user.role === "director" &&
          invoice.status === "director-exception")
      }
    >
      <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[0.8fr_1.4fr_0.8fr_auto] sm:items-center sm:p-5">
        <div>
          <p className="font-mono text-xs font-black text-[#60736a]">
            {invoice.caseCode}
          </p>
          <p className="mt-1 text-xs text-[#7c8982]">
            {siteName(invoice.siteId)} · v{invoice.version}
          </p>
        </div>
        <div className="min-w-0">
          <p className="truncate font-black text-[#2b4137]">
            {invoice.supplier.name}
          </p>
          <p className="mt-1 text-xs text-[#718078]">
            MST {invoice.supplier.taxCode} · HĐ {invoice.invoiceSeries}/
            {invoice.invoiceNumber}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-black text-[#263d33]">
            {formatVnd(invoice.totalVnd)}
          </p>
          <p className="mt-1 text-xs text-[#7a8781]">
            Hạn {formatDate(invoice.dueDate)}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${meta.className}`}
        >
          {meta.label}
        </span>
      </summary>
      <div className="border-t border-[#e5ebe7] bg-[#f8faf8] p-4 sm:p-5">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <section className="rounded-xl border border-[#dfe6e2] bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
                Đối chiếu ba nguồn
              </p>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-[#7b8881]">Đề nghị mua</dt>
                  <dd className="mt-1 break-words font-black">
                    {invoice.requestReference}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7b8881]">PO / hợp đồng</dt>
                  <dd className="mt-1 break-words font-black">
                    {invoice.purchaseOrderReference || "Chưa có"}
                  </dd>
                  <dd className="mt-1 text-xs text-[#6e7b75]">
                    {formatVnd(invoice.purchaseOrderTotalVnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7b8881]">Nghiệm thu</dt>
                  <dd className="mt-1 break-words font-black">
                    {invoice.acceptanceReference || "Chưa có"}
                  </dd>
                  <dd className="mt-1 text-xs text-[#6e7b75]">
                    {formatVnd(invoice.acceptedTotalVnd)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-[#dfe6e2] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
                  Hóa đơn và định khoản
                </p>
                <span className="text-xs font-bold text-[#66766e]">
                  Trước thuế {formatVnd(invoice.netVnd)} · Thuế{" "}
                  {formatVnd(invoice.vatVnd)}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {invoice.lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-1 rounded-lg bg-[#f3f6f4] px-3 py-2 sm:grid-cols-[1fr_auto]"
                  >
                    <span>
                      {line.description} · {line.costCenter}
                    </span>
                    <strong>
                      Nợ {line.debitAccountCode} · {formatVnd(line.netVnd)}
                    </strong>
                  </div>
                ))}
                {invoice.journalLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-1 rounded-lg border border-[#e2e8e4] px-3 py-2 sm:grid-cols-[auto_1fr_auto_auto]"
                  >
                    <strong>{line.accountCode}</strong>
                    <span>{line.accountName}</span>
                    <span>Nợ {formatVnd(line.debitVnd)}</span>
                    <span>Có {formatVnd(line.creditVnd)}</span>
                  </div>
                ))}
              </div>
              {invoice.journalId ? (
                <p
                  className={`mt-3 text-xs font-black ${
                    totals.debit === totals.credit
                      ? "text-[#34715b]"
                      : "text-[#a34a3c]"
                  }`}
                >
                  {invoice.journalCode} · Nợ {formatVnd(totals.debit)} · Có{" "}
                  {formatVnd(totals.credit)}
                </p>
              ) : null}
            </section>

            {invoice.exceptionCodes.length ? (
              <section className="rounded-xl border border-[#edc8bf] bg-[#fff5f1] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#934336]">
                  Phần chưa đạt
                </p>
                <ul className="mt-2 space-y-1 text-sm font-bold text-[#743e34]">
                  {invoice.exceptionCodes.map((code) => (
                    <li key={code}>• {SUPPLIER_AP_EXCEPTION_LABELS[code]}</li>
                  ))}
                </ul>
                {invoice.exceptionNote ? (
                  <p className="mt-2 text-xs leading-5 text-[#77554d]">
                    {invoice.exceptionNote}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="min-w-0 rounded-xl border border-[#dfe6e2] bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
              Người đang chịu trách nhiệm
            </p>
            <p className="mt-2 font-black text-[#2d4138]">
              {invoice.ownerRole === "manager"
                ? "Quản lý cơ sở"
                : invoice.ownerRole === "accountant"
                  ? "Kế toán công nợ"
                  : invoice.ownerRole === "chief-accountant"
                    ? "Kế toán trưởng"
                    : invoice.ownerRole === "director"
                      ? "Giám đốc"
                      : "Đã hoàn tất bước ghi nhận"}
            </p>
            <dl className="mt-4 grid gap-3 text-xs">
              <div>
                <dt className="text-[#7a8781]">Kế toán lập</dt>
                <dd className="mt-1 font-bold">
                  {invoice.accountantAccountId ?? "Chưa lập"}
                </dd>
                {invoice.accountantNote ? (
                  <dd className="mt-1 leading-5 text-[#65756d]">
                    {invoice.accountantNote}
                  </dd>
                ) : null}
              </div>
              <div className="border-t border-[#e8ece9] pt-3">
                <dt className="text-[#7a8781]">Kế toán trưởng</dt>
                <dd className="mt-1 font-bold">
                  {invoice.checkerAccountId ?? "Chưa kiểm tra"}
                </dd>
                {invoice.checkerNote ? (
                  <dd className="mt-1 leading-5 text-[#65756d]">
                    {invoice.checkerNote}
                  </dd>
                ) : null}
              </div>
              <div className="border-t border-[#e8ece9] pt-3">
                <dt className="text-[#7a8781]">Lịch sử gần nhất</dt>
                <dd className="mt-1 leading-5 text-[#65756d]">
                  {invoice.auditTrail.length
                    ? `${invoice.auditTrail.at(-1)?.note} · ${formatDate(
                        invoice.auditTrail.at(-1)?.occurredAt,
                        true,
                      )}`
                    : `Cập nhật ${formatDate(invoice.updatedAt, true)}`}
                </dd>
              </div>
            </dl>

            {user.role === "manager" &&
            invoice.status === "match-exception" &&
            invoice.ownerRole === "manager" ? (
              <ManagerResubmitForm invoice={invoice} />
            ) : null}
            {user.role === "accountant" &&
            ["ready-for-accounting", "accounting-returned"].includes(
              invoice.status,
            ) &&
            invoice.ownerRole === "accountant" ? (
              <AccountantPrepareForm invoice={invoice} />
            ) : null}
            {user.role === "accountant" &&
            invoice.status === "match-exception" &&
            invoice.ownerRole === "accountant" ? (
              <AccountantEscalateForm invoice={invoice} />
            ) : null}
            {user.role === "chief-accountant" &&
            invoice.status === "accounting-review" &&
            invoice.ownerRole === "chief-accountant" ? (
              <ChiefReviewForm invoice={invoice} />
            ) : null}
            {user.role === "director" &&
            invoice.status === "director-exception" &&
            invoice.ownerRole === "director" ? (
              <DirectorDecisionForm invoice={invoice} />
            ) : null}
            {user.role === "accountant" && invoice.status === "posted" ? (
              <PaymentRequestForm invoice={invoice} />
            ) : null}
            {user.role === "chief-accountant" &&
            invoice.status === "payment-requested" ? (
              <PaymentSettleForm invoice={invoice} />
            ) : null}
          </aside>
        </div>
      </div>
    </details>
  );
}

export function SupplierApControlCenter({
  user,
  invoices,
  suppliers,
  site,
  embedded = false,
}: {
  user: CurrentErpUser;
  invoices: readonly SupplierApInvoice[];
  suppliers: readonly SupplierApSupplier[];
  site?: ErpSite;
  embedded?: boolean;
}) {
  if (user.role === "employee") {
    return (
      <section className="rounded-2xl border border-[#d8e0db] bg-white p-6 text-sm text-[#63736b]">
        Hồ sơ công nợ chỉ dành cho quản lý và bộ phận tài chính. Công việc nhận
        hàng hoặc chụp bằng chứng của bạn nằm trong phiếu việc được giao.
      </section>
    );
  }
  const scoped = site
    ? invoices.filter((invoice) => invoice.siteId === site.id)
    : [...invoices];
  const visible =
    user.role === "director"
      ? scoped.filter(
          (invoice) =>
            invoice.status === "director-exception" ||
            invoice.status === "posted",
        )
      : scoped;
  const actionCount = scoped.filter(
    (invoice) =>
      (user.role === "manager" &&
        invoice.ownerRole === "manager" &&
        invoice.status === "match-exception") ||
      (user.role === "accountant" &&
        invoice.ownerRole === "accountant" &&
        [
          "match-exception",
          "ready-for-accounting",
          "accounting-returned",
        ].includes(invoice.status)) ||
      (user.role === "chief-accountant" &&
        invoice.ownerRole === "chief-accountant" &&
        invoice.status === "accounting-review") ||
      (user.role === "director" &&
        invoice.ownerRole === "director" &&
        invoice.status === "director-exception"),
  ).length;
  const posted = scoped.filter((invoice) => invoice.status === "posted");
  const postedPayable = posted.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const exceptionTotal = scoped
    .filter((invoice) =>
      ["match-exception", "director-exception"].includes(invoice.status),
    )
    .reduce((total, invoice) => total + invoice.totalVnd, 0);
  const pendingChecker = scoped.filter(
    (invoice) => invoice.status === "accounting-review",
  ).length;
  const directorExceptionTotal = scoped
    .filter((invoice) => invoice.status === "director-exception")
    .reduce((total, invoice) => total + invoice.totalVnd, 0);
  const postedSiteCount = new Set(posted.map((invoice) => invoice.siteId)).size;
  const metrics =
    user.role === "director"
      ? [
          [
            "Ngoại lệ cần quyết định",
            String(actionCount),
            "hồ sơ đã được kế toán xác minh",
          ],
          [
            "Giá trị cần quyết định",
            formatVnd(directorExceptionTotal),
            "phần phát sinh ngoài hồ sơ nguồn",
          ],
          [
            "Công nợ đã ghi nhận",
            formatVnd(postedPayable),
            `${posted.length} hóa đơn đã ghi sổ`,
          ],
          [
            "Cơ sở có công nợ",
            String(postedSiteCount),
            "theo dữ liệu đã ghi nhận",
          ],
        ]
      : [
          ["Việc thuộc tài khoản", String(actionCount), "hồ sơ cần xử lý"],
          [
            "Chờ kế toán trưởng",
            String(pendingChecker),
            "bút toán công nợ",
          ],
          [
            "Công nợ đã ghi nhận",
            formatVnd(postedPayable),
            `${posted.length} hóa đơn đã ghi sổ`,
          ],
          [
            "Giá trị đang sai lệch",
            formatVnd(exceptionTotal),
            "chưa được tính vào công nợ",
          ],
        ];
  const siteSuppliers = site
    ? suppliers.filter(
        (supplier) =>
          supplier.siteId === site.id && supplier.status === "active",
      )
    : suppliers;

  return (
    <div className="min-w-0 space-y-4">
      {!embedded ? (
        <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
            Nhà cung cấp & công nợ · {site?.shortName ?? "toàn vùng"}
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-5xl">
            PO, nghiệm thu, hóa đơn và công nợ
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
            Mỗi hồ sơ giữ cùng một mã từ bộ phận nguồn đến bút toán; phần thiếu
            được trả đúng người chịu trách nhiệm.
          </p>
        </header>
      ) : (
        <div className="rounded-2xl border border-[#cbdad3] bg-[#f5faf7] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Hóa đơn nhà cung cấp
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Công nợ từ PO và nghiệm thu
          </h2>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(([label, value, note]) => (
          <article
            key={label}
            className="min-w-0 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="text-xs leading-5 text-[#6e7b75]">{label}</p>
            <p className="mt-2 break-words text-xl font-black text-[#203a30] sm:text-2xl">
              {value}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      {user.role === "manager" && site ? (
        <CreateInvoiceForm site={site} suppliers={siteSuppliers} />
      ) : null}

      <section className="space-y-3" aria-label="Hồ sơ hóa đơn nhà cung cấp">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Hàng xử lý theo vai trò
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              {visible.length} hồ sơ có dữ liệu nguồn
            </h2>
          </div>
          <p className="text-xs font-bold text-[#718078]">
            Mở từng hồ sơ để xem PO, nghiệm thu, hóa đơn và bút toán
          </p>
        </div>
        {visible.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} user={user} />
        ))}
        {!visible.length ? (
          <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">
            Hiện không có hồ sơ nào thuộc phạm vi cần xử lý của tài khoản này.
          </p>
        ) : null}
      </section>
    </div>
  );
}
