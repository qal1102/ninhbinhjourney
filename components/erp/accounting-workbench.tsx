"use client";

import { useMemo, useState } from "react";
import {
  ACCOUNTING_CATEGORY_LABELS,
  ACCOUNTING_STATUS_LABELS,
  ERP_ACCOUNTING_CASES,
  journalTotals,
  type AccountingCaseCategory,
  type AccountingCaseStatus,
} from "@/domain/erp-accounting";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import { formatFinanceAmount } from "@/domain/erp-operating-data";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { ShiftCloseAccountingQueue } from "./shift-close-workflow";

type FilterCategory = "all" | AccountingCaseCategory;
type FilterSite = "all" | ErpSiteId;

const categoryFilters: readonly FilterCategory[] = [
  "all",
  "revenue",
  "payable",
  "expense",
  "payroll",
  "asset",
  "invoice",
  "close",
];

const statusTone: Record<AccountingCaseStatus, string> = {
  new: "bg-[#e3edf4] text-[#315f79]",
  "awaiting-source": "bg-[#ffe7df] text-[#934638]",
  reviewing: "bg-[#fff0ce] text-[#77531c]",
  drafted: "bg-[#e7e6f4] text-[#5c5486]",
  "awaiting-approval": "bg-[#f3e3c9] text-[#74501d]",
  "ready-to-post": "bg-[#dff1e8] text-[#246249]",
  closed: "bg-[#edf0ee] text-[#607068]",
};

function nextAction(status: AccountingCaseStatus, hasMissingDocuments: boolean) {
  if (hasMissingDocuments) return { label: "Gửi yêu cầu bổ sung", next: "awaiting-source" as const };
  if (status === "new") return { label: "Nhận kiểm tra", next: "reviewing" as const };
  if (status === "reviewing") return { label: "Tạo bút toán nháp", next: "drafted" as const };
  if (status === "drafted") return { label: "Gửi người kiểm tra", next: "awaiting-approval" as const };
  if (status === "awaiting-approval") return null;
  if (status === "ready-to-post") return { label: "Ghi sổ hồ sơ đã duyệt", next: "closed" as const };
  return null;
}

