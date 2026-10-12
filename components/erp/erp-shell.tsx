import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  ERP_MODULES,
  ERP_ROLE_LABELS,
  ERP_SITES,
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
import { NutQuayLaiApp } from "@/components/shared/nut-quay-lai-app";
import { ChiDiem } from "@/components/shared/chi-diem";
import { BAN_DO_CHUC_NANG, CHUC_NANG_MOI } from "@/domain/ban-do-chuc-nang";
import { BangLenh, type MucBangLenh } from "./bang-lenh";

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

  const adminLinks = [
    ...(user.role === "director"
      ? [
          { href: "/erp/toan-vung", label: "Toàn vùng", hint: "Khách, tiền, sự cố, dự án của cả bốn cơ sở; bấm cơ sở xem chi tiết" },
          { href: "/erp/khach-hang", label: "Khách hàng", hint: "Hành trình, đơn đặt và gợi ý chăm sóc khách" },
          { href: "/erp/marketing", label: "Kênh khách", hint: "Mã QR và nguồn khách theo từng kênh" },
          { href: "/erp/cong-ty-lu-hanh", label: "Công ty lữ hành", hint: "Vé đoàn theo công ty, ưu đãi theo số đoàn, lịch sử giao dịch" },
          { href: "/erp/dai-ly", label: "Đại lý & hoa hồng", hint: "Đường dẫn giới thiệu, đơn và hoa hồng từng đại lý" },
          { href: "/erp/thuyen", label: "Thuyền trên sông", hint: "Bản đồ sống từng thuyền Tràng An, Tam Cốc" },
          { href: "/erp/future-planning", label: "Future planning", hint: "Lịch lễ hội ba năm tới, công nghệ nên áp dụng" },
          { href: "/erp/bang-gia-quay", label: "Giá vé quầy", hint: "Đặt giá bán tại quầy của bốn cơ sở" },
          { href: "/erp/soat-giay-to", label: "✦ Soát giấy tờ bằng AI", hint: "Chụp hoá đơn, nghiệm thu: AI đọc, báo thiếu, điền sẵn hồ sơ NCC" },
        ]
      : []),
    ...(systemAdmin ? [{ href: "/erp/tai-khoan", label: "Tài khoản", hint: "Người dùng và phân quyền" }] : []),
  ];

  // G2: mục của bảng lệnh Ctrl+K, chỉ gồm màn người này vào được.
  const mucBangLenh: MucBangLenh[] = [
    { id: "trang-dau", nhom: "man", ten: "Trang đầu", phu: "Tổng quan hôm nay", href: "/erp" },
    { id: "viec", nhom: "man", ten: "Việc & ghi chú", phu: "Giao việc, ghi chú bằng giọng nói", href: "/erp/viec" },
    { id: "de-xuat", nhom: "man", ten: "Đề xuất & phê duyệt", phu: "Xin nghỉ, tạm ứng, mua hàng, sửa chữa", href: "/erp/de-xuat" },
    { id: "nhat-ky", nhom: "man", ten: "Nhật ký", phu: "Ai làm gì, lúc nào", href: "/erp/nhat-ky" },
    { id: "soat-giay-to", nhom: "man", ten: "Soát giấy tờ bằng AI", phu: "Chụp hoá đơn, danh sách đoàn", href: "/erp/soat-giay-to" },
    ...(user.role === "director" || user.actingAs
      ? [{ id: "huong-dan", nhom: "man" as const, ten: "Dạo một vòng", phu: "Mọi chức năng, bấm là tới đúng chỗ", href: "/erp/huong-dan" }]
      : []),
    ...adminLinks.map((item) => ({ id: item.href, nhom: "man" as const, ten: item.label.replace(/^✦ /, ""), phu: item.hint, href: item.href })),
    ...user.siteIds.flatMap((siteId) => {
      const coSo = ERP_SITES.find((s) => s.id === siteId);
      if (!coSo) return [];
      return ERP_MODULES.filter((module) => (user.moduleIdsBySite[siteId] ?? []).includes(module.id)).map((module) => ({
        id: `${siteId}/${module.id}`,
        nhom: "man" as const,
        ten: `${module.name} · ${coSo.shortName}`,
        phu: module.description,
        href: `/erp/${siteId}/${module.id}`,
      }));
    }),
    ...(user.role === "director" || user.actingAs
      ? BAN_DO_CHUC_NANG.flatMap((nhom) =>
          nhom.chucNang.map((cn) => ({
            id: `cn-${cn.id}`,
            nhom: "chuc-nang" as const,
            ten: cn.ten,
            phu: `${nhom.ten} · ${cn.moTa}`,
            href: cn.duongDan.replace("{site}", user.siteIds[0] ?? "trang-an"),
          })),
        )
      : []),
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f2f4f1] text-[#17231f]">
      <header className="sticky top-0 z-40 border-b border-[#dce2dd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          {/* overflow-hidden: chật thì khối này tự cắt, không để nút bên phải đè
              lên chữ (chủ dự án gửi ảnh 12/10/2026). */}
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <NutQuayLaiApp veTrang="/erp" />
            {/* `accountId` + `systemAdmin`: trên máy tính, hồ sơ cá nhân và
                "Tài khoản & phân quyền" nằm ở thanh đầu trang, nhưng cả hai
                đều `hidden` dưới `lg`. Ngăn kéo trước đây không chép chúng
                sang, nên mở ERP bằng điện thoại là hai màn hình ấy biến mất
                hẳn — không một lối nào bấm tới được. */}
            <ErpMobileMenu
              name={user.name}
              jobTitle={user.jobTitle}
              role={user.role}
              accountId={user.id}
              systemAdmin={systemAdmin}
              siteIds={user.siteIds}
              currentSiteId={site?.id}
              modules={visibleModules}
              roleSwitchEnabled={roleSwitchAvailable}
              roleSwitchTargets={roleSwitchTargets}
              actingAsUserId={user.actingAs ? user.id : undefined}
            />
            <Link href="/erp" className="flex min-h-11 min-w-11 shrink-0 items-center gap-2" aria-label="ERP Ninh Bình">
              <Image
                src="/brand/ninh-binh-mark.png"
                alt=""
                width={38}
                height={38}
                className="h-9 w-9 rounded-full object-cover"
              />
              <span className="hidden whitespace-nowrap text-sm font-black tracking-[-0.02em] text-[#183f34] sm:block lg:hidden xl:block">
                NINH BÌNH <span className="hidden font-medium text-[#738078] min-[1700px]:inline">/ ĐIỀU HÀNH</span>
              </span>
            </Link>
            {site ? (
              <>
                <span className="text-[#bdc5c0]">/</span>
                <Link
                  href={`/erp/${site.id}`}
                  className="block min-h-11 min-w-0 truncate whitespace-nowrap py-3 text-sm font-bold leading-5 text-[#34453e] hover:text-[#183f34]"
                >
                  {site.shortName}
                </Link>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <BangLenh muc={mucBangLenh} />
            <ErpAppControls role={user.role} accountId={user.id} />
            {/* ERP-UX-01: trợ lý nay đứng trên thanh đầu trang thay vì nổi đè
                lên nội dung. Xem chú thích trong `voice-command-center.tsx`. */}
            <VoiceCommandCenter role={user.role} siteIds={user.siteIds} currentSiteId={site?.id} />
            {/* T15: mọi vai trò đều vào được — phạm vi nhìn do máy chủ cắt,
                nên nhân viên vào chỉ thấy việc của chính mình. Giấu lối vào
                với một số người sẽ khiến nhật ký trông như đặc quyền, trong
                khi mục đích của nó là ai cũng kiểm tra được việc của mình. */}
            {user.role === "director" || user.actingAs ? (
              <Link
                href="/erp/huong-dan"
                data-testid="nut-thu-chuc-nang"
                className="hidden min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-[#e0b979] bg-[#fff8eb] px-4 text-sm font-bold text-[#7a5520] transition hover:border-[#d58c35] lg:inline-flex"
              >
                Dạo một vòng
                <span className="hidden rounded-full bg-[#d58c35] px-2 py-0.5 text-xs font-black text-white min-[1700px]:inline">
                  {CHUC_NANG_MOI.length} mới
                </span>
              </Link>
            ) : null}
            <Link
              href="/erp/viec"
              data-testid="loi-vao-viec"
              className="hidden min-h-10 items-center whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
            >
              Việc &amp; ghi chú
            </Link>
            {/* Giám đốc đã có Dạo một vòng, Quản trị, Xem theo vai trên thanh: thêm nút nữa là che chữ thương hiệu ở 1440px; giám đốc vào qua Quản trị. */}
            {user.role !== "director" ? (
            <Link
              href="/erp/soat-giay-to"
              data-testid="loi-vao-soat-giay-to"
              className="hidden min-h-10 items-center whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] xl:inline-flex"
            >
              ✦ Soát giấy tờ
            </Link>
            ) : null}
            <Link
              href="/erp/nhat-ky"
              className="hidden min-h-10 items-center whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
            >
              Nhật ký
            </Link>
            <Link
              href="/erp/de-xuat"
              className="hidden min-h-10 items-center whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] lg:inline-flex"
            >
              Đề xuất
            </Link>
            {/* 14/09/2026: bốn công cụ riêng của giám đốc từng đứng thành bốn nút
                ngang hàng; thêm Giá vé quầy và Đề xuất thì cả thanh gãy chữ hai
                dòng ngay ở màn 1440px. Gom vào một menu "Quản trị", chỉ Nhật ký
                và Đề xuất — việc ai cũng dùng — còn đứng riêng. */}
            {adminLinks.length > 0 ? (
              <details className="group relative hidden lg:block">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7]">
                  Quản trị
                  <span aria-hidden="true" className="text-xs transition group-open:rotate-180">▾</span>
                </summary>
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-[#d8e0db] bg-white p-2 shadow-xl">
                  {adminLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl px-3 py-2.5 hover:bg-[#f3f6f4]"
                    >
                      <span className="block text-sm font-black text-[#20342c]">{item.label}</span>
                      <span className="block text-xs text-[#6e7b75]">{item.hint}</span>
                    </Link>
                  ))}
                </div>
              </details>
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
              <p className="whitespace-nowrap text-sm font-bold text-[#25352f] hover:underline">{user.name}</p>
              {/* Dòng chức danh chỉ hiện từ màn rộng: ở 1024px thanh đầu trang của giám đốc hết chỗ. */}
              <p className="hidden whitespace-nowrap text-xs text-[#738078] min-[1366px]:block">
                {ERP_ROLE_LABELS[user.role]} · {user.jobTitle}
              </p>
            </Link>
            <form action={logoutErpAction} className="hidden lg:block">
              <button
                type="submit"
                className="min-h-10 whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7]"
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

      {/* `pb-28`: chừa sẵn chỗ cho nút trợ lý nổi ở góc dưới bên phải. Không
          có khoảng trống này thì thẻ cuối trang bị nút đè lên — đúng lỗi đã
          bắt được bằng ảnh chụp thật hồi ERP-UX-01. */}
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 sm:pb-28 sm:pt-8">
        {children}
      </main>
      {/* Tới từ màn Hướng dẫn (`?chi=`) thì khoanh đúng chỗ cần bấm. Chỉ đọc
          tham số đường dẫn ở trình duyệt, không thêm lượt chờ nào cho khung. */}
      <Suspense fallback={null}>
        <ChiDiem dangChuyenVai={Boolean(user.actingAs)} />
      </Suspense>
    </div>
  );
}
