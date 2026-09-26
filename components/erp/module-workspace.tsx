import Link from "next/link";
import { BaoCaoWorkspace } from "./bao-cao-workspace";
import type { BaoCaoCoSo } from "@/lib/erp/bao-cao-repository";
import type { ErpModule, ErpSite } from "@/domain/erp";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { WorkdayRecord } from "@/domain/erp-workday";
import type { CapacityWorkspaceData } from "@/domain/erp-capacity";
import type { SopWorkspaceData } from "@/domain/erp-sop";
import type {
  SupplierApInvoice,
  SupplierApSupplier,
} from "@/domain/erp-supplier-ap";
import type {
  AttendanceEvent,
  CurrentErpUser,
  ErpAccessState,
} from "@/lib/erp/demo-session";
import type { ShiftCareGroup } from "@/domain/shift-care-brief";
import type { IncidentCase } from "@/lib/erp/incident-repository";
import type { FieldReport } from "@/lib/erp/field-report-repository";
import type {
  GateScanEvent,
  TicketSalesSummary,
} from "@/lib/erp/gate-scan-repository";
import type { ProjectWorkspace } from "@/lib/erp/project-repository";
import type { ShiftHandover } from "@/lib/erp/shift-handover-repository";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
import type { ShiftReconciliationView } from "@/lib/erp/shift-reconciliation-repository";
import type { CounterSaleWorkspace } from "@/lib/erp/counter-sale-repository";
import { listWorkdayEmployeeOptions } from "@/lib/erp/workday-view";
import {
  SHIFT_CLOSE_STATUS_LABELS,
  SHIFT_CLOSE_STATUS_TONES,
} from "./shift-close-status";
import { ShiftReconciliationPanel } from "./shift-reconciliation-panel";
import { OnSiteDuePanel } from "./on-site-due-panel";
import type { OnSiteDueWorkspace } from "@/lib/erp/on-site-due-repository";
import { AttendancePanel } from "./attendance-panel";
import { ShiftHandoverPanel } from "./shift-handover-panel";
import { StaffAccessManager } from "./staff-access-manager";
import { CameraAiWorkspace } from "./camera-ai-workspace";
import { CapacityWorkspace } from "./capacity-workspace";
import { SopWorkspace } from "./sop-workspace";
import { ProjectEventWorkspace } from "./project-event-workspace";
import { FieldReportWorkspace } from "./field-report-workspace";
import { TicketGuestWorkspace } from "./ticket-guest-workspace";
import { resolveDemoTicketsEnabled } from "@/domain/erp-demo-tickets";
import type { SiteCapacityForecast } from "@/lib/erp/capacity-forecast-repository";
import { SupplierApControlCenter } from "./supplier-ap-control-center";
import { StaffPerformanceWorkspace } from "./staff-performance-workspace";
import { IncidentWorkflowWorkspace } from "./incident-workflow-workspace";
import { ShiftCareBriefPanel } from "./shift-care-brief-panel";
import { MachViecPanel } from "./mach-viec-panel";
import { machViecTheoId } from "@/domain/erp-mach-viec";
import {
  WorkdayLifecycle,
  type WorkdayEmployeeOption,
} from "./workday-lifecycle";

