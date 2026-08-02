import { notFound, redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { StaffProfileView } from "@/components/erp/staff-profile-view";
import { AuditTimelineView } from "@/components/erp/audit-timeline-view";
import {
  canViewRegistryProfile,
  getRegistryAccount,
  hasSystemAdmin,
  listAccountAdminAudit,
  sitesFromGrants,
} from "@/lib/erp/account-registry-repository";
import { listAuditTimeline } from "@/lib/erp/audit-timeline-repository";
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

  // T15: "bấm vào profile thấy toàn bộ hoạt động của riêng họ". Phạm vi vẫn do
  // `erp_audit_timeline` quyết định theo vai trò **người đang xem** — lọc theo
  // một người chỉ thu hẹp, không mở thêm gì.
  const activity = await listAuditTimeline({
    viewerAccountId: user.id,
    actorAccountId: target.accountId,
    limit: 100,
  }).catch((error) => {
    console.error("Profile activity read failed", error);
    return [];
  });

  return (
    <ErpShell user={user}>
      <div className="space-y-5">
        <StaffProfileView account={target} canEdit={canEdit} audit={audit} />
        <section>
          <h2 className="mb-3 text-xl font-black text-[#20342c]">
            Hoạt động của {target.displayName}
          </h2>
          <AuditTimelineView
            entries={activity}
            compact
            emptyMessage={`Chưa có thao tác nào của ${target.displayName} trong phạm vi bạn được xem.`}
          />
        </section>
      </div>
    </ErpShell>
  );
}
