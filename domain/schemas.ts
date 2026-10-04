import { z } from "zod";

export const JourneyIntentSchema = z.object({
  id: z.string().min(1),
  demoRunId: z.uuid(),
  locale: z.enum(["vi", "en"]),
  rawText: z.string().trim().min(2).max(4000),
  durationMinutes: z.number().int().positive().max(7 * 24 * 60),
  party: z.object({
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    seniors: z.number().int().min(0).max(20),
  }),
  partyContext: z.array(z.string().min(1)).max(8),
  interests: z.array(z.string().min(1)).max(12),
  pace: z.enum(["relaxed", "balanced", "active"]),
  walkingTolerance: z.enum(["low", "moderate", "high"]),
  budgetVnd: z
    .object({
      target: z.number().int().nonnegative(),
      tolerancePercent: z.number().int().min(0).max(100),
    })
    .optional(),
  accessibilityNeeds: z.array(z.string()).max(12),
  startSiteId: z.uuid().optional(),
  visitDate: z.iso.date().optional(),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)),
});

export const CreateJourneyRequestSchema = z.object({
  text: z.string().trim().min(2).max(4000),
  locale: z.enum(["vi", "en"]).default("vi"),
  durationMinutes: z.number().int().positive().max(7 * 24 * 60),
  party: z.object({
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    seniors: z.number().int().min(0).max(20),
  }),
  partyContext: z.array(z.string().min(1)).max(8).default([]),
  pace: z.enum(["relaxed", "balanced", "active"]),
  walkingTolerance: z.enum(["low", "moderate", "high"]),
  budgetVnd: z
    .object({
      target: z.number().int().nonnegative(),
      tolerancePercent: z.number().int().min(0).max(100),
    })
    .optional(),
  visitDate: z.iso.date().default("2026-08-15"),
  /** Điểm khách bấm "Thêm vào hành trình" ở trang điểm đến hay Khám phá. */
  uuTienSiteId: z.uuid().optional(),
});
