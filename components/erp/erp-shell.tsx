import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ERP_MODULES,
  ERP_ROLE_LABELS,
  type ErpSite,
} from "@/domain/erp";
import {
  getRegistryAccount,
  hasSystemAdmin,
} from "@/lib/erp/account-registry-repository";
import { isRoleSwitchEnabled, type CurrentErpUser } from "@/lib/erp/demo-session";
import { listRoleSwitchTargets } from "@/lib/erp/staff-directory";
import { logoutErpAction } from "@/app/erp/actions";
import { ErpAppControls } from "./erp-app-controls";
import { ErpDesktopNavigation } from "./erp-desktop-navigation";
import { RoleSwitchBanner } from "./role-switch-banner";
import { RoleSwitchControl } from "./role-switch-control";
import { VoiceCommandCenter } from "./voice-command-center";
import { ErpMobileMenu } from "./erp-mobile-menu";

type Props = {
  user: CurrentErpUser;
  site?: ErpSite;
  activeModuleId?: string;
  children: ReactNode;
};

export async function ErpShell({ user, site, activeModuleId, children }: Props) {
  // T6/T7: the account-administration entry point appears only for the
  // `system-admin` grant, which is a separate power from being the director.
  const systemAdmin = hasSystemAdmin(await getRegistryAccount(user.id));
  const visibleModules = site
    ? ERP_MODULES.filter((module) =>
        (user.moduleIdsBySite[site.id] ?? []).includes(module.id),
      )
    : [];

  // T4: the switcher stays reachable while impersonating, so a director can
  // hop straight from one role to the next instead of returning to their own
  // account between every comparison. `user.actingAs` proves the real owner is
  // a director even though `user.role` currently reports the target's role.
  const roleSwitchAvailable =
    isRoleSwitchEnabled() && (user.role === "director" || Boolean(user.actingAs));

  // T14b: danh sách xem thử đọc từ registry, nên tài khoản giám đốc vừa tạo
  // xuất hiện ngay. Chỉ đọc khi tính năng thật sự bật — mọi trang ERP đều dựng
  // qua shell này, không nên thêm một truy vấn cho mọi người dùng.
  const roleSwitchTargets = roleSwitchAvailable
    ? await listRoleSwitchTargets(user.actingAs ? user.id : undefined)
    : [];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f2f4f1] text-[#17231f]">
      <header className="sticky top-0 z-40 border-b border-[#dce2dd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <ErpMobileMenu
              name={user.name}
              jobTitle={user.jobTitle}
              role={user.role}
              siteIds={user.siteIds}
              currentSiteId={site?.id}
              modules={visibleModules}
              roleSwitchEnabled={roleSwitchAvailable}
              roleSwitchTargets={roleSwitchTargets}
              actingAsUserId={user.actingAs ? user.id : undefined}
            />
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
            {/* T15: mọi vai trò đều vào được — phạm vi nhìn do máy chủ cắt,
                nên nhân viên vào chỉ thấy việc của chính mình. Giấu lối vào
                với một số người sẽ khiến nhật ký trông như đặc quyền, trong
                khi mục đích của nó là ai cũng kiểm tra được việc của mình. */}
            <Link
              href="/erp/nhat-ky"
              className="hidden min-h-10 items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
            >
              Nhật ký
            </Link>
            {user.role === "director" ? (
              <Link
                href="/erp/khach-hang"
                className="hidden min-h-10 items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
              >
                Khách hàng
              </Link>
            ) : null}
            {user.role === "director" ? (
              <Link
                href="/erp/marketing"
                className="hidden min-h-10 items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
              >
                Marketing
              </Link>
            ) : null}
            {systemAdmin ? (
              <Link
                href="/erp/tai-khoan"
                className="hidden min-h-10 items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
              >
                Tài khoản
              </Link>
            ) : null}
            {roleSwitchAvailable ? (
              <div className="hidden lg:block">
                <RoleSwitchControl
                  currentUserId={user.actingAs ? user.id : undefined}
                  targets={roleSwitchTargets}
                />
              </div>
            ) : null}
            <Link
              href={`/erp/ho-so/${user.id}`}
              className="hidden text-right md:block"
            >
              <p className="text-sm font-bold text-[#25352f] hover:underline">{user.name}</p>
              <p className="text-xs text-[#738078]">
                {ERP_ROLE_LABELS[user.role]} · {user.jobTitle}
              </p>
            </Link>
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

      <RoleSwitchBanner user={user} />

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
