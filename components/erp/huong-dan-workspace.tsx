import Link from "next/link";
import { switchDemoRoleAction } from "@/app/erp/actions";
import {
  BAN_DO_CHUC_NANG,
  CHUC_NANG_MOI,
  CHUC_NANG_WEB,
  chonTaiKhoanMau,
  duongDanChucNang,
  type ChucNang,
  type ChucNangWeb,
} from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import { duongDenBuoc, duongDenChucNang, TONG_VIEC_TRA_CUU, VONG_KHACH } from "@/domain/huong-dan";
import type { EmployeeAccess } from "@/lib/erp/staff-access-repository";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
import { DauDaMo, NutXoaDauDaMo } from "./huong-dan-da-mo";

/**
 * Màn Thử chức năng (`/erp/huong-dan`). Bốn phần, theo thứ người chấm cần:
 * phần mới làm, phần khách thấy trên web, vòng khách bảy bước để trình diễn,
 * rồi mọi việc trong ERP để tra. Nút nào cũng đưa thẳng tới đúng màn, đúng
 * chỗ cần bấm (`?chi=`), rồi thẻ chỉ dẫn ở góc lo phần còn lại.
 */

const NUT_CHINH =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]";
const NUT_PHU =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#35594b] transition hover:border-[#8fa99f]";

type Props = {
  targets: readonly ErpStaffDirectoryEntry[];
  quyen: Record<string, EmployeeAccess>;
  chuyenVaiDuoc: boolean;
};

const MUC_MOI = CHUC_NANG_MOI;

function DauMoi({ ngay }: { ngay: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#fff1d6] px-2.5 py-0.5 text-xs font-black text-[#8a5a12]">
      Mới · {ngay}
    </span>
  );
}

/** Nút đi tới một việc ERP: tự làm được thì đi thẳng, việc vai khác thì chuyển vai. */
function NutViecErp({ cn, targets, quyen, chuyenVaiDuoc }: { cn: ChucNang } & Props) {
  const tuLam = cn.vai === "director" || cn.giamDocLamDuoc;
  const mau = tuLam ? null : chonTaiKhoanMau(targets, quyen, cn.vai, duongDanChucNang(cn));
  if (!tuLam && chuyenVaiDuoc && mau) {
    return (
      <form action={switchDemoRoleAction}>
        <input type="hidden" name="targetUserId" value={mau.accountId} />
        <input type="hidden" name="next" value={duongDenChucNang(cn)} />
        <button type="submit" className={NUT_CHINH}>
          Làm thử như {ERP_ROLE_LABELS[cn.vai]} →
        </button>
      </form>
    );
  }
  return (
    <Link href={duongDenChucNang(cn)} className={tuLam ? NUT_CHINH : NUT_PHU}>
      {tuLam ? "Đưa tôi tới →" : "Xem màn này →"}
    </Link>
  );
}

function NutViecWeb({ cn, chinh = false }: { cn: ChucNangWeb; chinh?: boolean }) {
  // Trang ERP thì mở ngay tại đây; trang khách mở thẻ mới để không mất danh sách.
  if (cn.duongDan.startsWith("/erp")) {
    return (
      <Link href={cn.duongDan} className={chinh ? NUT_CHINH : NUT_PHU}>
        Đưa tôi tới →
      </Link>
    );
  }
  return (
    <Link href={cn.duongDan} target="_blank" rel="noopener" className={chinh ? NUT_CHINH : NUT_PHU}>
      Mở trang khách ↗
    </Link>
  );
}

