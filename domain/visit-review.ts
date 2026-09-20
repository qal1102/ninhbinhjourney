import { z } from "zod";

import { VISITOR_GROUP_MEMBER_CODE_PATTERN } from "@/domain/visitor-group";

/**
 * TC-12 — đánh giá có dấu chân.
 *
 * Hàm thuần, không gọi mạng. Nguồn sự thật nằm ở `erp_visit_reviews`; ở đây
 * chỉ có luật hình dạng, phép tính bảng điểm và chữ nói với khách.
 *
 * Điều khiến bảng điểm này khác mọi bảng điểm khác: một lời chỉ tồn tại khi
 * có một lượt quét ở cổng đứng sau nó. Luật ấy nằm trong SQL
 * (`202609200079_danh_gia_co_dau_chan.sql`), không phải ở đây — tầng này
 * không được phép nới nó.
 */

export const VISIT_REVIEW_COMMENT_MAX = 400;

export const VisitReviewSubmitSchema = z
  .object({
    member_code: z.string().trim().regex(VISITOR_GROUP_MEMBER_CODE_PATTERN),
    site_id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(VISIT_REVIEW_COMMENT_MAX),
  })
  .strict();

export const VisitReviewQuerySchema = z
  .object({
    member_code: z.string().trim().regex(VISITOR_GROUP_MEMBER_CODE_PATTERN),
  })
  .strict();

export type VisitReview = {
  siteId: string;
  rating: number;
  comment: string;
  updatedAt: string;
};

export type VisitReviewVoice = {
  rating: number;
  comment: string;
  createdAt: string;
};

export type SiteReviewSummary = {
  siteId: string;
  count: number;
  average: number;
  /** Số lượt từng mức sao, từ 1 tới 5. */
  spread: Record<"1" | "2" | "3" | "4" | "5", number>;
  recentVoices: VisitReviewVoice[];
};

function ratingFrom(value: unknown): number {
  const so = Number(value);
  if (!Number.isFinite(so)) return 0;
  const lam_tron = Math.round(so);
  return lam_tron >= 1 && lam_tron <= 5 ? lam_tron : 0;
}

export function visitReviewFrom(value: unknown): VisitReview | null {
  if (!value || typeof value !== "object") return null;
  const hang = value as Record<string, unknown>;
  const rating = ratingFrom(hang.rating);
  if (!hang.site_id || rating === 0) return null;
  return {
    siteId: String(hang.site_id),
    rating,
    comment: String(hang.comment ?? ""),
    updatedAt: hang.updated_at == null ? "" : String(hang.updated_at),
  };
}

export function visitReviewsFrom(value: unknown): VisitReview[] {
  if (!Array.isArray(value)) return [];
  return value.map(visitReviewFrom).filter((r): r is VisitReview => r !== null);
}

function voicesFrom(value: unknown): VisitReviewVoice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      const rating = ratingFrom(hang.rating);
      const comment = String(hang.comment ?? "").trim();
      if (rating === 0 || comment.length === 0) return null;
      return { rating, comment, createdAt: String(hang.created_at ?? "") };
    })
    .filter((v): v is VisitReviewVoice => v !== null);
}

export function siteReviewSummariesFrom(value: unknown): SiteReviewSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      if (!hang.site_id) return null;
      const pho = (hang.pho_diem ?? {}) as Record<string, unknown>;
      const dem = (muc: string) => {
        const so = Number(pho[muc]);
        return Number.isFinite(so) && so > 0 ? Math.round(so) : 0;
      };
      const count = Number(hang.so_luot);
      const average = Number(hang.diem_trung_binh);
      return {
        siteId: String(hang.site_id),
        count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
        average: Number.isFinite(average) ? average : 0,
        spread: { "1": dem("1"), "2": dem("2"), "3": dem("3"), "4": dem("4"), "5": dem("5") },
        recentVoices: voicesFrom(hang.loi_gan_day),
      };
    })
    .filter((s): s is SiteReviewSummary => s !== null && s.count > 0);
}

/**
 * Điểm trung bình đọc theo lối người Việt viết số: dấu phẩy, một chữ số lẻ.
 */
export function formatAverage(average: number): string {
  return average.toFixed(1).replace(".", ",");
}

/**
 * Bảng điểm chỉ hiện khi đã đủ ba người nói.
 *
 * Dưới ba lượt thì một người khó tính kéo cả nơi xuống 2 sao, mà người đọc lại
 * tưởng đó là nhận xét chung. Vẫn nói thật số lượt đã có, chỉ không dựng thành
 * điểm số.
 */
export const REVIEW_MIN_COUNT_FOR_AVERAGE = 3;

export function shouldShowAverage(summary: SiteReviewSummary | undefined): boolean {
  return (summary?.count ?? 0) >= REVIEW_MIN_COUNT_FOR_AVERAGE;
}

export const VISIT_REVIEW_COPY = {
  vi: {
    heading: "Kể một câu về nơi này",
    ratingLabel: (place: string) => `Bạn chấm ${place} mấy sao?`,
    stars: ["Chưa vừa ý", "Tạm được", "Được", "Hay", "Rất đáng đi"],
    commentLabel: "Bạn muốn kể thêm gì không? (không bắt buộc)",
    commentHint: `Tối đa ${VISIT_REVIEW_COMMENT_MAX} chữ. Bạn đừng ghi số điện thoại hay địa chỉ ở đây nhé.`,
    submit: "Gửi lời này",
    submitting: "Đang gửi…",
    saved: "Cảm ơn bạn đã kể lại ạ.",
    edit: "Sửa lại lời đã gửi",
    note: "Chỉ người đã qua cổng nơi này mới nói được một câu ở đây, nên bảng điểm nặng ký hơn hẳn.",
    summary: (average: string, count: number) => `${average}/5 · ${count} người đã tới đây chấm`,
    summaryThin: (count: number) =>
      count === 1
        ? "Mới một người tới đây kể lại, chưa đủ để dựng thành điểm số."
        : `Mới ${count} người kể lại, chưa đủ để dựng thành điểm số.`,
    empty: "Chưa ai kể lại về nơi này.",
    failed: "Lời của bạn chưa gửi đi được. Bạn thử lại giúp em một lượt nhé.",
  },
  en: {
    heading: "Say a word about this place",
    ratingLabel: (place: string) => `How many stars for ${place}?`,
    stars: ["Not for me", "So-so", "Good", "Really good", "Worth the trip"],
    commentLabel: "Anything else you'd like to add? (optional)",
    commentHint: `Up to ${VISIT_REVIEW_COMMENT_MAX} characters. Please don't put a phone number or address here.`,
    submit: "Send it",
    submitting: "Sending…",
    saved: "Thank you for telling us.",
    edit: "Edit what you sent",
    note: "Only people who came through the gate here can write, which is what makes this score mean something.",
    summary: (average: string, count: number) => `${average}/5 · ${count} visitors rated it`,
    summaryThin: (count: number) =>
      count === 1 ? "Only one visitor has written so far — too few for a score." : `Only ${count} visitors have written — too few for a score.`,
    empty: "Nobody has written about this place yet.",
    failed: "Your words didn't go through. Please try once more.",
  },
} as const;