type Props = {
  site: ErpSite;
  module: ErpModule;
  user: CurrentErpUser;
  access: ErpAccessState;
  attendance: AttendanceEvent[];
  shiftClosures: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  workdayEmployees: readonly WorkdayEmployeeOption[];
  supplierApInvoices: readonly SupplierApInvoice[];
  supplierApSuppliers: readonly SupplierApSupplier[];
  incidents: readonly IncidentCase[];
  fieldReports: readonly FieldReport[];
  gateScans: readonly GateScanEvent[];
  ticketSales: TicketSalesSummary | null;
  projectWorkspace: ProjectWorkspace | null;
  shiftHandovers: readonly ShiftHandover[];
  staffDirectory: readonly ErpStaffDirectoryEntry[];
  capacityWorkspace: CapacityWorkspaceData | null;
  sopWorkspace: SopWorkspaceData | null;
  /** TC-21 — chỉ đọc cho module tài chính & đối soát; `null` ở mọi module khác. */
  shiftReconciliation: ShiftReconciliationView | null;
  counterSale?: CounterSaleWorkspace | null;
  /** QA-DON-DU-LIEU-10 — đơn trả tại điểm còn chờ thu; `null` khi không phải quản lý/giám đốc ở module tài chính. */
  onSiteDue?: OnSiteDueWorkspace | null;
  initialCameraId?: string;
  /** TC-11 — dự báo giờ chạm trần của chính cơ sở này, null khi chưa đọc được. */
  capacityForecast?: SiteCapacityForecast | null;
  /** TC-13 — đoàn hôm nay có người tự khai cần hỗ trợ; rỗng ở mọi module khác. */
  shiftCare?: readonly ShiftCareGroup[];
  /** Báo cáo & dự báo; `null` ở mọi module khác. */
  baoCao?: BaoCaoCoSo | null;
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Dải mạch việc cho đúng màn đang mở.
 *
 * Luồng không tồn tại thì không vẽ gì cả — thà không có mạch còn hơn có một
 * mạch bịa. Trạng thái nhận vào là trạng thái của chính những hồ sơ màn hình
 * này đang cầm, nên con số đếm không bao giờ lệch với cái người ta nhìn thấy
 * bên dưới.
 */
function MachViecTaiDay({
  machId,
  siteId,
  moduleId,
  viewerRole,
  trangThai,
}: {
  machId: string;
  siteId: ErpSite["id"];
  moduleId: string;
  viewerRole: CurrentErpUser["role"];
  trangThai: readonly string[];
}) {
  const mach = machViecTheoId(machId);
  if (!mach) return null;
  return (
    <MachViecPanel
      mach={mach}
      siteId={siteId}
      viewerRole={viewerRole}
      trangThai={trangThai}
      dangODay={`/erp/${siteId}/${moduleId}`}
    />
  );
}

/** Today in Asia/Ho_Chi_Minh — the operating day, not the server's. */
function vietnamBusinessDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

/**
 * Who this shift can be handed to: everyone else granted access at this site.
 * A handover names a person, so the list has to come from the grant store
 * rather than from a fixed roster.
 */
function shiftHandoverColleagues(
  access: ErpAccessState,
  siteId: ErpSite["id"],
  currentUserId: string,
) {
  return listWorkdayEmployeeOptions(access, [siteId])
    .filter(
      (employee) =>
        employee.id !== currentUserId && employee.siteIds.includes(siteId),
    )
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      jobTitle: employee.jobTitle,
    }));
}