export function HuongDanWorkspace(props: Props) {
  const buocDau = VONG_KHACH[0];
  const muc = [
    { href: "#moi-cap-nhat", nhan: `Mới cập nhật · ${MUC_MOI.length}` },
    { href: "#tren-web", nhan: `Trên web khách · ${CHUC_NANG_WEB.length}` },
    { href: "#vong-khach", nhan: `Vòng khách · ${VONG_KHACH.length} bước` },
    { href: "#tra-viec", nhan: `Mọi việc trong ERP · ${TONG_VIEC_TRA_CUU}` },
  ];
  return (
    <div className="space-y-6" data-testid="huong-dan">
      <header className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Thử chức năng</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
          Mọi chức năng ở một chỗ, bấm là tới đúng chỗ để thử
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
          Tất cả đi bằng tài khoản giám đốc. Tới nơi, chỗ cần bấm được khoanh viền cam và thẻ nhỏ ở góc dưới nói bây giờ
          bấm gì. Việc của vai khác (kế toán trưởng, nhân viên) thì bấm &ldquo;Làm thử như…&rdquo;: hệ thống chuyển vai,
          thanh trên cùng luôn có nút quay về giám đốc. Mọi thao tác chạy trên dữ liệu thật.
        </p>
        <nav aria-label="Các phần của màn này" className="mt-5 flex flex-wrap gap-2">
          {muc.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="inline-flex min-h-11 items-center rounded-full border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
            >
              {m.nhan}
            </a>
          ))}
        </nav>
      </header>

      <section
        id="moi-cap-nhat"
        aria-labelledby="tieu-de-moi"
        className="scroll-mt-24 rounded-3xl border-2 border-[#e0b979] bg-[#fffaf0] p-5 shadow-sm sm:p-7"
      >
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#9a6328]">
          Mới cập nhật · {MUC_MOI.length} chức năng
        </p>
        <h2 id="tieu-de-moi" className="mt-2 text-2xl font-black text-[#3f3524]">
          Phần mới làm, thử trước những thứ này
        </h2>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {MUC_MOI.map(({ loai, cn }) => (
            <li
              key={cn.id}
              data-moi={cn.id}
              className="flex flex-col rounded-2xl border border-[#ecdcbc] bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <DauMoi ngay={cn.moi!} />
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#718078]">
                  {loai === "web"
                    ? cn.duongDan.startsWith("/erp")
                      ? "Web khách · xem trong ERP"
                      : "Web khách"
                    : `ERP · ${ERP_ROLE_LABELS[cn.vai]}`}
                </span>
                {loai === "web" && cn.chiMayTinh ? (
                  <span className="text-xs font-bold text-[#718078]">· máy tính</span>
                ) : null}
                {loai === "erp" ? <DauDaMo id={cn.id} /> : null}
              </div>
              <h3 className="mt-2 text-lg font-black text-[#20342c]">{cn.ten}</h3>
              <p className="mt-1 text-sm leading-6 text-[#5f7068]">{cn.moTa}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#3d5047]">
                {cn.cacViec.map((viec) => (
                  <li key={viec}>{viec}</li>
                ))}
              </ol>
              <div className="mt-auto flex justify-end pt-4">
                {loai === "erp" ? <NutViecErp cn={cn} {...props} /> : <NutViecWeb cn={cn} chinh />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="tren-web"
        aria-labelledby="tieu-de-web"
        className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7"
      >
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Trên web khách · {CHUC_NANG_WEB.length} phần
        </p>
        <h2 id="tieu-de-web" className="mt-2 text-2xl font-black text-[#20342c]">
          Khách thấy gì trên ninhbinhjourney
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
          Trang khách mở ở thẻ mới, danh sách này vẫn nằm nguyên. Không cần đăng nhập.
        </p>
        <ul className="mt-4 divide-y divide-[#eef1ed]">
          {CHUC_NANG_WEB.map((cn) => (
            <li
              key={cn.id}
              data-chuc-nang-web={cn.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold text-[#20342c]">
                  {cn.ten}
                  {cn.moi ? <DauMoi ngay={cn.moi} /> : null}
                </p>
                <p className="text-sm text-[#5f7068]">
                  {cn.moTa}
                  {cn.chiMayTinh ? <span className="font-bold text-[#35594b]"> · chỉ trên máy tính</span> : null}
                </p>
              </div>
              <NutViecWeb cn={cn} />
            </li>
          ))}
        </ul>
      </section>

      <section
        id="vong-khach"
        aria-labelledby="tieu-de-vong-khach"
        className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
              Trình diễn · {VONG_KHACH.length} bước, chừng mười phút
            </p>
            <h2 id="tieu-de-vong-khach" className="mt-2 text-2xl font-black text-[#20342c]">
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

      <section
        id="tra-viec"
        aria-labelledby="tieu-de-tra-viec"
        className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7"
      >
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Tra một việc · {TONG_VIEC_TRA_CUU} việc
        </p>
        <h2 id="tieu-de-tra-viec" className="mt-2 text-2xl font-black text-[#20342c]">
          Mọi việc trong ERP, việc nào của ai
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
          Việc của giám đốc thì bấm là tới. Việc của vai khác thì bấm &ldquo;Làm thử&rdquo;: hệ thống chuyển sang một tài
          khoản đúng vai ở Tràng An, thanh trên cùng luôn có nút quay lại giám đốc, nhật ký ghi đủ.
        </p>

        {BAN_DO_CHUC_NANG.map((nhom) => (
          <section key={nhom.id} className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#718078]">{nhom.ten}</h3>
            <ul className="mt-2 divide-y divide-[#eef1ed]">
              {nhom.chucNang.map((cn) => (
                <li
                  key={cn.id}
                  data-chuc-nang={cn.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-[#20342c]">
                      {cn.ten}
                      {cn.moi ? <DauMoi ngay={cn.moi} /> : null}
                      <DauDaMo id={cn.id} />
                    </p>
                    <p className="text-sm text-[#5f7068]">
                      {cn.moTa} <span className="font-bold text-[#35594b]">· {ERP_ROLE_LABELS[cn.vai]}</span>
                    </p>
                  </div>
                  <NutViecErp cn={cn} {...props} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
