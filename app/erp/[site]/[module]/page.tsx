import Link from "next/link";
import { docBaoCaoCoSo } from "@/lib/erp/bao-cao-repository";
import { notFound, redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ModuleContextHelp } from "@/components/erp/module-context-help";
import { ModuleWorkspace } from "@/components/erp/module-workspace";
import { getErpModule, getErpSite, isOperationalModule } from "@/domain/erp";
import { accountCanAccessModule, getCurrentErpUser } from "@/lib/erp/demo-session";
import { forecastSiteCapacity } from "@/lib/erp/capacity-forecast-repository";
import { getAccessState } from "@/lib/erp/staff-access-repository";
import { getAttendanceState } from "@/lib/erp/attendance-repository";
import { listCapacityWorkspace } from "@/lib/erp/capacity-repository";
import { listSopWorkspace } from "@/lib/erp/sop-repository";
import { getIncidentCases } from "@/lib/erp/incident-repository";
import { getFieldReports } from "@/lib/erp/field-report-repository";
import { resolveModuleBackTarget } from "@/lib/erp/erp-back-link";
import { getRecentGateScans, getTicketSalesSummary } from "@/lib/erp/gate-scan-repository";
import { getCounterSaleWorkspace } from "@/lib/erp/counter-sale-repository";
import { getProjectWorkspace } from "@/lib/erp/project-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listShiftHandovers } from "@/lib/erp/shift-handover-repository";
import { readShiftReconciliation } from "@/lib/erp/shift-reconciliation-repository";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";
import {
  listWorkdayEmployeeOptions,
  listWorkdaysForUser,
} from "@/lib/erp/workday-view";
import { listOnSiteDueOrders } from "@/lib/erp/on-site-due-repository";
import { readShiftCareBrief } from "@/lib/erp/shift-care-repository";

