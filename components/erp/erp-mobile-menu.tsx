"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type TransitionEvent as ReactTransitionEvent } from "react";
import { createPortal } from "react-dom";
import { logoutErpAction } from "@/app/erp/actions";
import { ERP_SITES, type ErpModule, type ErpRole, type ErpSiteId } from "@/domain/erp";
import { groupVisibleErpModules } from "@/domain/erp-navigation";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
import { RoleSwitchControl } from "./role-switch-control";

type Props = {
  name: string;
  jobTitle: string;
  role: ErpRole;
  siteIds: ErpSiteId[];
  currentSiteId?: ErpSiteId;
  modules: readonly ErpModule[];
  roleSwitchEnabled?: boolean;
  /** T14b: danh sach doc tu registry, truyen xuong vi day la client component. */
  roleSwitchTargets?: readonly ErpStaffDirectoryEntry[];
  /** Account being viewed, when a role switch is already active. */
  actingAsUserId?: string;
};

/*
 * VUOT CANH DE MO/DONG NGAN KEO -- chu du an bao 07/08 "sao khong keo
 * qua phai de dung ma phai nhan vao moi duoc". Nut bam VAN GIU NGUYEN
 * (khong phai ai cung biet vuot canh la mot lua chon), vuot la them vao.
 *
 * BAT BUOC doc truoc khi sua tiep: bai hoc da ghi o
 * REFERENCE_SITE_ANALYSIS.md#alkemy-market -- KHONG BAO GIO dat
 * `touch-action: none` chan cuon cham mot-ngon chi de giu vung tuong tac.
 * Ca hai cu vuot duoi day theo dung mot nguyen tac: doi it nhat
 * `AXIS_LOCK_DEAD_ZONE_PX` di chuyen roi moi QUYET DINH huong (ngang hay
 * doc); neu huong la DOC thi BO CUOC NGAY, khong dung tay vao su kien
 * nao nua trong ca gesture do -- trang/ngan keo cuon doc binh thuong y
 * het khi khong co gesture nao o day ca. Chi preventDefault() sau khi da
 * khoa huong la NGANG.
 */
const LG_BREAKPOINT_QUERY = "(max-width: 1023px)"; // khop voi Tailwind `lg:`
const EDGE_ZONE_PX = 28; // be rong vung mep tinh tu trai man hinh de bat dau vuot-mo
const AXIS_LOCK_DEAD_ZONE_PX = 6; // di chuyen toi thieu truoc khi quyet dinh huong
const OPEN_THRESHOLD_RATIO = 0.3; // vuot qua 30% be rong ngan keo thi mo han
const CLOSE_THRESHOLD_RATIO = 0.3; // vuot qua 30% nguoc lai thi dong han
const DRAWER_WIDTH_PX = 352; // khop voi w-[min(88vw,22rem)] -- 22rem = 352px, dung khi chua do duoc kich thuoc that

type GestureMode = "open" | "close" | null;
type Gesture = {
  active: boolean;
  mode: GestureMode;
  axis: "x" | "y" | null;
  startX: number;
  startY: number;
  widthPx: number;
};

const IDLE_GESTURE: Gesture = { active: false, mode: null, axis: null, startX: 0, startY: 0, widthPx: DRAWER_WIDTH_PX };

