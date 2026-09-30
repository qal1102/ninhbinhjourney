import { notFound, redirect } from "next/navigation";
import { DaiLyCong } from "@/components/commerce/dai-ly-cong";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { dungCongDaiLy } from "@/lib/dai-ly-cong";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

/** Giám đốc và kế toán xem đúng cổng đại lý thấy, không cần khoá. */
export default async function ErpDaiLyXemTruocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && user.role !== "chief-accountant" && user.role !== "accountant") {
    redirect("/erp?denied=dai-ly");
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const cong = await dungCongDaiLy(id).catch(() => null);
  if (!cong) notFound();
  return (
    <ErpShell user={user}>
      <ErpBackLink href="/erp/dai-ly" label="Đại lý & hoa hồng" />
      <p className="mb-6 rounded-2xl border border-[#e3e8e5] bg-white p-4 text-sm text-[#59654b]">
        Đây là trang đại lý thấy khi mở đường dẫn cổng của họ.
      </p>
      <DaiLyCong {...cong} />
    </ErpShell>
  );
}
