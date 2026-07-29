import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginErpAction } from "../actions";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  missing: "Nhập đầy đủ tên đăng nhập và mật khẩu.",
  invalid: "Tên đăng nhập hoặc mật khẩu không đúng.",
};

export default async function ErpLoginPage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (user) redirect("/erp");
  const params = (await searchParams) ?? {};
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = rawError ? errorMessages[rawError] : null;

  return (
    <main className="grid min-h-screen bg-[#10241e] text-white lg:grid-cols-[1.06fr_0.94fr]">
      <section
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
        className="pointer-events-none relative z-0 hidden min-h-screen overflow-hidden lg:block"
      >
        <Image
          src="/images/destinations/intro-trang-an-rain.png"
          alt="Cảnh quan Tràng An"
          fill
          priority
          sizes="55vw"
          className="pointer-events-none object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,27,22,.16),rgba(9,27,22,.9))]" />
        <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/ninh-binh-mark.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
            />
            <p className="font-black tracking-[0.12em]">NINH BÌNH / ĐIỀU HÀNH</p>
          </div>
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e7c78d]">
              Trung tâm điều hành
            </p>
            <h1 className="font-display mt-5 text-6xl leading-[0.98] xl:text-7xl">
              Một nhịp vận hành,<br />toàn bộ cơ sở.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">
              Theo dõi tài chính, dòng khách, nhân sự, phương tiện và sự cố trong cùng một hệ thống.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 flex min-h-screen items-center px-5 py-10 sm:px-10 xl:px-20">
        <div className="mx-auto w-full max-w-lg">
          <div className="flex items-center gap-3 lg:hidden">
            <Image
              src="/brand/ninh-binh-mark.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
            />
            <p className="font-black tracking-[0.1em]">NINH BÌNH / ĐIỀU HÀNH</p>
          </div>
          <p className="mt-10 text-xs font-black uppercase tracking-[0.22em] text-[#e7c78d] lg:mt-0">
            Đăng nhập nội bộ
          </p>
          <h2 className="font-display mt-3 text-5xl">Chào mừng trở lại.</h2>
          <p className="mt-4 leading-7 text-white/62">
            Đăng nhập bằng tài khoản đã được cấp cho công việc của bạn.
          </p>

          <form action={loginErpAction} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-white/78">Tên đăng nhập</span>
              <input
                name="username"
                autoComplete="username"
                required
                className="mt-2 min-h-12 w-full rounded-xl border border-white/16 bg-white/[0.07] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#e7c78d]"
                placeholder="vd: nv.trangan"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-white/78">Mật khẩu</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 min-h-12 w-full rounded-xl border border-white/16 bg-white/[0.07] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#e7c78d]"
                placeholder="Mật khẩu được cấp"
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-xl border border-[#efb6aa]/30 bg-[#9e4636]/20 px-4 py-3 text-sm text-[#ffd9d1]">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="min-h-12 w-full rounded-xl bg-[#e7c78d] px-5 font-black text-[#17352c] transition hover:bg-[#f2d69f]"
            >
              Mở hệ thống quản lý
            </button>
          </form>

          <details className="mt-6 rounded-xl border border-white/12 bg-white/[0.04] p-4 text-sm">
            <summary className="cursor-pointer font-bold text-white/78">Tài khoản đăng nhập được cấp</summary>
            <div className="mt-4 grid gap-3 text-white/62 sm:grid-cols-2">
              <p><strong className="block text-white">Giám đốc</strong>giamdoc<br />Giamdoc@2026</p>
              <p><strong className="block text-white">Quản lý vận hành · 4 cơ sở</strong>ql.vanhanh<br />Quanly@2026</p>
              <p><strong className="block text-white">Kế toán trưởng</strong>ketoantruong<br />Ketoantruong@2026</p>
              <p><strong className="block text-white">Kế toán tổng hợp</strong>ketoan<br />Ketoan@2026</p>
              <p><strong className="block text-white">Nhân viên Tràng An</strong>nv.trangan<br />Nhanvien@2026</p>
              <p><strong className="block text-white">Nhân viên Tam Chúc</strong>nv.tamchuc<br />Nhanvien@2026</p>
              <p><strong className="block text-white">Nhân viên Tam Cốc</strong>nv.tamcoc<br />Nhanvien@2026</p>
              <p><strong className="block text-white">Nhân viên Bái Đính</strong>nv.baidinh<br />Nhanvien@2026</p>
              <p><strong className="block text-white">Nhân viên thời vụ Tràng An</strong>tv.trangan<br />Thoivu@2026</p>
              <p className="sm:col-span-2"><strong className="block text-white">Tương thích kịch bản cũ</strong>ql.trangan vẫn đăng nhập vào tài khoản quản lý vận hành.</p>
            </div>
          </details>

          <Link href="/" className="mt-7 inline-flex text-sm font-bold text-white/55 underline-offset-4 hover:text-white hover:underline">
            Quay lại trang dành cho du khách
          </Link>
        </div>
      </section>
    </main>
  );
}
