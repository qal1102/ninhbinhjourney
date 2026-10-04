import Link from "next/link";
import { switchDemoRoleAction } from "@/app/erp/actions";
import {
  BAN_DO_CHUC_NANG,
  CHUC_NANG_WEB,
  chonTaiKhoanMau,
  duongDanChucNang,
  TEN_NHOM_WEB,
  type ChucNang,
  type ChucNangWeb,
  type NhomWeb,
} from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import { duongDenBuoc, duongDenChucNang, TONG_VIEC_TRA_CUU, VONG_KHACH } from "@/domain/huong-dan";
import type { EmployeeAccess } from "@/lib/erp/staff-access-repository";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";
import { DauDaMo, NutXoaDauDaMo } from "./huong-dan-da-mo";

/**
 * Màn Dạo một vòng (`/erp/huong-dan`, trước 04/10/2026 tên "Thử chức năng"). Ba thẻ tách hẳn nhau, theo lời anh
 * Đạt 04/10/2026 ("web để riêng, ERP để riêng, không trộn lẫn"):
 *
 * - **Hệ thống điều hành**: mọi việc trong ERP, chia nhóm. Bấm là tới đúng
 *   màn, chỗ cần bấm được khoanh (`?chi=`); việc của vai khác thì chuyển vai.
 * - **Web khách**: mọi thứ khách thấy, chia nhóm, mở ở thẻ mới.
 * - **Trình diễn**: vòng khách bảy bước từ đặt vé tới trang đầu giám đốc.
 *
 * Mỗi chức năng là một thẻ ghi rõ làm gì và các bước thử; phần mới làm mang
 * dấu "Mới" và lọc riêng được.
 */

export type TheThu = "erp" | "web" | "vong";

const NUT_CHINH =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]";
const NUT_PHU =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#35594b] transition hover:border-[#8fa99f]";

type Props = {
  targets: readonly ErpStaffDirectoryEntry[];
  quyen: Record<string, EmployeeAccess>;
  chuyenVaiDuoc: boolean;
  the: TheThu;
  chiMoi: boolean;
};

const TONG_WEB = CHUC_NANG_WEB.length;
const SO_MOI_ERP = BAN_DO_CHUC_NANG.flatMap((n) => n.chucNang).filter((cn) => cn.moi).length;
const SO_MOI_WEB = CHUC_NANG_WEB.filter((cn) => cn.moi).length;
const THU_TU_NHOM_WEB: readonly NhomWeb[] = ["kham-pha", "dat-ve", "tai-diem", "doi-tac", "hieu-ung"];

function DauMoi({ ngay }: { ngay: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#fff1d6] px-2.5 py-0.5 text-xs font-black text-[#8a5a12]">
      Mới · {ngay}
    </span>
  );
}

