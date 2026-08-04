import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { AccountingControlCenter } from "@/components/erp/accounting-control-center";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import type { CashDepositEligibleShift } from "@/domain/erp-cash-deposit";
import {
  listAccountingJournals,
  listAccountingPeriods,
} from "@/lib/erp/accounting-repository";
import {
  listCashDeposits,
  listEligibleShiftsForDeposit,
  listUnmatchedStatementLines,
} from "@/lib/erp/cash-deposit-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpFinancePage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!canViewRegionalFinance(user.role)) redirect("/erp");
  const cashSites = ERP_SITES.filter((site) => user.siteIds.includes(site.id));
  const [
    shiftClosures,
    journals,
    periods,
    supplierAp,
    cashDeposits,
    unmatchedStatementLines,
    eligibleShiftsEntries,
    params,
  ] = await Promise.all([
    listShiftClosures({ siteIds: user.siteIds }),
    listAccountingJournals({ siteIds: user.siteIds }),
    listAccountingPeriods(),
    listSupplierAp({ siteIds: user.siteIds }),
    listCashDeposits({ siteIds: user.siteIds }),
    listUnmatchedStatementLines({ siteIds: user.siteIds }),
    Promise.all(
      cashSites.map(
        async (site) =>
          [site.id, await listEligibleShiftsForDeposit(site.id)] as const,
      ),
    ),
    searchParams ??
      Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const eligibleShiftsBySite = eligibleShiftsEntries.reduce<
    Record<string, readonly CashDepositEligibleShift[]>
  >((acc, [siteId, shifts]) => {
    acc[siteId as ErpSiteId] = shifts;
    return acc;
  }, {});
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
        cashSites={cashSites}
        cashDeposits={cashDeposits}
        cashUnmatchedStatementLines={unmatchedStatementLines}
        cashEligibleShiftsBySite={eligibleShiftsBySite}
        initialSourceId={initialSourceId}
      />
    </ErpShell>
  );
}
