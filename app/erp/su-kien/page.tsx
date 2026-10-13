import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { SuKienWorkspace } from "@/components/erp/su-kien-workspace";
import { danhSachSuKienErp } from "@/lib/customer-data/su-kien-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

/** Sự kiện gặp người nổi tiếng, rút thăm minh bạch (13/10/2026, migration 127). */
export default async function ErpSuKienPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director") redirect("/erp?denied=su-kien");
  const ds = await danhSachSuKienErp();
  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Kéo khách · thu số điện thoại có đồng ý</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-5xl">Sự kiện và rút thăm</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          Khách đăng ký bằng số điện thoại để có cơ hội giao lưu với khách mời; mỗi lần qua cổng bằng vé gắn số trong thời gian đăng ký được thêm một lượt.
          Rút thăm có mã cam kết công bố trước, ai cũng tự kiểm lại được người trúng trên trang khách.
        </p>
      </div>
      {ds ? <SuKienWorkspace ds={ds} bayGio={new Date().getTime()} /> : <p className="rounded-2xl bg-white p-5 text-sm text-[#68776f]">Chưa đọc được kho sự kiện. Thử tải lại sau ít phút.</p>}
    </ErpShell>
  );
}
