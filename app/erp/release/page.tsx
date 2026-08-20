import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { getCustomerReleaseReadiness } from "@/lib/customer-data/release-readiness-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export const dynamic = "force-dynamic";

export default async function ErpReleaseReadinessPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director") redirect("/erp?denied=release");

  const report = await getCustomerReleaseReadiness();
  return (
    <ErpShell user={user}>
      <section className="space-y-6" data-testid="customer-release-readiness">
        <div className={`rounded-3xl border p-6 sm:p-8 ${report.safeForCanary ? "border-[#9fc4b5] bg-[#eef7f2]" : "border-[#e1c49a] bg-[#fff8ea]"}`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6c755f]">A6 · Production activation gate · chỉ đọc</p>
          <h1 className="mt-3 text-4xl font-black text-[#263c33] sm:text-5xl">Sẵn sàng phát hành dữ liệu khách hàng</h1>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-[#5f6e67]">Màn hình này không apply migration, không bật flag và không hiển thị secret. Nó chỉ đối chiếu project/origin, hình thức cấu hình, data contract 039–045 và thứ tự dependency trước canary.</p>
          <div className={`mt-5 inline-flex rounded-full px-4 py-2 text-sm font-black ${report.safeForCanary ? "bg-[#27664f] text-white" : "bg-[#8b5428] text-white"}`} data-testid="release-verdict">
            {report.safeForCanary ? "ĐỦ ĐIỀU KIỆN KỸ THUẬT ĐỂ LẬP CANARY" : "CHƯA ĐƯỢC BẬT PRODUCTION"}
          </div>
          <p className="mt-3 text-xs text-[#718078]">Đối chiếu lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(report.generatedAt))}</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-[#dbe3de] bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-black text-[#263c33]">Project, secrets và policy</h2>
            <div className="mt-4 space-y-2">
              {report.environment.map((check) => <div key={check.id} data-testid={`release-environment-${check.id}`} className="flex items-start justify-between gap-4 rounded-xl bg-[#f5f7f5] px-4 py-3 text-sm"><span>{check.label}</span><strong className={check.ready ? "text-[#27664f]" : "text-[#9a4938]"}>{check.ready ? "Sẵn sàng" : "Thiếu / sai"}</strong></div>)}
            </div>
          </article>

          <article className="rounded-3xl border border-[#dbe3de] bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-black text-[#263c33]">Migration data contract</h2>
            <div className="mt-4 space-y-2">
              {report.phases.map((phase) => <div key={phase.id} data-testid={`release-phase-${phase.id}`} className="rounded-xl bg-[#f5f7f5] px-4 py-3 text-sm"><div className="flex items-start justify-between gap-4"><span><strong>{phase.id}</strong> · {phase.label}</span><strong className={phase.status === "ready" ? "text-[#27664f]" : "text-[#9a4938]"}>{phase.status === "ready" ? "Schema sẵn sàng" : phase.status === "unchecked" ? "Chưa probe" : "Thiếu contract"}</strong></div>{phase.missingContracts.length ? <p className="mt-2 break-words text-xs text-[#8a5a43]">Cần kiểm: {phase.missingContracts.join(", ")}</p> : null}<p className="mt-1 text-xs text-[#718078]">{phase.migration}</p></div>)}
            </div>
          </article>
        </div>

        <article className="rounded-3xl border border-[#dbe3de] bg-white p-5 sm:p-6">
          <h2 className="text-2xl font-black text-[#263c33]">Feature flags và dependency</h2>
          <p className="mt-2 text-sm text-[#65736c]">Flag đang tắt là trạng thái bình thường trước canary. Màu đỏ chỉ xuất hiện khi flag đã bật nhưng schema hoặc dependency chưa sẵn sàng.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {report.flags.map((flag) => <div key={flag.name} data-testid={`release-flag-${flag.name}`} className={`rounded-xl border px-4 py-3 text-sm ${flag.enabled && !flag.ready ? "border-[#e5b6a9] bg-[#fff1ed]" : "border-[#e1e7e3] bg-[#f7f9f7]"}`}><div className="flex flex-wrap items-center justify-between gap-2"><code className="font-bold text-[#33483f]">{flag.name}</code><strong>{flag.enabled ? "ON" : "OFF"}</strong></div>{flag.blockers.length ? <p className="mt-2 text-xs text-[#8a5a43]">{flag.blockers.join(" · ")}</p> : <p className="mt-2 text-xs text-[#2f6b53]">Dependency đã sẵn sàng.</p>}</div>)}
          </div>
        </article>
      </section>
    </ErpShell>
  );
}
