import { redirect } from "next/navigation";
import { endRoleSwitchAction } from "@/app/erp/actions";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { HuongDanWorkspace } from "@/components/erp/huong-dan-workspace";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import { getCurrentErpUser, isRoleSwitchEnabled } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { getAccessState } from "@/lib/erp/staff-access-repository";
import { listRoleSwitchTargets } from "@/lib/erp/staff-directory";

/**
 * Màn Hướng dẫn: kịch bản ở `domain/huong-dan.ts`, phần khoanh chỗ cần bấm ở
 * `components/shared/chi-diem.tsx`. Chỉ dành cho giám đốc, người duy nhất
 * trình diễn hệ thống.
 */
export default async function HuongDanPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && !user.actingAs) redirect("/erp");

  // Đang xem thử vai khác: nút nào ở đây cũng cần vai giám đốc, nên mời quay
  // về trước thay vì hiện những nút bấm vào là bị từ chối.
  if (user.actingAs) {
    return (
      <ErpShell user={user}>
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#e0b979] bg-[#fff8eb] p-6 text-[#5d4420] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">Hướng dẫn</p>
          <h1 className="mt-2 text-2xl font-black text-[#3f3524]">
            Bạn đang xem với vai {ERP_ROLE_LABELS[user.role]}
          </h1>
          <p className="mt-2 leading-7">Hướng dẫn đi bằng tài khoản giám đốc. Mời bạn quay về giám đốc rồi chọn việc tiếp theo.</p>
          <form action={endRoleSwitchAction} className="mt-5">
            <input type="hidden" name="next" value="/erp/huong-dan" />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center rounded-xl bg-[#183f34] px-5 font-black text-white"
            >
              Quay về giám đốc, mở hướng dẫn
            </button>
          </form>
        </section>
      </ErpShell>
    );
  }

  const chuyenVaiDuoc = isRoleSwitchEnabled();
  const [access, targets] = await Promise.all([
    getAccessState(),
    chuyenVaiDuoc ? listRoleSwitchTargets() : Promise.resolve([]),
  ]);

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <HuongDanWorkspace targets={targets} quyen={access.employees} chuyenVaiDuoc={chuyenVaiDuoc} />
    </ErpShell>
  );
}
