import Link from "next/link";
import { switchDemoRoleAction } from "@/app/erp/actions";
import {
  BAN_DO_CHUC_NANG,
  chonTaiKhoanMau,
  duongDanChucNang,
} from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import type { EmployeeAccess } from "@/lib/erp/staff-access-repository";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

/**
 * Bản đồ mọi chức năng trên trang đầu của giám đốc.
 *
 * Việc của giám đốc: bấm "Mở" là tới thẳng. Việc của vai khác: "Làm thử như
 * Nhân viên" chuyển sang một tài khoản đúng vai ở Tràng An và đưa tới đúng
 * màn hình ấy; thanh trên cùng luôn có nút quay về giám đốc.
 */

export function BanDoChucNangPanel({
  targets,
  quyen,
  chuyenVaiDuoc,
}: {
  targets: readonly ErpStaffDirectoryEntry[];
  quyen: Record<string, EmployeeAccess>;
  chuyenVaiDuoc: boolean;
}) {
  const tong = BAN_DO_CHUC_NANG.reduce((n, nhom) => n + nhom.chucNang.length, 0);
  return (
    <details data-testid="ban-do-chuc-nang" className="mb-6 rounded-2xl border border-[#dfe4dc] bg-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
        <span>
          <span className="block font-black text-[#20342c]">Bản đồ mọi chức năng</span>
          <span className="block text-sm text-[#5f7068]">
            {tong} việc hệ thống làm được, việc nào của ai. Bấm một chạm là làm thử đúng vai.
          </span>
        </span>
        <span aria-hidden="true" className="text-[#93a199]">▾</span>
      </summary>
      <div className="border-t border-[#e7ebe6] px-5 pb-5">
        {BAN_DO_CHUC_NANG.map((nhom) => (
          <section key={nhom.id} className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#718078]">{nhom.ten}</h3>
            <ul className="mt-2 divide-y divide-[#eef1ed]">
              {nhom.chucNang.map((cn) => {
                const duongDan = duongDanChucNang(cn);
                const mau = cn.vai === "director" ? null : chonTaiKhoanMau(targets, quyen, cn.vai, duongDan);
                return (
                  <li key={cn.id} data-chuc-nang={cn.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-[#20342c]">{cn.ten}</p>
                      <p className="text-sm text-[#5f7068]">
                        {cn.moTa} <span className="font-bold text-[#35594b]">· {ERP_ROLE_LABELS[cn.vai]}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={duongDan}
                        className="inline-flex min-h-11 items-center rounded-xl border border-[#ced8d1] px-4 text-sm font-bold text-[#35594b]"
                      >
                        {cn.vai === "director" ? "Mở" : "Xem"}
                      </Link>
                      {cn.vai !== "director" && chuyenVaiDuoc && mau ? (
                        <form action={switchDemoRoleAction}>
                          <input type="hidden" name="targetUserId" value={mau.accountId} />
                          <input type="hidden" name="next" value={duongDan} />
                          <button
                            type="submit"
                            className="inline-flex min-h-11 items-center rounded-xl bg-[#183f34] px-4 text-sm font-bold text-white"
                          >
                            Làm thử như {ERP_ROLE_LABELS[cn.vai]}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
