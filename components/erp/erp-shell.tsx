import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ERP_MODULES,
  ERP_ROLE_LABELS,
  type ErpSite,
} from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { logoutErpAction } from "@/app/erp/actions";
import { ErpAppControls } from "./erp-app-controls";
import { ErpDesktopNavigation } from "./erp-desktop-navigation";
import { VoiceCommandCenter } from "./voice-command-center";
import { ErpMobileMenu } from "./erp-mobile-menu";

type Props = {
  user: CurrentErpUser;
  site?: ErpSite;
  activeModuleId?: string;
  children: ReactNode;
};

export function ErpShell({ user, site, activeModuleId, children }: Props) {
  const visibleModules = site
    ? ERP_MODULES.filter((module) =>
        (user.moduleIdsBySite[site.id] ?? []).includes(module.id),
      )
    : [];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f2f4f1] text-[#17231f]">
      <header className="sticky top-0 z-40 border-b border-[#dce2dd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <ErpMobileMenu name={user.name} jobTitle={user.jobTitle} role={user.role} siteIds={user.siteIds} currentSiteId={site?.id} modules={visibleModules} />
            <Link href="/erp" className="flex shrink-0 items-center gap-2" aria-label="ERP Ninh Bình">
              <Image
                src="/brand/ninh-binh-mark.png"
                alt=""
                width={38}
                height={38}
                className="h-9 w-9 rounded-full object-cover"
              />
              <span className="hidden text-sm font-black tracking-[-0.02em] text-[#183f34] sm:block">
                NINH BÌNH <span className="font-medium text-[#738078]">/ ĐIỀU HÀNH</span>
              </span>
            </Link>
            {site ? (
              <>
                <span className="text-[#bdc5c0]">/</span>
                <Link
                  href={`/erp/${site.id}`}
                  className="truncate text-sm font-bold text-[#34453e] hover:text-[#183f34]"
                >
                  {site.shortName}
                </Link>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ErpAppControls role={user.role} />
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-[#25352f]">{user.name}</p>
              <p className="text-xs text-[#738078]">
                {ERP_ROLE_LABELS[user.role]} · {user.jobTitle}
              </p>
            </div>
            <form action={logoutErpAction} className="hidden lg:block">
              <button
                type="submit"
                className="min-h-10 rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7]"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>

      {site ? (
        <ErpDesktopNavigation
          site={site}
          modules={visibleModules}
          activeModuleId={activeModuleId}
        />
      ) : null}

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <VoiceCommandCenter role={user.role} siteIds={user.siteIds} currentSiteId={site?.id} />
    </div>
  );
}
