import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { SoatGiayToWorkspace } from "@/components/erp/soat-giay-to-workspace";
import { coMoHinhAi } from "@/lib/ai/goi-mo-hinh";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";

/**
 * Soát giấy tờ bằng AI (08/10/2026): chụp hoá đơn, biên bản nghiệm thu, hợp
 * đồng, danh sách đoàn; AI đọc, luật trong `domain/soat-giay-to.ts` soát và
 * đối chiếu, rồi điền sẵn vào hồ sơ hoá đơn nhà cung cấp. Mọi vai vào được:
 * nhân viên nộp chứng từ cũng cần biết giấy của mình thiếu gì trước khi nộp.
 */
export default async function SoatGiayToPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const { suppliers } = await listSupplierAp({ siteIds: user.siteIds }).catch(() => ({ suppliers: [] }));

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <SoatGiayToWorkspace dsNcc={suppliers} coAi={coMoHinhAi()} vai={user.role} coSoMacDinh={user.siteIds[0] ?? null} />
    </ErpShell>
  );
}
