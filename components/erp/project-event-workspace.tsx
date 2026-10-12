"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  decideProjectChangeRequestAction,
  recordProjectSettlementAction,
  reportProjectBlockerAction,
  submitProjectChangeRequestAction,
  updateProjectWorkItemAction,
} from "@/app/erp/project-actions";
import type { ErpSite } from "@/domain/erp";
import {
  canAcceptProjectWork,
  canDecideProjectChange,
  canRecordProjectSettlement,
  canRequestProjectChange,
} from "@/domain/erp-role-policy";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type {
  ProjectWorkItem,
  ProjectWorkItemStatus,
  ProjectWorkspace,
} from "@/lib/erp/project-repository";

type Props = { site: ErpSite; user: CurrentErpUser; workspace: ProjectWorkspace };

const statusLabel: Record<ProjectWorkItemStatus, string> = {
  open: "Chưa bắt đầu",
  "in-progress": "Đang xử lý",
  blocked: "Đang chặn",
  "ready-for-acceptance": "Chờ nghiệm thu",
  done: "Hoàn thành",
};

const statusTone: Record<ProjectWorkItemStatus, string> = {
  open: "bg-[#eef1ef] text-[#69766f]",
  "in-progress": "bg-[#e1edf4] text-[#315f79]",
  blocked: "bg-[#ffe4de] text-[#934336]",
  "ready-for-acceptance": "bg-[#fff0ce] text-[#77531c]",
  done: "bg-[#dff1e8] text-[#246249]",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value),
  );
}

