export type UUID = string;
export type ISODateTime = string;
export type Currency = "VND";

export type DemoRole =
  | "visitor"
  | "check-in-agent"
  | "site-supervisor"
  | "icc-operator"
  | "finance"
  | "content"
  | "admin"
  | "ritual-authority";

export type InternalRole = Exclude<DemoRole, "visitor">;

export interface DemoRun {
  id: UUID;
  tenantId: UUID;
  regionId: UUID;
  operatorId: UUID;
  ownerUserId: UUID;
  label: string;
  status: "active" | "read-only" | "expired";
  expiresAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface DemoRunMember {
  demoRunId: UUID;
  tenantId: UUID;
  userId: UUID;
  role: DemoRole;
  status: "active" | "revoked";
  joinedAt: ISODateTime;
}

export interface Site {
  id: UUID;
  tenantId: UUID;
  regionId: UUID;
  operatorId: UUID;
  name: string;
  slug: string;
  coordinates: [number, number];
  tags: string[];
  mobilityLevel: "low" | "moderate" | "high";
  suggestedMinutes: number;
  demoOpeningWindows: Array<{ day: number; start: string; end: string }>;
  contentSourceIds: string[];
}

export interface Product {
  id: UUID;
  tenantId: UUID;
  regionId: UUID;
  name: string;
  slug: string;
  type: "ticket" | "transport" | "experience" | "package";
  ledgerType: "service-commerce" | "donation" | "sponsorship";
  siteIds: UUID[];
  demoPriceVnd: number;
  durationMinutes: number;
  entitlementTemplates: Array<{ siteSlug: string; quantity: number }>;
}

export interface CapacitySlot {
  id: UUID;
  tenantId: UUID;
  demoRunId: UUID;
  siteId: UUID;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  reserved: number;
  checkedIn: number;
  status: "available" | "paused" | "closed";
}

export interface JourneyIntent {
  id: UUID;
  demoRunId: UUID;
  locale: "vi" | "en";
  rawText: string;
  durationMinutes: number;
  party: { adults: number; children: number; seniors: number };
  partyContext: string[];
  interests: string[];
  pace: "relaxed" | "balanced" | "active";
  walkingTolerance: "low" | "moderate" | "high";
  budgetVnd?: { target: number; tolerancePercent: number };
  accessibilityNeeds: string[];
  startSiteId?: UUID;
  visitDate?: string;
  fieldConfidence: Record<string, number>;
}

export interface JourneyIntentDraft {
  locale: "vi" | "en";
  rawText: string;
  durationMinutes?: number;
  party?: { adults: number; children: number; seniors: number };
  partyContext?: string[];
  interests?: string[];
  pace?: "relaxed" | "balanced" | "active";
  walkingTolerance?: "low" | "moderate" | "high";
  budgetVnd?: { target: number; tolerancePercent: number };
  accessibilityNeeds?: string[];
  startSiteId?: UUID;
  visitDate?: string;
  fieldConfidence: Record<string, number>;
}

export interface ItineraryItem {
  id: UUID;
  siteId: UUID;
  startAt: ISODateTime;
  endAt: ISODateTime;
  travelMinutesFromPrevious: number;
  reason: string;
}

export interface Itinerary {
  id: UUID;
  demoRunId: UUID;
  tenantId: UUID;
  regionId: UUID;
  intentId: UUID;
  items: ItineraryItem[];
  totalMinutes: number;
  estimatedPriceVnd: number;
  validation: {
    valid: boolean;
    issues: Array<{ code: string; message: string; itemId?: UUID }>;
  };
  explanation: string;
}

export type IncidentCategory =
  | "crowd-capacity"
  | "weather"
  | "medical"
  | "transport"
  | "water-safety"
  | "fire-safety"
  | "infrastructure"
  | "security"
  | "lost-person"
  | "other";

export interface IncidentDraft {
  id: UUID;
  demoRunId: UUID;
  transcript: string;
  siteId?: UUID;
  category?: IncidentCategory;
  suggestedSeverity?: "P1" | "P2" | "P3" | "P4";
  waitTimeMinutes?: number;
  resourceRequest?: { resourceType: string; quantity: number };
  notes?: string;
  sopId?: UUID;
  fieldConfidence: Record<string, number>;
  humanConfirmationRequired: true;
}

export interface QuoteLine {
  productId: UUID;
  quantity: number;
  unitPriceVnd: number;
  totalVnd: number;
  ledgerType: "service-commerce" | "donation" | "sponsorship";
}

export interface Quote {
  id: UUID;
  demoRunId: UUID;
  itineraryId?: UUID;
  visitDate: string;
  partySize: number;
  lines: QuoteLine[];
  subtotalVnd: number;
  totalVnd: number;
  currency: "VND";
  status: "active" | "consumed" | "expired" | "cancelled";
  expiresAt: ISODateTime;
}

export interface Booking {
  id: UUID;
  demoRunId: UUID;
  code: string;
  status:
    | "pending"
    | "confirmed"
    | "partially-used"
    | "used"
    | "cancelled"
    | "expired";
  visitDate: string;
  customerDisplayName: string;
  maskedContact: string;
  partySize: number;
  totalVnd: number;
  currency: "VND";
  campaignId?: UUID;
  qrSourceId?: UUID;
  createdAt: ISODateTime;
}

export interface PassEntitlement {
  id: UUID;
  passId: UUID;
  siteId: UUID;
  productId: UUID;
  quantity: number;
  redeemedQuantity: number;
}

export interface Pass {
  id: UUID;
  demoRunId: UUID;
  bookingId: UUID;
  tokenHint: string;
  status: "active" | "partially-used" | "used" | "cancelled" | "expired";
  issuedAt: ISODateTime;
  expiresAt: ISODateTime;
  entitlements: PassEntitlement[];
}

export interface Redemption {
  id: UUID;
  demoRunId: UUID;
  passId: UUID;
  entitlementId: UUID;
  siteId: UUID;
  quantity: number;
  actorUserId: UUID;
  idempotencyKey: string;
  createdAt: ISODateTime;
}
