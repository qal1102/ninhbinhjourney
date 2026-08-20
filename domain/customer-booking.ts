import { z } from "zod";

export const CustomerBookingHoldRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    anonymous_id: z.string().uuid(),
    product_id: z.string().uuid(),
    visit_date: z.iso.date(),
    party_size: z.number().int().min(1).max(20),
  })
  .strict();

export const CustomerBookingConfirmationRequestSchema = z
  .object({
    payment_request_id: z.string().uuid(),
    hold_id: z.string().uuid(),
  })
  .strict();

export type CustomerBookingSlot = {
  slotId: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  capacitySource: "estimate" | "customer" | "measured";
  thresholdVersion: number;
};

export type CustomerBookingTicket = {
  ticketId: string;
  ticketCode: string;
  siteId: string;
  validOn: string;
  entriesAllowed: number;
  status: "issued" | "partially-used" | "used" | "void";
};
