import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ERP_MODULES, getErpSite } from "@/domain/erp";
import { ErpShell } from "@/components/erp/erp-shell";
import {
  accountCanAccessSite,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";

type Props = {
  params: Promise<{ site: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpSitePage({ params, searchParams }: Props) {
  const { site: siteId } = await params;
  const site = getErpSite(siteId);
  if (!site) notFound();
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (!accountCanAccessSite(user, site.id)) redirect("/erp?denied=site");
  const query = (await searchParams) ?? {};
  const denied = Array.isArray(query.denied) ? query.denied[0] : query.denied;
  const moduleIds = user.moduleIdsBySite[site.id] ?? [];
  const modules = ERP_MODULES.filter((module) => moduleIds.includes(module.id));
  const directorPriority = new Set(["tai-chinh-doi-soat", "camera-ai", "bao-cao-hien-truong", "du-an-su-kien", "bao-cao", "suc-chua", "su-co", "sop-dien-tap"]);
  const primaryModules = user.role === "director" ? modules.filter((module) => directorPriority.has(module.id)) : modules;
  const secondaryModules = user.role === "director" ? modules.filter((module) => !directorPriority.has(module.id)) : [];

  return (
    <ErpShell user={user} site={site}>
      <section className="relative overflow-hidden rounded-3xl bg-[#183f34] text-white">
        <Image src={site.image} alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,52,42,.97),rgba(18,52,42,.68),rgba(18,52,42,.25))]" />
        <div className="relative z-10 p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ddcf]">Tổng quan trong ngày</p>
          <h1 className="font-display mt-3 text-5xl sm:text-7xl">{site.shortName}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{site.summary}</p>
          <div className="mt-7 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Khách dự kiến", site.snapshot.visitors],
              ["Đã check-in", site.snapshot.checkedIn],
              ["Nhân sự trong ca", site.snapshot.employeesOnShift],
              ["Tải hiện tại", `${site.snapshot.capacityPercent}%`],
              ["Sự cố mở", site.snapshot.openIncidents],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/12 bg-black/10 p-3 backdrop-blur-sm">
                <p className="text-[11px] text-white/48">{label}</p>
                <p className="mt-1 text-xl font-black">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {denied === "module" ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#eccac2] bg-[#fff2ef] px-4 py-3 text-sm font-bold text-[#8b3d31]">
          Nghiệp vụ này chưa được mở cho tài khoản của bạn.
        </p>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#477565]">{user.role === "director" ? "Nghiệp vụ ưu tiên" : user.role === "accountant" ? "Hồ sơ nguồn" : "Nghiệp vụ"}</p>
            <h2 className="font-display mt-2 text-3xl text-[#183f34] sm:text-4xl">{user.role === "director" ? "Tài chính, rủi ro và dự án" : user.role === "accountant" ? `Chứng từ phát sinh tại ${site.shortName}` : `Công việc tại ${site.shortName}`}</h2>
          </div>
          <Link href="/erp" className="text-sm font-bold text-[#5e7068] hover:text-[#183f34]">← Đổi cơ sở</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {primaryModules.map((module, index) => (
            <Link
              href={`/erp/${site.id}/${module.id}`}
              key={module.id}
              className="group rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#a8bbb2] hover:shadow-lg hover:shadow-[#24483c]/8"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl text-sm font-black text-white" style={{ backgroundColor: module.accent }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-xl text-[#91a098] transition group-hover:translate-x-1 group-hover:text-[#286655]">→</span>
              </div>
              <h3 className="mt-5 text-lg font-black text-[#24372f]">{module.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#697770]">{module.description}</p>
            </Link>
          ))}
        </div>

        {secondaryModules.length ? (
          <details className="mt-5 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[#34473f]">
              <span>Toàn bộ nghiệp vụ tại {site.shortName}</span>
              <span className="text-sm text-[#74827b]">{secondaryModules.length} mục khác +</span>
            </summary>
            <div className="mt-4 grid gap-3 border-t border-[#e4e9e6] pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {secondaryModules.map((module, index) => (
                <Link key={module.id} href={`/erp/${site.id}/${module.id}`} className="flex items-center gap-3 rounded-xl border border-[#e0e6e2] p-4 transition hover:border-[#a8bbb2] hover:bg-[#f8faf8]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: module.accent }}>{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-black text-[#2f4239]">{module.name}</p><p className="mt-1 truncate text-xs text-[#7a8781]">{module.description}</p></div>
                </Link>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </ErpShell>
  );
}
