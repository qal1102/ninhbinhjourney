import { redirect } from "next/navigation";
import {
  AccountAdministration,
  type QuyenHienThi,
} from "@/components/erp/account-administration";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ERP_MODULES, ERP_SITES } from "@/domain/erp";
import { isHiddenErpTestAccount } from "@/domain/erp-data-origin";
import {
  getRegistryAccount,
  hasSystemAdmin,
  listAccountAdminAudit,
  listRegistryAccounts,
} from "@/lib/erp/account-registry-repository";
import { findDemoErpAccountById } from "@/lib/erp/demo-data";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { getAccessState } from "@/lib/erp/staff-access-repository";
import { dungTaiKhoanHieuLuc } from "@/lib/erp/tai-khoan-hieu-luc";

const TEN_CO_SO = new Map(ERP_SITES.map((site) => [site.id, site.shortName]));
const TEN_VIEC = new Map(ERP_MODULES.map((module) => [module.id, module.shortName]));

export default async function ErpAccountAdministrationPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  // Gated on the `system-admin` grant, not on being the director. The two are
  // separate powers here (see docs/HANDOFF.md T7): a director holds both, but
  // the audit trail has to be able to tell them apart.
  const registryAccount = await getRegistryAccount(user.id);
  if (!hasSystemAdmin(registryAccount)) redirect("/erp");

  const [allAccounts, audit, access] = await Promise.all([
    listRegistryAccounts(),
    listAccountAdminAudit(),
    getAccessState(),
  ]);
  // Ẩn ở đây, không ẩn trong `listRegistryAccounts`: bộ sinh mã tài khoản đọc
  // chính danh sách ấy để khỏi ghi đè một mã đang dùng, nên nó phải thấy đủ.
  const accounts = allAccounts.filter((account) => !isHiddenErpTestAccount(account));
  const hiddenTestAccounts = allAccounts.filter(isHiddenErpTestAccount);

  // Quyền đang có hiệu lực của từng người, tính bằng đúng luật lúc họ đăng
  // nhập (`domain/quyen-hieu-luc.ts`). Màn hình này không tự suy luận quyền:
  // cái nó hiện ra chính là cái người ấy mở được.
  const quyen: Record<string, QuyenHienThi> = {};
  for (const account of accounts) {
    const demo = findDemoErpAccountById(account.accountId);
    const taiKhoan = dungTaiKhoanHieuLuc(account, access);
    quyen[account.accountId] = {
      tenDangNhap: demo?.username ?? (account.hasAuthUser ? account.accountId : null),
      coSo: taiKhoan
        ? taiKhoan.quyen.siteIds.map((siteId) => ({
            ten: TEN_CO_SO.get(siteId) ?? siteId,
            viec: (taiKhoan.quyen.moduleIdsBySite[siteId] ?? []).map((id) => TEN_VIEC.get(id) ?? id),
          }))
        : [],
      conHieuLuc: taiKhoan?.conHieuLuc ?? false,
      moiViec: taiKhoan?.role === "director" || taiKhoan?.role === "manager",
    };
  }
  const tenTheoMa = Object.fromEntries(allAccounts.map((account) => [account.accountId, account.displayName]));

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <AccountAdministration accounts={accounts} audit={audit} quyen={quyen} tenTheoMa={tenTheoMa} />
      {hiddenTestAccounts.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-[#d8e0db] bg-[#f7f9f7] p-4 text-sm text-[#5d6c65] sm:p-5">
          <summary className="cursor-pointer font-bold text-[#42574e]">
            Đang ẩn {hiddenTestAccounts.length.toLocaleString("vi-VN")} tài khoản tạo ra khi chạy thử tự động, đều đã khoá
          </summary>
          <p className="mt-3 leading-6">
            Đây không phải nhân viên thật. Chúng được khoá lại và cất khỏi danh
            sách phía trên. Nếu có tài khoản kiểm thử nào còn đang mở, nó sẽ
            không bị ẩn, để bạn khoá được ngay.
          </p>
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {hiddenTestAccounts.map((account) => (
              <li key={account.accountId}>{account.accountId}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </ErpShell>
  );
}