type Props = {
  params: Promise<{ site: string; module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * TC-11 — dự báo giờ chạm trần, chỉ đọc khi thật sự mở màn Sức chứa. Đọc lỗi
 * thì trả rỗng ở trong kho, nên màn hình vẫn sống như cũ.
 */
async function docDuBao(siteId: string, siteName: string) {
  return forecastSiteCapacity({
    siteIds: [siteId],
    visitDate: ngayVanHanh(),
    siteNames: { [siteId]: siteName },
  });
}

/**
 * Ngày vận hành theo giờ Ninh Bình, không theo giờ máy chủ.
 *
 * Cộng thẳng bảy giờ rồi cắt chuỗi ISO, giống `vietnamBusinessDate` bên
 * `module-workspace`. Lối `toLocaleString` rồi `new Date(...)` chỉ ra đúng khi
 * máy chủ chạy giờ UTC — đúng trên production hôm nay, nhưng sai ngay ở máy
 * người làm, và sai lặng lẽ: bảng trống trong khi đoàn thì có thật.
 */
function ngayVanHanh(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

export default async function ErpModulePage({ params, searchParams }: Props) {
  const { site: siteId, module: moduleId } = await params;
  const site = getErpSite(siteId);
  const moduleDefinition = getErpModule(moduleId);
  if (!site || !moduleDefinition) notFound();
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!accountCanAccessModule(user, site.id, moduleDefinition.id)) {
    redirect(`/erp/${site.id}?denied=module`);
  }
  const isTicketModule =
    moduleDefinition.id === "check-in-khach" || moduleDefinition.id === "ve-dat-cho";
  const [access, attendance, shiftClosures, workdays, supplierAp, incidents, fieldReports, gateScans, ticketSales, projectWorkspace, shiftHandovers, staffDirectory, capacityWorkspace, sopWorkspace, capacityForecast] =
    await Promise.all([
    getAccessState(),
    // Chỉ Nhân sự và Chấm công dùng nhật ký chấm công. Ngày 13/09/2026 một
    // nhịp đọc chấm công hỏng trên production (lỗi gốc rỗng, cùng giây với
    // một lỗi đọc vé ở trang chủ) đã làm sập nguyên màn hình SOÁT VÉ Tam Cốc —
    // màn hình vốn không cần một dòng chấm công nào. Nhân viên đứng ở cổng
    // không được mất máy quét vì một phần họ không dùng.
    moduleDefinition.id === "nhan-su" || moduleDefinition.id === "cham-cong"
      ? getAttendanceState()
      : Promise.resolve({ version: 1 as const, events: [] }),
    listShiftClosures({ siteIds: [site.id] }),
    listWorkdaysForUser(user, [site.id]),
      moduleDefinition.id === "doi-tac-nha-cung-ung"
        ? listSupplierAp({ siteIds: [site.id] })
        : Promise.resolve({ suppliers: [], invoices: [] }),
      moduleDefinition.id === "su-co"
        ? getIncidentCases(site.id)
        : Promise.resolve([]),
      moduleDefinition.id === "bao-cao-hien-truong"
        ? getFieldReports(site.id)
        : Promise.resolve([]),
      moduleDefinition.id === "check-in-khach"
        ? getRecentGateScans(site.id)
        : Promise.resolve([]),
      isTicketModule ? getTicketSalesSummary(site.id) : Promise.resolve(null),
      moduleDefinition.id === "du-an-su-kien"
        ? getProjectWorkspace(site.id)
        : Promise.resolve(null),
      // The handover panel is additive to a module that already worked, so a
      // store that cannot answer must not take the whole staffing screen down
      // with it -- including in the window between deploying this code and
      // applying migration 029.
      moduleDefinition.id === "nhan-su"
        ? listShiftHandovers(site.id).catch((error) => {
            console.error("Shift handover read failed", error);
            return [];
          })
        : Promise.resolve([]),
      // T14b: chi doc khi man hinh that su liet ke nguoi.
      moduleDefinition.id === "nhan-su"
        ? listStaffDirectory()
        : Promise.resolve([]),
      moduleDefinition.id === "suc-chua"
        ? listCapacityWorkspace(site.id).catch((error) => {
            console.error("Capacity read failed", error);
            return null;
          })
        : Promise.resolve(null),
      moduleDefinition.id === "sop-dien-tap"
        ? listSopWorkspace(site.id).catch((error) => {
            console.error("SOP read failed", error);
            return null;
          })
        : Promise.resolve(null),
      moduleDefinition.id === "suc-chua"
        ? docDuBao(site.id, site.name).catch((error) => {
            console.error("Capacity forecast read failed", error);
            return [];
          })
        : Promise.resolve([]),
    ]);
  const query = (await searchParams) ?? {};
  const requestedCamera = Array.isArray(query.camera) ? query.camera[0] : query.camera;
  const requestedShift = Array.isArray(query.ca) ? query.ca[0] : query.ca;
  const backTarget = resolveModuleBackTarget(site);

  // QA-ERP-POS-04 — bán vé tại quầy. Đọc riêng, sau `Promise.all`, và bắt lỗi
  // tại chỗ: kho giá quầy chưa trả lời thì phần bán nói thật là chưa bán được,
  // còn phần vé đã bán và phiếu đoàn bên dưới vẫn mở bình thường.
  const counterSale =
    moduleDefinition.id === "ve-dat-cho"
      ? await getCounterSaleWorkspace({ siteId: site.id, viewerAccountId: user.id }).catch(
          (error) => {
            console.error("Counter sale workspace read failed", error);
            return {
              available: false as const,
              message: "Chưa đọc được bảng giá quầy. Xin tải lại trang.",
            };
          },
        )
      : null;

  // QA-DON-DU-LIEU-10 — đơn trả tại điểm còn chờ thu, chỉ cho quản lý và giám đốc.
  const onSiteDue =
    moduleDefinition.id === "tai-chinh-doi-soat" && (user.role === "manager" || user.role === "director")
      ? await listOnSiteDueOrders({ siteId: site.id, viewerAccountId: user.id }).catch((error) => {
          console.error("On-site due orders read failed", error);
          return { available: false as const, message: "Chưa đọc được danh sách đơn trả tại điểm. Xin tải lại trang." };
        })
      : null;

  // TC-13 — bản giao ca "hôm nay ai cần để ý", chỉ đọc khi thật sự mở màn
  // check-in. Kho tự nuốt lỗi và trả rỗng, nên máy quét ở cổng không thể chết
  // vì một khối thông tin phụ trợ.
  const shiftCare =
    moduleDefinition.id === "check-in-khach"
      ? await readShiftCareBrief({ siteId: site.id, visitDate: ngayVanHanh() })
      : [];

  // TC-21 — đối soát cuối ca. Đọc sau `Promise.all` vì nó cần chính danh sách
  // ca vừa đọc về, và cần biết người dùng đang chọn ca nào. Bảng này chỉ đọc,
  // nên hỏng cũng không được kéo cả module tài chính xuống theo.
  const shiftReconciliation =
    moduleDefinition.id === "tai-chinh-doi-soat"
      ? await readShiftReconciliation({
          siteId: site.id,
          shifts: shiftClosures,
          selectedShiftId: requestedShift,
        }).catch((error) => {
          console.error("Shift reconciliation read failed", error);
          return null;
        })
      : null;

  const baoCao = moduleDefinition.id === "bao-cao" ? await docBaoCaoCoSo(site.id) : null;

  return (
    <ErpShell user={user} site={site} activeModuleId={moduleDefinition.id}>
      {/*
        A15-LOI-03 — sàn chữ 14px, chỉ ở màn vận hành. Luật nằm trong
        `app/globals.css`; danh sách màn nằm trong `domain/erp.ts`.
      */}
      <div data-thang-chu={isOperationalModule(moduleDefinition.id) ? "van-hanh" : undefined}>
      <ErpBackLink href={backTarget.href} label={backTarget.label} />
      {/*
        Nút `?` đứng cùng hàng với đường dẫn, không đứng riêng một dòng.
        Đo thật ở khổ 390px trước khi đổi: khối tiêu đề chiếm 650px — ba phần
        tư màn hình điện thoại — mà 72px trong đó là một nút tròn nằm một mình
        giữa khoảng trắng. Trên máy tính bố cục cũ vẫn giữ nguyên tinh thần:
        nút nằm bên phải, chỉ khác là nó lên cùng hàng đường dẫn.
      */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#668078]">
            <Link href={`/erp/${site.id}`} className="inline-flex min-h-11 items-center hover:text-[#183f34]">{site.shortName}</Link>
            <span>/</span>
            <span>{moduleDefinition.shortName}</span>
          </div>
          <ModuleContextHelp
            module={moduleDefinition}
            role={user.role}
            site={site}
          />
        </div>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">{moduleDefinition.name}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">{moduleDefinition.description}</p>
      </div>
      <ModuleWorkspace
        site={site}
        module={moduleDefinition}
        user={user}
        access={access}
        attendance={attendance.events}
        shiftClosures={shiftClosures}
        workdays={workdays}
        workdayEmployees={
          user.role === "manager"
            ? listWorkdayEmployeeOptions(access, [site.id])
            : []
        }
        supplierApInvoices={supplierAp.invoices}
        supplierApSuppliers={supplierAp.suppliers}
        incidents={incidents}
        fieldReports={fieldReports}
        gateScans={gateScans}
        ticketSales={ticketSales}
        projectWorkspace={projectWorkspace}
        shiftHandovers={shiftHandovers}
        staffDirectory={staffDirectory}
        capacityWorkspace={capacityWorkspace}
        capacityForecast={capacityForecast[0] ?? null}
        shiftCare={shiftCare}
        sopWorkspace={sopWorkspace}
        shiftReconciliation={shiftReconciliation}
        counterSale={counterSale}
        onSiteDue={onSiteDue}
        initialCameraId={requestedCamera}
        baoCao={baoCao}
      />
      </div>
    </ErpShell>
  );
}
