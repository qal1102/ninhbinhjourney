import { mergeProductSlotRows, CustomerBookingSlotsQuerySchema } from "@/domain/customer-booking";
import {
  CustomerBookingRepositoryError,
  isCustomerBookingEnabled,
  listCustomerProductSlots,
} from "@/lib/customer-data/booking-repository";

// TC-02 — chỉ đọc: trả danh sách khung giờ của một sản phẩm trong một ngày,
// kèm số chỗ còn lại thật từ `customer_list_product_slots`. Không cookie,
// không ghi, không khoá — gọi lại bao nhiêu lần cũng an toàn.
export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_DISABLED", message: "Đặt chỗ trực tuyến chưa được bật." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const parsedInput = CustomerBookingSlotsQuerySchema.safeParse({
    product_id: url.searchParams.get("product_id"),
    visit_date: url.searchParams.get("visit_date"),
  });
  if (!parsedInput.success) {
    return Response.json(
      { accepted: false, error: { code: "CUSTOMER_BOOKING_SLOTS_INPUT_INVALID", message: "Ngày hoặc sản phẩm chưa hợp lệ." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const rows = await listCustomerProductSlots({
      productId: parsedInput.data.product_id,
      visitDate: parsedInput.data.visit_date,
    });
    return Response.json(
      { accepted: true, slots: mergeProductSlotRows(rows) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const repositoryError = error instanceof CustomerBookingRepositoryError ? error : null;
    const status = repositoryError?.code === "CONFIGURATION_MISSING" || repositoryError?.code === "PERSISTENCE_FAILED"
      ? 503
      : 400;
    return Response.json(
      {
        accepted: false,
        error: {
          code: repositoryError ? `CUSTOMER_BOOKING_${repositoryError.code}` : "CUSTOMER_BOOKING_SLOTS_INPUT_INVALID",
          message: repositoryError?.message ?? "Chưa lấy được khung giờ lúc này.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
