import { updateEmployeeAccessAction } from "@/app/erp/actions";
import { ERP_MODULES, ERP_SITES, type ErpSite } from "@/domain/erp";
import {
  getEmployeeAssignableModuleIds,
  isDemoErpAccountActive,
  listDemoEmployees,
} from "@/lib/erp/demo-data";
import type {
  AttendanceEvent,
  CurrentErpUser,
  ErpAccessState,
} from "@/lib/erp/demo-session";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  access: ErpAccessState;
  attendance: AttendanceEvent[];
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function StaffAccessManager({ site, user, access, attendance }: Props) {
  const employees = listDemoEmployees().filter((employee) => {
    const assignedSites = access.employees[employee.id]?.siteIds ?? [];
    if (user.role === "director") return true;
    return assignedSites.length === 0 || assignedSites.includes(site.id);
  });
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Phân công & quyền xem</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">Đội ngũ {site.shortName}</h2>
          </div>
          <span className="w-fit rounded-full bg-[#e8f1ec] px-3 py-1 text-xs font-black text-[#32614f]">
            {employees.filter((employee) => access.employees[employee.id]?.siteIds.includes(site.id)).length} người được gán
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {employees.map((employee) => {
            const employeeAccess = access.employees[employee.id] ?? { siteIds: [], moduleIdsBySite: {} };
            const assignedHere = employeeAccess.siteIds.includes(site.id);
            const assignedElsewhere = employeeAccess.siteIds.find((id) => id !== site.id);
            const selectedModules = employeeAccess.moduleIdsBySite[site.id] ?? [];
            const latestAttendance = attendance
              .filter((event) => event.userId === employee.id && event.siteId === site.id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const otherSite = assignedElsewhere ? ERP_SITES.find((candidate) => candidate.id === assignedElsewhere) : null;
            const active = isDemoErpAccountActive(employee);
            const locked = !active || Boolean(assignedElsewhere && user.role !== "director");
            const trainedModules = new Set(getEmployeeAssignableModuleIds(employee));
            const assignableModules = ERP_MODULES.filter(
              (module) => module.employeeAssignable && trainedModules.has(module.id),
            );
            const profile = employee.workforceProfile;

            return (
              <details key={employee.id} className="group rounded-xl border border-[#e1e7e3] bg-[#fbfcfb] open:border-[#a9bdb3] open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#293a33]">{employee.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${assignedHere ? "bg-[#dcefe7] text-[#236148]" : "bg-[#edf0ee] text-[#6f7b75]"}`}>
                        {assignedHere ? "Đã phân công" : otherSite ? `Thuộc ${otherSite.shortName}` : "Chưa phân công"}
                      </span>
                      {profile ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${profile.employmentType === "seasonal" ? "bg-[#fff0ce] text-[#77531c]" : "bg-[#e8edf5] text-[#49617d]"}`}>{profile.employmentType === "seasonal" ? "Thời vụ" : "Chính thức"}</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[#75817b]">{employee.jobTitle} · {employee.username}</p>
                    {profile ? <p className="mt-1 text-xs text-[#8a958f]">{profile.primaryStation} · Ca {profile.shiftLabel}{profile.accessEndsAt ? ` · Quyền đến ${formatDate(profile.accessEndsAt)}` : ""}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-[#586961]">{latestAttendance?.type === "check-in" ? "Đang trong ca" : "Ngoài ca"}</p>
                    <p className="mt-1 text-xs text-[#8a958f]">{latestAttendance ? formatTime(latestAttendance.createdAt) : "Chưa chấm công"}</p>
                  </div>
                </summary>
                <form action={updateEmployeeAccessAction} className="border-t border-[#e5eae7] p-4 sm:p-5">
                  <input type="hidden" name="siteId" value={site.id} />
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <label className="flex items-center gap-3 rounded-xl bg-[#f2f6f3] p-3 text-sm font-black text-[#34473f]">
                    <input type="checkbox" name="siteActive" defaultChecked={assignedHere} disabled={locked} className="h-4 w-4 accent-[#286655]" />
                    Cho phép nhân viên làm việc và xem {site.shortName}
                  </label>
                  <fieldset disabled={locked} className="mt-4">
                    <legend className="text-xs font-black uppercase tracking-[0.16em] text-[#718078]">Nghiệp vụ được giao</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {assignableModules.map((module) => (
                        <label key={module.id} className="flex items-center gap-3 rounded-lg border border-[#e0e6e2] px-3 py-2.5 text-sm font-bold text-[#52635b]">
                          <input type="checkbox" name="moduleIds" value={module.id} defaultChecked={selectedModules.includes(module.id)} disabled={locked} className="h-4 w-4 accent-[#286655]" />
                          {module.shortName}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-[#7c8882]">Chỉ hiện nghiệp vụ người này đã được đào tạo; thay đổi được ghi vào nhật ký.</p>
                    <button type="submit" disabled={locked} className="min-h-10 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      Lưu phân công
                    </button>
                  </div>
                </form>
              </details>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Audit log</p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">Thay đổi quyền gần đây</h2>
        <ol className="mt-4 divide-y divide-[#e5eae7]">
          {access.audit.filter((event) => event.siteId === site.id).slice(-6).reverse().map((event) => {
            const target = listDemoEmployees().find((employee) => employee.id === event.targetId);
            return (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <p><strong>{target?.name ?? event.targetId}</strong> · {event.action === "employee.site.revoked" ? "thu hồi quyền cơ sở" : "cập nhật module"}</p>
                <time className="shrink-0 text-xs text-[#7d8983]">{new Date(event.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
              </li>
            );
          })}
          {access.audit.filter((event) => event.siteId === site.id).length === 0 ? (
            <li className="py-6 text-sm text-[#7c8882]">Chưa có thay đổi phân công gần đây.</li>
          ) : null}
        </ol>
      </section>
    </div>
  );
}