/** Nút đi tới một việc ERP: tự làm được thì đi thẳng, việc vai khác thì chuyển vai. */
function NutViecErp({ cn, targets, quyen, chuyenVaiDuoc }: { cn: ChucNang } & Pick<Props, "targets" | "quyen" | "chuyenVaiDuoc">) {
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

function NutViecWeb({ cn }: { cn: ChucNangWeb }) {
  // Phần khách xem từ trong hệ thống thì mở ngay tại đây; trang khách mở thẻ mới
  // để danh sách này vẫn nằm nguyên.
  if (cn.duongDan.startsWith("/erp")) {
    return (
      <Link href={cn.duongDan} className={NUT_CHINH}>
        Đưa tôi tới →
      </Link>
    );
  }
  return (
    <Link href={cn.duongDan} target="_blank" rel="noopener" className={NUT_CHINH}>
      Mở trang khách ↗
    </Link>
  );
}

/** Khung chung của một thẻ chức năng, dùng cho cả ERP lẫn web. */
function TheChucNang({
  nhan,
  ten,
  moTa,
  cacViec,
  moi,
  dauDaMo,
  nut,
  ...thuocTinh
}: {
  nhan: string;
  ten: string;
  moTa: string;
  cacViec: readonly string[];
  moi?: string;
  dauDaMo?: string;
  nut: React.ReactNode;
} & Record<`data-${string}`, string>) {
  return (
    <li {...thuocTinh} className="flex flex-col rounded-2xl border border-[#e0e6e2] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {moi ? <DauMoi ngay={moi} /> : null}
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#718078]">{nhan}</span>
        {dauDaMo ? <DauDaMo id={dauDaMo} /> : null}
      </div>
      <h4 className="mt-2 text-lg font-black leading-snug text-[#20342c]">{ten}</h4>
      <p className="mt-1 text-sm leading-6 text-[#5f7068]">{moTa}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#3d5047]">
        {cacViec.map((viec) => (
          <li key={viec}>{viec}</li>
        ))}
      </ol>
      <div className="mt-auto flex justify-end pt-4">{nut}</div>
    </li>
  );
}

function ChipNhom({ muc }: { muc: { href: string; nhan: string }[] }) {
  return (
    <nav aria-label="Các nhóm" className="flex flex-wrap gap-2">
      {muc.map((m) => (
        <a
          key={m.href}
          href={m.href}
          className="inline-flex min-h-10 items-center rounded-full border border-[#d8e0db] bg-white px-3.5 text-sm font-bold text-[#35594b] transition hover:border-[#8fa99f]"
        >
          {m.nhan}
        </a>
      ))}
    </nav>
  );
}

function LocMoi({ the, chiMoi, soMoi }: { the: TheThu; chiMoi: boolean; soMoi: number }) {
  return (
    <Link
      href={chiMoi ? `/erp/huong-dan?xem=${the}` : `/erp/huong-dan?xem=${the}&moi=1`}
      aria-pressed={chiMoi}
      className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-black transition ${
        chiMoi ? "bg-[#d58c35] text-white" : "border border-[#e0b979] bg-[#fff8eb] text-[#7a5520] hover:border-[#d58c35]"
      }`}
    >
      {chiMoi ? `Đang xem ${soMoi} mục mới · xem hết` : `Chỉ xem mục mới · ${soMoi}`}
    </Link>
  );
}

function TheErp({ chiMoi, ...props }: Pick<Props, "targets" | "quyen" | "chuyenVaiDuoc" | "chiMoi">) {
  const nhom = BAN_DO_CHUC_NANG.map((n) => ({ ...n, chucNang: n.chucNang.filter((cn) => !chiMoi || cn.moi) })).filter(
    (n) => n.chucNang.length > 0,
  );
  return (
    <section aria-labelledby="tieu-de-erp" className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="tieu-de-erp" className="text-2xl font-black text-[#20342c]">
            Điều hành · {TONG_VIEC_TRA_CUU} việc
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f7068]">
            Việc của nhân viên, quản lý hay kế toán thì bấm &ldquo;Làm thử như…&rdquo; để vào bằng tài khoản vai ấy ở Tràng An.
            Thanh trên cùng luôn có nút quay về giám đốc.
          </p>
        </div>
        <LocMoi the="erp" chiMoi={chiMoi} soMoi={SO_MOI_ERP} />
      </div>
      <ChipNhom muc={nhom.map((n) => ({ href: `#nhom-${n.id}`, nhan: `${n.ten} · ${n.chucNang.length}` }))} />
      {nhom.map((n) => (
        <section key={n.id} id={`nhom-${n.id}`} aria-labelledby={`tieu-de-${n.id}`} className="scroll-mt-24">
          <h3 id={`tieu-de-${n.id}`} className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
            {n.ten}
          </h3>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {n.chucNang.map((cn) => (
              <TheChucNang
                key={cn.id}
                data-chuc-nang={cn.id}
                nhan={ERP_ROLE_LABELS[cn.vai]}
                ten={cn.ten}
                moTa={cn.moTa}
                cacViec={cn.cacViec}
                moi={cn.moi}
                dauDaMo={cn.id}
                nut={<NutViecErp cn={cn} {...props} />}
              />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function TheWeb({ chiMoi }: { chiMoi: boolean }) {
  const nhom = THU_TU_NHOM_WEB.map((id) => ({
    id,
    ten: TEN_NHOM_WEB[id],
    chucNang: CHUC_NANG_WEB.filter((cn) => cn.nhom === id && (!chiMoi || cn.moi)),
  })).filter((n) => n.chucNang.length > 0);
  return (
    <section aria-labelledby="tieu-de-web" className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="tieu-de-web" className="text-2xl font-black text-[#20342c]">
            Trang của khách · {TONG_WEB}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f7068]">
            Mỗi trang mở ở một thẻ mới, khách không cần đăng nhập.
          </p>
        </div>
        <LocMoi the="web" chiMoi={chiMoi} soMoi={SO_MOI_WEB} />
      </div>
      <ChipNhom muc={nhom.map((n) => ({ href: `#nhom-${n.id}`, nhan: `${n.ten} · ${n.chucNang.length}` }))} />
      {nhom.map((n) => (
        <section key={n.id} id={`nhom-${n.id}`} aria-labelledby={`tieu-de-${n.id}`} className="scroll-mt-24">
          <h3 id={`tieu-de-${n.id}`} className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
            {n.ten}
          </h3>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {n.chucNang.map((cn) => (
              <TheChucNang
                key={cn.id}
                data-chuc-nang-web={cn.id}
                nhan={cn.duongDan.startsWith("/erp") ? "Xem trong hệ thống" : cn.chiMayTinh ? "Trang khách · máy tính" : "Trang khách"}
                ten={cn.ten}
                moTa={cn.moTa}
                cacViec={cn.cacViec}
                moi={cn.moi}
                nut={<NutViecWeb cn={cn} />}
              />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function TheVong() {
  const buocDau = VONG_KHACH[0];
  return (
    <section aria-labelledby="tieu-de-vong-khach">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="tieu-de-vong-khach" className="text-2xl font-black text-[#20342c]">
            Một vị khách, từ lúc đặt vé tới trang đầu giám đốc
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
            Bảy bước, chừng mười phút, dùng gói &ldquo;Nhịp chậm Ninh Bình&rdquo;. Chuyến Tràng An cuối lúc 16:00, nên sau 15:55
            thì đặt cho ngày mai; tới bước 3 máy sẽ báo vé chưa tới ngày dùng.
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
            className="flex flex-col rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-5"
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
  );
}

export function HuongDanWorkspace({ the, chiMoi, ...props }: Props) {
  const cacThe: { id: TheThu; ten: string; phu: string }[] = [
    { id: "erp", ten: `Điều hành · ${TONG_VIEC_TRA_CUU} việc`, phu: "Việc của giám đốc và từng vai" },
    { id: "web", ten: `Trang của khách · ${TONG_WEB}`, phu: "Khách thấy gì, mở ở thẻ mới" },
    { id: "vong", ten: `Đi cùng một vị khách · ${VONG_KHACH.length} bước`, phu: "Từ lúc đặt vé tới trang đầu giám đốc" },
  ];
  return (
    <div className="space-y-6" data-testid="huong-dan">
      <header className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Dạo một vòng</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
          Dạo một vòng hệ thống
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
          Bấm vào việc nào là tới đúng màn ấy, chỗ cần bấm có viền cam. Mọi thứ chạy trên dữ liệu thật, nên bán thử một vé là
          có một phiếu thu thật.
        </p>
        <nav aria-label="Chọn phần muốn xem" className="mt-6 grid gap-3 sm:grid-cols-3">
          {cacThe.map((t) => {
            const dangChon = t.id === the;
            return (
              <Link
                key={t.id}
                href={`/erp/huong-dan?xem=${t.id}`}
                aria-current={dangChon ? "page" : undefined}
                data-the-thu={t.id}
                className={`rounded-2xl border p-4 transition ${
                  dangChon
                    ? "border-[#e7c78d] bg-[#fffaf0] text-[#20342c]"
                    : "border-white/20 bg-white/8 text-white hover:bg-white/14"
                }`}
              >
                <span className="block text-base font-black">{t.ten}</span>
                <span className={`mt-1 block text-xs ${dangChon ? "text-[#5f7068]" : "text-white/70"}`}>{t.phu}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {the === "erp" ? <TheErp chiMoi={chiMoi} {...props} /> : null}
      {the === "web" ? <TheWeb chiMoi={chiMoi} /> : null}
      {the === "vong" ? <TheVong /> : null}
    </div>
  );
}
