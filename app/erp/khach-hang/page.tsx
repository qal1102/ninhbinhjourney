import { redirect } from "next/navigation";
import { Customer360Dashboard } from "@/components/customer-data/customer-360-dashboard";
import { ErpShell } from "@/components/erp/erp-shell";
import { canViewCustomer360 } from "@/domain/customer-journey";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import {
  isCustomerJourneyPersistenceEnabled,
  listCustomer360Journeys,
  type Customer360Journey,
} from "@/lib/customer-data/journey-repository";

export default async function Customer360Page() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!canViewCustomer360(user.role)) redirect("/erp?denied=customer-data");

  let status: "disabled" | "unavailable" | "ready" = "disabled";
  let journeys: Customer360Journey[] = [];
  if (isCustomerJourneyPersistenceEnabled()) {
    try {
      journeys = await listCustomer360Journeys(user.id);
      status = "ready";
    } catch (error) {
      console.error("Customer 360 read failed", error);
      status = "unavailable";
    }
  }

  return (
    <ErpShell user={user}>
      <Customer360Dashboard status={status} journeys={journeys} />
    </ErpShell>
  );
}