export function AccountingWorkbench({
  user,
  shiftClosures,
}: {
  user: CurrentErpUser;
  shiftClosures: readonly ShiftCloseRecord[];
}) {
  const [category, setCategory] = useState<FilterCategory>("all");
  const [siteId, setSiteId] = useState<FilterSite>("all");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, AccountingCaseStatus>>(
    () => Object.fromEntries(ERP_ACCOUNTING_CASES.map((item) => [item.id, item.status])),
  );
  const [message, setMessage] = useState("");

  const visibleCases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return ERP_ACCOUNTING_CASES.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesSite = siteId === "all" || item.siteId === siteId || item.siteId === "all";
      const matchesQuery =
        !normalized ||
        `${item.id} ${item.title} ${item.counterparty}`
          .toLocaleLowerCase("vi-VN")
          .includes(normalized);
      return matchesCategory && matchesSite && matchesQuery;
    });
  }, [category, query, siteId]);

  const openCount = Object.values(statuses).filter((status) => status !== "closed").length;
  const missingCount = ERP_ACCOUNTING_CASES.filter((item) => item.missingDocuments.length > 0).length;
  const payableMillion = ERP_ACCOUNTING_CASES.filter((item) => item.category === "payable").reduce(
    (total, item) => total + item.amountMillion,
    0,
  );

  function performAction(id: string, next: AccountingCaseStatus, label: string) {
    setStatuses((current) => ({ ...current, [id]: next }));
    setMessage(`${id} · ${label} lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}. Nhật ký đã ghi người thực hiện.`);
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Kế toán tổng hợp · toàn vùng</p>
          <h1 className="font-display mt-2 text-4xl text-[#183f34] sm:text-6xl">Chứng từ & đối soát</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#697770]">Hàng việc nối từ giao dịch nguồn đến hồ sơ, định khoản nháp, kiểm tra và ghi sổ.</p>
        </div>
        <div className="rounded-xl border border-[#d8e0db] bg-white px-4 py-3 text-xs font-bold text-[#64756d]">Kỳ đang mở · Tháng 7/2026</div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Hồ sơ đang mở", String(openCount), "Đã có người phụ trách"],
          ["Thiếu chứng từ", String(missingCount), "Đang chờ đúng bộ phận"],
          ["Phải trả trong hàng việc", formatFinanceAmount(payableMillion), "Theo hồ sơ NCC"],
          ["Tiến độ đóng kỳ", "18/22", "4 ngoại lệ còn mở"],
        ].map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs text-[#6e7b75]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[#203a30] sm:text-3xl">{value}</p>
            <p className="mt-2 text-xs text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      <ShiftCloseAccountingQueue records={shiftClosures} user={user} />

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_0.45fr]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] px-4 text-sm outline-none focus:border-[#4f806f]"
            placeholder="Tìm mã hồ sơ, nhà cung cấp hoặc nội dung"
          />
          <select value={siteId} onChange={(event) => setSiteId(event.target.value as FilterSite)} className="min-h-11 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-bold">
            <option value="all">Tất cả cơ sở</option>
            {ERP_SITES.map((site) => <option key={site.id} value={site.id}>{site.shortName}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Loại hồ sơ kế toán">
          {categoryFilters.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${category === item ? "bg-[#183f34] text-white" : "bg-[#f0f4f1] text-[#5f7068]"}`}>
              {item === "all" ? "Tất cả" : ACCOUNTING_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>
      </section>

      {message ? <p role="status" className="rounded-xl bg-[#e1f0e8] px-4 py-3 text-sm font-bold text-[#245e48]">{message}</p> : null}

      <section className="space-y-3" aria-label="Hàng việc kế toán">
        {visibleCases.map((item) => {
          const status = statuses[item.id] ?? item.status;
          const action = nextAction(status, item.missingDocuments.length > 0);
          const totals = journalTotals(item);
          const siteName = item.siteId === "all" ? "Toàn vùng" : ERP_SITES.find((site) => site.id === item.siteId)?.shortName;
          return (
            <details key={item.id} className="group overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm open:border-[#8eaa9e]">
              <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[0.65fr_1.45fr_0.7fr_auto] sm:items-center sm:p-5">
                <div><p className="text-xs font-black text-[#65776e]">{item.id}</p><p className="mt-1 text-xs text-[#87928d]">{siteName}</p></div>
                <div><p className="font-black text-[#293f35]">{item.title}</p><p className="mt-1 text-xs text-[#74827b]">{item.counterparty}</p></div>
                <div><p className="text-xs text-[#7c8882]">Giá trị</p><p className="mt-1 font-black text-[#2d4138]">{item.amountMillion ? formatFinanceAmount(item.amountMillion) : "Checklist"}</p></div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone[status]}`}>{ACCOUNTING_STATUS_LABELS[status]}</span>
              </summary>

              <div className="border-t border-[#e5eae7] bg-[#f8faf8] p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
                  <div className="space-y-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[#7c8882]">Nguồn nghiệp vụ</dt><dd className="mt-1 font-bold">{item.source}</dd></div>
                      <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[#7c8882]">Hạn xử lý</dt><dd className="mt-1 font-black text-[#8a5138]">{item.due}</dd></div>
                      <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[#7c8882]">Người lập/kiểm tra</dt><dd className="mt-1 font-bold">{item.owner}<br />{item.checker}</dd></div>
                      <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[#7c8882]">Chiều quản trị</dt><dd className="mt-1 font-bold">{item.dimensions.join(" · ")}</dd></div>
                    </dl>

                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                      <h3 className="text-sm font-black text-[#30443b]">Bộ hồ sơ</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {item.documents.map((document) => <p key={document} className="rounded-lg bg-[#edf5f0] px-3 py-2 text-xs font-bold text-[#35604f]">✓ {document}</p>)}
                        {item.missingDocuments.map((document) => <p key={document} className="rounded-lg bg-[#fff0eb] px-3 py-2 text-xs font-bold text-[#91483a]">Thiếu · {document}</p>)}
                      </div>
                    </div>

                    {item.journal.length ? (
                      <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black">Định khoản đề xuất</h3><span className="text-xs font-bold text-[#35705a]">Nợ = Có · {formatFinanceAmount(totals.debitMillion)}</span></div>
                        <div className="mt-3 divide-y divide-[#e8ece9]">
                          {item.journal.map((line) => <div key={`${line.account}-${line.label}`} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2 text-xs"><strong>{line.account}</strong><span className="text-[#68776f]">{line.label}</span><span className="font-black">{line.debitMillion ? `Nợ ${formatFinanceAmount(line.debitMillion)}` : `Có ${formatFinanceAmount(line.creditMillion)}`}</span></div>)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <aside className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                    <h3 className="text-sm font-black">Dòng thời gian</h3>
                    <ol className="mt-3 space-y-3">
                      {item.timeline.map((event) => <li key={event} className="border-l-2 border-[#8eb4a5] pl-3 text-xs leading-5 text-[#607068]">{event}</li>)}
                    </ol>
                    <div className="mt-5 border-t border-[#e3e8e5] pt-4">
                      {action ? <button type="button" onClick={() => performAction(item.id, action.next, action.label)} className="min-h-11 w-full rounded-xl bg-[#183f34] px-4 text-sm font-black text-white">{action.label}</button> : status === "awaiting-approval" ? <p className="rounded-xl bg-[#fff0ce] p-3 text-xs font-bold text-[#77531c]">Đang chờ người kiểm tra độc lập; người lập không thể tự duyệt.</p> : <p className="rounded-xl bg-[#e5f1eb] p-3 text-xs font-bold text-[#2f654f]">Hồ sơ đã hoàn tất, giữ nguyên lịch sử và liên kết bút toán.</p>}
                    </div>
                  </aside>
                </div>
              </div>
            </details>
          );
        })}
        {visibleCases.length === 0 ? <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-12 text-center text-sm text-[#75817b]">Không có hồ sơ phù hợp bộ lọc.</p> : null}
      </section>
    </div>
  );
}
