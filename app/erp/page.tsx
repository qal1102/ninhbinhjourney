import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import { ExecutiveDashboard } from "@/components/erp/executive-dashboard";
import { RoleHomeDashboard } from "@/components/erp/role-home-dashboard";
import { ViecDauTienPanel } from "@/components/erp/viec-dau-tien-panel";
import { tongViecCho, type DemViecChoGiamDoc } from "@/domain/viec-dau-tien";
import { CHUC_NANG_MOI, CHUC_NANG_WEB } from "@/domain/ban-do-chuc-nang";
import { duongDenMucMoi, TONG_VIEC_TRA_CUU } from "@/domain/huong-dan";
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

      {/* 03/10: chủ dự án vào tài khoản giám đốc mà không tìm ra các phần vừa
          làm (bản đồ thuyền nằm sâu trong màn Sức chứa). Dòng chữ mời mở
          Hướng dẫn cũ quá khiêm tốn, nên thay bằng khung liệt kê phần mới,
          bấm là tới đúng chỗ, kèm lối sang danh sách đầy đủ. */}
      {isDirector ? (
        <section
          data-testid="loi-vao-huong-dan"
          aria-labelledby="thu-chuc-nang"
          className="mb-6 rounded-2xl border border-[#e7d3ad] bg-[#fffaf0] p-4 sm:p-5"
        >
          {/* 06/10: chủ dự án thấy khung cũ rối (dòng đầu dài, ba nút cùng
              một ý, tám dòng lặp "Mới · ngày"). Nay: một tiêu đề, một nút,
              mỗi nhóm ba dòng gọn. */}
          <div className="flex items-center justify-between gap-3">
            <h2 id="thu-chuc-nang" className="text-lg font-black text-[#3f3524]">
              Chức năng mới
            </h2>
            <Link
              href="/erp/huong-dan"
              aria-label="Xem tất cả chức năng"
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]"
            >
              <span className="sm:hidden">Xem tất cả</span>
              <span className="hidden sm:inline">Xem tất cả chức năng</span>
            </Link>
          </div>
          {/* Điều hành và web khách để riêng, theo lời chủ dự án 04/10:
              "web để riêng, ERP để riêng, không trộn lẫn". */}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(
              [
                { loai: "erp", ten: "Điều hành", tong: TONG_VIEC_TRA_CUU },
                { loai: "web", ten: "Trang của khách", tong: CHUC_NANG_WEB.length },
              ] as const
            ).map((cot) => (
              <div key={cot.loai} className="rounded-xl border border-[#ecdcbc] bg-white">
                <h3 className="flex items-baseline justify-between gap-3 border-b border-[#f1e6d0] px-4 py-2.5 text-sm font-black text-[#20342c]">
                  {cot.ten}
                  <span className="text-xs font-bold text-[#8a7a5f]">{cot.tong} chức năng</span>
                </h3>
                <ul className="divide-y divide-[#f4ecdc]">
                  {CHUC_NANG_MOI.filter((muc) => muc.loai === cot.loai)
                    .slice(0, 3)
                    .map((muc, i) => {
                      const raNgoai = muc.loai === "web" && !muc.cn.duongDan.startsWith("/erp");
                      return (
                        // Điện thoại: hai dòng mỗi nhóm cho khung ngắn lại.
                        <li key={muc.cn.id} className={i === 2 ? "hidden sm:block" : undefined}>
                          <Link
                            href={duongDenMucMoi(muc)}
                            {...(raNgoai ? { target: "_blank", rel: "noopener" } : {})}
                            className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm transition hover:bg-[#fdf6e8]"
                          >
                            <span className="min-w-0 flex-1 font-bold text-[#20342c]">{muc.cn.ten}</span>
                            <span className="shrink-0 text-xs tabular-nums text-[#8a7a5f]">{muc.cn.moi}</span>
                            <span aria-hidden="true" className="shrink-0 text-[#9a6328]">
                              {raNgoai ? "↗" : "→"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </section>
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
