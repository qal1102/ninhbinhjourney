import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import { ExecutiveDashboard } from "@/components/erp/executive-dashboard";
import { RoleHomeDashboard } from "@/components/erp/role-home-dashboard";
import { VongDanPanel } from "@/components/erp/vong-dan-panel";
import { ViecDauTienPanel } from "@/components/erp/viec-dau-tien-panel";
import { VONG_TIEN_ID, type KhoaSo } from "@/domain/huong-dan-vong-dau";
import { tongViecCho, type DemViecChoGiamDoc } from "@/domain/viec-dau-tien";
import { readTienDoVongDan } from "@/lib/erp/huong-dan-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
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
  ]);
  const params = (await searchParams) ?? {};
  const denied = Array.isArray(params.denied)
    ? params.denied[0]
    : params.denied;
  const visibleSites = ERP_SITES.filter((site) =>
    user.siteIds.includes(site.id),
  );

  // Mạch dẫn (giai đoạn 3) — chỉ giám đốc, vì thực tế chỉ tài khoản này được
  // dùng. Kho tự nuốt lỗi và trả "chưa từng đi", nên một lượt đọc hỏng cùng
  // lắm làm vòng dẫn chào lại, không kéo sập trang chủ.
  const tienDoVongDan = isDirector
    ? await readTienDoVongDan({ accountId: user.id, vongId: VONG_TIEN_ID })
    : null;

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
      soThatVongDan["ve-hom-nay"] = `Hôm nay: ${veHomNay.toLocaleString("vi-VN")} lượt qua cổng trên ${ticketOverview.bySite.length} cơ sở.`;
    }

    soThatVongDan["ca-trong-ky"] = `Đang có ${shiftClosures.length.toLocaleString("vi-VN")} hồ sơ ca trong kỳ này.`;

    const caChuaKhep = shiftClosures.filter((record) => record.status !== "posted").length;
    soThatVongDan["ca-dang-cho-nguoi-khac"] =
      caChuaKhep > 0
        ? `${caChuaKhep.toLocaleString("vi-VN")} hồ sơ ca chưa ghi sổ xong, hồ sơ nào cũng đang chờ một người cụ thể.`
        : "Mọi hồ sơ ca trong kỳ đã ghi sổ xong.";

    const tongChoAnh = tongViecCho(demViecChoGiamDoc);
    soThatVongDan["viec-cho-giam-doc"] =
      tongChoAnh > 0
        ? `Đang chờ anh quyết: ${demViecChoGiamDoc.caLechChoQuyet} ca lệch, ${demViecChoGiamDoc.hoaDonChoQuyet} hoá đơn, ${demViecChoGiamDoc.suCoLeoThang} sự cố, ${demViecChoGiamDoc.deNghiDoiDuAn} đề nghị đổi dự án.`
        : "Hôm nay không có việc nào chờ anh quyết.";

    const apChuaTra = supplierAp.invoices.filter(
      (invoice) => invoice.status !== "paid" && invoice.status !== "reversed",
    ).length;
    soThatVongDan["hoa-don-doi-tac"] = `${apChuaTra.toLocaleString("vi-VN")} hoá đơn đối tác chưa thanh toán xong, trên tổng ${supplierAp.invoices.length.toLocaleString("vi-VN")} hoá đơn.`;

    soThatVongDan["diem-khach-cham"] =
      "Xem điểm khách chấm ở màn Khách hàng.";
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

      {isDirector ? (
        <ViecDauTienPanel
          dem={demViecChoGiamDoc}
          siteId={visibleSites[0]?.id ?? ERP_SITES[0].id}
        />
      ) : null}

      {tienDoVongDan ? (
        <VongDanPanel
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
              ? listWorkdayEmployeeOptions(access, user.siteIds)
              : []
          }
        />
      )}
    </ErpShell>
  );
}
