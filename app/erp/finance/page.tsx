import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { AccountingControlCenter } from "@/components/erp/accounting-control-center";
import { MachViecPanel } from "@/components/erp/mach-viec-panel";
import { machViecTheoId } from "@/domain/erp-mach-viec";
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
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
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
  // Trang Tài chính không thuộc một cơ sở nào, nhưng vài bước của mạch lại
  // nằm trong cơ sở. Lấy cơ sở đầu tiên người này được vào để dựng đường dẫn;
  // giám đốc vào được cả bốn nên lấy cái nào cũng mở ra đúng màn.
  const coSoChoDuongDan = cashSites[0]?.id ?? ERP_SITES[0].id;
  const machViecCuaTrangNay = [
    { mach: machViecTheoId("dong-ca"), trangThai: shiftClosures.map((r) => r.status) },
    {
      mach: machViecTheoId("cong-no-doi-tac"),
      trangThai: supplierAp.invoices.map((invoice) => invoice.status),
    },
  ].flatMap(({ mach, trangThai }) => (mach ? [{ mach, trangThai }] : []));

  const sourceValue = params.source;
  const initialSourceId = Array.isArray(sourceValue)
    ? sourceValue[0]
    : sourceValue;

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      {/*
        Trang này là nơi hai luồng tiền gặp nhau: bước 3–4 của đóng ca và bước
        3, 5 của công nợ đều làm ở đây. Vì thế dựng cả hai dải, mỗi dải đếm
        đúng những hồ sơ mà chính trang này đang cầm.
      */}
      {machViecCuaTrangNay.map(({ mach, trangThai }) => (
        <MachViecPanel
          key={mach.id}
          mach={mach}
          siteId={coSoChoDuongDan}
          viewerRole={user.role}
          trangThai={trangThai}
          dangODay="/erp/finance"
        />
      ))}
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
