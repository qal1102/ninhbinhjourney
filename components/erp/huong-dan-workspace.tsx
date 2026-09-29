import Link from "next/link";
import { switchDemoRoleAction } from "@/app/erp/actions";
import { BAN_DO_CHUC_NANG, chonTaiKhoanMau, duongDanChucNang } from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import { duongDenBuoc, duongDenChucNang, TONG_VIEC_TRA_CUU, VONG_KHACH } from "@/domain/huong-dan";
import type { EmployeeAccess } from "@/lib/erp/staff-access-repository";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
import { DauDaMo, NutXoaDauDaMo } from "./huong-dan-da-mo";

/**
 * Màn Hướng dẫn. Hai phần: vòng khách bảy bước để trình diễn từ đầu tới cuối,
 * và mọi việc hệ thống làm được để tra khi cần. Nút nào cũng đưa thẳng tới
 * đúng màn, đúng chỗ cần bấm (`?chi=`), rồi thẻ chỉ dẫn ở góc lo phần còn lại.
 */

const NUT_CHINH =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]";
const NUT_PHU =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#35594b] transition hover:border-[#8fa99f]";

export function HuongDanWorkspace({
  targets,
  quyen,
  chuyenVaiDuoc,
}: {
  targets: readonly ErpStaffDirectoryEntry[];
  quyen: Record<string, EmployeeAccess>;
  chuyenVaiDuoc: boolean;
}) {
  const buocDau = VONG_KHACH[0];
  return (
    <div className="space-y-6" data-testid="huong-dan">
      <header className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Hướng dẫn</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
          Bấm một việc, hệ thống đưa bạn tới đúng chỗ cần bấm
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
          Tới nơi, chỗ cần bấm được khoanh viền cam. Thẻ nhỏ ở góc dưới nói bây giờ bấm gì và đưa bạn sang bước tiếp.
          Mọi thao tác chạy trên dữ liệu thật như ngày thường: bán thử một vé là có một phiếu thật trong sổ.
        </p>
      </header>

      <section aria-labelledby="vong-khach" className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Trình diễn · {VONG_KHACH.length} bước, chừng mười phút
            </p>
            <h2 id="vong-khach" className="mt-2 text-2xl font-black text-[#20342c]">
              Một vị khách, từ lúc đặt vé tới trang đầu giám đốc
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
              Vé trình diễn là gói &ldquo;Nhịp chậm Ninh Bình&rdquo;, chuyến Tràng An cuối lúc 13:00, nên đi trọn vòng được tới
              khoảng 12:55. Muộn hơn thì đặt cho ngày mai; tới bước 3 máy sẽ báo vé không dùng cho hôm nay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NutXoaDauDaMo />
            <Link href={duongDenBuoc(buocDau)} data-testid="bat-dau-vong" className={`${NUT_CHINH} min-h-12 px-5 text-base`}>
              Bắt đầu từ bước 1 →
            </Link>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 lg:grid-cols-2">
          {VONG_KHACH.map((buoc) => (
            <li
              key={buoc.id}
              data-buoc={buoc.id}
              className="flex flex-col rounded-2xl border border-[#e2e8e3] bg-[#f8faf8] p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#183f34] font-black text-[#e7c78d]"
                >
                  {buoc.thuTu}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-[#20342c]">
                      <span className="sr-only">Bước {buoc.thuTu}: </span>
                      {buoc.ten}
                    </h3>
                    <DauDaMo id={buoc.id} />
                  </div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#3d5047]">
                    {buoc.cacViec.map((viec) => (
                      <li key={viec}>{viec}</li>
                    ))}
                  </ol>
                  <p className="mt-2 text-sm leading-6 text-[#5f7068]">
                    <span className="font-black text-[#35594b]">Bạn sẽ thấy: </span>
                    {buoc.seThay}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Link href={duongDenBuoc(buoc)} className={NUT_PHU}>
                  Đưa tôi tới →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tra-viec" className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Tra một việc · {TONG_VIEC_TRA_CUU} việc
        </p>
        <h2 id="tra-viec" className="mt-2 text-2xl font-black text-[#20342c]">
          Mọi việc hệ thống làm được, việc nào của ai
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
          Việc của giám đốc thì bấm là tới. Việc của vai khác thì bấm &ldquo;Làm thử&rdquo;: hệ thống chuyển sang một tài
          khoản đúng vai ở Tràng An, thanh trên cùng luôn có nút quay lại giám đốc, nhật ký ghi đủ.
        </p>

        {BAN_DO_CHUC_NANG.map((nhom) => (
          <section key={nhom.id} className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#718078]">{nhom.ten}</h3>
            <ul className="mt-2 divide-y divide-[#eef1ed]">
              {nhom.chucNang.map((cn) => {
                const tuLam = cn.vai === "director" || cn.giamDocLamDuoc;
                const mau = tuLam ? null : chonTaiKhoanMau(targets, quyen, cn.vai, duongDanChucNang(cn));
                return (
                  <li
                    key={cn.id}
                    data-chuc-nang={cn.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-[#20342c]">
                        {cn.ten}
                        <DauDaMo id={cn.id} />
                      </p>
                      <p className="text-sm text-[#5f7068]">
                        {cn.moTa} <span className="font-bold text-[#35594b]">· {ERP_ROLE_LABELS[cn.vai]}</span>
                      </p>
                    </div>
                    {!tuLam && chuyenVaiDuoc && mau ? (
                      <form action={switchDemoRoleAction}>
                        <input type="hidden" name="targetUserId" value={mau.accountId} />
                        <input type="hidden" name="next" value={duongDenChucNang(cn)} />
                        <button type="submit" className={NUT_CHINH}>
                          Làm thử như {ERP_ROLE_LABELS[cn.vai]} →
                        </button>
                      </form>
                    ) : (
                      <Link href={duongDenChucNang(cn)} className={tuLam ? NUT_CHINH : NUT_PHU}>
                        {tuLam ? "Đưa tôi tới →" : "Xem màn này →"}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
