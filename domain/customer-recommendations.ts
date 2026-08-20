import { z } from "zod";

export const CustomerRecommendationSchema = z.object({
  recommendationId: z.string().uuid(),
  profileId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().min(1),
  ruleVersion: z.string().min(3).max(80),
  reasonCode: z.string().min(3).max(80),
  status: z.enum(["available", "shown", "clicked", "accepted", "suppressed", "expired"]),
  expiresAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});

export type CustomerRecommendation = z.infer<typeof CustomerRecommendationSchema>;

export const RECOMMENDATION_REASON_LABELS: Record<string, string> = {
  explicit_party_children: "Khách đã chủ động chọn nhóm có trẻ em.",
  explicit_relaxed_or_low_walking: "Khách đã chủ động chọn nhịp thư thả hoặc khả năng đi bộ thấp.",
  explicit_active_photography: "Khách đã chủ động chọn nhịp năng động và quan tâm nhiếp ảnh.",
};
