import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { StaffRequestCenter } from "@/components/erp/staff-request-center";
import { ERP_SITES } from "@/domain/erp";
import type { StaffRequest } from "@/domain/erp-staff-requests";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import {
  StaffRequestRepositoryError,
  listStaffRequests,
  staffRequestStorage,
} from "@/lib/erp/staff-request-repository";

/** ERP-DE-XUAT-01 — đề xuất & phê duyệt. Mọi vai trò đều vào; máy chủ cắt phạm vi nhìn. */
export default async function StaffRequestsPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const viewer = { id: user.id, name: user.name, role: user.role, siteIds: user.siteIds };
  let requests: StaffRequest[] = [];
  let unavailableMessage: string | null = null;
  try {
    requests = await listStaffRequests({ ...viewer, actingDirectorId: user.actingAs?.directorId ?? null });
  } catch (error) {
    console.error("Staff request list failed", error);
    unavailableMessage =
      error instanceof StaffRequestRepositoryError
        ? error.message
        : "Chưa đọc được danh sách đề xuất. Xin tải lại trang; nếu vẫn vậy thì báo bộ phận kỹ thuật.";
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <StaffRequestCenter
        viewer={viewer}
        sites={ERP_SITES.map((site) => ({ id: site.id, shortName: site.shortName }))}
        requests={requests}
        today={today}
        storage={staffRequestStorage()}
        unavailableMessage={unavailableMessage}
      />
    </ErpShell>
  );
}
