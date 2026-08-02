import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { AuditTimelineView } from "@/components/erp/audit-timeline-view";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  listAuditTimeline,
  listHeadcountBySite,
} from "@/lib/erp/audit-timeline-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function asSiteId(value: string | undefined): ErpSiteId | undefined {
  return ERP_SITES.some((site) => site.id === value)
    ? (value as ErpSiteId)
    : undefined;
}

export default async function AuditTimelinePage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const query = (await searchParams) ?? {};
  const search = firstValue(query.q)?.trim() || undefined;
  const siteId = asSiteId(firstValue(query.site));

  // Phạm vi không truyền từ đây. `erp_audit_timeline` tự tính từ phiếu cấp vai
  // trò của chính tài khoản này -- sửa địa chỉ web không mở thêm được gì.
  const [entries, headcount] = await Promise.all([
    listAuditTimeline({ viewerAccountId: user.id, search, siteId }).catch(
      (error) => {
        console.error("Audit timeline read failed", error);
        return [];
      },
    ),
    listHeadcountBySite(user.id).catch(() => []),
  ]);

  return (
    <ErpShell user={user}>
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">
          Truy vết trách nhiệm
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-6xl">
          Nhật ký hệ thống
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          {user.role === "director"
            ? "Toàn bộ thao tác trên cả bốn cơ sở."
            : user.role === "manager"
              ? "Việc do người của cơ sở bạn làm, cộng mọi việc tác động lên cơ sở bạn — kể cả do người ngoài làm."
              : "Các thao tác do chính tài khoản này thực hiện."}
        </p>
      </div>
      <AuditTimelineView
        entries={entries}
        headcount={headcount}
        search={search}
        siteId={siteId}
        emptyMessage={
          search || siteId
            ? "Không có thao tác nào khớp bộ lọc trong phạm vi bạn được xem."
            : "Chưa có thao tác nào được ghi trong phạm vi bạn được xem."
        }
      />
    </ErpShell>
  );
}
