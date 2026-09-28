import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import { ExecutiveDashboard } from "@/components/erp/executive-dashboard";
import { RoleHomeDashboard } from "@/components/erp/role-home-dashboard";
import { VongDanPanel } from "@/components/erp/vong-dan-panel";
import { ViecDauTienPanel } from "@/components/erp/viec-dau-tien-panel";
import { VONG_TIEN, VONG_TIEN_ID, type KhoaSo } from "@/domain/huong-dan-vong-dau";
import { chonTaiKhoanMau, CO_SO_MAU } from "@/domain/ban-do-chuc-nang";
import { tongViecCho, type DemViecChoGiamDoc } from "@/domain/viec-dau-tien";
import { readTienDoVongDan } from "@/lib/erp/huong-dan-repository";
import { getCurrentErpUser, isRoleSwitchEnabled } from "@/lib/erp/demo-session";
import { listRoleSwitchTargets, listStaffDirectory } from "@/lib/erp/staff-directory";
import { BanDoChucNangPanel } from "@/components/erp/ban-do-chuc-nang-panel";
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

/**
 * Khung "Trình diễn một vòng khách". Ẩn từ 26/09/2026 theo lời chủ dự án
 * ("khung hướng dẫn chỉ nên làm khi xong hết rồi"); bật lại 28/09/2026 sau
 * khi soát từng bước với các màn đã chốt. Tắt thì chỉ cần đổi về `false`.
 */
const HIEN_VONG_DAN = true;

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
    mucTieuChuyenVai,
    danhBa,
    tienDoVongDan,
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
    // Bước trình diễn nào là việc của nhân viên thì chuẩn bị sẵn tài khoản
    // đúng người, để nút "Làm thử" chuyển vai và vào thẳng màn hình ấy. Đọc
    // cùng nhóm với phần trên: trước 27/09 nó chờ riêng một lượt phía sau.
    isDirector && !user.actingAs && isRoleSwitchEnabled()
      ? listRoleSwitchTargets()
      : Promise.resolve([]),
    // Ô chọn người khi quản lý giao việc ngay trên trang đầu.
    user.role === "manager" ? listStaffDirectory() : Promise.resolve([]),
    // Mạch dẫn — chỉ giám đốc, vì thực tế chỉ tài khoản này được dùng. Kho tự
    // nuốt lỗi và trả "chưa từng đi", nên một lượt đọc hỏng cùng lắm làm vòng
    // dẫn chào lại, không kéo sập trang chủ. Đọc cùng nhóm, không chờ riêng.
    isDirector && HIEN_VONG_DAN
      ? readTienDoVongDan({ accountId: user.id, vongId: VONG_TIEN_ID })
      : Promise.resolve(null),
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

  // Con số thật cho từng chặng, lấy từ chính dữ liệu trang này vừa đọc —
  // không mở thêm một lượt đọc nào. Chặng nào chưa có số thì để trống, và
  // vòng dẫn sẽ nói thẳng là "chưa có số hôm nay" thay vì bịa một số mẫu.
  const soThatVongDan: Partial<Record<KhoaSo, string>> = {};
  if (isDirector) {
    const veHomNay = ticketOverview?.bySite.reduce((tong, hang) => tong + hang.today, 0) ?? null;
    if (ticketOverview?.available && veHomNay !== null) {
      // `bySite.today` đếm lượt khách của vé PHÁT hôm nay, không phải lượt qua cổng.
      soThatVongDan["ve-hom-nay"] = `Hôm nay đã phát vé cho ${veHomNay.toLocaleString("vi-VN")} lượt khách ở ${ticketOverview.bySite.length} cơ sở${ticketOverview.demoHistoryEntries30d > 0 ? ", gồm số liệu mẫu" : ""}.`;
    }

    const tongCho = tongViecCho(demViecChoGiamDoc);
    soThatVongDan["viec-cho-giam-doc"] =
      tongCho > 0
        ? `Đang chờ bạn quyết: ${demViecChoGiamDoc.caLechChoQuyet} ca lệch, ${demViecChoGiamDoc.hoaDonChoQuyet} hoá đơn, ${demViecChoGiamDoc.suCoLeoThang} sự cố, ${demViecChoGiamDoc.deNghiDoiDuAn} đề nghị đổi dự án, ${demViecChoGiamDoc.quyetDinhSop} cổng mở cửa.`
        : "Hôm nay không có việc nào chờ bạn quyết.";
  }

  const taiKhoanTheoChang: Partial<Record<number, string>> = {};
  for (const chang of VONG_TIEN) {
    if (!chang.moMan?.vai) continue;
    const mau = chonTaiKhoanMau(
      mucTieuChuyenVai,
      access.employees,
      chang.moMan.vai,
      chang.moMan.duong(CO_SO_MAU),
    );
    if (mau) taiKhoanTheoChang[chang.thuTu] = mau.accountId;
  }

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

      {tienDoVongDan ? (
        <VongDanPanel
          taiKhoanTheoChang={taiKhoanTheoChang}
          tienDoBanDau={tienDoVongDan}
          soThat={soThatVongDan}
          siteId={visibleSites[0]?.id ?? ERP_SITES[0].id}
        />
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

      {/* Bản đồ là chỗ tra cứu, không phải việc hằng ngày: đứng sau số liệu. */}
      {isDirector && !user.actingAs ? (
        <div className="mt-6">
          <BanDoChucNangPanel
            targets={mucTieuChuyenVai}
            quyen={access.employees}
            chuyenVaiDuoc={isRoleSwitchEnabled()}
          />
        </div>
      ) : null}
    </ErpShell>
  );
}
