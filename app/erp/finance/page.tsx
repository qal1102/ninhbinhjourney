import { redirect } from "next/navigation";
import { doThoiGian } from "@/lib/do-thoi-gian";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { AccountingControlCenter } from "@/components/erp/accounting-control-center";
import { TenNguoiProvider } from "@/components/erp/ten-nguoi";
import { listStaffDirectory } from "@/lib/erp/staff-directory";
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
    doThoiGian("tc/chot-ca", listShiftClosures({ siteIds: user.siteIds })),
    doThoiGian("tc/but-toan", listAccountingJournals({ siteIds: user.siteIds })),
    doThoiGian("tc/ky", listAccountingPeriods()),
    doThoiGian("tc/ncc", listSupplierAp({ siteIds: user.siteIds })),
    doThoiGian("tc/nop-quy", listCashDeposits({ siteIds: user.siteIds })),
    doThoiGian("tc/sao-ke", listUnmatchedStatementLines({ siteIds: user.siteIds })),
    doThoiGian("tc/ca-nop", Promise.all(
      cashSites.map(
        async (site) =>
          [site.id, await listEligibleShiftsForDeposit(site.id)] as const,
      ),
    )),
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
    {
      mach: machViecTheoId("nop-quy"),
      trangThai: cashDeposits.map((deposit) => deposit.status),
    },
  ].flatMap(({ mach, trangThai }) => (mach ? [{ mach, trangThai }] : []));

  const sourceValue = params.source;
  const initialSourceId = Array.isArray(sourceValue)
    ? sourceValue[0]
    : sourceValue;

  // Sổ lưu mã tài khoản; người đọc cần họ tên (components/erp/ten-nguoi.tsx).
  const tenNguoi = Object.fromEntries(
    (await listStaffDirectory().catch(() => [])).map((nguoi) => [nguoi.accountId, nguoi.displayName]),
  );

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <TenNguoiProvider ten={tenNguoi}>
      <AccountingControlCenter
        /*
          Trang này là nơi ba luồng tiền gặp nhau: bước 3–4 của đóng ca, bước 3
          và 5 của công nợ, và cả ba bước của nộp quỹ đều làm ở đây. Vì thế dựng
          cả ba dải, mỗi dải đếm đúng những hồ sơ mà chính trang này đang cầm.
          Ba dải gập sẵn và đứng ngay dưới tiêu đề (trước 04/10/2026 chúng đứng
          trên tiêu đề, mở màn ra không biết mình đang ở đâu).
        */
        sauTieuDe={
          <div className="space-y-3">
            {machViecCuaTrangNay.map(({ mach, trangThai }) => (
              <MachViecPanel
                key={mach.id}
                mach={mach}
                siteId={coSoChoDuongDan}
                viewerRole={user.role}
                trangThai={trangThai}
                dangODay="/erp/finance"
                gon
              />
            ))}
          </div>
        }
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
      </TenNguoiProvider>
    </ErpShell>
  );
}
