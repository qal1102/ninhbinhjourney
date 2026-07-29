"use client";

import { useMemo, useState } from "react";
import type { ErpSite, ErpSiteId } from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
};

type IncidentSeverity = "P1" | "P2" | "P3" | "P4";
type IncidentStatus =
  | "reported"
  | "acknowledged"
  | "in-progress"
  | "verification"
  | "closed";

type IncidentEvidence = {
  id: string;
  kind: "Ảnh hiện trường" | "Checklist" | "Biên bản";
  label: string;
  addedBy: string;
  addedAt: string;
};

type IncidentTimelineItem = {
  id: string;
  at: string;
  actor: string;
  action: string;
  note: string;
};

type IncidentCase = {
  id: string;
  siteId: ErpSiteId;
  title: string;
  area: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  escalated: boolean;
  escalationReason?: string;
  reportedAt: string;
  slaMinutes: number;
  elapsedMinutes: number;
  reporter: string;
  assigneeId: string | null;
  assigneeName: string;
  assigneeTeam: string;
  sop: {
    code: string;
    title: string;
    completedSteps: number;
    totalSteps: number;
  };
  nextAction: string;
  evidence: IncidentEvidence[];
  timeline: IncidentTimelineItem[];
};

const siteCode: Record<ErpSiteId, string> = {
  "trang-an": "TA",
  "tam-chuc": "TC",
  "tam-coc": "TCO",
  "bai-dinh": "BD",
};

const assignedEmployee: Record<
  ErpSiteId,
  { id: string; name: string; team: string }
> = {
  "trang-an": {
    id: "employee-trang-an-01",
    name: "Đỗ Thị Lan",
    team: "Đón khách & cổng vé",
  },
  "tam-chuc": {
    id: "employee-tam-chuc-01",
    name: "Vũ Ngọc Mai",
    team: "Điều phối xe trung chuyển",
  },
  "tam-coc": {
    id: "employee-tam-coc-01",
    name: "Nguyễn Văn Sơn",
    team: "Điều phối bến đò",
  },
  "bai-dinh": {
    id: "employee-bai-dinh-01",
    name: "Lương Thanh Tùng",
    team: "Điều phối xe điện",
  },
};

const statusLabel: Record<IncidentStatus, string> = {
  reported: "Mới báo",
  acknowledged: "Đã tiếp nhận",
  "in-progress": "Đang xử lý",
  verification: "Chờ xác minh",
  closed: "Đã đóng",
};

const statusTone: Record<IncidentStatus, string> = {
  reported: "bg-[#ffe4de] text-[#934336]",
  acknowledged: "bg-[#fff0ce] text-[#77531c]",
  "in-progress": "bg-[#e1edf4] text-[#315f79]",
  verification: "bg-[#eee8f5] text-[#6c5187]",
  closed: "bg-[#dff1e8] text-[#246249]",
};

const severityTone: Record<IncidentSeverity, string> = {
  P1: "bg-[#8c3028] text-white",
  P2: "bg-[#c35c47] text-white",
  P3: "bg-[#e9bd67] text-[#523b13]",
  P4: "bg-[#dce5e0] text-[#52635b]",
};

