import { z } from "zod";

import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import {
  getSiteReviewSummaries,
  VisitReviewRepositoryError,
} from "@/lib/customer-data/visit-review-repository";

/**
 * TC-12 — bảng điểm công khai của một nơi.
 *
 * Chỉ đọc, và chỉ trả số đếm, điểm trung bình cùng vài lời gần đây. Không tên,
 * không mã, không gì lần ra được một người. Vì thế đường này mở cho mọi trang
 * đọc, kể cả trang điểm đến mà khách chưa từng đặt gì.
 *
 * Giữ bản sao ở biên 5 phút: bảng điểm chậm 5 phút không hại ai, mà mỗi lượt
 * xem trang điểm đến lại gọi thẳng xuống cơ sở dữ liệu thì phí.
 */
const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } as const;
const NO_STORE = { "Cache-Control": "no-store" } as const;

const QuerySchema = z.object({ site_ids: z.array(z.string().uuid()).min(1).max(20) });

export async function GET(request: Request) {
  if (!isCustomerBookingEnabled()) {
    return Response.json({ accepted: true, summaries: [] }, { status: 200, headers: NO_STORE });
  }
  try {
    const raw = new URL(request.url).searchParams.getAll("site_id");
    const input = QuerySchema.parse({ site_ids: raw });
    const summaries = await getSiteReviewSummaries(input.site_ids);
    return Response.json(
      { accepted: true, summaries },
      { status: 200, headers: CACHE },
    );
  } catch (error) {
    // Chưa áp migration, hoặc kho tạm trục trặc: trang gọi chỉ cần biết "chưa
    // có gì để hiện", đừng dựng một khối lỗi giữa trang điểm đến.
    const loi = error instanceof VisitReviewRepositoryError ? error : null;
    if (loi && (loi.code === "NOT_READY" || loi.code === "CONFIGURATION_MISSING" || loi.code === "PERSISTENCE_FAILED")) {
      return Response.json({ accepted: true, summaries: [] }, { status: 200, headers: NO_STORE });
    }
    return Response.json(
      { accepted: false, error: { code: "SITE_REVIEW_INPUT_INVALID", message: "Yêu cầu chưa hợp lệ." } },
      { status: 400, headers: NO_STORE },
    );
  }
}
