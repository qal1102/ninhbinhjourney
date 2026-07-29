import { z } from "zod";

export const DomainEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("qr.source.opened"),
    at: z.iso.datetime(),
    qrSourceId: z.uuid(),
    campaignId: z.uuid(),
  }),
  z.object({
    type: z.literal("journey.intent.confirmed"),
    at: z.iso.datetime(),
    intentId: z.uuid(),
  }),
  z.object({
    type: z.literal("itinerary.created"),
    at: z.iso.datetime(),
    itineraryId: z.uuid(),
  }),
  z.object({
    type: z.literal("itinerary.updated"),
    at: z.iso.datetime(),
    itineraryId: z.uuid(),
  }),
  z.object({
    type: z.literal("quote.created"),
    at: z.iso.datetime(),
    quoteId: z.uuid(),
  }),
  z.object({
    type: z.literal("booking.created"),
    at: z.iso.datetime(),
    bookingId: z.uuid(),
  }),
  z.object({
    type: z.literal("pass.issued"),
    at: z.iso.datetime(),
    passId: z.uuid(),
  }),
  z.object({
    type: z.literal("pass.redeemed"),
    at: z.iso.datetime(),
    passId: z.uuid(),
    entitlementId: z.uuid(),
    redemptionId: z.uuid(),
  }),
  z.object({
    type: z.literal("pass.redemption-rejected"),
    at: z.iso.datetime(),
    passId: z.uuid().optional(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("incident.draft-created"),
    at: z.iso.datetime(),
    draftId: z.string(),
  }),
  z.object({
    type: z.literal("incident.confirmed"),
    at: z.iso.datetime(),
    incidentId: z.uuid(),
  }),
  z.object({
    type: z.literal("demo.state-reset"),
    at: z.iso.datetime(),
    actorId: z.uuid(),
  }),
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