function createCases(site: ErpSite): IncidentCase[] {
  const code = siteCode[site.id];
  const employee = assignedEmployee[site.id];

  return [
    {
      id: `INC-${code}-071`,
      siteId: site.id,
      title: "Khách cần hỗ trợ y tế tại cổng chính",
      area: "Cổng chính · Làn khách đoàn",
      summary:
        "Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.",
      severity: "P2",
      status: "reported",
      escalated: true,
      escalationReason:
        "Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.",
      reportedAt: "09:16",
      slaMinutes: 5,
      elapsedMinutes: 4,
      reporter: employee.name,
      assigneeId: null,
      assigneeName: "Chưa giao",
      assigneeTeam: "Tổ y tế & an toàn",
      sop: {
        code: "SOP-YT-02",
        title: "Sơ cứu và bảo đảm lối tiếp cận",
        completedSteps: 2,
        totalSteps: 6,
      },
      nextAction: "Quản lý tiếp nhận và giao tổ y tế",
      evidence: [
        {
          id: "EV-071-01",
          kind: "Ảnh hiện trường",
          label: "Vị trí khách đang được hỗ trợ",
          addedBy: employee.name,
          addedAt: "09:17",
        },
        {
          id: "EV-071-02",
          kind: "Checklist",
          label: "Đã mở lối tiếp cận tạm thời",
          addedBy: employee.name,
          addedAt: "09:18",
        },
      ],
      timeline: [
        {
          id: "TL-071-02",
          at: "09:18",
          actor: "Hệ thống",
          action: "Chuyển cấp P2",
          note: "Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách.",
        },
        {
          id: "TL-071-01",
          at: "09:16",
          actor: employee.name,
          action: "Báo sự cố",
          note: "Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế.",
        },
      ],
    },
    {
      id: `INC-${code}-069`,
      siteId: site.id,
      title: "Dòng khách dồn tại điểm đón",
      area: "Điểm đón trung tâm · Làn số 2",
      summary:
        "Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.",
      severity: "P3",
      status: "in-progress",
      escalated: false,
      reportedAt: "09:02",
      slaMinutes: 10,
      elapsedMinutes: 7,
      reporter: "Camera AI · CAM 02",
      assigneeId: employee.id,
      assigneeName: employee.name,
      assigneeTeam: employee.team,
      sop: {
        code: "SOP-LUONG-03",
        title: "Phân luồng khi thời gian chờ vượt 10 phút",
        completedSteps: 4,
        totalSteps: 5,
      },
      nextAction: "Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh",
      evidence: [
        {
          id: "EV-069-01",
          kind: "Ảnh hiện trường",
          label: "Hàng chờ trước khi mở làn phụ",
          addedBy: "Camera AI · CAM 02",
          addedAt: "09:02",
        },
        {
          id: "EV-069-02",
          kind: "Checklist",
          label: "Đã đặt biển hướng dẫn và mở hàng chờ phụ",
          addedBy: employee.name,
          addedAt: "09:06",
        },
      ],
      timeline: [
        {
          id: "TL-069-03",
          at: "09:06",
          actor: employee.name,
          action: "Cập nhật xử lý",
          note: "Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút.",
        },
        {
          id: "TL-069-02",
          at: "09:04",
          actor: `Quản lý ${site.shortName}`,
          action: "Giao xử lý",
          note: `Giao ${employee.name} phụ trách tại hiện trường.`,
        },
        {
          id: "TL-069-01",
          at: "09:02",
          actor: "Camera AI · CAM 02",
          action: "Tạo cảnh báo",
          note: "Mật độ hàng chờ vượt ngưỡng vận hành.",
        },
      ],
    },
    {
      id: `INC-${code}-064`,
      siteId: site.id,
      title: "Đồ thất lạc đã bàn giao cho khách",
      area: "Quầy hỗ trợ khách",
      summary:
        "Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.",
      severity: "P4",
      status: "closed",
      escalated: false,
      reportedAt: "08:21",
      slaMinutes: 15,
      elapsedMinutes: 6,
      reporter: "Quầy hỗ trợ 01",
      assigneeId: employee.id,
      assigneeName: employee.name,
      assigneeTeam: "Chăm sóc khách hàng",
      sop: {
        code: "SOP-TS-01",
        title: "Tiếp nhận và bàn giao tài sản thất lạc",
        completedSteps: 5,
        totalSteps: 5,
      },
      nextAction: "Không còn việc cần xử lý",
      evidence: [
        {
          id: "EV-064-01",
          kind: "Biên bản",
          label: "Biên bản bàn giao có xác nhận của khách",
          addedBy: employee.name,
          addedAt: "08:27",
        },
      ],
      timeline: [
        {
          id: "TL-064-02",
          at: "08:27",
          actor: `Quản lý ${site.shortName}`,
          action: "Xác minh và đóng",
          note: "Đủ thông tin người nhận và biên bản bàn giao.",
        },
        {
          id: "TL-064-01",
          at: "08:21",
          actor: "Quầy hỗ trợ 01",
          action: "Báo tài sản thất lạc",
          note: "Niêm phong và chuyển quầy hỗ trợ đối chiếu.",
        },
      ],
    },
  ];
}

