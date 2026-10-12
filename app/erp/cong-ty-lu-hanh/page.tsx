import { redirect } from "next/navigation";
import { ERP_SITES } from "@/domain/erp";
import { CongTyLuHanhWorkspace } from "@/components/erp/cong-ty-lu-hanh-workspace";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { listTravelCompanies } from "@/lib/erp/counter-sale-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

export const metadata = { title: "Công ty lữ hành" };

export default async function CongTyLuHanhPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!["director", "manager", "chief-accountant", "accountant"].includes(user.role)) redirect("/erp?denied=site");
  const congTy = await listTravelCompanies();
  const tenCoSo = Object.fromEntries(ERP_SITES.map((site) => [ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[site.id], site.shortName]));
  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <CongTyLuHanhWorkspace congTy={congTy} laGiamDoc={user.role === "director"} tenCoSo={tenCoSo} />
    </ErpShell>
  );
}
