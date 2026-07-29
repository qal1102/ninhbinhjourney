import Link from "next/link";
import {
  ERP_MODULES,
  type ErpModuleId,
  type ErpSite,
  type ErpSiteId,
} from "@/domain/erp";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type { AttendanceEvent } from "@/lib/erp/demo-session";
import { ERP_WORKFORCE_SUMMARY } from "@/domain/erp-operating-data";
import type { WorkdayRecord } from "@/domain/erp-workday";
import {
  WorkdayLifecycle,
  type WorkdayEmployeeOption,
} from "@/components/erp/workday-lifecycle";

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  attendance: readonly AttendanceEvent[];
  records: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  workdayEmployees: readonly WorkdayEmployeeOption[];
};

type WorkItem = {
  title: string;
  detail: string;
  time: string;
  moduleId: ErpModuleId;
  tone: "red" | "amber" | "green" | "blue";
};

const toneClasses = {
  red: "bg-[#ffe5df] text-[#934336]",
  amber: "bg-[#fff0ce] text-[#77531c]",
  green: "bg-[#dff1e8] text-[#246249]",
  blue: "bg-[#e1edf4] text-[#315f79]",
} as const;

const accountingActionableStatuses = new Set<ShiftCloseRecord["status"]>([
  "manager-approved",
  "accounting-review",
  "director-approved",
  "director-rejected",
]);

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

const employeeWorkByModule: Partial<Record<ErpModuleId, WorkItem>> = {
  "check-in-khach": {
    title: "Xác thực đoàn TA-018 tại Cổng A",
    detail: "42 khách · kiểm tra quyền lợi trước khi cho đoàn qua cổng",
    time: "Trước 11:30",
    moduleId: "check-in-khach",
    tone: "red",
  },
  "bao-cao-hien-truong": {
    title: "Nộp ảnh bàn giao khu vực phụ trách",
    detail: "Cần đủ ảnh toàn cảnh, kết quả công việc và mã hạch toán",
    time: "Trước 11:45",
    moduleId: "bao-cao-hien-truong",
    tone: "amber",
  },
  "su-co": {
    title: "Kiểm tra cảnh báo tại lối đón khách",
    detail: "Ghi nhận hiện trạng và chuyển quản lý nếu chưa thể xử lý tại chỗ",
    time: "Trước 10:50",
    moduleId: "su-co",
    tone: "amber",
  },
  "suc-chua": {
    title: "Cập nhật hàng chờ tại khu vực được giao",
    detail: "Đếm lượt chờ và báo quản lý khi tải vượt ngưỡng",
    time: "Trước 10:40",
    moduleId: "suc-chua",
    tone: "blue",
  },
  "xe-trung-chuyen": {
    title: "Bàn giao tình trạng vòng xe",
    detail: "Xác nhận số chuyến, thời gian chờ và xe cần kiểm tra",
    time: "Trước 11:20",
    moduleId: "xe-trung-chuyen",
    tone: "blue",
  },
  "tai-san-bao-tri": {
    title: "Hoàn tất checklist thiết bị đầu ca",
    detail: "Bổ sung ảnh và tình trạng cho các hạng mục đã kiểm tra",
    time: "Trước 11:15",
    moduleId: "tai-san-bao-tri",
    tone: "amber",
  },
  "sop-dien-tap": {
    title: "Xác nhận đã đọc SOP áp dụng trong ca",
    detail: "Kiểm tra đúng vai trò và điểm tập kết được phân công",
    time: "Trong ca",
    moduleId: "sop-dien-tap",
    tone: "green",
  },
  "du-an-su-kien": {
    title: "Cập nhật gói việc sự kiện được giao",
    detail: "Ghi tiến độ, vướng mắc và bằng chứng hoàn thành",
    time: "Trước 16:00",
    moduleId: "du-an-su-kien",
    tone: "blue",
  },
  "ve-dat-cho": {
    title: "Kiểm tra giao dịch vé cần bàn giao",
    detail: "Đối chiếu số vé, tiền thu và ngoại lệ trước khi kết ca",
    time: "Cuối ca",
    moduleId: "ve-dat-cho",
    tone: "green",
  },
};

function firstSiteForModule(
  user: CurrentErpUser,
  moduleId: ErpModuleId,
  preferredSiteId?: ErpSiteId,
) {
  if (
    preferredSiteId &&
    (user.moduleIdsBySite[preferredSiteId] ?? []).includes(moduleId)
  ) {
    return preferredSiteId;
  }
  return user.siteIds.find((siteId) =>
    (user.moduleIdsBySite[siteId] ?? []).includes(moduleId),
  );
}

