"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { logoutErpAction } from "@/app/erp/actions";
import { ERP_SITES, type ErpModule, type ErpRole, type ErpSiteId } from "@/domain/erp";
import { groupVisibleErpModules } from "@/domain/erp-navigation";

type Props = {
  name: string;
  jobTitle: string;
  role: ErpRole;
  siteIds: ErpSiteId[];
  currentSiteId?: ErpSiteId;
  modules: readonly ErpModule[];
};

export function ErpMobileMenu({ name, jobTitle, role, siteIds, currentSiteId, modules }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const visibleSites = ERP_SITES.filter((site) => siteIds.includes(site.id));
  const visibleGroups = groupVisibleErpModules(modules);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Mở menu" className="grid h-10 w-10 place-items-center rounded-xl border border-[#ced8d1] bg-white text-[#385047]">
        <span aria-hidden="true" className="space-y-1"><i className="block h-0.5 w-5 rounded bg-current" /><i className="block h-0.5 w-5 rounded bg-current" /><i className="block h-0.5 w-5 rounded bg-current" /></span>
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[110]">
          <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#071b15]/55" />
          <aside role="dialog" aria-modal="true" aria-label="Menu điều hành" className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col overflow-hidden bg-[#f4f6f3] shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-[#183f34] p-5 text-white">
              <div className="min-w-0"><p className="truncate font-black">{name}</p><p className="mt-1 truncate text-xs text-white/60">{jobTitle}</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xl">×</button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto p-4" aria-label="Điều hướng trên điện thoại">
              <p className="px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">Đi nhanh</p>
              <div className="mt-2 space-y-1">
                <Link href="/erp" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between rounded-xl bg-white px-4 text-sm font-black text-[#294139]">Tổng quan <span>→</span></Link>
                {role === "director" || role === "accountant" ? <Link href="/erp/finance" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black text-[#42574e] hover:bg-white">{role === "accountant" ? "Sổ kế toán & đối soát" : "Tài chính toàn vùng"} <span>→</span></Link> : null}
              </div>

              <p className="mt-6 px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">Cơ sở</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {visibleSites.map((site) => <Link key={site.id} href={`/erp/${site.id}`} onClick={() => setOpen(false)} className={`rounded-xl border px-3 py-3 text-sm font-black ${site.id === currentSiteId ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#dbe2de] bg-white text-[#42574e]"}`}>{site.shortName}</Link>)}
              </div>

              {currentSiteId && modules.length ? (
                <>
                  <p className="mt-6 px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">Nghiệp vụ tại {ERP_SITES.find((site) => site.id === currentSiteId)?.shortName}</p>
                  <div className="mt-2 space-y-3">
                    {visibleGroups.map((group) => (
                      <section key={group.id} className="rounded-xl bg-white p-2">
                        <h3 className="px-2 py-1 text-xs font-black text-[#294139]">
                          {group.name}
                        </h3>
                        {group.modules.map((module) => (
                          <Link
                            key={module.id}
                            href={`/erp/${currentSiteId}/${module.id}`}
                            onClick={() => setOpen(false)}
                            className="flex min-h-11 items-center justify-between rounded-lg px-2 text-sm font-bold text-[#52645c] hover:bg-[#f1f5f2]"
                          >
                            <span>{module.name}</span>
                            <span className="text-[#93a199]">›</span>
                          </Link>
                        ))}
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
            </nav>

            <form action={logoutErpAction} className="border-t border-[#dce3de] p-4">
              <button type="submit" className="min-h-11 w-full rounded-xl border border-[#cfd9d3] bg-white text-sm font-black text-[#4d6057]">Đăng xuất</button>
            </form>
          </aside>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
