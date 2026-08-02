import Link from "next/link";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import { ERP_REGISTRY_ROLE_LABELS } from "@/domain/erp-account-roles";
import type {
  ErpAuditEntry,
  ErpHeadcountRow,
} from "@/lib/erp/audit-timeline-repository";

type Props = {
  entries: readonly ErpAuditEntry[];
  headcount?: readonly ErpHeadcountRow[];
  search?: string;
  siteId?: ErpSiteId;
  /** Đã thu hẹp về một người rồi thì không hiện lại ô tìm kiếm. */
  compact?: boolean;
  emptyMessage: string;
};

function siteName(siteId: ErpSiteId) {
  return ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId;
}

function formatMoment(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parsed);
}

function actorPlace(entry: ErpAuditEntry) {
  if (entry.actorSiteIds.length === 0) return "toàn vùng";
  return entry.actorSiteIds.map(siteName).join(", ");
}

function roleLabel(role: string) {
  return (
    ERP_REGISTRY_ROLE_LABELS[role as keyof typeof ERP_REGISTRY_ROLE_LABELS] ?? role
  );
}

export function AuditTimelineView({
  entries,
  headcount,
  search,
  siteId,
  compact,
  emptyMessage,
}: Props) {
  const backfilledCount = entries.filter(
    (entry) => !entry.actorSnapshotAtWrite,
  ).length;

  return (
    <div className="space-y-5">
      {headcount && headcount.length > 0 ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">
            Nhân sự đang có hiệu lực
          </p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">
            Số người theo khu vực
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ERP_SITES.filter((site) =>
              headcount.some((row) => row.siteId === site.id),
            ).map((site) => {
              const rows = headcount.filter((row) => row.siteId === site.id);
              const total = rows.reduce((sum, row) => sum + row.headcount, 0);
              return (
                <article
                  key={site.id}
                  className="rounded-xl border border-[#e1e7e3] bg-[#fbfcfb] p-4"
                >
                  <p className="text-sm font-black text-[#20342c]">
                    {site.shortName}
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#183f34]">{total}</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-[#75817b]">
                    {rows.map((row) => (
                      <li key={row.role}>
                        {roleLabel(row.role)} · {row.headcount}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        {!compact ? (
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#718078]">
              Tìm theo tên
              <input
                name="q"
                defaultValue={search ?? ""}
                placeholder="Ví dụ: Long"
                className="min-h-11 rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#20342c] outline-none focus:border-[#4f806f]"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#718078]">
              Khu vực
              <select
                name="site"
                defaultValue={siteId ?? ""}
                className="min-h-11 rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#20342c]"
              >
                <option value="">Tất cả</option>
                {ERP_SITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.shortName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white"
            >
              Lọc
            </button>
          </form>
        ) : null}

        <p className="mt-4 text-xs leading-5 text-[#7c8882]">
          Tìm được cả <span className="font-bold">tên trong nhật ký cũ</span> lẫn tên
          hiện tại — người đổi tên vẫn tra ra việc đã làm dưới tên cũ. Phạm vi nhìn
          do máy chủ quyết định theo vai trò của bạn, không phải do bộ lọc này.
        </p>

        {backfilledCount > 0 ? (
          <p className="mt-3 rounded-xl border border-[#efd4a8] bg-[#fff9ed] px-4 py-3 text-xs leading-5 text-[#7a5a1d]">
            <span className="font-black">{backfilledCount} dòng</span> được ghi từ
            trước khi hệ thống bắt đầu chụp danh tính tại thời điểm thao tác. Tên và
            chức danh trên các dòng đó là{" "}
            <span className="font-bold">thông tin hiện tại</span> của người đó, không
            phải thông tin lúc thao tác xảy ra.
          </p>
        ) : null}

        <ol className="mt-5 divide-y divide-[#e6ebe8]">
          {entries.map((entry, index) => (
            <li
              key={`${entry.source}-${entry.occurredAt}-${entry.entityId ?? index}`}
              className="grid gap-1 py-3.5 sm:grid-cols-[1fr_auto] sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm leading-6 text-[#34483f]">
                  <Link
                    href={`/erp/ho-so/${entry.actorAccountId}`}
                    className="font-black text-[#183f34] underline decoration-[#b9ccc3] underline-offset-2 hover:decoration-[#183f34]"
                  >
                    {entry.actorDisplayName}
                  </Link>
                  {entry.actorJobTitle ? (
                    <span className="text-[#75817b]"> — {entry.actorJobTitle}</span>
                  ) : null}
                  <span className="text-[#75817b]"> — {actorPlace(entry)}</span>
                  {!entry.actorSnapshotAtWrite ? (
                    <span
                      title="Tên hiện tại, không phải tên lúc thao tác"
                      className="ml-2 rounded bg-[#f2e6cc] px-1.5 py-0.5 text-[10px] font-black text-[#7a5a1d]"
                    >
                      tên hiện tại
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm font-bold text-[#20342c]">
                  {entry.source} · {entry.action}
                  {entry.entityId ? (
                    <span className="font-mono text-xs font-normal text-[#75817b]">
                      {" "}
                      {entry.entityId}
                    </span>
                  ) : null}
                </p>
                {entry.note ? (
                  <p className="mt-1 text-xs leading-5 text-[#7a8781]">{entry.note}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-[#87938d] sm:text-right">
                <p>{formatMoment(entry.occurredAt)}</p>
                {entry.siteId ? (
                  <p className="mt-1 font-bold text-[#586961]">
                    {siteName(entry.siteId)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#b8c6bf] px-5 py-10 text-center text-sm text-[#75817b]">
            {emptyMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}
