"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  progressIncidentAction,
  transitionIncidentAction,
} from "@/app/erp/actions";
import type { ErpSite } from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type {
  IncidentCase,
  IncidentSeverity,
  IncidentStatus,
} from "@/lib/erp/incident-repository";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  cases: IncidentCase[];
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

function managerActionLabel(status: IncidentStatus): string | null {
  if (status === "reported") return "Tiếp nhận & giữ SLA";
  if (status === "acknowledged") return "Giao tổ phụ trách";
  if (status === "in-progress") return "Chuyển sang xác minh";
  if (status === "verification") return "Xác nhận & đóng";
  return null;
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

export function IncidentWorkflowWorkspace({ site, user, cases }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  async function handleManagerAction(incident: IncidentCase) {
    setPendingId(incident.id);
    try {
      const result = await transitionIncidentAction({
        incidentId: incident.id,
        siteId: site.id,
      });
      setMessage(result.message);
      if (result.success) router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleEmployeeAction(incident: IncidentCase) {
    setPendingId(incident.id);
    try {
      const result = await progressIncidentAction({
        incidentId: incident.id,
        siteId: site.id,
      });
      setMessage(result.message);
      if (result.success) router.refresh();
    } finally {
      setPendingId(null);
    }
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
            const managerLabel =
              user.role === "manager" ? managerActionLabel(incident.status) : null;
            const employeeCanUpdate =
              user.role === "employee" &&
              incident.status !== "closed" &&
              incident.status !== "verification";
            const isPending = pendingId === incident.id;

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

                      {(managerLabel || employeeCanUpdate) && (
                        <div className="rounded-xl border border-[#cddbd4] bg-[#eaf3ee] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#477565]">
                            Hành động của bạn
                          </p>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              managerLabel
                                ? handleManagerAction(incident)
                                : handleEmployeeAction(incident)
                            }
                            className="mt-3 min-h-11 w-full rounded-xl bg-[#183f34] px-5 text-sm font-black text-white transition hover:bg-[#245747] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                          >
                            {isPending
                              ? "Đang cập nhật..."
                              : (managerLabel ?? "Báo đã xử lý · chờ xác minh")}
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
