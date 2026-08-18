import { z } from "zod";
import type { Itinerary, JourneyIntent } from "@/domain/models";
import type { ErpRole } from "@/domain/erp";

const SOURCE_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "qr_source_id",
  "campaign_id",
  "placement_id",
  "partner_id",
  "click_id",
  "referrer_class",
  "entry_path",
] as const;

const safeSourceValue = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine(
    (value) =>
      !/(^|[^\w.%+-])[\w.%+-]+@[\w.-]+\.[a-z]{2,}($|[^\w.%+-])|(^|\D)(?:\+?84|0)[\d .-]{8,12}($|\D)/i.test(
        value,
      ),
    "Nguồn hành trình không được chứa dữ liệu liên hệ.",
  );

export const CustomerJourneySourceSchema = z
  .object(
    Object.fromEntries(
      SOURCE_KEYS.map((key) => [key, safeSourceValue.optional()]),
    ) as Record<(typeof SOURCE_KEYS)[number], z.ZodOptional<typeof safeSourceValue>>,
  )
  .strict();

const PartyContextSchema = z.enum(["travelling-with-parents"]);
const InterestSchema = z.enum([
  "heritage",
  "nature",
  "photography",
  "food",
  "spirituality",
]);

export const CustomerJourneyIntentSummarySchema = z
  .object({
    locale: z.enum(["vi", "en"]),
    duration_minutes: z.number().int().positive().max(7 * 24 * 60),
    party: z.object({
      adults: z.number().int().min(0).max(20),
      children: z.number().int().min(0).max(20),
      seniors: z.number().int().min(0).max(20),
    }),
    party_context: z.array(PartyContextSchema).max(8),
    interests: z.array(InterestSchema).max(12),
    pace: z.enum(["relaxed", "balanced", "active"]),
    walking_tolerance: z.enum(["low", "moderate", "high"]),
    budget_band: z.enum(["under-1m", "1m-to-3m", "over-3m", "unspecified"]),
    visit_date: z.string().date(),
  })
  .strict();

export const CustomerJourneyItinerarySnapshotSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            site_id: z.string().uuid(),
            start_at: z.string().datetime({ offset: true }),
            end_at: z.string().datetime({ offset: true }),
            travel_minutes_from_previous: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(8),
    total_minutes: z.number().int().nonnegative(),
    estimated_price_band: z.enum(["under-1m", "1m-to-3m", "over-3m"]),
  })
  .strict();

export type CustomerJourneyIntentSummary = z.infer<
  typeof CustomerJourneyIntentSummarySchema
>;
export type CustomerJourneyItinerarySnapshot = z.infer<
  typeof CustomerJourneyItinerarySnapshotSchema
>;
export type CustomerJourneySource = z.infer<typeof CustomerJourneySourceSchema>;

function priceBand(value: number | undefined) {
  if (!value) return "unspecified" as const;
  if (value < 1_000_000) return "under-1m" as const;
  if (value <= 3_000_000) return "1m-to-3m" as const;
  return "over-3m" as const;
}

export function customerJourneyIntentSummary(
  intent: JourneyIntent,
): CustomerJourneyIntentSummary {
  return CustomerJourneyIntentSummarySchema.parse({
    locale: intent.locale,
    duration_minutes: intent.durationMinutes,
    party: intent.party,
    party_context: intent.partyContext,
    interests: intent.interests,
    pace: intent.pace,
    walking_tolerance: intent.walkingTolerance,
    budget_band: priceBand(intent.budgetVnd?.target),
    visit_date: intent.visitDate ?? new Date().toISOString().slice(0, 10),
  });
}

export function customerJourneyItinerarySnapshot(
  itinerary: Itinerary,
): CustomerJourneyItinerarySnapshot {
  const estimatedPriceBand = priceBand(itinerary.estimatedPriceVnd);
  return CustomerJourneyItinerarySnapshotSchema.parse({
    items: itinerary.items.map((item) => ({
      site_id: item.siteId,
      start_at: item.startAt,
      end_at: item.endAt,
      travel_minutes_from_previous: item.travelMinutesFromPrevious,
    })),
    total_minutes: itinerary.totalMinutes,
    estimated_price_band:
      estimatedPriceBand === "unspecified" ? "under-1m" : estimatedPriceBand,
  });
}

export function customerJourneySourceFromRequest(request: Request): CustomerJourneySource {
  const source: Record<string, string> = { entry_path: "/plan" };
  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  let referrerClass = "direct";

  if (referer) {
    try {
      const url = new URL(referer);
      referrerClass = url.origin === origin ? "internal" : "external";
      if (url.origin === origin) {
        for (const key of SOURCE_KEYS) {
          if (key === "referrer_class" || key === "entry_path") continue;
          const value = url.searchParams.get(key) ??
            (key === "utm_source" ? url.searchParams.get("source") : null);
          if (value) source[key] = value;
        }
      }
    } catch {
      referrerClass = "unknown";
    }
  }
  source.referrer_class = referrerClass;
  return CustomerJourneySourceSchema.parse(source);
}

export function canViewCustomer360(role: ErpRole) {
  return role === "director";
}
