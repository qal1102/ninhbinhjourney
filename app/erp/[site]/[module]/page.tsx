import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { ModuleContextHelp } from "@/components/erp/module-context-help";
import { ModuleWorkspace } from "@/components/erp/module-workspace";
import { getErpModule, getErpSite } from "@/domain/erp";
import {
  accountCanAccessModule,
  getAccessState,
  getAttendanceState,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import {
  listWorkdayEmployeeOptions,
  listWorkdaysForUser,
} from "@/lib/erp/workday-view";

type Props = {
  params: Promise<{ site: string; module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpModulePage({ params, searchParams }: Props) {
  const { site: siteId, module: moduleId } = await params;
  const site = getErpSite(siteId);
  const moduleDefinition = getErpModule(moduleId);
  if (!site || !moduleDefinition) notFound();
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (!accountCanAccessModule(user, site.id, moduleDefinition.id)) {
    redirect(`/erp/${site.id}?denied=module`);
  }
  const [access, attendance, shiftClosures, workdays] = await Promise.all([
    getAccessState(),
    getAttendanceState(),
    listShiftClosures({ siteIds: [site.id] }),
    listWorkdaysForUser(user, [site.id]),
  ]);
  const query = (await searchParams) ?? {};
  const requestedCamera = Array.isArray(query.camera) ? query.camera[0] : query.camera;

  return (
    <ErpShell user={user} site={site} activeModuleId={moduleDefinition.id}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#668078]">
            <Link href={`/erp/${site.id}`} className="hover:text-[#183f34]">{site.shortName}</Link>
            <span>/</span>
            <span>{moduleDefinition.shortName}</span>
          </div>
          <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-6xl">{moduleDefinition.name}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">{moduleDefinition.description}</p>
        </div>
        <ModuleContextHelp
          module={moduleDefinition}
          role={user.role}
          site={site}
        />
      </div>
      <ModuleWorkspace
        site={site}
        module={moduleDefinition}
        user={user}
        access={access}
        attendance={attendance.events}
        shiftClosures={shiftClosures}
        workdays={workdays}
        workdayEmployees={
          user.role === "manager"
            ? listWorkdayEmployeeOptions(access, [site.id])
            : []
        }
        initialCameraId={requestedCamera}
      />
    </ErpShell>
  );
}