function moduleHref(
  user: CurrentErpUser,
  moduleId: ErpModuleId,
  preferredSiteId?: ErpSiteId,
) {
  const siteId = firstSiteForModule(user, moduleId, preferredSiteId);
  return siteId ? `/erp/${siteId}/${moduleId}` : "/erp";
}

function ManagerDashboard({
  user,
  sites,
  records,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
}) {
  const site = sites[0];
  if (!site) {
    return <EmptyAssignment name={user.name} />;
  }

  const checkedInRate = Math.round(
    (site.snapshot.checkedIn / Math.max(site.snapshot.visitors, 1)) * 100,
  );
  const workforce = ERP_WORKFORCE_SUMMARY.find((item) => item.siteId === site.id);
  const pendingShiftClosures = records.filter(
    (record) => record.siteId === site.id && record.status === "submitted",
  );
  const pendingTickets = pendingShiftClosures.reduce(
    (sum, record) => sum + record.ticketsSold,
    0,
  );
  const pendingRevenueVnd = pendingShiftClosures.reduce(
    (sum, record) =>
      sum + record.amounts.grossVnd - record.amounts.refundVnd,
    0,
  );
  const pendingDifferenceVnd = pendingShiftClosures.reduce(
    (sum, record) => sum + Math.abs(record.differenceVnd),
    0,
  );
  const work: WorkItem[] = [
    {
      title: "Phân người xử lý cảnh báo tại luồng vào",
      detail: "Cảnh báo đã được xác minh, cần cập nhật người phụ trách và mốc kiểm tra",
      time: "Trước 09:40",
      moduleId: "su-co",
      tone: "red",
    },
    {
      title: "Bổ sung nhân sự cho khung giờ cao điểm",
      detail: "Điều chuyển 3 người từ ca dự phòng sang khu vực đón khách",
      time: "Trước 10:00",
      moduleId: "nhan-su",
      tone: "amber",
    },
    {
      title:
        pendingShiftClosures.length > 0
          ? `Xác nhận ${pendingShiftClosures.length} ca vé và tiền thu`
          : "Chưa có chốt ca vé mới cần xác nhận",
      detail:
        pendingShiftClosures.length > 0
          ? `${pendingTickets.toLocaleString("vi-VN")} vé · ${formatVnd(pendingRevenueVnd)} doanh thu khai báo · ${
              pendingDifferenceVnd > 0
                ? `chênh ${formatVnd(pendingDifferenceVnd)}`
                : "tiền thu đã khớp"
            }`
          : "Hồ sơ mới sẽ xuất hiện ngay khi nhân viên trong ca gửi bàn giao.",
      time: pendingShiftClosures.length > 0 ? "Cần xác nhận" : "Chưa có hồ sơ",
      moduleId: "ve-dat-cho",
      tone:
        pendingShiftClosures.length > 0
          ? pendingDifferenceVnd > 0
            ? "red"
            : "blue"
          : "green",
    },
    {
      title: "Duyệt báo cáo bàn giao hiện trường",
      detail: "4 báo cáo mới đã có ảnh và mã hạch toán",
      time: "Trong hôm nay",
      moduleId: "bao-cao-hien-truong",
      tone: "green",
    },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
          Ca điều hành · {site.shortName}
        </p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              Chào {user.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
              {pendingShiftClosures.length} ca chờ xác nhận ·{" "}
              {site.snapshot.openIncidents} sự cố đang mở
            </p>
          </div>
          <Link
            href={`/erp/${site.id}`}
            className="w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-[#183f34]"
          >
            Mở toàn bộ {site.shortName} →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Khách hôm nay", site.snapshot.visitors.toLocaleString("vi-VN")],
            ["Đã check-in", `${checkedInRate}%`],
            ["Phủ ca", `${site.snapshot.employeesOnShift}/${workforce?.planned ?? site.snapshot.employeesOnShift}`, `${workforce?.seasonalOnShift ?? 0} thời vụ · ${workforce?.absent ?? 0} vắng`],
            ["Sự cố đang mở", site.snapshot.openIncidents.toLocaleString("vi-VN"), `${pendingShiftClosures.length} ca chờ xác nhận`],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-2xl font-black">{value}</p>
              {note ? <p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">{note}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Điều phối trong ca
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Việc cần xử lý tiếp theo
          </h2>
        </div>
        <div className="divide-y divide-[#e7ece9]">
          {work.map((item) => (
            <Link
              key={item.title}
              href={`/erp/${site.id}/${item.moduleId}`}
              className="grid min-w-0 gap-2 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <p className="font-black text-[#293d34]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#748079]">{item.detail}</p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneClasses[item.tone]}`}
              >
                {item.time}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmployeeDashboard({
  user,
  sites,
  attendance,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  attendance: readonly AttendanceEvent[];
}) {
  const site = sites[0];
  if (!site) {
    return <EmptyAssignment name={user.name} />;
  }

  const moduleIds = user.moduleIdsBySite[site.id] ?? [];
  const modules = ERP_MODULES.filter((module) => moduleIds.includes(module.id));
  const work = moduleIds
    .map((moduleId) => employeeWorkByModule[moduleId])
    .filter((item): item is WorkItem => Boolean(item))
    .slice(0, 3);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  const latestAttendance = attendance
    .filter((event) => event.userId === user.id && event.siteId === site.id)
    .filter((event) => new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(event.createdAt)) === today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const inShift = latestAttendance?.type === "check-in";
  const workforce = user.workforceProfile;
  const employmentLabel = workforce?.employmentType === "seasonal" ? "Nhân viên thời vụ" : "Nhân viên chính thức";

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
          {employmentLabel} · {site.shortName}
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              {user.name}
            </h1>
            <p className="mt-3 text-sm text-white/65">{user.jobTitle}{workforce ? ` · ${workforce.primaryStation}` : ""}</p>
            {workforce?.accessEndsAt ? <p className="mt-1 text-xs text-[#b6d5ca]">Quyền làm việc có hiệu lực đến {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(workforce.accessEndsAt))}</p> : null}
          </div>
          <span className="w-fit rounded-full bg-[#dff1e8] px-3 py-1.5 text-xs font-black text-[#246249]">
            {inShift ? "Đang trong ca" : "Ngoài ca"}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Ca làm", workforce?.shiftLabel ?? "Theo phân công"],
            ["Đã hoàn thành", "7 / 8 việc"],
            ["Tiến độ", "88%"],
            ["Deadline gần nhất", work[0]?.time ?? "Trong ca"],
          ].map(([label, value]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-lg font-black sm:text-xl">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Công việc được giao
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Việc của tôi hôm nay
            </h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {work.map((item, index) => (
              <Link
                key={item.title}
                href={`/erp/${site.id}/${item.moduleId}`}
                className="grid min-w-0 gap-3 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8f1ec] text-xs font-black text-[#2b6651]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-black text-[#293d34]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#748079]">{item.detail}</p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneClasses[item.tone]}`}
                >
                  {item.time}
                </span>
              </Link>
            ))}
            {work.length === 0 ? (
              <p className="p-6 text-sm leading-6 text-[#748079]">
                Quản lý chưa giao việc cụ thể cho ca này.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Mở nhanh
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Nghiệp vụ được giao
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/erp/${site.id}/${module.id}`}
                className="min-w-0 rounded-xl border border-[#e0e6e2] p-3 transition hover:border-[#9db5aa] hover:bg-[#f7faf8]"
              >
                <span
                  className="block h-2 w-8 rounded-full"
                  style={{ backgroundColor: module.accent }}
                />
                <p className="mt-3 break-words text-sm font-black text-[#34473f]">
                  {module.shortName}
                </p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function AccountantDashboard({
  user,
  sites,
  records,
}: {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
}) {
  const actionableShiftClosures = records.filter((record) =>
    accountingActionableStatuses.has(record.status),
  );
  const differenceShiftClosures = actionableShiftClosures.filter(
    (record) => record.differenceVnd !== 0,
  );
  const differenceVnd = differenceShiftClosures.reduce(
    (sum, record) => sum + Math.abs(record.differenceVnd),
    0,
  );
  const pendingDirector = records.filter(
    (record) => record.status === "exception-pending-director",
  );
  const queueSiteCount = new Set(
    actionableShiftClosures.map((record) => record.siteId),
  ).size;
  const queue = [
    {
      title: "Đối soát ca vé và tiền thu",
      detail:
        actionableShiftClosures.length > 0
          ? `${actionableShiftClosures.length} ca cần xử lý từ ${queueSiteCount} cơ sở · ${
              differenceShiftClosures.length > 0
                ? `${differenceShiftClosures.length} ca chênh ${formatVnd(differenceVnd)}`
                : "toàn bộ tiền thu đã khớp"
            }`
          : "Không có ca nào đang chờ kế toán đối soát.",
      status:
        actionableShiftClosures.length > 0
          ? "Cần xử lý"
          : "Không có hồ sơ mới",
      tone:
        differenceShiftClosures.length > 0
          ? ("red" as const)
          : actionableShiftClosures.length > 0
            ? ("blue" as const)
            : ("green" as const),
      moduleId: "tai-chinh-doi-soat" as const,
    },
    {
      title: "Hoàn thiện hồ sơ nhà cung cấp",
      detail: "4 hóa đơn còn thiếu biên bản nghiệm thu hoặc chứng từ gốc",
      status: "Đến hạn 15:00",
      tone: "amber" as const,
      moduleId: "doi-tac-nha-cung-ung" as const,
    },
    {
      title: "Kiểm tra chi phí theo mã hạch toán",
      detail: "12 báo cáo hiện trường đã có ảnh, 3 hồ sơ cần bổ sung mã chi phí",
      status: "Chờ kiểm tra",
      tone: "blue" as const,
      moduleId: "bao-cao-hien-truong" as const,
    },
    {
      title: "Rà soát nghiệm thu tài sản",
      detail: "2 biên bản bảo trì cần đối chiếu hợp đồng trước khi ghi nhận chi phí",
      status: "Trong hôm nay",
      tone: "green" as const,
      moduleId: "tai-san-bao-tri" as const,
    },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6d5ca]">
              Bàn làm việc kế toán
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              {user.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
              {actionableShiftClosures.length} ca cần đối soát ·{" "}
              {pendingDirector.length} ngoại lệ đang chờ giám đốc
            </p>
          </div>
          <Link
            href="/erp/finance"
            className="w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-[#183f34]"
          >
            Mở tài chính toàn vùng →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Ca cần xử lý", actionableShiftClosures.length.toLocaleString("vi-VN"), `Từ ${queueSiteCount} cơ sở`],
            ["Chênh lệch cần xử lý", formatVnd(differenceVnd), `${differenceShiftClosures.length} ca`],
            ["Phải trả đến hạn", "428 triệu", "286 triệu đủ hồ sơ"],
            ["Thiếu chứng từ", "142 triệu", "4 bộ hồ sơ"],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-[11px] leading-4 text-white/50">{label}</p>
              <p className="mt-2 break-words text-xl font-black sm:text-2xl">{value}</p>
              <p className="mt-2 text-[11px] leading-4 text-[#b5d6ca]">{note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#8a6b27]">
              Hồ sơ cần làm
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Hàng việc hôm nay
            </h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {queue.map((item) => (
              <Link
                key={item.title}
                href="/erp/finance"
                className="grid min-w-0 gap-2 p-4 transition hover:bg-[#f7faf8] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <p className="font-black text-[#293d34]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#748079]">{item.detail}</p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneClasses[item.tone]}`}
                >
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Theo cơ sở
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Hồ sơ đang mở
          </h2>
          <div className="mt-5 space-y-2">
            {sites.map((site) => {
              const siteActionable = actionableShiftClosures.filter(
                (record) => record.siteId === site.id,
              );
              const sitePendingDirector = pendingDirector.filter(
                (record) => record.siteId === site.id,
              );
              const siteDifferenceVnd = siteActionable.reduce(
                (sum, record) => sum + Math.abs(record.differenceVnd),
                0,
              );
              const detail =
                siteActionable.length > 0
                  ? `${siteActionable.length} ca cần xử lý${
                      siteDifferenceVnd > 0
                        ? ` · chênh ${formatVnd(siteDifferenceVnd)}`
                        : " · tiền thu đã khớp"
                    }`
                  : sitePendingDirector.length > 0
                    ? `${sitePendingDirector.length} ngoại lệ chờ giám đốc`
                    : "Không có ca chờ đối soát";
              return (
                <Link
                  key={site.id}
                  href={moduleHref(user, "tai-chinh-doi-soat", site.id)}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e0e6e2] p-4 transition hover:border-[#9db5aa] hover:bg-[#f7faf8]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#34473f]">{site.shortName}</p>
                    <p className="mt-1 text-xs text-[#7b8881]">{detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[#286655]">Mở →</span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}

function EmptyAssignment({ name }: { name: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-[#b8c6bf] bg-white p-8 text-center sm:p-12">
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
        Phân công công việc
      </p>
      <h1 className="mt-3 text-3xl font-black text-[#183f34]">{name}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#66756e]">
        Tài khoản chưa được gán cơ sở. Hãy liên hệ quản lý trực tiếp để nhận ca và nghiệp vụ phụ trách.
      </p>
    </section>
  );
}

export function RoleHomeDashboard({
  user,
  sites,
  attendance,
  records,
  workdays,
  workdayEmployees,
}: Props) {
  if (user.role === "manager") {
    return (
      <div className="space-y-5">
        <ManagerDashboard user={user} sites={sites} records={records} />
        <WorkdayLifecycle
          user={user}
          sites={sites}
          initialRecords={workdays}
          employees={workdayEmployees}
        />
      </div>
    );
  }
  if (user.role === "employee") {
    return (
      <div className="space-y-5">
        <EmployeeDashboard
          user={user}
          sites={sites}
          attendance={attendance}
        />
        <WorkdayLifecycle
          user={user}
          sites={sites}
          initialRecords={workdays}
        />
      </div>
    );
  }
  if (user.role === "accountant") {
    return <AccountantDashboard user={user} sites={sites} records={records} />;
  }
  return null;
}
