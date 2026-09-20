import { redirect } from "next/navigation";
import { Customer360Dashboard } from "@/components/customer-data/customer-360-dashboard";
import { VisitReviewOverviewPanel } from "@/components/erp/visit-review-overview-panel";
import { TRIP_PASSPORT_PLACE_IDS } from "@/domain/trip-passport";
import type { SiteReviewOverview } from "@/domain/visit-review-overview";
import { listSiteReviewOverview } from "@/lib/customer-data/visit-review-overview-repository";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { canViewCustomer360 } from "@/domain/customer-journey";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import {
  isCustomerJourneyPersistenceEnabled,
  listCustomer360Journeys,
  type Customer360Journey,
} from "@/lib/customer-data/journey-repository";
import {
  isCustomerBookingEnabled,
  listCustomer360BookingOrders,
  type Customer360BookingOrder,
} from "@/lib/customer-data/booking-repository";
import {
  isCustomerRecommendationsEnabled,
  listCustomer360Recommendations,
  type Customer360OutboundAction,
} from "@/lib/customer-data/recommendation-repository";
import type { CustomerRecommendation } from "@/domain/customer-recommendations";
import { auditCustomer360Access } from "@/lib/customer-data/identity-repository";

export default async function Customer360Page() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!canViewCustomer360(user.role)) redirect("/erp?denied=customer-data");

  let status: "disabled" | "unavailable" | "ready" = "disabled";
  let journeys: Customer360Journey[] = [];
  let orders: Customer360BookingOrder[] = [];
  let recommendations: CustomerRecommendation[] = [];
  let outboundActions: Customer360OutboundAction[] = [];
  const journeyEnabled = isCustomerJourneyPersistenceEnabled();
  const bookingEnabled = isCustomerBookingEnabled();
  const recommendationsEnabled = isCustomerRecommendationsEnabled();
  if (journeyEnabled || bookingEnabled || recommendationsEnabled) {
    try {
      // Ghi nhật ký truy cập TRƯỚC khi đọc bất cứ đơn hay gợi ý nào — đọc hành
      // trình tự ghi nhật ký bên trong nó, nên nó phải đi đầu, một mình.
      if (journeyEnabled) {
        journeys = await listCustomer360Journeys(user.id);
      } else {
        await auditCustomer360Access(user.id);
      }
      // Hai lượt đọc còn lại không phụ thuộc nhau, nên chạy song song thay vì
      // nối đuôi. Lượt kiểm tay ngày 12/09/2026 thấy màn hình này chậm; đo lại
      // ra khoảng 3 giây, chậm hơn màn Tài chính chừng một giây — đúng cỡ một
      // lượt chờ nối đuôi thừa.
      const [orderResult, queue] = await Promise.all([
        bookingEnabled ? listCustomer360BookingOrders() : Promise.resolve(null),
        recommendationsEnabled ? listCustomer360Recommendations() : Promise.resolve(null),
      ]);
      if (orderResult) orders = orderResult;
      if (queue) {
        recommendations = queue.recommendations;
        outboundActions = queue.outboundActions;
      }
      status = "ready";
    } catch (error) {
      console.error("Customer 360 read failed", error);
      status = "unavailable";
    }
  }

  /*
   * TC-12 mục 2 — bảng điểm 30 ngày gần nhất, tính theo ngày Việt Nam. Đọc
   * riêng và nuốt lỗi bên trong kho: khối này hỏng thì ba khối kia của màn
   * hình Khách hàng vẫn phải sống.
   */
  const homNay = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const batDau = new Date(homNay);
  batDau.setDate(batDau.getDate() - 29);
  const ngay = (d: Date) => d.toISOString().slice(0, 10);
  const doc = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  let reviewRows: SiteReviewOverview[] = [];
  if (bookingEnabled) {
    reviewRows = await listSiteReviewOverview({
      siteIds: [...TRIP_PASSPORT_PLACE_IDS],
      from: ngay(batDau),
      to: ngay(homNay),
    });
  }

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <Customer360Dashboard status={status} journeys={journeys} orders={orders} recommendations={recommendations} outboundActions={outboundActions} />
      {reviewRows.length > 0 ? (
        <div className="mt-6">
          <VisitReviewOverviewPanel rows={reviewRows} fromLabel={doc(batDau)} toLabel={doc(homNay)} />
        </div>
      ) : null}
    </ErpShell>
  );
}
