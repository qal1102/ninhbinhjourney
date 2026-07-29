import type {
  CapacitySlot,
  Booking,
  IncidentDraft,
  Itinerary,
  JourneyIntent,
  Product,
  Pass,
  Quote,
  Site,
} from "@/domain/models";
import type { DomainEvent } from "@/domain/events";

export type { DemoRunService } from "./demo-run-service";

export interface JourneyService {
  parseIntent(input: {
    demoRunId: string;
    text: string;
    locale: "vi" | "en";
  }): Promise<JourneyIntent>;
  generateItinerary(input: { intent: JourneyIntent }): Promise<Itinerary>;
  validateItinerary(input: {
    itinerary: Itinerary;
  }): Promise<Itinerary["validation"]>;
}

export interface CatalogService {
  listSites(input: { regionId: string }): Promise<Site[]>;
  listProducts(input: {
    regionId: string;
    siteIds?: string[];
  }): Promise<Product[]>;
  getAvailability(input: {
    demoRunId: string;
    siteIds: string[];
    date: string;
  }): Promise<CapacitySlot[]>;
}

export interface AnalyticsService {
  record(input: { demoRunId: string; event: DomainEvent }): Promise<void>;
}

export interface OperationsService {
  parseIncident(input: {
    demoRunId: string;
    text: string;
    locale: "vi" | "en";
  }): Promise<IncidentDraft>;
}

export interface BookingService {
  quote(input: {
    itineraryId?: string;
    productSelections: Array<{ productId: string; quantity: number }>;
    visitDate: string;
    partySize: number;
  }): Promise<Quote>;
  createBooking(input: {
    quoteId: string;
    customerDisplayName: string;
    contactKind: "email" | "phone";
    contactValue: string;
    consent: true;
    idempotencyKey: string;
  }): Promise<{
    booking: Pick<Booking, "id" | "code" | "status">;
    payment: { providerIntentId: string; status: string; mode: "simulation" };
    pass: { id: string; token: string; path: string };
    idempotentReplay: boolean;
  }>;
}

export interface PassService {
  getByToken(input: { token: string }): Promise<{
    snapshot: { pass: Pass; booking: Booking };
    fetchedAt: string;
  }>;
}
