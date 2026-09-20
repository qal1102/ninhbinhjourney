import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  siteReviewSummariesFrom,
  visitReviewFrom,
  visitReviewsFrom,
  type SiteReviewSummary,
  type VisitReview,
} from "@/domain/visit-review";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class VisitReviewRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CONFIGURATION_MISSING"
      | "INPUT_INVALID"
      | "MEMBER_NOT_FOUND"
      | "KHONG_CO_DAU_CHAN"
      | "NOT_READY"
      | "PERSISTENCE_FAILED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "VisitReviewRepositoryError";
  }
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new VisitReviewRepositoryError(
      "Kho đánh giá chưa được cấu hình đủ ở phía máy chủ.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-visit-review-server" } },
  });
}

/**
 * Hàm chưa có trên cơ sở dữ liệu: PostgREST báo `PGRST202`, PostgreSQL báo
 * `42883`. Mã lên production trước khi migration được áp là chuyện có thật ở
 * dự án này, nên trạng thái ấy phải có tên riêng chứ không trộn vào lỗi chung.
 */
function isMissingDatabaseFunction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "PGRST202" || code === "42883";
}

function mapRepositoryError(error: unknown): VisitReviewRepositoryError {
  if (isMissingDatabaseFunction(error)) {
    return new VisitReviewRepositoryError("Phần này sắp mở ạ.", "NOT_READY");
  }
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const mappings: Array<[string, VisitReviewRepositoryError["code"], string]> = [
    ["REVIEW_KHONG_CO_DAU_CHAN", "KHONG_CO_DAU_CHAN", "Nơi này chưa ghi nhận lượt vào bằng mã của bạn."],
    ["REVIEW_MEMBER_NOT_FOUND", "MEMBER_NOT_FOUND", "Không tìm thấy mã khách này trong đoàn nào."],
    ["REVIEW_RATING_INVALID", "INPUT_INVALID", "Số sao chưa hợp lệ."],
    ["REVIEW_COMMENT_TOO_LONG", "INPUT_INVALID", "Lời kể dài quá mức cho phép."],
    ["REVIEW_TOO_MANY_SITES", "INPUT_INVALID", "Hỏi quá nhiều nơi trong một lượt."],
    ["REVIEW_INPUT_INVALID", "INPUT_INVALID", "Yêu cầu chưa hợp lệ."],
  ];
  for (const [needle, code, safeMessage] of mappings) {
    if (message.includes(needle)) return new VisitReviewRepositoryError(safeMessage, code);
  }
  return new VisitReviewRepositoryError(
    "Kho đánh giá tạm thời chưa xử lý được yêu cầu.",
    "PERSISTENCE_FAILED",
    { cause: error instanceof Error ? error : undefined },
  );
}

export async function submitVisitReview(input: {
  memberCode: string;
  siteId: string;
  rating: number;
  comment: string;
}): Promise<VisitReview> {
  const { data, error } = await createAdminClient().rpc("erp_submit_visit_review", {
    p_tenant_id: TENANT_ID,
    p_member_code: input.memberCode,
    p_site_id: input.siteId,
    p_rating: input.rating,
    p_comment: input.comment,
  });
  if (error) throw mapRepositoryError(error);
  const review = visitReviewFrom(data);
  if (!review) throw mapRepositoryError(new Error("REVIEW_INPUT_INVALID"));
  return review;
}

export async function getVisitReviewsOfMember(memberCode: string): Promise<VisitReview[]> {
  const { data, error } = await createAdminClient().rpc("erp_visit_reviews_of_member", {
    p_tenant_id: TENANT_ID,
    p_member_code: memberCode,
  });
  if (error) throw mapRepositoryError(error);
  return visitReviewsFrom(data);
}

/**
 * Bảng điểm công khai. Nơi nào chưa ai nói thì không có hàng nào trả về —
 * trang gọi phải hiểu "không có hàng" là "chưa ai kể", đừng dựng số 0 lên
 * thành điểm.
 */
export async function getSiteReviewSummaries(siteIds: string[]): Promise<SiteReviewSummary[]> {
  if (siteIds.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("erp_site_review_summary", {
    p_tenant_id: TENANT_ID,
    p_site_ids: siteIds,
  });
  if (error) throw mapRepositoryError(error);
  return siteReviewSummariesFrom(data);
}
