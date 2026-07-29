import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import { ExecutiveDashboard } from "@/components/erp/executive-dashboard";
import { RoleHomeDashboard } from "@/components/erp/role-home-dashboard";
import { getAccessState, getCurrentErpUser } from "@/lib/erp/demo-session";
import { listAccountingJournals } from "@/lib/erp/accounting-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listWorkdays, vietnamDateKey } from "@/lib/erp/workday-repository";
import {
  listWorkdayEmployeeOptions,
  listWorkdaysForUser,
} from "@/lib/erp/workday-view";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpHomePage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  const shouldReadAccounting =
    user.role === "director" ||
    user.role === "accountant" ||
    user.role === "chief-accountant";
  const [access, shiftClosures, workdays, journals] = await Promise.all([
    getAccessState(),
    listShiftClosures({ siteIds: user.siteIds }),
    user.role === "director"
      ? listWorkdays({
          siteIds: user.siteIds,
          businessDate: vietnamDateKey(),
          limit: 100,
        })
      : listWorkdaysForUser(user),
    shouldReadAccounting
      ? listAccountingJournals({ siteIds: user.siteIds, limit: 100 })
      : Promise.resolve([]),
  ]);
  const params = (await searchParams) ?? {};
  const denied = Array.isArray(params.denied)
    ? params.denied[0]
    : params.denied;
  const visibleSites = ERP_SITES.filter((site) =>
    user.siteIds.includes(site.id),
  );

  return (
    <ErpShell user={user}>
      {denied ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-[#eccac2] bg-[#fff2ef] px-4 py-3 text-sm font-bold text-[#8b3d31]"
        >
          Bạn chưa được phân công vào cơ sở hoặc nghiệp vụ này.
        </p>
      ) : null}

      {user.role === "director" ? (
        <ExecutiveDashboard
          user={user}
          sites={visibleSites}
          records={shiftClosures}
          workdays={workdays}
          journals={journals}
        />
      ) : (
        <RoleHomeDashboard
          user={user}
          sites={visibleSites}
          records={shiftClosures}
          workdays={workdays}
          journals={journals}
          workdayEmployees={
            user.role === "manager"
              ? listWorkdayEmployeeOptions(access, user.siteIds)
              : []
          }
        />
      )}
    </ErpShell>
  );
}