export function ErpMobileMenu({
  name,
  jobTitle,
  role,
  siteIds,
  currentSiteId,
  modules,
  roleSwitchEnabled,
  roleSwitchTargets = [],
  actingAsUserId,
}: Props) {
  const [open, setOpen] = useState(false);
  // Ngan keo co dang nam trong DOM khong -- khac `open` o cho no VAN true
  // trong luc dang truot-ra (dong) de animation kip chay het truoc khi go.
  const [visible, setVisible] = useState(false);
  // 0..1, chi khac null trong luc ngon tay dang cham. Dieu khien vi tri
  // ngan keo THEO DUNG NGON TAY; khi tha ra tro ve null va CSS transition
  // (dua theo `open`) tu snap ve dong han hoac mo han.
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(IDLE_GESTURE);

  function openDrawer() {
    setVisible(true);
    setOpen(true);
  }

  function closeDrawer() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  /*
   * DUNG TOUCH EVENTS (touchstart/touchmove/touchend), KHONG DUNG POINTER
   * EVENTS, cho ca hai gesture duoi day -- day la mot phat hien that, do
   * duoc bang thuc nghiem (CDP Input.dispatchTouchEvent + log truc tiep
   * trong trang), khong phai doc tai lieu suong:
   *
   * Chrome quyet dinh mot touchmove co "cancelable" hay khong CHI dua
   * tren viec co ton tai listener `touchmove` non-passive nao tren duong
   * di cua su kien hay khong -- no KHONG tinh listener `pointermove`.
   * Ban dau chi dung `pointermove` (goi `event.preventDefault()` ben
   * trong): move dau tien van toi (cancelable=true), nhung tu move thu
   * hai tro di, moi touchmove den voi `cancelable=false` va KHONG CO
   * pointermove nao duoc phat sinh nua -- trinh duyet da chuyen han sang
   * cuon o luong composite, khong con hoi main thread nua. Da ghi lai
   * chuoi log thuc nghiem trong scratchpad cua phien vá 07/08 lam bang
   * chung. Doi sang lang nghe `touchmove` (khong phai `pointermove`) thi
   * ca 8 su kien deu toi voi cancelable=true, dung nhu ky vong.
   *
   * Nguyen tac an toan (bai hoc REFERENCE_SITE_ANALYSIS.md#alkemy-market)
   * VAN GIU NGUYEN du doi API: doi it nhat `AXIS_LOCK_DEAD_ZONE_PX` di
   * chuyen roi moi quyet dinh huong; neu huong la DOC thi bo cuoc ngay,
   * khong dung tay vao su kien nao nua trong ca gesture do; chi goi
   * `preventDefault()` sau khi da khoa huong la NGANG.
   */

  // --- Vuot tu mep trai man hinh sang PHAI de MO ngan keo. ---
  // Gan tren `window`, KHONG chen mot phan tu moi nao vao DOM: chi doc
  // toa do cua su kien von da noi bot len (khong preventDefault/stopPropagation
  // trong touchstart), nen khong bao gio chan nut "Mo menu" hay bat ky noi
  // dung nao khac dung o mep trai.
  useEffect(() => {
    if (open) return;
    function onStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_ZONE_PX) return;
      if (!window.matchMedia(LG_BREAKPOINT_QUERY).matches) return; // chi man hinh nho, khop voi lg:hidden
      gesture.current = {
        active: true,
        mode: "open",
        axis: null,
        startX: touch.clientX,
        startY: touch.clientY,
        widthPx: DRAWER_WIDTH_PX,
      };
    }
    function onMove(event: TouchEvent) {
      const g = gesture.current;
      if (!g.active || g.mode !== "open") return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_LOCK_DEAD_ZONE_PX) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "y") {
          // Cuon doc that -- bo cuoc ngay, khong dung tay vao gi nua.
          g.active = false;
          return;
        }
        // Vua khoa huong ngang: ngan keo can co mat trong DOM de ve theo
        // ngon tay tu day, truoc ca khi vuot qua nguong mo han.
        setVisible(true);
      }
      if (dx <= 0) return; // chi quan tam vuot sang phai
      if (event.cancelable) event.preventDefault();
      setDragProgress(Math.min(dx / g.widthPx, 1));
    }
    function onEnd(event: TouchEvent) {
      const g = gesture.current;
      if (!g.active || g.mode !== "open") return;
      g.active = false;
      const touch = event.changedTouches[0];
      const dx = touch ? Math.max(0, touch.clientX - g.startX) : 0;
      setDragProgress(null);
      if (dx / g.widthPx > OPEN_THRESHOLD_RATIO) setOpen(true);
      // Khong vuot qua nguong: `open` van false, CSS transition tu keo
      // ngan keo lui ve translateX(-100%) roi `onTransitionEnd` se go no
      // khoi DOM -- xem ham `handleTransitionEnd` ben duoi.
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [open]);

  /*
   * --- Vuot NGAN KEO ĐANG MỞ sang trai de DONG. ---
   *
   * GAN THANG VAO DOM QUA `useEffect`, KHONG QUA JSX PROP
   * (`onTouchMove={...}` tren <aside>). Day la phat hien that thu hai
   * cua phien vá nay: React dai dien (delegate) su kien `touchmove` gan
   * qua JSX tai goc voi `{ passive: true }` de toi uu cuon trang -- goi
   * `event.preventDefault()` ben trong mot handler nhu vay se BI TRINH
   * DUYET BO QUA va in canh bao "Unable to preventDefault inside passive
   * event listener invocation" (da bat duoc canh bao nay that su khi con
   * dung JSX props, truoc khi doi sang cach nay). Gan truc tiep bang
   * `addEventListener(..., { passive: false })` thi khong dinh gioi han
   * do cua React nua.
   *
   * Chay lai moi khi `visible` doi: `aside` chi ton tai trong DOM khi
   * `visible === true` (no nam trong mot portal duoc dieu kien hoa boc
   * ngoai). KHONG phu thuoc `dragProgress`/`open` de tranh go-gan lai
   * lien tuc giua chung mot cu vuot.
   */
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    function onStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      gesture.current = {
        active: true,
        mode: "close",
        axis: null,
        startX: touch.clientX,
        startY: touch.clientY,
        widthPx: aside!.getBoundingClientRect().width || DRAWER_WIDTH_PX,
      };
    }
    function onMove(event: TouchEvent) {
      const g = gesture.current;
      if (!g.active || g.mode !== "close") return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_LOCK_DEAD_ZONE_PX) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "y") {
          // Cuon doc danh sach module -- bo cuoc ngay, khong preventDefault gi ca.
          g.active = false;
          return;
        }
      }
      if (dx >= 0) return; // chi quan tam vuot sang trai
      if (event.cancelable) event.preventDefault();
      setDragProgress(Math.max(1 + dx / g.widthPx, 0));
    }
    function onEnd(event: TouchEvent) {
      const g = gesture.current;
      if (!g.active || g.mode !== "close") return;
      g.active = false;
      const touch = event.changedTouches[0];
      const dx = touch ? Math.min(0, touch.clientX - g.startX) : 0;
      setDragProgress(null);
      if (-dx / g.widthPx > CLOSE_THRESHOLD_RATIO) closeDrawer();
      // Khong vuot qua nguong: `open` van true, CSS transition tu keo
      // ngan keo tro lai translateX(0) -- khong can lam gi them.
    }
    aside.addEventListener("touchstart", onStart, { passive: true });
    aside.addEventListener("touchmove", onMove, { passive: false });
    aside.addEventListener("touchend", onEnd);
    aside.addEventListener("touchcancel", onEnd);
    return () => {
      aside.removeEventListener("touchstart", onStart);
      aside.removeEventListener("touchmove", onMove);
      aside.removeEventListener("touchend", onEnd);
      aside.removeEventListener("touchcancel", onEnd);
    };
  }, [visible]);

  // Chi mot noi go ngan keo khoi DOM, du dong bang nut/backdrop/Escape
  // hay bang vuot: doi dung luc CSS transition cua `transform` chay
  // xong roi moi go, de animation khong bi cat cut.
  function handleTransitionEnd(event: ReactTransitionEvent<HTMLElement>) {
    if (event.propertyName !== "transform") return;
    if (!open) setVisible(false);
  }

  const visibleSites = ERP_SITES.filter((site) => siteIds.includes(site.id));
  const visibleGroups = groupVisibleErpModules(modules);

  const dragging = dragProgress !== null;
  const progress = dragProgress ?? (open ? 1 : 0);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={openDrawer} aria-label="Mở menu" className="grid h-10 w-10 place-items-center rounded-xl border border-[#ced8d1] bg-white text-[#385047]">
        <span aria-hidden="true" className="space-y-1"><i className="block h-0.5 w-5 rounded bg-current" /><i className="block h-0.5 w-5 rounded bg-current" /><i className="block h-0.5 w-5 rounded bg-current" /></span>
      </button>

      {visible && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-[#071b15]"
            style={{ opacity: progress * 0.55, transition: dragging ? "none" : "opacity 260ms ease" }}
          />
          <aside
            ref={asideRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hành"
            onTransitionEnd={handleTransitionEnd}
            // `touch-pan-y`: KHONG chan cuon doc bang tay -- nguoc lai, no
            // noi ro cho trinh duyet biet cuon doc la cu chi mac dinh cua
            // khu vuc nay, de trinh duyet tu xu ly muot hon; JS chi can
            // preventDefault them cho dung nhanh NGANG sau khi da khoa
            // huong. Dung "none" o day se dung lai bai hoc Alkemy Market.
            className="touch-pan-y absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col overflow-hidden bg-[#f4f6f3] shadow-2xl"
            style={{
              transform: `translateX(${(progress - 1) * 100}%)`,
              transition: dragging ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <div className="flex items-start justify-between gap-4 bg-[#183f34] p-5 text-white">
              <div className="min-w-0"><p className="truncate font-black">{name}</p><p className="mt-1 truncate text-xs text-white/60">{jobTitle}</p></div>
              <button type="button" onClick={closeDrawer} aria-label="Đóng" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xl">×</button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto p-4" aria-label="Điều hướng trên điện thoại">
              <p className="px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">Đi nhanh</p>
              <div className="mt-2 space-y-1">
                <Link href="/erp" onClick={closeDrawer} className="flex min-h-11 items-center justify-between rounded-xl bg-white px-4 text-sm font-black text-[#294139]">Tổng quan <span>→</span></Link>
                {role === "director" || role === "accountant" || role === "chief-accountant" ? <Link href="/erp/finance" onClick={closeDrawer} className="flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black text-[#42574e] hover:bg-white">{role === "director" ? "Tài chính toàn vùng" : role === "chief-accountant" ? "Kiểm soát & sổ cái" : "Đối soát & lập bút toán"} <span>→</span></Link> : null}
                {role === "director" ? <Link href="/erp/khach-hang" onClick={closeDrawer} className="flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black text-[#42574e] hover:bg-white">Khách hàng <span>→</span></Link> : null}
                <Link href="/erp/nhat-ky" onClick={closeDrawer} className="flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black text-[#42574e] hover:bg-white">Nhật ký <span>→</span></Link>
              </div>

              <p className="mt-6 px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">Cơ sở</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {visibleSites.map((site) => <Link key={site.id} href={`/erp/${site.id}`} onClick={closeDrawer} className={`rounded-xl border px-3 py-3 text-sm font-black ${site.id === currentSiteId ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#dbe2de] bg-white text-[#42574e]"}`}>{site.shortName}</Link>)}
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
                            onClick={closeDrawer}
                            className="flex min-h-11 items-center justify-between rounded-lg px-2 text-sm font-bold text-[#52645c] hover:bg-[#f1f5f2]"
                          >
                            <span>{module.name}</span>
                            {module.status === "planned" ? (
                              <span className="rounded-full bg-[#f6ecd8] px-2 py-0.5 text-[10px] font-black text-[#8a6b27]">
                                Sau
                              </span>
                            ) : (
                              <span className="text-[#93a199]">›</span>
                            )}
                          </Link>
                        ))}
                      </section>
                    ))}
                  </div>
                </>
              ) : null}

              {/*
                Khối đổi vai trò phải nằm BÊN TRONG <nav> — vùng duy nhất
                cuộn được (`overflow-y-auto`) của ngăn kéo.

                Trước 07/08 nó là một khối riêng kẹp giữa </nav> và form
                đăng xuất, tức nằm ở phần ĐÁY CỐ ĐỊNH. Ngăn kéo lại đặt
                `overflow-hidden`, nên bảng chọn thả xuống tràn khỏi đáy
                rồi bị cắt: đo thật trên production khổ 390×844 thì nút
                "Xem thử" rơi xuống y=940, thò ra ngoài 96px — không nhìn
                thấy, không chạm tới. Đó là lỗi "trên điện thoại không
                switch được".

                Nay: nằm trong vùng cuộn + `variant="inline"` (bảng chọn
                đẩy nội dung xuống thay vì đè lên), nên dù danh sách tài
                khoản dài bao nhiêu vẫn cuộn tới được.
              */}
              {roleSwitchEnabled ? (
                <div className="mt-6 border-t border-[#dce3de] pt-4">
                  <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#718078]">
                    Xem thử theo vai trò
                  </p>
                  <RoleSwitchControl
                    currentUserId={actingAsUserId}
                    targets={roleSwitchTargets}
                    variant="inline"
                  />
                </div>
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
