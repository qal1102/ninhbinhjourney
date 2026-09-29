import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import { ExecutiveDashboard } from "@/components/erp/executive-dashboard";
import { RoleHomeDashboard } from "@/components/erp/role-home-dashboard";
import { ViecDauTienPanel } from "@/components/erp/viec-dau-tien-panel";
import { tongViecCho, type DemViecChoGiamDoc } from "@/domain/viec-dau-tien";
import Link from "next/link";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
import { getAccessState } from "@/lib/erp/staff-access-repository";
import { listAccountingJournals } from "@/lib/erp/accounting-repository";
import { listEscalatedIncidents } from "@/lib/erp/incident-repository";
import { listPendingProjectChangeRequests } from "@/lib/erp/project-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";
import { listPendingSopDecisions } from "@/lib/erp/sop-repository";
import { getDirectorTicketOverview } from "@/lib/erp/ticket-overview-repository";
import { listWorkdays, vietnamDateKey } from "@/lib/erp/workday-repository";
import {
  listWorkdayEmployeeOptions,
  listWorkdaysForUser,
} from "@/lib/erp/workday-view";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpHomePage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  const shouldReadAccounting =
    user.role === "director" ||
    user.role === "accountant" ||
    user.role === "chief-accountant";
  const shouldReadSupplierAp = user.role !== "employee";
  const isDirector = user.role === "director";
  const [
    access,
    shiftClosures,
    workdays,
    journals,
    supplierAp,
    escalatedIncidents,
    pendingProjectChangeRequests,
    pendingSopDecisions,
    ticketOverview,
    danhBa,
  ] = await Promise.all([
    getAccessState(),
    listShiftClosures({ siteIds: user.siteIds }),
    user.role === "director"
      ? listWorkdays({
          siteIds: user.siteIds,
          businessDate: vietnamDateKey(),
          limit: 100,
        })
      : listWorkdaysForUser(user),
    shouldReadAccounting
      ? listAccountingJournals({ siteIds: user.siteIds, limit: 100 })
      : Promise.resolve([]),
    shouldReadSupplierAp
      ? listSupplierAp({ siteIds: user.siteIds })
      : Promise.resolve({ suppliers: [], invoices: [] }),
    isDirector ? listEscalatedIncidents(user.siteIds) : Promise.resolve([]),
    isDirector
      ? listPendingProjectChangeRequests(user.siteIds)
      : Promise.resolve([]),
    isDirector
      ? listPendingSopDecisions(user.siteIds).catch((error) => {
          console.error("SOP decision queue read failed", error);
          return [];
        })
      : Promise.resolve([]),
    // Bảng vé chỉ đọc, không sửa gì. Nó hỏng thì phần còn lại của trang vẫn
    // phải mở được — nên bắt lỗi tại đây và để màn hình nói thật là chưa đọc
    // được, thay vì cả trang chủ giám đốc trắng xoá.
    isDirector
      ? getDirectorTicketOverview(user.siteIds).catch((error) => {
          console.error("Director ticket overview read failed", error);
          return null;
        })
      : Promise.resolve(null),
    // Ô chọn người khi quản lý giao việc ngay trên trang đầu.
    user.role === "manager" ? listStaffDirectory() : Promise.resolve([]),
  ]);
  const params = (await searchParams) ?? {};
  const denied = Array.isArray(params.denied)
    ? params.denied[0]
    : params.denied;
  const visibleSites = ERP_SITES.filter((site) =>
    user.siteIds.includes(site.id),
  );


  // Giai đoạn 5 — "hôm nay nên làm gì trước". Đếm từ chính dữ liệu trang này
  // vừa đọc, không mở thêm lượt đọc nào; luật xếp hạng nằm trong domain.
  const demViecChoGiamDoc: DemViecChoGiamDoc = {
    suCoLeoThang: escalatedIncidents.length,
    suCoQuaHan: escalatedIncidents.filter(
      (incident) => incident.elapsedMinutes >= incident.slaMinutes,
    ).length,
    caLechChoQuyet: shiftClosures.filter(
      (record) => record.status === "exception-pending-director",
    ).length,
    hoaDonChoQuyet: supplierAp.invoices.filter(
      (invoice) => invoice.status === "director-exception",
    ).length,
    deNghiDoiDuAn: pendingProjectChangeRequests.length,
    quyetDinhSop: pendingSopDecisions.length,
  };

  return (
    <ErpShell user={user}>
      {denied ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-[#eccac2] bg-[#fff2ef] px-4 py-3 text-sm font-bold text-[#8b3d31]"
        >
          Bạn chưa được phân công vào cơ sở hoặc nghiệp vụ này.
        </p>
      ) : null}

      {/* Không có việc chờ thì khối "Cần giám đốc quyết định" trong bảng số
          liệu đã nói điều đó; thêm một khung "không có gì" ở đầu trang chỉ
          đẩy số liệu xuống. */}
      {isDirector && tongViecCho(demViecChoGiamDoc) > 0 ? (
        <ViecDauTienPanel
          dem={demViecChoGiamDoc}
          siteId={visibleSites[0]?.id ?? ERP_SITES[0].id}
        />
      ) : null}

      {/* Lối vào màn Hướng dẫn: một dòng, không đẩy bảng số liệu xuống. */}
      {isDirector ? (
        <p
          data-testid="loi-vao-huong-dan"
          className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5f7068]"
        >
          <span>Mới dùng, hay cần trình diễn cho khách?</span>
          <Link
            href="/erp/huong-dan"
            className="inline-flex min-h-11 items-center font-black text-[#1f604c] underline underline-offset-4"
          >
            Mở Hướng dẫn: bấm một việc là tới đúng chỗ cần bấm →
          </Link>
        </p>
      ) : null}


      {user.role === "director" ? (
        <ExecutiveDashboard
          user={user}
          sites={visibleSites}
          records={shiftClosures}
          workdays={workdays}
          journals={journals}
          supplierApInvoices={supplierAp.invoices}
          escalatedIncidents={escalatedIncidents}
          pendingProjectChangeRequests={pendingProjectChangeRequests}
          pendingSopDecisions={pendingSopDecisions}
          ticketOverview={ticketOverview}
        />
      ) : (
        <RoleHomeDashboard
          user={user}
          sites={visibleSites}
          records={shiftClosures}
          workdays={workdays}
          journals={journals}
          supplierApInvoices={supplierAp.invoices}
          workdayEmployees={
            user.role === "manager"
              ? listWorkdayEmployeeOptions(access, user.siteIds, danhBa)
              : []
          }
        />
      )}

    </ErpShell>
  );
}
