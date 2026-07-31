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
import type { GateScanEvent } from "@/lib/erp/gate-scan-repository";
import { AttendancePanel } from "./attendance-panel";
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
  initialCameraId?: string;
};

type WorkspaceRow = {
  code: string;
  title: string;
  owner: string;
  time: string;
  status: string;
  tone: "green" | "amber" | "red" | "blue";
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
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

function workspaceData(site: ErpSite, module: ErpModule) {
  const snapshot = site.snapshot;
  const data: Record<ErpModule["id"], { metrics: [string, string, string][]; rows: WorkspaceRow[] }> = {
    "ve-dat-cho": {
      metrics: [
        ["Đơn hôm nay", Math.round(snapshot.visitors / 2.4).toLocaleString("vi-VN"), "+8,4% so với hôm qua"],
        ["Khách dự kiến", snapshot.visitors.toLocaleString("vi-VN"), "Theo toàn bộ kênh bán"],
        ["Cần xác minh", "12", "Thanh toán hoặc ngày đi"],
        ["Tỷ lệ hoàn", "1,7%", "Trong ngưỡng vận hành"],
      ],
      rows: [
        { code: "NB-82419", title: "Đoàn gia đình · 6 khách", owner: "Website trực tiếp", time: "08:20", status: "Đã xác nhận", tone: "green" },
        { code: "NB-82424", title: "Đoàn trường học · 42 khách", owner: "Kênh đối tác", time: "09:10", status: "Cần đối chiếu", tone: "amber" },
        { code: "NB-82431", title: "Khách lẻ · 2 khách", owner: "Quầy vé", time: "10:05", status: "Đã thanh toán", tone: "blue" },
      ],
    },
    "check-in-khach": {
      metrics: [
        ["Đã qua cổng", snapshot.checkedIn.toLocaleString("vi-VN"), `${Math.round((snapshot.checkedIn / snapshot.visitors) * 100)}% kế hoạch ngày`],
        ["Trong 30 phút", "386", "3 làn đang mở"],
        ["Mã cần xử lý", "7", "Không tìm thấy / đã dùng"],
        ["Thời gian trung bình", "11 giây", "Mỗi lượt xác thực"],
      ],
      rows: [
        { code: "GATE-A", title: "Làn quét cổng chính", owner: "Đỗ Thị Lan", time: "Đang mở", status: "Ổn định", tone: "green" },
        { code: "QR-9837", title: "Mã đã sử dụng một phần", owner: "Bàn hỗ trợ 01", time: "08:47", status: "Chờ xử lý", tone: "amber" },
        { code: "GROUP-42", title: "Đoàn 42 khách đang đến", owner: "Cổng đoàn", time: "09:10", status: "Chuẩn bị", tone: "blue" },
      ],
    },
    "suc-chua": {
      metrics: [
        ["Tải hiện tại", `${snapshot.capacityPercent}%`, snapshot.capacityPercent >= 80 ? "Gần ngưỡng cảnh báo" : "Trong ngưỡng an toàn"],
        ["Khách 90 phút tới", "740", "Từ đơn đã xác nhận"],
        ["Ca đang mở", "6", "Theo tuyến và cửa vào"],
        ["Tuyến tạm dừng", snapshot.capacityPercent >= 80 ? "1" : "0", "Quản lý xác nhận thủ công"],
      ],
      rows: [
        { code: "SLOT-08", title: "Khung 08:00 – 09:30", owner: "Tuyến chính", time: "1.120 / 1.400", status: "80%", tone: "amber" },
        { code: "SLOT-10", title: "Khung 10:00 – 11:30", owner: "Tuyến chính", time: "824 / 1.400", status: "59%", tone: "green" },
        { code: "SLOT-13", title: "Khung 13:00 – 14:30", owner: "Tuyến phụ", time: "380 / 900", status: "42%", tone: "blue" },
      ],
    },
    "camera-ai": { metrics: [], rows: [] },
    "bao-cao-hien-truong": { metrics: [], rows: [] },
    "du-an-su-kien": { metrics: [], rows: [] },
    "su-co": {
      metrics: [
        ["Đang mở", String(snapshot.openIncidents), "Có người phụ trách"],
        ["Mức ưu tiên cao", site.status === "attention" ? "2" : "0", "P1 / P2 cần theo dõi"],
        ["Phản hồi trung bình", "4 phút", "Từ lúc tiếp nhận"],
        ["Đã xử lý hôm nay", "18", "Có đầy đủ nhật ký"],
      ],
      rows: [
        { code: "INC-071", title: "Khách cần hỗ trợ y tế nhẹ", owner: "Tổ an toàn", time: "08:32", status: "Đang xử lý", tone: "red" },
        { code: "INC-069", title: "Tắc nghẽn ngắn tại điểm đón", owner: "Điều phối tuyến", time: "08:06", status: "Theo dõi", tone: "amber" },
        { code: "INC-064", title: "Đồ thất lạc đã tìm thấy", owner: "Quầy hỗ trợ", time: "07:41", status: "Đã đóng", tone: "green" },
      ],
    },
    "nhan-su": { metrics: [], rows: [] },
    "cham-cong": { metrics: [], rows: [] },
    "xe-trung-chuyen": {
      metrics: [
        ["Xe đang chạy", "18", "Trên 5 vòng tuyến"],
        ["Đang chờ khách", "6", "Tại các điểm đón"],
        ["Chuyến trễ", "1", "Chậm hơn kế hoạch 7 phút"],
        ["Tài xế trong ca", "27", "2 người dự phòng"],
      ],
      rows: [
        { code: "XE-012", title: "Cổng chính → Bến trung tâm", owner: "Nguyễn Văn Hải", time: "Còn 4 phút", status: "Đang chạy", tone: "green" },
        { code: "XE-018", title: "Bến trung tâm → Khu tham quan", owner: "Phạm Quốc Dũng", time: "Trễ 7 phút", status: "Cần điều phối", tone: "red" },
        { code: "XE-024", title: "Vòng tăng cường", owner: "Trần Minh Tuấn", time: "09:00", status: "Sẵn sàng", tone: "blue" },
      ],
    },
    "tai-san-bao-tri": {
      metrics: [
        ["Tài sản theo dõi", "428", "Có mã và lịch sử"],
        ["Đến hạn tuần này", "16", "Bảo dưỡng định kỳ"],
        ["Phiếu việc đang mở", "9", "4 phiếu ưu tiên"],
        ["Quá hạn", "2", "Đã nhắc người phụ trách"],
      ],
      rows: [
        { code: "WO-219", title: "Kiểm tra phanh xe điện 018", owner: "Tổ cơ điện", time: "Hạn 10:00", status: "Ưu tiên", tone: "red" },
        { code: "WO-217", title: "Bảo dưỡng máy quét cổng B", owner: "Kỹ thuật IT", time: "Hạn hôm nay", status: "Đang làm", tone: "amber" },
        { code: "WO-211", title: "Kiểm tra áo phao theo lô", owner: "Tổ an toàn", time: "Hoàn tất 08:14", status: "Đã xong", tone: "green" },
      ],
    },
    "doi-tac-nha-cung-ung": {
      metrics: [
        ["Đối tác đang hoạt động", "26", "8 đơn vị tham gia ca hôm nay"],
        ["Hồ sơ chờ nghiệm thu", "7", "3 hồ sơ đến hạn trong ngày"],
        ["Cam kết an toàn", "96%", "Còn 1 đơn vị cần bổ sung"],
        ["Công nợ đến hạn", "1,24 tỷ", "Theo kỳ đối soát hiện tại"],
      ],
      rows: [
        { code: "VDR-018", title: "Nghiệm thu đội xe điện ca sáng", owner: "Ban vận hành", time: "09:30", status: "Chờ ký", tone: "amber" },
        { code: "VDR-011", title: "Bổ sung chứng nhận an toàn thực phẩm", owner: "Bếp trung tâm", time: "Hạn 16:00", status: "Cần bổ sung", tone: "red" },
        { code: "VDR-006", title: "Đối soát dịch vụ hướng dẫn viên", owner: "Kế toán", time: "Đã duyệt", status: "Hoàn tất", tone: "green" },
      ],
    },
    "sop-dien-tap": {
      metrics: [
        ["Điều kiện mở cửa", "23 / 24", "Một hạng mục cần xác nhận"],
        ["SOP đang áp dụng", "20", "Theo cấu hình ngày thường"],
        ["Diễn tập kế tiếp", "3 ngày", "Ùn tắc kết hợp cấp cứu"],
        ["Tỷ lệ đọc xác nhận", "94%", "Nhóm trưởng cần nhắc 6 người"],
      ],
      rows: [
        { code: "GATE-24", title: "Kiểm tra liên lạc tại các điểm mù", owner: "Chỉ huy ca", time: "Hạn 07:45", status: "Chưa đạt", tone: "red" },
        { code: "SOP-03", title: "Dừng luồng khi mật độ lên mức cam", owner: "Điều hành luồng", time: "Đã xác nhận", status: "Sẵn sàng", tone: "green" },
        { code: "DRILL-08", title: "Diễn tập tìm người thất lạc", owner: "An ninh & CSKH", time: "Thứ Năm", status: "Đã lên lịch", tone: "blue" },
      ],
    },
    "tai-chinh-doi-soat": {
      metrics: [
        ["Doanh thu lũy kế", `${Math.round(snapshot.visitors * 0.19).toLocaleString("vi-VN")} triệu`, "+6,2% so với cùng kỳ"],
        ["Chi phí vận hành", `${Math.round(snapshot.visitors * 0.108).toLocaleString("vi-VN")} triệu`, "57% doanh thu"],
        ["Lợi nhuận vận hành", `${Math.round(snapshot.visitors * 0.082).toLocaleString("vi-VN")} triệu`, "Biên 43%"],
        ["Chưa đối soát", "8 giao dịch", "Tập trung ở kênh đối tác"],
      ],
      rows: [
        { code: "REC-082", title: "Đối soát vé trực tuyến ca sáng", owner: "Kế toán doanh thu", time: "10:30", status: "Đang khớp", tone: "blue" },
        { code: "REC-079", title: "Chênh lệch quầy vé số 02", owner: "Trưởng ca", time: "08:54", status: "Cần xác minh", tone: "red" },
        { code: "REC-071", title: "Thanh toán dịch vụ xe điện", owner: "Kế toán công nợ", time: "08:10", status: "Đã duyệt", tone: "green" },
      ],
    },
    "bao-cao": {
      metrics: [
        ["Doanh thu lũy kế", `${Math.round(snapshot.visitors * 0.19).toLocaleString("vi-VN")} triệu`, "+6,2% so với cùng kỳ"],
        ["Khách hoàn tất", snapshot.checkedIn.toLocaleString("vi-VN"), "Đã đối soát qua cổng"],
        ["Hiệu suất ca", "92%", "Theo kế hoạch nhân sự"],
        ["SLA sự cố", "96%", "Đúng thời gian phản hồi"],
      ],
      rows: [
        { code: "RPT-DAY", title: "Báo cáo vận hành ngày", owner: "Tự động tổng hợp", time: "17:30", status: "Đã lên lịch", tone: "blue" },
        { code: "RPT-SHIFT", title: "Đối soát ca sáng", owner: "Quản lý cơ sở", time: "12:15", status: "Chờ ký", tone: "amber" },
        { code: "RPT-WEEK", title: "KPI tuần hiện tại", owner: "Ban điều hành", time: "Thứ Hai", status: "Đang cập nhật", tone: "green" },
      ],
    },
  };
  return data[module.id];
}

const toneClasses = {
  green: "bg-[#dff1e8] text-[#246249]",
  amber: "bg-[#fff0ce] text-[#77531c]",
  red: "bg-[#ffe4de] text-[#934336]",
  blue: "bg-[#e1edf4] text-[#315f79]",
};

function rowsForRole(rows: WorkspaceRow[], user: CurrentErpUser, site: ErpSite) {
  if (user.role === "manager") return rows;
  if (user.role === "accountant") {
    return rows.map((row) => ({
      ...row,
      owner: `Quản lý ${site.shortName}`,
      status: "Hồ sơ nguồn",
      tone: "blue" as const,
    }));
  }
  if (user.role === "employee") {
    return rows.slice(0, 2).map((row, index) => ({
      ...row,
      owner: user.name,
      status: index === 0 ? "Đang thực hiện" : "Việc tiếp theo",
      tone: index === 0 ? "blue" as const : "green" as const,
    }));
  }
  return rows
    .filter((row) => row.tone === "red" || row.tone === "amber")
    .slice(0, 2)
    .map((row) => ({
      ...row,
      owner: `Quản lý ${site.shortName}`,
      status: "Đã chuyển cấp",
      tone: "amber" as const,
    }));
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
  if (module.id === "du-an-su-kien") {
    return <ProjectEventWorkspace site={site} user={user} />;
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
    return <TicketGuestWorkspace site={site} user={user} mode="sales" shiftClosures={shiftClosures} gateScans={gateScans} />;
  }
  if (module.id === "check-in-khach") {
    return <TicketGuestWorkspace site={site} user={user} mode="checkin" shiftClosures={shiftClosures} gateScans={gateScans} />;
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

  const data = workspaceData(site, module);
  const visibleRows = rowsForRole(data.rows, user, site);
  const queueCopy = user.role === "director"
    ? { eyebrow: "Ngoại lệ được chuyển cấp", title: "Ngoại lệ cần quyết định", badge: "Quản lý đã xác minh" }
    : user.role === "accountant"
      ? { eyebrow: "Hồ sơ nguồn", title: "Dữ liệu chờ kiểm tra hạch toán", badge: "Chỉ đọc nghiệp vụ" }
    : user.role === "manager"
      ? { eyebrow: "Điều phối tại cơ sở", title: "Hàng việc toàn ca", badge: "Theo dõi trong ca" }
      : { eyebrow: "Công việc được giao", title: "Việc của tôi", badge: "Đúng phân công" };
  const escalationCopy = user.role === "director"
    ? "Quản lý cơ sở đã xác minh và chuyển cấp cùng phương án xử lý."
    : user.role === "accountant"
      ? "Kế toán kiểm tra chứng từ nguồn, mã chi phí và liên kết hồ sơ trước khi lập bút toán."
    : user.role === "manager"
      ? "Nhật ký ca đã ghi người thực hiện và mốc kiểm tra tiếp theo."
      : "Kết quả sẽ được bàn giao cho quản lý khi hoàn thành.";
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {data.metrics.map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs leading-5 text-[#697770] sm:text-sm">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#1f352c] sm:text-3xl">{value}</p>
            <p className="mt-2 text-xs leading-5 text-[#87928d]">{note}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="flex items-end justify-between gap-4 border-b border-[#e3e9e5] p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">{queueCopy.eyebrow}</p>
              <h2 className="mt-2 text-xl font-black text-[#20342c]">{queueCopy.title}</h2>
            </div>
            <span className="rounded-full bg-[#eef3f0] px-3 py-1 text-xs font-black text-[#5c6d65]">{queueCopy.badge}</span>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {visibleRows.map((row) => (
              <details key={row.code} className="group">
                <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-[#f8faf8] sm:grid-cols-[0.62fr_1.5fr_0.9fr_0.7fr] sm:items-center sm:px-6">
                  <p className="text-xs font-black text-[#718078]">{row.code}</p>
                  <p className="text-sm font-black text-[#2c3e36]">{row.title}</p>
                  <p className="text-sm text-[#6e7b75]">{row.owner}</p>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs text-[#87928d]">{row.time}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneClasses[row.tone]}`}>{row.status}</span>
                  </div>
                </summary>
                <div className="border-t border-[#edf0ee] bg-[#f8faf8] px-5 py-4 sm:px-6">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-[#7b8881]">Mã hồ sơ</dt><dd className="mt-1 font-mono font-black text-[#30443b]">{row.code}</dd></div>
                    <div><dt className="text-xs text-[#7b8881]">Người phụ trách</dt><dd className="mt-1 font-black text-[#30443b]">{row.owner}</dd></div>
                    <div><dt className="text-xs text-[#7b8881]">Mốc xử lý</dt><dd className="mt-1 font-black text-[#30443b]">{row.time}</dd></div>
                    <div><dt className="text-xs text-[#7b8881]">Mã hạch toán</dt><dd className="mt-1 font-mono font-black text-[#30443b]">OPS-{site.id.toUpperCase()}-{module.id.slice(0, 6).toUpperCase()}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-[#7b8881]">Bằng chứng</dt><dd className="mt-1 font-bold text-[#30443b]">Nhật ký ca · 2 tệp đính kèm · Lịch sử cập nhật</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-[#7b8881]">Luồng xử lý</dt><dd className="mt-1 font-bold text-[#30443b]">{escalationCopy}</dd></div>
                  </dl>
                </div>
              </details>
            ))}
            {visibleRows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[#7b8881]">Không có mục nào cần chuyển cấp ở nghiệp vụ này.</p> : null}
          </div>
        </div>

      </section>
    </div>
  );
}