function daysUntil(value: string) {
  return Math.ceil((new Date(`${value}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

function formatBillion(value: number) {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
}

function dueText(item: ProjectWorkItem) {
  if (item.status === "done") return "đã xong";
  const days = daysUntil(item.dueDate);
  if (days < 0) return `trễ ${Math.abs(days)} ngày`;
  if (days === 0) return "hạn hôm nay";
  return `còn ${days} ngày`;
}

/** Bước kế tiếp của gói việc và ai làm, để người chỉ xem cũng biết việc đang chờ ai. */
function nextStepText(item: ProjectWorkItem, settled: boolean) {
  switch (item.status) {
    case "open":
      return "Người được giao hoặc quản lý cơ sở bấm Bắt đầu xử lý.";
    case "in-progress":
      return "Người làm cập nhật tiến độ; đủ 100% thì gửi nghiệm thu.";
    case "blocked":
      return "Đang vướng. Quản lý cơ sở hoặc người được giao gỡ chặn khi đã xử lý xong.";
    case "ready-for-acceptance":
      return "Quản lý hoặc giám đốc xác nhận hoàn thành (người gửi không tự xác nhận được).";
    case "done":
      return item.requiresSettlement && !settled
        ? "Đã nghiệm thu. Kế toán ghi chi phí thực tế ở khối Quyết toán."
        : "Đã xong, không còn việc nào.";
  }
}

export function ProjectEventWorkspace({ site, user, workspace }: Props) {
  const router = useRouter();
  const { event, milestones, changeRequests, settlements } = workspace;
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [blockReasons, setBlockReasons] = useState<Record<string, string>>({});

  const allItems = milestones.flatMap((milestone) => milestone.workItems);
  const overallProgress = allItems.length
    ? Math.round(allItems.reduce((sum, item) => sum + item.progressPercent, 0) / allItems.length)
    : 0;
  const doneCount = allItems.filter((item) => item.status === "done").length;
  const remaining = event.budgetBillion - event.committedBillion;
  const daysLeft = daysUntil(event.eventDate);
  const urgentCount = allItems.filter(
    (item) => item.status !== "done" && daysUntil(item.dueDate) <= 3,
  ).length;

  const canAccept = canAcceptProjectWork(user.role);
  const canRequestChange = canRequestProjectChange(user.role);
  const canDecideChange = canDecideProjectChange(user.role);
  const canSettle = canRecordProjectSettlement(user.role);

  async function runAction<T>(key: string, action: () => Promise<{ success: boolean; message: string } & T>) {
    setPendingKey(key);
    try {
      const result = await action();
      setMessage(result.message);
      if (result.success) router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  function isAssignee(item: ProjectWorkItem) {
    return user.role === "employee" && item.assigneeAccountId === user.id;
  }

  function canActOnItem(item: ProjectWorkItem) {
    return user.role === "manager" || isAssignee(item);
  }

  const settledCodes = new Set(settlements.map((settlement) => settlement.workItemCode));
  const settledAmountByCode = new Map<string, number>();
  for (const settlement of settlements) {
    settledAmountByCode.set(
      settlement.workItemCode,
      (settledAmountByCode.get(settlement.workItemCode) ?? 0) + settlement.amountBillion,
    );
  }
  const settleableItems = allItems.filter(
    (item) => item.status === "done" && item.requiresSettlement && !settledCodes.has(item.code),
  );

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#3f2e24] p-5 text-white sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e8c8a8]">
              {site.shortName} · {formatDate(event.eventDate)}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl">{event.name}</h2>
            <p className="mt-3 text-sm text-white/65">{event.nextMilestone}</p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-xl px-4 py-3 text-sm font-black ${urgentCount > 0 ? "bg-[#c85b45]" : "bg-white/12"}`}>{urgentCount > 0 ? `${urgentCount} việc sắp tới hạn hoặc trễ` : "Chưa có việc nào trễ hạn"}</span>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-[#e4b37b]" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/55">
          <span>Tiến độ tổng thể {overallProgress}%</span>
          <span>{daysLeft >= 0 ? `Còn ${daysLeft} ngày` : `Đã qua ${Math.abs(daysLeft)} ngày`}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Ngân sách", formatBillion(event.budgetBillion), `${formatBillion(event.committedBillion)} đã cam kết`],
          ["Còn khả dụng", formatBillion(remaining), "Sau quyết toán đã ghi nhận"],
          ["Khách dự kiến", event.expectedGuests.toLocaleString("vi-VN"), "Theo phương án phân luồng"],
          ["Gói việc", `${doneCount} / ${allItems.length}`, "Đã hoàn thành / tổng số"],
        ].map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs text-[#697770]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[#253c33]">{value}</p>
            <p className="mt-2 text-xs leading-5 text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      {message ? (
        <p role="status" className="rounded-xl border border-[#e3d2c4] bg-[#fbf4ec] px-4 py-3 text-sm font-bold text-[#7a4d2a]">
          {message}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e3e9e5] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#9a5f32]" data-chi="goi-viec" data-chi-loi="Gói việc của sự kiện, chia theo nhóm. Mở từng gói xem hạn, người phụ trách, tiến độ.">Chia theo nhóm việc</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">Gói việc</h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {milestones.map((milestone) => {
              const milestoneItems =
                user.role === "employee" ? milestone.workItems.filter(isAssignee) : milestone.workItems;
              if (milestoneItems.length === 0) return null;
              return (
                <div key={milestone.name} className="p-4 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d7c75]">{milestone.name}</p>
                  <div className="mt-3 space-y-3">
                    {milestoneItems.map((item) => {
                      const pending = pendingKey === item.code;
                      const dependencies = item.dependsOnCodes
                        .map((code) => allItems.find((candidate) => candidate.code === code))
                        .filter((candidate): candidate is ProjectWorkItem => Boolean(candidate));
                      const waitingOnThis = allItems.filter((candidate) => candidate.dependsOnCodes.includes(item.code));
                      const settledAmount = settledAmountByCode.get(item.code);
                      const late = item.status !== "done" && daysUntil(item.dueDate) < 0;
                      const canAct =
                        (item.status === "ready-for-acceptance" && canAccept && item.submittedForAcceptanceBy !== user.id) ||
                        (item.status !== "ready-for-acceptance" && item.status !== "done" && canActOnItem(item));

                      return (
                        <details key={item.code} data-goi-viec={item.code} className="group rounded-xl border border-[#e0e6e2] open:border-[#c9d6ce] open:shadow-sm">
                          <summary className="cursor-pointer list-none rounded-xl p-4 transition-colors hover:bg-[#f8faf8] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                                  <span className="font-mono text-xs font-black text-[#7a8781]">{item.code}</span>
                                  <strong className="text-sm text-[#2c3e36]">{item.title}</strong>
                                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusTone[item.status]}`}>
                                    {statusLabel[item.status]}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-[#6e7b75]">
                                  {item.ownerTeam} · Hạn {formatDate(item.dueDate)}
                                  {late ? <span className="font-black text-[#a34637]"> · {dueText(item)}</span> : null}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7ece9]">
                                    <div className="h-full rounded-full bg-[#397a62]" style={{ width: `${item.progressPercent}%` }} />
                                  </div>
                                  <span className="w-9 text-right text-xs font-black text-[#4a5952]">{item.progressPercent}%</span>
                                </div>
                              </div>
                              <span aria-hidden="true" className="mt-0.5 text-xl font-black leading-none text-[#8a968f] transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
                            </div>
                          </summary>

                          <div className="space-y-3 rounded-b-xl border-t border-[#edf0ee] bg-[#f8faf8] p-4">
                            <dl className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-white p-3">
                                <dt className="text-[#7b8881]">Người được giao</dt>
                                <dd className="mt-1 font-black text-[#2c3e36]">{item.assigneeName ?? "Chưa giao riêng ai"}</dd>
                                {item.assigneeName ? null : <dd className="mt-0.5 text-[#849089]">Quản lý cơ sở trực tiếp làm</dd>}
                              </div>
                              <div className="rounded-lg bg-white p-3">
                                <dt className="text-[#7b8881]">Nhóm phụ trách</dt>
                                <dd className="mt-1 font-black text-[#2c3e36]">{item.ownerTeam}</dd>
                                <dd className="mt-0.5 text-[#849089]">{milestone.name}</dd>
                              </div>
                              <div className="rounded-lg bg-white p-3">
                                <dt className="text-[#7b8881]">Hạn</dt>
                                <dd className="mt-1 font-black text-[#2c3e36]">{formatDate(item.dueDate)}</dd>
                                <dd className={`mt-0.5 font-bold ${late ? "text-[#a34637]" : "text-[#849089]"}`}>{dueText(item)}</dd>
                              </div>
                              <div className="rounded-lg bg-white p-3">
                                <dt className="text-[#7b8881]">Quyết toán</dt>
                                <dd className="mt-1 font-black text-[#2c3e36]">
                                  {!item.requiresSettlement
                                    ? "Không cần"
                                    : settledAmount !== undefined
                                      ? `Đã ghi ${formatBillion(settledAmount)}`
                                      : "Cần ghi khi xong"}
                                </dd>
                                {item.requiresSettlement && settledAmount === undefined ? (
                                  <dd className="mt-0.5 text-[#849089]">Kế toán ghi chi phí thực tế</dd>
                                ) : null}
                              </div>
                            </dl>

                            <p className="rounded-lg border border-[#e3d2c4] bg-[#fbf4ec] p-3 text-xs leading-5 text-[#7a4d2a]">
                              <strong>Bước tiếp theo:</strong> {nextStepText(item, settledAmount !== undefined)}
                              {item.status === "ready-for-acceptance" && item.submittedForAcceptanceByName ? (
                                <> Người gửi nghiệm thu: {item.submittedForAcceptanceByName}.</>
                              ) : null}
                              {!canAct && item.status !== "done" ? (
                                <span className="mt-1 block text-[#8a6a52]">Vai đang xem chỉ theo dõi gói này, không có nút thao tác.</span>
                              ) : null}
                            </p>

                            {dependencies.length > 0 ? (
                              <div className="rounded-lg bg-white p-3 text-xs">
                                <p className="font-black text-[#607169]">Cần xong trước</p>
                                <ul className="mt-1 space-y-1">
                                  {dependencies.map((dep) => (
                                    <li key={dep.code} className="flex justify-between gap-2">
                                      <span className="min-w-0"><span className="font-mono">{dep.code}</span> {dep.title}</span>
                                      <span className={`shrink-0 font-black ${statusTone[dep.status].split(" ")[1]}`}>
                                        {statusLabel[dep.status]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {waitingOnThis.length > 0 ? (
                              <div className="rounded-lg bg-white p-3 text-xs">
                                <p className="font-black text-[#607169]">Gói đang chờ gói này</p>
                                <ul className="mt-1 space-y-1">
                                  {waitingOnThis.map((next) => (
                                    <li key={next.code}><span className="font-mono">{next.code}</span> {next.title}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {item.status === "blocked" && item.blockedReason ? (
                              <p className="rounded-lg bg-[#fff2ee] p-3 text-xs text-[#8a4433]">
                                <strong>Lý do chặn:</strong> {item.blockedReason}
                              </p>
                            ) : null}

                            {item.status === "open" && canActOnItem(item) ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  runAction(item.code, () =>
                                    updateProjectWorkItemAction({
                                      siteId: site.id,
                                      workItemCode: item.code,
                                      nextStatus: "in-progress",
                                    }),
                                  )
                                }
                                className="min-h-11 rounded-lg bg-[#183f34] px-4 text-xs font-black text-white disabled:opacity-60"
                              >
                                Bắt đầu xử lý
                              </button>
                            ) : null}

                            {item.status === "in-progress" && canActOnItem(item) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <form
                                  className="flex items-center gap-2"
                                  onSubmit={(formEvent) => {
                                    formEvent.preventDefault();
                                    const progress = Number(
                                      new FormData(formEvent.currentTarget).get("progress"),
                                    );
                                    runAction(item.code, () =>
                                      updateProjectWorkItemAction({
                                        siteId: site.id,
                                        workItemCode: item.code,
                                        nextStatus: "in-progress",
                                        progressPercent: progress,
                                      }),
                                    );
                                  }}
                                >
                                  <select name="progress" defaultValue={item.progressPercent} className="min-h-11 rounded-lg border border-[#ced8d1] bg-white px-2 text-xs">
                                    {[10, 25, 50, 75, 90, 100].map((value) => (
                                      <option key={value} value={value}>{value}%</option>
                                    ))}
                                  </select>
                                  <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-[#183f34] px-3 text-xs font-black text-white disabled:opacity-60">
                                    Cập nhật tiến độ
                                  </button>
                                </form>
                                {item.progressPercent >= 100 ? (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      runAction(item.code, () =>
                                        updateProjectWorkItemAction({
                                          siteId: site.id,
                                          workItemCode: item.code,
                                          nextStatus: "ready-for-acceptance",
                                        }),
                                      )
                                    }
                                    className="min-h-11 rounded-lg bg-[#397a62] px-3 text-xs font-black text-white disabled:opacity-60"
                                  >
                                    Gửi nghiệm thu
                                  </button>
                                ) : null}
                                <form
                                  className="flex items-center gap-2"
                                  onSubmit={(formEvent) => {
                                    formEvent.preventDefault();
                                    runAction(`${item.code}-block`, () =>
                                      reportProjectBlockerAction({
                                        siteId: site.id,
                                        workItemCode: item.code,
                                        reason: blockReasons[item.code],
                                      }),
                                    );
                                  }}
                                >
                                  <input
                                    value={blockReasons[item.code] ?? ""}
                                    onChange={(inputEvent) =>
                                      setBlockReasons((current) => ({ ...current, [item.code]: inputEvent.target.value }))
                                    }
                                    placeholder="Lý do chặn"
                                    className="min-h-11 rounded-lg border border-[#ced8d1] px-2 text-xs"
                                  />
                                  <button type="submit" disabled={pendingKey === `${item.code}-block`} className="min-h-11 rounded-lg bg-[#a34637] px-3 text-xs font-black text-white disabled:opacity-60">
                                    Báo chặn
                                  </button>
                                </form>
                              </div>
                            ) : null}

                            {item.status === "blocked" && canActOnItem(item) ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  runAction(item.code, () =>
                                    reportProjectBlockerAction({ siteId: site.id, workItemCode: item.code }),
                                  )
                                }
                                className="min-h-11 rounded-lg bg-[#183f34] px-4 text-xs font-black text-white disabled:opacity-60"
                              >
                                Gỡ chặn
                              </button>
                            ) : null}

                            {item.status === "ready-for-acceptance" ? (
                              canAccept && item.submittedForAcceptanceBy !== user.id ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      runAction(item.code, () =>
                                        updateProjectWorkItemAction({
                                          siteId: site.id,
                                          workItemCode: item.code,
                                          nextStatus: "done",
                                        }),
                                      )
                                    }
                                    className="min-h-11 rounded-lg bg-[#183f34] px-4 text-xs font-black text-white disabled:opacity-60"
                                  >
                                    Xác nhận hoàn thành
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      runAction(item.code, () =>
                                        updateProjectWorkItemAction({
                                          siteId: site.id,
                                          workItemCode: item.code,
                                          nextStatus: "in-progress",
                                        }),
                                      )
                                    }
                                    className="min-h-11 rounded-lg border border-[#d6dfd9] px-4 text-xs font-black text-[#4a5952] disabled:opacity-60"
                                  >
                                    Trả lại yêu cầu làm thêm
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-[#849089]">Đang chờ quản lý hoặc giám đốc khác xác nhận.</p>
                              )
                            ) : null}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Đổi phạm vi</p>
            <h2 className="mt-2 text-xl font-black text-[#20342c]" data-chi="doi-pham-vi" data-chi-loi="Quản lý gửi đề nghị đổi ngân sách, ngày hay phạm vi; giám đốc duyệt hoặc từ chối ngay tại đây.">Yêu cầu đổi ngân sách / hạn / phạm vi</h2>

            {canRequestChange ? (
              <form
                className="mt-4 space-y-2"
                onSubmit={(formEvent) => {
                  formEvent.preventDefault();
                  const form = formEvent.currentTarget;
                  const data = new FormData(form);
                  const kind = String(data.get("kind"));
                  runAction("submit-change", () =>
                    submitProjectChangeRequestAction({
                      siteId: site.id,
                      kind,
                      summary: String(data.get("summary") ?? ""),
                      proposedBudgetBillion:
                        kind === "budget" ? Number(data.get("proposedBudgetBillion")) : undefined,
                      proposedEventDate: kind === "deadline" ? String(data.get("proposedEventDate")) : undefined,
                      note: String(data.get("note") ?? ""),
                    }),
                  ).then(() => form.reset());
                }}
              >
                <select name="kind" className="min-h-11 w-full rounded-lg border border-[#ced8d1] bg-white px-2 text-sm">
                  <option value="budget">Đổi ngân sách</option>
                  <option value="deadline">Đổi ngày tổ chức</option>
                  <option value="scope">Đổi phạm vi</option>
                </select>
                <input name="summary" required placeholder="Tóm tắt yêu cầu" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-sm" />
                <input name="proposedBudgetBillion" type="number" step="0.1" placeholder="Ngân sách đề xuất (tỷ)" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-sm" />
                <input name="proposedEventDate" type="date" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-sm" />
                <textarea name="note" rows={2} placeholder="Ghi chú thêm" className="w-full rounded-lg border border-[#ced8d1] p-2 text-sm" />
                <button type="submit" disabled={pendingKey === "submit-change"} className="min-h-11 w-full rounded-lg bg-[#183f34] text-sm font-black text-white disabled:opacity-60">
                  Gửi yêu cầu
                </button>
              </form>
            ) : null}

            <ul className="mt-4 space-y-2">
              {changeRequests.map((request) => (
                <li key={request.id} className="rounded-lg border border-[#e0e6e2] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-[#30443b]">{request.summary}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-black ${
                        request.status === "pending"
                          ? "bg-[#fff0ce] text-[#77531c]"
                          : request.status === "approved"
                            ? "bg-[#dff1e8] text-[#246249]"
                            : "bg-[#ffe4de] text-[#934336]"
                      }`}
                    >
                      {request.status === "pending" ? "Chờ duyệt" : request.status === "approved" ? "Đã duyệt" : "Từ chối"}
                    </span>
                  </div>
                  <p className="mt-1 text-[#7b8881]">Gửi bởi {request.requestedByName}</p>
                  {request.status === "pending" && canDecideChange ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={pendingKey === `decide-${request.id}`}
                        onClick={() =>
                          runAction(`decide-${request.id}`, () =>
                            decideProjectChangeRequestAction({
                              siteId: site.id,
                              changeRequestId: request.id,
                              decision: "approved",
                            }),
                          )
                        }
                        className="min-h-8 rounded-md bg-[#183f34] px-3 text-xs font-black text-white disabled:opacity-60"
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        disabled={pendingKey === `decide-${request.id}`}
                        onClick={() =>
                          runAction(`decide-${request.id}`, () =>
                            decideProjectChangeRequestAction({
                              siteId: site.id,
                              changeRequestId: request.id,
                              decision: "rejected",
                            }),
                          )
                        }
                        className="min-h-8 rounded-md border border-[#d6dfd9] px-3 text-xs font-black text-[#4a5952] disabled:opacity-60"
                      >
                        Từ chối
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {changeRequests.length === 0 ? <li className="text-xs text-[#849089]">Chưa có yêu cầu nào.</li> : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Quyết toán</p>
            <h2 className="mt-2 text-xl font-black text-[#20342c]">Chi phí thực tế</h2>

            {canSettle && settleableItems.length > 0 ? (
              <div className="mt-4 space-y-3">
                {settleableItems.map((item) => (
                  <form
                    key={item.code}
                    className="space-y-2 rounded-lg border border-[#e0e6e2] p-3"
                    onSubmit={(formEvent) => {
                      formEvent.preventDefault();
                      const form = formEvent.currentTarget;
                      const data = new FormData(form);
                      runAction(`settle-${item.code}`, () =>
                        recordProjectSettlementAction({
                          siteId: site.id,
                          workItemCode: item.code,
                          amountBillion: Number(data.get("amountBillion")),
                          note: String(data.get("note") ?? ""),
                          financeCode: String(data.get("financeCode") ?? ""),
                        }),
                      ).then(() => form.reset());
                    }}
                  >
                    <p className="text-xs font-black text-[#30443b]">{item.code} · {item.title}</p>
                    <div className="flex gap-2">
                      <input name="amountBillion" type="number" step="0.01" required placeholder="Số tiền (tỷ)" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-xs" />
                      <input name="financeCode" required placeholder="Mã hạch toán" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-xs" />
                    </div>
                    <input name="note" required placeholder="Ghi chú" className="min-h-11 w-full rounded-lg border border-[#ced8d1] px-2 text-xs" />
                    <button type="submit" disabled={pendingKey === `settle-${item.code}`} className="min-h-11 w-full rounded-lg bg-[#183f34] text-xs font-black text-white disabled:opacity-60">
                      Ghi nhận quyết toán
                    </button>
                  </form>
                ))}
              </div>
            ) : null}

            <ul className="mt-4 space-y-2">
              {settlements.map((settlement) => (
                <li key={settlement.id} className="rounded-lg bg-[#f3f6f4] p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-black text-[#30443b]">{settlement.workItemCode}</span>
                    <span className="font-black text-[#2d735b]">{formatBillion(settlement.amountBillion)}</span>
                  </div>
                  <p className="mt-1 text-[#7b8881]">{settlement.financeCode} · {settlement.recordedByName}</p>
                </li>
              ))}
              {settlements.length === 0 ? <li className="text-xs text-[#849089]">Chưa có quyết toán nào.</li> : null}
            </ul>
          </section>
        </aside>
      </section>
    </div>
  );
}
