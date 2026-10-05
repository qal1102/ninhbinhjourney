import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ViecGhiWorkspace } from "@/components/erp/viec-ghi-workspace";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
import { boHieuDangDung } from "@/lib/erp/tro-ly-hieu";
import { luuTruViecGhi, viecGhiCuaToi } from "@/lib/erp/viec-ghi-repository";

/**
 * Việc & ghi chú (06/10/2026): ghi bằng giọng nói hoặc gõ tay việc giao, ghi
 * chú riêng và ghi chép ngày. Mọi vai đều vào được; ai cũng chỉ thấy thứ mình
 * tạo và việc giao cho mình.
 */
export default async function ViecGhiPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const [{ dong, loi }, danhBa] = await Promise.all([viecGhiCuaToi(user.id), listStaffDirectory()]);
  const ten = Object.fromEntries(danhBa.map((p) => [p.accountId, p.displayName]));
  ten[user.id] = user.name;

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <ViecGhiWorkspace dong={dong} ten={ten} toiId={user.id} luuTru={luuTruViecGhi()} loiKho={loi} boHieu={boHieuDangDung()} />
    </ErpShell>
  );
}
