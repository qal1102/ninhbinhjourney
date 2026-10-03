import Link from "next/link";
import { updateEmployeeAccessAction } from "@/app/erp/actions";
import { ERP_MODULES, type ErpSite } from "@/domain/erp";
import { ERP_EMPLOYEE_BASE_MODULE_IDS } from "@/domain/quyen-hieu-luc";
import type {
  AttendanceEvent,
  CurrentErpUser,
  ErpAccessState,
} from "@/lib/erp/demo-session";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  access: ErpAccessState;
  attendance: AttendanceEvent[];
  /**
   * T14b: danh bạ đọc từ registry thay cho `DEMO_ERP_ACCOUNTS`. Trước đây một
   * người do giám đốc tạo trên `/erp/tai-khoan` đăng nhập được nhưng **không
   * hiện ra ở màn hình này**, tức là tuyển xong không phân được việc.
   */
  directory: readonly ErpStaffDirectoryEntry[];
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

export function StaffAccessManager({
  site,
  user,
  access,
  attendance,
  directory,
}: Props) {
  const nameByAccountId = new Map(
    directory.map((entry) => [entry.accountId, entry.displayName]),
  );
  // Ai thuộc cơ sở nào do màn Tài khoản & phân quyền quyết (sổ tài khoản),
  // không do màn này. Trước 28/09 ở đây còn một ô "cho phép làm việc ở cơ sở"
  // riêng, tức là một nguồn thứ hai nói khác về cùng một người.
  const employees = directory.filter(
    (entry) => entry.role === "employee" && entry.siteIds.includes(site.id),
  );
  const siteManagers = directory.filter(
    (entry) => entry.role === "manager" && entry.siteIds.includes(site.id),
  );

  return (
    <div className="space-y-5">
      {siteManagers.length > 0 ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Quản lý phụ trách</p>
          <ul className="mt-2 space-y-1 text-sm text-[#43574e]">
            {siteManagers.map((manager) => (
              <li key={manager.accountId}>
                <strong>{manager.displayName}</strong> · {manager.jobTitle} · phụ trách mọi việc ở {site.shortName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Phân công & quyền xem</p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">Đội ngũ {site.shortName}</h2>
          </div>
          <span className="w-fit rounded-full bg-[#e8f1ec] px-3 py-1 text-xs font-black text-[#32614f]">
            {employees.length} nhân viên
          </span>
        </div>
        <p className="mt-2 text-sm text-[#6b7a72]">
          Tích việc cho từng người rồi lưu. Người chưa được giao riêng thì có sẵn
          chấm công và báo cáo hiện trường.{" "}
          {user.role === "director" ? (
            <>
              Thêm người vào {site.shortName} hay chuyển cơ sở ở màn{" "}
              <Link href="/erp/tai-khoan" className="font-bold text-[#286655] underline underline-offset-2">
                Tài khoản & phân quyền
              </Link>
              .
            </>
          ) : (
            <>Thêm người hay chuyển cơ sở do giám đốc làm ở màn Tài khoản & phân quyền.</>
          )}
        </p>

        <div className="mt-6 space-y-3">
          {employees.map((employee) => {
            const daGiao = access.employees[employee.accountId]?.moduleIdsBySite[site.id];
            // Ô tích hiện đúng việc người ấy đang mở được: việc đã giao, hoặc
            // bộ cơ bản khi chưa ai giao riêng (cùng luật với lúc đăng nhập).
            const selectedModules = daGiao ?? [...ERP_EMPLOYEE_BASE_MODULE_IDS];
            const latestAttendance = attendance
              .filter((event) => event.userId === employee.accountId && event.siteId === site.id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const locked = !employee.active;
            // Danh sách module được phép tích do danh bạ quyết định: hồ sơ đào
            // tạo nếu có, còn không thì mọi module giao được cho nhân viên.
            const grantable = new Set(employee.grantableModuleIds);
            const assignableModules = ERP_MODULES.filter(
              (module) => module.employeeAssignable && grantable.has(module.id),
            );
            const profile = employee.workforceProfile;

            return (
              <details key={employee.accountId} className="group rounded-xl border border-[#e1e7e3] bg-[#fbfcfb] open:border-[#a9bdb3] open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#293a33]">{employee.displayName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${daGiao ? "bg-[#dcefe7] text-[#236148]" : "bg-[#edf0ee] text-[#6f7b75]"}`}>
                        {!employee.active ? "Đang khoá" : daGiao ? `${selectedModules.length} việc được giao` : "Bộ việc cơ bản"}
                      </span>
                      {profile ? <span className={`rounded-full px-2 py-0.5 text-xs font-black ${profile.employmentType === "seasonal" ? "bg-[#fff0ce] text-[#77531c]" : "bg-[#e8edf5] text-[#49617d]"}`}>{profile.employmentType === "seasonal" ? "Thời vụ" : "Chính thức"}</span> : null}
                    </div>
                    <p className="mt-1 break-words text-sm text-[#75817b] sm:truncate">{employee.jobTitle} · {employee.email ?? employee.username ?? employee.accountId}</p>
                    {profile ? <p className="mt-1 text-xs text-[#8a958f]">{profile.primaryStation} · Ca {profile.shiftLabel}{profile.accessEndsAt ? ` · Quyền đến ${formatDate(profile.accessEndsAt)}` : ""}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-[#586961]">{latestAttendance?.type === "check-in" ? "Đang trong ca" : "Ngoài ca"}</p>
                    <p className="mt-1 text-xs text-[#8a958f]">{latestAttendance ? formatTime(latestAttendance.createdAt) : "Chưa chấm công"}</p>
                  </div>
                </summary>
                <form action={updateEmployeeAccessAction} className="border-t border-[#e5eae7] p-4 sm:p-5">
                  <input type="hidden" name="siteId" value={site.id} />
                  <input type="hidden" name="employeeId" value={employee.accountId} />
                  <input type="hidden" name="siteActive" value="on" />
                  <fieldset disabled={locked}>
                    <legend className="text-xs font-black uppercase tracking-[0.16em] text-[#718078]">Nghiệp vụ được giao</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {assignableModules.map((module) => (
                        <label key={module.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#e0e6e2] px-3 py-2 text-sm font-bold text-[#52635b]">
                          <input type="checkbox" name="moduleIds" value={module.id} defaultChecked={selectedModules.includes(module.id)} disabled={locked} className="h-4 w-4 accent-[#286655]" />
                          {module.shortName}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-[#7c8882]">
                      {employee.hasTrainingRecord
                        ? "Chỉ hiện nghiệp vụ người này đã được đào tạo; thay đổi được ghi vào nhật ký."
                        : "Tài khoản này chưa có hồ sơ đào tạo, nên đang hiện mọi nghiệp vụ giao được cho nhân viên — người giao tự chịu trách nhiệm. Thay đổi được ghi vào nhật ký."}
                    </p>
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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#477565]">Nhật ký</p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">Thay đổi quyền gần đây</h2>
        <ol className="mt-4 divide-y divide-[#e5eae7]">
          {access.audit.filter((event) => event.siteId === site.id).slice(-6).reverse().map((event) => {
            const targetName = nameByAccountId.get(event.targetId);
            return (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <p><strong>{targetName ?? event.targetId}</strong> · {event.action === "employee.site.revoked" ? "thu hồi quyền ở cơ sở" : "đổi việc được giao"}</p>
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
