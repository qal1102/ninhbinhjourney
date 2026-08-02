import { redirect } from "next/navigation";
import { AccountAdministration } from "@/components/erp/account-administration";
import { ErpShell } from "@/components/erp/erp-shell";
import {
  getRegistryAccount,
  hasSystemAdmin,
  listAccountAdminAudit,
  listRegistryAccounts,
} from "@/lib/erp/account-registry-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export default async function ErpAccountAdministrationPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  // Gated on the `system-admin` grant, not on being the director. The two are
  // separate powers here (see docs/HANDOFF.md T7): a director holds both, but
  // the audit trail has to be able to tell them apart.
  const registryAccount = await getRegistryAccount(user.id);
  if (!hasSystemAdmin(registryAccount)) redirect("/erp");

  const [accounts, audit] = await Promise.all([
    listRegistryAccounts(),
    listAccountAdminAudit(),
  ]);

  return (
    <ErpShell user={user}>
      <AccountAdministration accounts={accounts} audit={audit} />
    </ErpShell>
  );
}
