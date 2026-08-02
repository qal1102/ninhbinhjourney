import Image from "next/image";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/erp/change-password-form";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export default async function ChangePasswordPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  // Only a Supabase Auth session has a personal password to change here.
  // A legacy demo-cookie account has nothing to do on this page yet.
  if (!user.authUserId) redirect("/erp");

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
        </div>
      </section>

      <section className="relative z-10 flex min-h-screen items-center px-5 py-10 sm:px-10 xl:px-20">
        <div className="mx-auto w-full max-w-lg">
          <p className="mt-10 text-xs font-black uppercase tracking-[0.22em] text-[#e7c78d] lg:mt-0">
            {user.name}
          </p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">
            Đặt mật khẩu riêng cho tài khoản này
          </h2>
          <p className="mt-4 leading-7 text-white/62">
            Tài khoản của bạn vừa được cấp trên hệ thống. Vì lý do an toàn,
            hãy đặt một mật khẩu riêng trước khi tiếp tục — mật khẩu tạm chỉ
            dùng được một lần.
          </p>
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
