import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { AccountingControlCenter } from "@/components/erp/accounting-control-center";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import {
  listAccountingJournals,
  listAccountingPeriods,
} from "@/lib/erp/accounting-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpFinancePage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (!canViewRegionalFinance(user.role)) redirect("/erp");
  const [shiftClosures, journals, periods, supplierAp, params] = await Promise.all([
    listShiftClosures({ siteIds: user.siteIds }),
    listAccountingJournals({ siteIds: user.siteIds }),
    listAccountingPeriods(),
    listSupplierAp({ siteIds: user.siteIds }),
    searchParams ??
      Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const sourceValue = params.source;
  const initialSourceId = Array.isArray(sourceValue)
    ? sourceValue[0]
    : sourceValue;

  return (
    <ErpShell user={user}>
      <AccountingControlCenter
        user={user}
        shiftClosures={shiftClosures}
        journals={journals}
        periods={periods}
        supplierApInvoices={supplierAp.invoices}
        supplierApSuppliers={supplierAp.suppliers}
        initialSourceId={initialSourceId}
      />
    </ErpShell>
  );
}
