import { notFound, redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { StaffProfileView } from "@/components/erp/staff-profile-view";
import {
  canViewRegistryProfile,
  getRegistryAccount,
  hasSystemAdmin,
  listAccountAdminAudit,
  sitesFromGrants,
} from "@/lib/erp/account-registry-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  params: Promise<{ accountId: string }>;
};

export default async function StaffProfilePage({ params }: Props) {
  const { accountId } = await params;
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const target = await getRegistryAccount(accountId);
  if (!target) notFound();

  const systemAdmin = hasSystemAdmin(await getRegistryAccount(user.id));
  const visible = canViewRegistryProfile(
    { accountId: user.id, siteIds: user.siteIds },
    systemAdmin,
    target,
  );
  if (!visible) redirect("/erp?denied=profile");

  // T14: a manager edits profile fields for anyone sharing a site with
  // them (including themselves) -- the same rule `erp_manager_update_profile`
  // enforces at the database layer. Employees never get the form, matching
  // SO_TAY_HE_THONG_VI.md mục 6: they can view their own profile, not edit it.
  const canEdit =
    systemAdmin ||
    (user.role === "manager" &&
      sitesFromGrants(target).some((siteId) => user.siteIds.includes(siteId)));

  const audit = await listAccountAdminAudit(30, target.accountId);

  return (
    <ErpShell user={user}>
      <StaffProfileView account={target} canEdit={canEdit} audit={audit} />
    </ErpShell>
  );
}