function SiteFinanceSource({
  site,
  user,
  records,
}: {
  site: ErpSite;
  user: CurrentErpUser;
  records: readonly ShiftCloseRecord[];
}) {
  const scoped = records.filter((record) => record.siteId === site.id);
  const grossVnd = scoped.reduce(
    (total, record) => total + record.amounts.grossVnd,
    0,
  );
  const refundVnd = scoped.reduce(
    (total, record) => total + record.amounts.refundVnd,
    0,
  );
  const tickets = scoped.reduce(
    (total, record) => total + record.ticketsSold,
    0,
  );
  const pending = scoped.filter(
    (record) => record.status !== "posted",
  ).length;

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Nguồn doanh thu · {site.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">
          Số liệu từ các ca đã gửi
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Mỗi dòng giữ nguyên mã ca, người gửi, trạng thái duyệt và chênh lệch
          bàn giao.
        </p>
      </header>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Doanh thu hệ thống", formatVnd(grossVnd), `${scoped.length} ca`],
          ["Hoàn trong ca", formatVnd(refundVnd), "theo hồ sơ nguồn"],
          ["Vé đã bán", tickets.toLocaleString("vi-VN"), "theo chốt ca"],
          ["Chưa ghi sổ", String(pending), "ca đang trong luồng"],
        ].map(([label, value, note]) => (
          <article
            key={label}
            className="min-w-0 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="text-xs text-[#6e7b75]">{label}</p>
            <p className="mt-2 break-words text-2xl font-black text-[#203a30]">
              {value}
            </p>
            <p className="mt-2 text-xs text-[#849089]">{note}</p>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        {scoped.map((record) => (
          <details
            key={record.id}
            className="group rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm open:border-[#8eaa9e] sm:p-5"
          >
            <summary className="grid cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-black text-[#293f35]">
                  {record.shiftCode}
                </p>
                <p className="mt-1 text-xs text-[#74827b]">
                  {record.station} · {record.shiftLabel} · phiên bản{" "}
                  {record.version}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-black text-[#203a30]">
                  {formatVnd(record.amounts.grossVnd - record.amounts.refundVnd)}
                </p>
                {/* Chỗ này từng in thẳng giá trị lưu trong kho: giám đốc mở
                    màn hình tài chính của cơ sở là đọc được chữ `submitted`
                    giữa một trang tiếng Việt. Nhãn tiếng Việt nay lấy chung
                    một nguồn với hàng chốt ca, để hai màn hình không bao giờ
                    gọi cùng một trạng thái bằng hai cái tên. */}
                <p className="mt-1 flex items-center gap-2 text-xs font-bold text-[#65776e] sm:justify-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${SHIFT_CLOSE_STATUS_TONES[record.status]}`}
                  >
                    {SHIFT_CLOSE_STATUS_LABELS[record.status]}
                  </span>
                  {/* `list-none` đã bỏ mất tam giác mở của `details`, nên nếu
                      không có chữ và mũi tên thì hàng này nhìn như một dòng
                      đứng yên — người gửi, số vé và chênh lệch nằm bên trong
                      coi như không tồn tại. */}
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-black text-[#5f7268]">
                    <span className="group-open:hidden">Xem hồ sơ</span>
                    <span className="hidden group-open:inline">Thu gọn</span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180"
                    >
                      <path
                        d="m4 6 4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </p>
              </div>
            </summary>
            <dl className="mt-4 grid gap-3 border-t border-[#e7ece9] pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[#7b8882]">Người gửi</dt>
                <dd className="mt-1 font-bold">{record.submittedBy.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#7b8882]">Vé đã bán</dt>
                <dd className="mt-1 font-bold">
                  {record.ticketsSold.toLocaleString("vi-VN")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#7b8882]">Chênh lệch</dt>
                <dd className="mt-1 font-bold">
                  {formatVnd(record.differenceVnd)}
                </dd>
              </div>
            </dl>
          </details>
        ))}
        {scoped.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">
            Chưa có ca nào được gửi tại {site.shortName}.
          </p>
        ) : null}
      </section>
      {canViewRegionalFinance(user.role) ? (
        <Link
          href="/erp/finance"
          className="inline-grid min-h-11 place-items-center rounded-xl bg-[#183f34] px-5 text-sm font-black text-white"
        >
          Mở kiểm soát kế toán toàn vùng
        </Link>
      ) : null}
    </div>
  );
}


export function ModuleWorkspace({
  site,
  module,
  user,
  access,
  attendance,
  shiftClosures,
  workdays,
  workdayEmployees,
  supplierApInvoices,
  supplierApSuppliers,
  incidents,
  fieldReports,
  gateScans,
  ticketSales,
  projectWorkspace,
  shiftHandovers,
  staffDirectory,
  capacityWorkspace,
  sopWorkspace,
  shiftReconciliation,
  counterSale = null,
  onSiteDue = null,
  initialCameraId,
  capacityForecast = null,
  shiftCare = [],
  baoCao = null,
}: Props) {
  if (module.id === "suc-chua") {
    return (
      <CapacityWorkspace site={site} user={user} data={capacityWorkspace} forecast={capacityForecast} />
    );
  }
  if (module.id === "sop-dien-tap") {
    return <SopWorkspace site={site} user={user} data={sopWorkspace} />;
  }
  if (module.id === "su-co") {
    return (
      <>
        <MachViecTaiDay
          machId="su-co"
          siteId={site.id}
          moduleId={module.id}
          viewerRole={user.role}
          trangThai={incidents.map((item) => item.status)}
        />
        <IncidentWorkflowWorkspace site={site} user={user} cases={[...incidents]} />
      </>
    );
  }
  if (module.id === "nhan-su") {
    return (
      <div className="space-y-5">
        {user.role === "manager" ? (
          <WorkdayLifecycle
            user={user}
            sites={[site]}
            initialRecords={workdays}
            employees={workdayEmployees}
          />
        ) : null}
        {/* T9: shift handover lives in "Nhân sự & ca trực" because that is
            where ca trực is managed. Being shift leader is a duty for one
            shift at one station, not a sixth global role -- the same employee
            leads the gate this morning and works the pier tomorrow. */}
        <ShiftHandoverPanel
          site={site}
          user={user}
          handovers={shiftHandovers}
          colleagues={shiftHandoverColleagues(access, site.id, user.id)}
          businessDate={vietnamBusinessDate()}
        />
        <StaffPerformanceWorkspace
          site={site}
          directory={staffDirectory}
          attendance={attendance}
        />
        <StaffAccessManager
          site={site}
          user={user}
          access={access}
          attendance={attendance}
          directory={staffDirectory}
        />
      </div>
    );
  }
  if (module.id === "cham-cong") {
    return (
      <div className="space-y-5">
        <MachViecTaiDay
          machId="cham-cong"
          siteId={site.id}
          moduleId={module.id}
          viewerRole={user.role}
          trangThai={workdays.map((record) => record.status)}
        />
        <WorkdayLifecycle
          user={user}
          sites={[site]}
          initialRecords={workdays}
          employees={workdayEmployees}
        />
        <AttendancePanel site={site} user={user} events={attendance} />
      </div>
    );
  }
  if (module.id === "tai-chinh-doi-soat") {
    return (
      <div className="space-y-6">
        {shiftReconciliation ? (
          <ShiftReconciliationPanel
            site={site}
            moduleId={module.id}
            view={shiftReconciliation}
          />
        ) : null}
        {onSiteDue ? (
          <OnSiteDuePanel
            site={site}
            workspace={onSiteDue}
            today={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}
          />
        ) : null}
        <SiteFinanceSource site={site} user={user} records={shiftClosures} />
      </div>
    );
  }
  if (module.id === "camera-ai") {
    // Thời điểm dựng cảnh lấy ở máy chủ để lần render đầu ở client trùng khít
    // với HTML đã gửi xuống; sau đó client tự sang khung 5 phút mới.
    //
    // Đây là server component (trang này vốn đã động vì đọc phiên đăng nhập),
    // nên đọc đồng hồ lúc dựng trang là đúng chỗ. Quy tắc purity của React
    // Compiler nhắm vào client component render lại nhiều lần, không phân biệt
    // được hai trường hợp.
    return (
      <CameraAiWorkspace
        site={site}
        user={user}
        // eslint-disable-next-line react-hooks/purity
        sceneAt={Date.now()}
        initialCameraId={initialCameraId}
      />
    );
  }
  if (module.id === "du-an-su-kien" && projectWorkspace) {
    return <ProjectEventWorkspace site={site} user={user} workspace={projectWorkspace} />;
  }
  if (module.id === "bao-cao-hien-truong") {
    return (
      <div className="space-y-5">
        <WorkdayLifecycle
          user={user}
          sites={[site]}
          initialRecords={workdays}
          employees={workdayEmployees}
        />
        <FieldReportWorkspace site={site} user={user} reports={[...fieldReports]} />
      </div>
    );
  }
  if (module.id === "ve-dat-cho") {
    // Mạch việc "đóng ca" bắt đầu và được duyệt ngay tại màn này (bước 1–2),
    // nên dải đứng trước phần bán vé. Nó gập sẵn, chỉ cao một khối ngắn.
    return (
      <>
        <MachViecTaiDay
          machId="dong-ca"
          siteId={site.id}
          moduleId={module.id}
          viewerRole={user.role}
          trangThai={shiftClosures.map((record) => record.status)}
        />
        <TicketGuestWorkspace site={site} user={user} mode="sales" shiftClosures={shiftClosures} gateScans={gateScans} ticketSales={ticketSales} counterSale={counterSale} />
      </>
    );
  }
  if (module.id === "check-in-khach") {
    // TC-13: bản giao ca đứng trước máy quét. Đặt nó xuống cuối thì ở khổ
    // 390px nó rơi tới mốc 1838px — phải cuộn gần hai màn hình mới thấy, và
    // một bản giao ca không ai nhìn thấy thì bằng không. Ngày thường khối này
    // chỉ là một dòng chữ, nên máy ở cổng gần như không bị đẩy xuống.
    return (
      <>
        <ShiftCareBriefPanel groups={shiftCare} />
        <TicketGuestWorkspace site={site} user={user} mode="checkin" shiftClosures={shiftClosures} gateScans={gateScans} ticketSales={ticketSales} offlineGateEnabled={process.env.ERP_OFFLINE_GATE_ENABLED === "true"} demoTicketsEnabled={resolveDemoTicketsEnabled(process.env.ERP_DEMO_TICKETS_ENABLED)} />
      </>
    );
  }
  if (module.id === "bao-cao" && baoCao) {
    return <BaoCaoWorkspace site={site} baoCao={baoCao} />;
  }
  if (module.id === "doi-tac-nha-cung-ung") {
    return (
      <>
        <MachViecTaiDay
          machId="cong-no-doi-tac"
          siteId={site.id}
          moduleId={module.id}
          viewerRole={user.role}
          trangThai={supplierApInvoices.map((invoice) => invoice.status)}
        />
        <SupplierApControlCenter
          site={site}
          user={user}
          invoices={supplierApInvoices}
          suppliers={supplierApSuppliers}
        />
      </>
    );
  }

  // Mọi module đều có nghiệp vụ thật (26/09/2026). Tới được đây nghĩa là
  // phần dữ liệu của nó không đọc được — du-an-su-kien khi projectWorkspace
  // là null, bao-cao khi baoCao là null — nên nói đúng điều đã xảy ra.
  return (
    <section className="rounded-2xl border border-[#e6cdc7] bg-[#fff6f3] p-5 sm:p-6">
      <h1 className="text-xl font-black text-[#8c4436]">
        Chưa tải được dữ liệu {module.name}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7a5750]">
        Nghiệp vụ này có chạy thật, nhưng kho dữ liệu chưa phản hồi cho cơ sở{" "}
        {site.shortName}. Xin tải lại trang; nếu vẫn vậy, báo bộ phận hệ thống.
      </p>
    </section>
  );
}
