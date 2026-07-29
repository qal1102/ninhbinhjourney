import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { FinanceDashboard } from "@/components/erp/finance-dashboard";
import { AccountingWorkbench } from "@/components/erp/accounting-workbench";
import { ERP_SITES } from "@/domain/erp";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";

export default async function ErpFinancePage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (!canViewRegionalFinance(user.role)) redirect("/erp");
  const shiftClosures = await listShiftClosures({ siteIds: user.siteIds });

  return (
    <ErpShell user={user}>
      {user.role === "accountant" ? (
        <AccountingWorkbench user={user} shiftClosures={shiftClosures} />
      ) : (
        <FinanceDashboard sites={ERP_SITES} />
      )}
    </ErpShell>
  );
}