function nextManagerState(status: IncidentStatus): {
  label: string;
  status: IncidentStatus;
  action: string;
  note: string;
} | null {
  if (status === "reported") {
    return {
      label: "Tiếp nhận & giữ SLA",
      status: "acknowledged",
      action: "Tiếp nhận sự cố",
      note: "Quản lý đã kiểm tra thông tin ban đầu và nhận điều phối.",
    };
  }
  if (status === "acknowledged") {
    return {
      label: "Giao tổ phụ trách",
      status: "in-progress",
      action: "Giao xử lý",
      note: "Đã giao đúng tổ phụ trách và thông báo mốc cập nhật tiếp theo.",
    };
  }
  if (status === "in-progress") {
    return {
      label: "Chuyển sang xác minh",
      status: "verification",
      action: "Yêu cầu xác minh",
      note: "Hiện trường báo đã xử lý; chờ quản lý kiểm tra kết quả và bằng chứng.",
    };
  }
  if (status === "verification") {
    return {
      label: "Xác nhận & đóng",
      status: "closed",
      action: "Xác minh và đóng",
      note: "Kết quả đạt yêu cầu, đủ bằng chứng và không còn rủi ro tồn đọng.",
    };
  }
  return null;
}

function displayTime() {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function slaCopy(item: IncidentCase) {
  if (item.status === "closed") {
    return {
      text: `Hoàn tất trong ${item.elapsedMinutes} phút`,
      tone: "text-[#2b7359]",
    };
  }
  const remaining = item.slaMinutes - item.elapsedMinutes;
  if (remaining <= 0) {
    return {
      text: `Quá SLA ${Math.abs(remaining)} phút`,
      tone: "text-[#a34637]",
    };
  }
  return {
    text: `Còn ${remaining} phút để phản hồi`,
    tone: remaining <= 2 ? "text-[#a34637]" : "text-[#8a642a]",
  };
}

export function IncidentWorkflowWorkspace({ site, user }: Props) {
  const [cases, setCases] = useState<IncidentCase[]>(() => createCases(site));
  const [message, setMessage] = useState("");

  const visibleCases = useMemo(() => {
    if (user.role === "director") {
      return cases.filter((item) => item.escalated && item.status !== "closed");
    }
    if (user.role === "employee") {
      return cases.filter((item) => item.assigneeId === user.id);
    }
    return cases;
  }, [cases, user.id, user.role]);

  const activeCount = visibleCases.filter(
    (item) => item.status !== "closed",
  ).length;
  const urgentCount = visibleCases.filter(
    (item) =>
      item.status !== "closed" &&
      (item.severity === "P1" || item.severity === "P2"),
  ).length;
  const slaRiskCount = visibleCases.filter(
    (item) =>
      item.status !== "closed" &&
      item.slaMinutes - item.elapsedMinutes <= 2,
  ).length;

  const heading =
    user.role === "director"
      ? "Sự cố đã chuyển cấp"
      : user.role === "manager"
        ? `Điều phối sự cố tại ${site.shortName}`
        : "Việc sự cố của tôi";
  const description =
    user.role === "director"
      ? "Chỉ hiển thị hồ sơ vượt thẩm quyền cơ sở hoặc cần quyết định điều hành."
      : user.role === "manager"
        ? "Tiếp nhận, giao đúng người, kiểm tra bằng chứng và đóng hồ sơ tại một nơi."
        : "Cập nhật đúng việc được giao; quản lý sẽ xác minh trước khi đóng hồ sơ.";

  function updateCase(
    incident: IncidentCase,
    transition: ReturnType<typeof nextManagerState>,
  ) {
    if (!transition) return;
    const employee = assignedEmployee[site.id];
    const shouldAssign =
      transition.status === "in-progress" && incident.assigneeId === null;
    const nextAction =
      transition.status === "acknowledged"
        ? "Giao tổ phụ trách và chốt mốc cập nhật"
        : transition.status === "in-progress"
          ? "Cập nhật hiện trường và bằng chứng sau xử lý"
          : transition.status === "verification"
            ? "Quản lý kiểm tra hiện trường và đủ bằng chứng"
            : "Không còn việc cần xử lý";

    setCases((current) =>
      current.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              status: transition.status,
              assigneeId: shouldAssign ? employee.id : item.assigneeId,
              assigneeName: shouldAssign ? employee.name : item.assigneeName,
              assigneeTeam: shouldAssign
                ? item.assigneeTeam
                : item.assigneeTeam,
              nextAction,
              timeline: [
                {
                  id: crypto.randomUUID(),
                  at: displayTime(),
                  actor: user.name,
                  action: transition.action,
                  note: transition.note,
                },
                ...item.timeline,
              ],
            }
          : item,
      ),
    );
    setMessage(`${incident.id}: ${transition.action.toLocaleLowerCase("vi-VN")}.`);
  }

  function employeeUpdate(incident: IncidentCase) {
    if (incident.status === "closed" || incident.status === "verification") {
      return;
    }
    setCases((current) =>
      current.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              status: "verification",
              nextAction: "Chờ quản lý kiểm tra hiện trường và bằng chứng",
              sop: {
                ...item.sop,
                completedSteps: item.sop.totalSteps,
              },
              timeline: [
                {
                  id: crypto.randomUUID(),
                  at: displayTime(),
                  actor: user.name,
                  action: "Báo đã xử lý",
                  note: "Đã hoàn thành checklist và chuyển quản lý xác minh kết quả.",
                },
                ...item.timeline,
              ],
            }
          : item,
      ),
    );
    setMessage(`${incident.id}: đã chuyển quản lý xác minh.`);
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#a34738]">
              An toàn & sự cố · {site.shortName}
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c] sm:text-3xl">
              {heading}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#697770]">
              {description}
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#edf2ef] px-3 py-1.5 text-xs font-black text-[#596a62]">
            {activeCount} hồ sơ đang mở
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Đang xử lý", String(activeCount), "Theo đúng phạm vi của bạn"],
            ["Mức P1 / P2", String(urgentCount), "Ưu tiên an toàn trước"],
            ["Sát hoặc quá SLA", String(slaRiskCount), "Cần phản hồi ngay"],
            [
              user.role === "director" ? "Cần quyết định" : "Đã đóng gần nhất",
              user.role === "director"
                ? String(visibleCases.filter((item) => item.escalated).length)
                : String(
                    visibleCases.filter((item) => item.status === "closed")
                      .length,
                  ),
              user.role === "director"
                ? "Đã được quản lý xác minh"
                : "Có đủ nhật ký và bằng chứng",
            ],
          ].map(([label, value, note]) => (
            <article key={label} className="rounded-xl bg-[#f3f6f4] p-4">
              <p className="text-xs leading-5 text-[#718078]">{label}</p>
              <p className="mt-1 text-2xl font-black text-[#253c33]">{value}</p>
              <p className="mt-1 text-xs leading-5 text-[#7b8881]">{note}</p>
            </article>
          ))}
        </div>
      </section>

      {message ? (
        <p
          role="status"
          className="rounded-xl border border-[#cde2d7] bg-[#e8f4ed] px-4 py-3 text-sm font-bold text-[#285f49]"
        >
          {message}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="border-b border-[#e3e9e5] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Hàng việc theo mức ưu tiên
          </p>
          <h2 className="mt-2 text-xl font-black text-[#20342c]">
            Hồ sơ cần theo dõi
          </h2>
        </div>

        <div className="divide-y divide-[#e6ebe8]">
          {visibleCases.map((incident) => {
            const sla = slaCopy(incident);
            const managerTransition =
              user.role === "manager"
                ? nextManagerState(incident.status)
                : null;
            const employeeCanUpdate =
              user.role === "employee" &&
              incident.status !== "closed" &&
              incident.status !== "verification";

            return (
              <details key={incident.id} className="group">
                <summary className="cursor-pointer list-none p-4 transition hover:bg-[#f8faf8] sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-black ${severityTone[incident.severity]}`}
                      >
                        {incident.severity}
                      </span>
                      <span className="font-mono text-xs font-black text-[#718078]">
                        {incident.id}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[#2c3e36]">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#74817b]">
                        {incident.area} · Báo lúc {incident.reportedAt}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone[incident.status]}`}
                      >
                        {statusLabel[incident.status]}
                      </span>
                      <span className={`text-xs font-black ${sla.tone}`}>
                        {sla.text}
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-[#e6ebe8] bg-[#f8faf8] p-4 sm:p-6">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="min-w-0 space-y-4">
                      <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d7c75]">
                          Tình hình
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#465950]">
                          {incident.summary}
                        </p>
                        {incident.escalationReason ? (
                          <div className="mt-3 rounded-xl border border-[#e8c7bc] bg-[#fff2ee] p-3">
                            <p className="text-xs font-black text-[#913f32]">
                              Lý do chuyển cấp
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#74483f]">
                              {incident.escalationReason}
                            </p>
                          </div>
                        ) : null}
                      </article>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                          <p className="text-xs text-[#7b8881]">Người phụ trách</p>
                          <p className="mt-1 font-black text-[#30443b]">
                            {incident.assigneeName}
                          </p>
                          <p className="mt-1 text-xs text-[#718078]">
                            {incident.assigneeTeam}
                          </p>
                        </article>
                        <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                          <p className="text-xs text-[#7b8881]">Việc tiếp theo</p>
                          <p className="mt-1 text-sm font-black leading-6 text-[#30443b]">
                            {incident.nextAction}
                          </p>
                        </article>
                      </div>

                      <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-[#7b8881]">
                              {incident.sop.code}
                            </p>
                            <p className="mt-1 font-black text-[#30443b]">
                              {incident.sop.title}
                            </p>
                          </div>
                          <span className="text-xs font-black text-[#526a60]">
                            {incident.sop.completedSteps}/
                            {incident.sop.totalSteps} bước
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eeea]">
                          <div
                            className="h-full rounded-full bg-[#397a62]"
                            style={{
                              width: `${Math.round(
                                (incident.sop.completedSteps /
                                  incident.sop.totalSteps) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </article>

                      {(managerTransition || employeeCanUpdate) && (
                        <div className="rounded-xl border border-[#cddbd4] bg-[#eaf3ee] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
                            Hành động của bạn
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              managerTransition
                                ? updateCase(incident, managerTransition)
                                : employeeUpdate(incident)
                            }
                            className="mt-3 min-h-11 w-full rounded-xl bg-[#183f34] px-5 text-sm font-black text-white transition hover:bg-[#245747] sm:w-auto"
                          >
                            {managerTransition?.label ??
                              "Báo đã xử lý · chờ xác minh"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-4">
                      <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d7c75]">
                          Bằng chứng
                        </p>
                        <ul className="mt-3 space-y-2">
                          {incident.evidence.map((evidence) => (
                            <li
                              key={evidence.id}
                              className="rounded-lg bg-[#f3f6f4] p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black text-[#477565]">
                                  {evidence.kind}
                                </span>
                                <span className="text-[11px] text-[#839089]">
                                  {evidence.addedAt}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-bold text-[#34473f]">
                                {evidence.label}
                              </p>
                              <p className="mt-1 text-xs text-[#7b8881]">
                                {evidence.addedBy}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </article>

                      <article className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d7c75]">
                          Dòng thời gian
                        </p>
                        <ol className="mt-3 space-y-4">
                          {incident.timeline.map((item, index) => (
                            <li
                              key={item.id}
                              className="relative grid grid-cols-[auto_1fr] gap-3"
                            >
                              <div className="flex flex-col items-center">
                                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#397a62]" />
                                {index < incident.timeline.length - 1 ? (
                                  <span className="mt-1 h-full w-px bg-[#dbe4df]" />
                                ) : null}
                              </div>
                              <div className="min-w-0 pb-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-black text-[#34473f]">
                                    {item.action}
                                  </p>
                                  <time className="text-xs text-[#87928d]">
                                    {item.at}
                                  </time>
                                </div>
                                <p className="mt-1 text-xs font-bold text-[#607169]">
                                  {item.actor}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[#74817b]">
                                  {item.note}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </article>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}

          {visibleCases.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-black text-[#34473f]">
                Không có sự cố nào cần bạn xử lý.
              </p>
              <p className="mt-2 text-sm text-[#7b8881]">
                Sự cố mới sẽ xuất hiện khi được giao đúng người và đúng cơ sở.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
