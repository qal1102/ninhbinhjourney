import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { hoSoTheoLienHe, HoSoKhachError } from "@/lib/customer-data/ho-so-khach-repository";

/**
 * Mở hộ chiếu Ninh Bình từ một máy khác: số điện thoại hoặc email CỘNG một
 * mã đặt chỗ, đúng cặp khoá của trang tra cứu vé. Chỉ đọc.
 */

const NO_STORE = { "Cache-Control": "no-store" };
const YeuCau = z
  .object({
    contact: z.string().trim().min(6).max(160),
    order_code: z.string().trim().min(6).max(40),
  })
  .strict();

export async function POST(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json(
      { accepted: false, error: { message: "Hồ sơ khách chưa mở ở bản này." } },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json({ accepted: false, error: { message: "Yêu cầu không hợp lệ." } }, { status: 403, headers: NO_STORE });
  }
  const body = await request.json().catch(() => null);
  const parsed = YeuCau.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { accepted: false, error: { message: "Mời bạn nhập mã đặt chỗ và số điện thoại hoặc email đã dùng lúc đặt." } },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const hoSo = await hoSoTheoLienHe({ contact: parsed.data.contact, orderCode: parsed.data.order_code });
    return Response.json({ accepted: true, hoSo }, { headers: NO_STORE });
  } catch (error) {
    const loi = error instanceof HoSoKhachError ? error : null;
    return Response.json(
      { accepted: false, error: { message: loi?.message ?? "Chưa đọc được hồ sơ, mời bạn thử lại." } },
      { status: loi?.code === "NOT_FOUND" ? 404 : loi?.code === "CONFIGURATION_MISSING" ? 503 : 500, headers: NO_STORE },
    );
  }
}
