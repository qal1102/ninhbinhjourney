import { z } from "zod";

export const DemoRoleSchema = z.enum([
  "visitor",
  "check-in-agent",
  "site-supervisor",
  "icc-operator",
  "finance",
  "content",
  "admin",
  "ritual-authority",
]);

export const DemoRunSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  regionId: z.uuid(),
  operatorId: z.uuid(),
  ownerUserId: z.uuid(),
  label: z.string().trim().min(2).max(80),
  status: z.enum(["active", "read-only", "expired"]),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const CreateDemoRunInputSchema = z.object({
  label: z.string().trim().min(2).max(80),
  sourceCode: z.string().trim().min(3).max(80).default("TRANGAN-WHARF-DEMO"),
  expiresInMinutes: z.number().int().min(30).max(240).default(120),
});

export const JoinDemoRunInputSchema = z.object({
  token: z.string().min(32).max(512),
});

export const ResetDemoRunInputSchema = z.object({
  demoRunId: z.uuid(),
});

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

export const ItineraryItemSchema = z
  .object({
    id: z.string().min(1),
    siteId: z.uuid(),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    travelMinutesFromPrevious: z.number().int().nonnegative(),
    reason: z.string().trim().min(2).max(500),
  })
  .refine((item) => Date.parse(item.endAt) > Date.parse(item.startAt), {
    message: "Itinerary item must end after it starts.",
    path: ["endAt"],
  });

export const IncidentDraftSchema = z.object({
  id: z.string().min(1),
  demoRunId: z.uuid(),
  transcript: z.string().trim().min(2).max(4000),
  siteId: z.uuid().optional(),
  category: z
    .enum([
      "crowd-capacity",
      "weather",
      "medical",
      "transport",
      "water-safety",
      "fire-safety",
      "infrastructure",
      "security",
      "lost-person",
      "other",
    ])
    .optional(),
  suggestedSeverity: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  waitTimeMinutes: z.number().int().nonnegative().max(1440).optional(),
  resourceRequest: z
    .object({
      resourceType: z.string().trim().min(2).max(120),
      quantity: z.number().int().positive().max(1000),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  sopId: z.uuid().optional(),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)),
  humanConfirmationRequired: z.literal(true),
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
});

export const UpdateJourneyRequestSchema = z.object({
  siteIds: z.array(z.uuid()).min(1).max(8),
});

export const CreateQuoteRequestSchema = z.object({
  itineraryId: z.uuid().optional(),
  productSelections: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(4),
  visitDate: z.iso.date(),
  partySize: z.number().int().min(1).max(20),
});

export const ConfirmBookingRequestSchema = z.object({
  quoteId: z.uuid(),
  customerDisplayName: z.string().trim().min(2).max(80),
  contactKind: z.enum(["email", "phone"]),
  contactValue: z.string().trim().min(5).max(160),
  consent: z.literal(true),
  idempotencyKey: z.string().min(16).max(200),
});

export const UpdateCapacityRequestSchema = z.object({
  capacity: z.number().int().min(0).max(10000),
  status: z.enum(["available", "paused", "closed"]),
});

export const InspectPassRequestSchema = z.object({
  lookupValue: z.string().trim().min(3).max(512),
  lookupKind: z.enum(["pass-token", "booking-code"]),
});

export const RedeemPassRequestSchema = InspectPassRequestSchema.extend({
  siteId: z.uuid().optional(),
  entitlementId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  idempotencyKey: z.string().min(16).max(200),
});

export const ConfirmIncidentRequestSchema = IncidentDraftSchema.extend({
  siteId: z.uuid(),
  category: z.enum([
    "crowd-capacity",
    "weather",
    "medical",
    "transport",
    "water-safety",
    "fire-safety",
    "infrastructure",
    "security",
    "lost-person",
    "other",
  ]),
  suggestedSeverity: z.enum(["P1", "P2", "P3", "P4"]),
});

export const UpdateIncidentRequestSchema = z.object({
  status: z.enum([
    "open",
    "acknowledged",
    "in-progress",
    "resolved",
    "closed",
  ]),
  assignedTo: z.uuid().nullable().optional(),
  resourceStatus: z
    .enum(["requested", "assigned", "fulfilled", "cancelled"])
    .nullable()
    .optional(),
});
