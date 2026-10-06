import { redirect } from "next/navigation";
import { doThoiGian } from "@/lib/do-thoi-gian";
import { Customer360Dashboard } from "@/components/customer-data/customer-360-dashboard";
import { VisitReviewOverviewPanel } from "@/components/erp/visit-review-overview-panel";
import { TRIP_PASSPORT_PLACE_IDS } from "@/domain/trip-passport";
import type { SiteReviewOverview } from "@/domain/visit-review-overview";
import { listSiteReviewOverview } from "@/lib/customer-data/visit-review-overview-repository";
import { hideQuotaUsed } from "@/lib/erp/visit-review-moderation-repository";
import { canModerateReviews } from "@/domain/visit-review-moderation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { KhachThayGi } from "@/components/customer-data/khach-thay-gi";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import { hoSoTheoMaHoSo } from "@/lib/customer-data/ho-so-khach-repository";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Customer360Page({
  searchParams,
}: {
  searchParams: Promise<{ xem?: string }>;
}) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!canViewCustomer360(user.role)) redirect("/erp?denied=customer-data");

  const homNay = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const batDau = new Date(homNay);
  batDau.setDate(batDau.getDate() - 29);
  const ngay = (d: Date) => d.toISOString().slice(0, 10);
  const doc = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const { xem } = await searchParams;
  const xemHopLe = xem && UUID.test(xem) ? xem : null;

  let status: "disabled" | "unavailable" | "ready" = "disabled";
  let journeys: Customer360Journey[] = [];
  let orders: Customer360BookingOrder[] = [];
  let recommendations: CustomerRecommendation[] = [];
  let outboundActions: Customer360OutboundAction[] = [];
  const journeyEnabled = isCustomerJourneyPersistenceEnabled();
  const bookingEnabled = isCustomerBookingEnabled();
  const recommendationsEnabled = isCustomerRecommendationsEnabled();

  /*
   * Bảng điểm 30 ngày (TC-12 mục 2) và hồ sơ khách khi đường dẫn đã chỉ rõ
   * ai: không phụ thuộc đơn hay gợi ý, nên đọc cùng nhóm song song với chúng.
   * Trước 27/09 chúng nối đuôi sau mọi lượt đọc khác, màn này mất khoảng 2,7
   * giây. Cả hai tự trả rỗng khi lỗi, nên không kéo đổ nhóm; và vẫn chỉ đọc
   * SAU khi đã ghi nhật ký truy cập, như mọi dữ liệu khách.
   */
  const docDanhGia = (): Promise<[SiteReviewOverview[], number]> =>
    bookingEnabled
      ? Promise.all([
          listSiteReviewOverview({
            siteIds: [...TRIP_PASSPORT_PLACE_IDS],
            from: ngay(batDau),
            to: ngay(homNay),
          }),
          // Hạn mức đã dùng: chỉ hỏi khi vai thật sự ẩn được, đỡ một lượt đọc thừa.
          canModerateReviews(user.role) ? hideQuotaUsed(user.id) : Promise.resolve(0),
        ])
      : Promise.resolve([[], 0]);
  const docHoSoTheoDuongDan = (): Promise<HoSoKhach | null> =>
    bookingEnabled && xemHopLe ? hoSoTheoMaHoSo(xemHopLe).catch(() => null) : Promise.resolve(null);

  let danhGia: [SiteReviewOverview[], number] | null = null;
  let hoSoXem: HoSoKhach | null = null;
  if (journeyEnabled || bookingEnabled || recommendationsEnabled) {
    try {
      // Ghi nhật ký truy cập TRƯỚC khi đọc bất cứ đơn hay gợi ý nào — đọc hành
      // trình tự ghi nhật ký bên trong nó, nên nó phải đi đầu, một mình.
      if (journeyEnabled) {
        journeys = await doThoiGian("kh/hanh-trinh", listCustomer360Journeys(user.id));
      } else {
        await doThoiGian("kh/nhat-ky", auditCustomer360Access(user.id));
      }
      // Các lượt đọc còn lại không phụ thuộc nhau, nên chạy song song.
      const [orderResult, queue, danhGiaDoc, hoSoDoc] = await Promise.all([
        bookingEnabled ? doThoiGian("kh/don", listCustomer360BookingOrders()) : Promise.resolve(null),
        recommendationsEnabled ? doThoiGian("kh/goi-y", listCustomer360Recommendations()) : Promise.resolve(null),
        doThoiGian("kh/danh-gia", docDanhGia()),
        doThoiGian("kh/ho-so-url", docHoSoTheoDuongDan()),
      ]);
      danhGia = danhGiaDoc;
      hoSoXem = hoSoDoc;
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
  // Nhóm trên hỏng hoặc không chạy thì hai khối này vẫn phải có.
  const [reviewRows, hidesUsed] = danhGia ?? (await docDanhGia());

  /*
   * "Khách thấy gì" — giám đốc đứng ở vị trí khách để trình diễn: hộ chiếu
   * của một khách thật, dựng bằng đúng thành phần trang /ho-so đang dùng.
   * Chưa chọn ai thì lấy khách của đơn mới nhất, để màn hình không trống.
   */
  const maXem = xemHopLe ?? orders[0]?.profileId ?? null;
  if (!hoSoXem && bookingEnabled && maXem) {
    try {
      hoSoXem = await doThoiGian("kh/ho-so", hoSoTheoMaHoSo(maXem));
    } catch {
      hoSoXem = null;
    }
  }

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <Customer360Dashboard status={status} journeys={journeys} orders={orders} recommendations={recommendations} outboundActions={outboundActions} />
      <KhachThayGi hoSo={hoSoXem} maKhach={maXem} />
      {reviewRows.length > 0 ? (
        <div className="mt-6">
          <VisitReviewOverviewPanel rows={reviewRows} fromLabel={doc(batDau)} toLabel={doc(homNay)} viewerRole={user.role} hidesUsedIn30Days={hidesUsed} />
        </div>
      ) : null}
    </ErpShell>
  );
}
