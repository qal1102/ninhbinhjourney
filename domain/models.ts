export type UUID = string;
export type ISODateTime = string;

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
  /**
   * Số ngày khách nói ra, khi họ bảo "hai ngày" hoặc "cuối tuần".
   *
   * Cố ý chỉ nằm ở bản nháp, không đi tiếp vào `JourneyIntent` đã chốt:
   * `generateItinerary` dựng đúng MỘT ngày — mốc tám giờ sáng, giờ mở cửa của
   * từng nơi, nhiều nhất ba chặng. Đem con số này vào bản chốt là hứa một thứ
   * máy chưa làm được. Nó ở đây để màn hình nói thật với khách rằng mình mới
   * xếp ngày đầu, chứ không phải để nhân đôi lịch trình.
   */
  tripDays?: number;
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
