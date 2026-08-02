import Link from "next/link";
import type { ErpModule, ErpSite } from "@/domain/erp";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { WorkdayRecord } from "@/domain/erp-workday";
import type {
  SupplierApInvoice,
  SupplierApSupplier,
} from "@/domain/erp-supplier-ap";
import type {
  AttendanceEvent,
  CurrentErpUser,
  ErpAccessState,
} from "@/lib/erp/demo-session";
import type { IncidentCase } from "@/lib/erp/incident-repository";
import type { FieldReport } from "@/lib/erp/field-report-repository";
import type {
  GateScanEvent,
  TicketSalesSummary,
} from "@/lib/erp/gate-scan-repository";
import type { ProjectWorkspace } from "@/lib/erp/project-repository";
import type { ShiftHandover } from "@/lib/erp/shift-handover-repository";
import { listWorkdayEmployeeOptions } from "@/lib/erp/workday-view";
import { AttendancePanel } from "./attendance-panel";
import { ShiftHandoverPanel } from "./shift-handover-panel";
import { StaffAccessManager } from "./staff-access-manager";
import { CameraAiWorkspace } from "./camera-ai-workspace";
import { ProjectEventWorkspace } from "./project-event-workspace";
import { FieldReportWorkspace } from "./field-report-workspace";
import { TicketGuestWorkspace } from "./ticket-guest-workspace";
import { SupplierApControlCenter } from "./supplier-ap-control-center";
import { StaffPerformanceWorkspace } from "./staff-performance-workspace";
import { IncidentWorkflowWorkspace } from "./incident-workflow-workspace";
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
  initialCameraId?: string;
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
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
            className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm open:border-[#8eaa9e] sm:p-5"
          >
            <summary className="grid cursor-pointer list-none gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
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
                <p className="mt-1 text-xs font-bold text-[#65776e]">
                  {record.status}
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

/**
 * T3. These five screens used to render invented operational data: named
 * drivers running late, work orders with deadlines, attachment counts. None of
 * it existed. During a demo the first question about any of those rows has no
 * honest answer, and the ten modules that *are* real lose credibility with it.
 *
 * A module with nothing behind it now says so, says what it will do, and says
 * exactly which data has to arrive first. That is a roadmap the client can
 * act on instead of a screen they can be embarrassed by.
 */
function PlannedModuleNotice({
  site,
  module,
}: {
  site: ErpSite;
  module: ErpModule;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-5 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
          Giai đoạn sau · {site.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#3d3325] sm:text-4xl">
          {module.name} chưa có nghiệp vụ chạy thật
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6250]">
          Màn hình này cố tình để trống. Hệ thống không hiển thị số liệu minh
          hoạ ở đây, vì một con số không có nguồn thật sẽ bị hiểu nhầm là số
          liệu vận hành.
        </p>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-[#20342c]">Khi hoàn thiện sẽ làm gì</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6d66]">
          {module.description}
        </p>
      </section>

      {module.plannedNeeds && module.plannedNeeds.length > 0 ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-[#20342c]">
            Cần có dữ liệu này trước
          </h2>
          <ul className="mt-3 space-y-2">
            {module.plannedNeeds.map((need) => (
              <li
                key={need}
                className="flex gap-3 text-sm leading-6 text-[#5f6d66]"
              >
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a6a20]"
                />
                <span>{need}</span>
              </li>
            ))}
          </ul>
        </section>
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
  initialCameraId,
}: Props) {
  if (module.id === "su-co") {
    return (
      <IncidentWorkflowWorkspace site={site} user={user} cases={[...incidents]} />
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
        <StaffPerformanceWorkspace site={site} />
        <StaffAccessManager
          site={site}
          user={user}
          access={access}
          attendance={attendance}
        />
      </div>
    );
  }
  if (module.id === "cham-cong") {
    return (
      <div className="space-y-5">
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
      <SiteFinanceSource site={site} user={user} records={shiftClosures} />
    );
  }
  if (module.id === "camera-ai") {
    return <CameraAiWorkspace site={site} user={user} initialCameraId={initialCameraId} />;
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
    return <TicketGuestWorkspace site={site} user={user} mode="sales" shiftClosures={shiftClosures} gateScans={gateScans} ticketSales={ticketSales} />;
  }
  if (module.id === "check-in-khach") {
    return <TicketGuestWorkspace site={site} user={user} mode="checkin" shiftClosures={shiftClosures} gateScans={gateScans} ticketSales={ticketSales} />;
  }
  if (module.id === "doi-tac-nha-cung-ung") {
    return (
      <SupplierApControlCenter
        site={site}
        user={user}
        invoices={supplierApInvoices}
        suppliers={supplierApSuppliers}
      />
    );
  }

  // A `live` module reaching here means its data failed to load (today only
  // du-an-su-kien can, when projectWorkspace is null). Saying "giai đoạn sau"
  // would be a lie about a module that works, so say what actually happened.
  if (module.status === "live") {
    return (
      <section className="rounded-2xl border border-[#e6cdc7] bg-[#fff6f3] p-5 sm:p-6">
        <h1 className="text-xl font-black text-[#8c4436]">
          Chưa tải được dữ liệu {module.name}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7a5750]">
          Nghiệp vụ này có chạy thật, nhưng kho dữ liệu chưa phản hồi cho cơ sở{" "}
          {site.shortName}. Hãy tải lại trang; nếu vẫn vậy, báo bộ phận hệ thống.
        </p>
      </section>
    );
  }

  return <PlannedModuleNotice site={site} module={module} />;
}
