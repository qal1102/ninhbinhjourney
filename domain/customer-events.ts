import { z } from "zod";

export const CUSTOMER_EVENT_NAMES = [
  "page_viewed",
  "qr_opened",
  "section_viewed",
  "section_engaged",
  "scroll_depth_reached",
  "content_clicked",
  "destination_viewed",
  "service_viewed",
  "plan_started",
  "plan_generated",
  "recommendation_shown",
  "recommendation_clicked",
  "recommendation_accepted",
  "booking_started",
  "slot_hold_created",
  "payment_completed",
  "ticket_issued",
  "ticket_checked_in",
  "contact_submitted",
  "identity_linked",
  "consent_updated",
  "marketing_message_outcome",
] as const;

export type CustomerEventName = (typeof CUSTOMER_EVENT_NAMES)[number];

const ScalarPropertySchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const PropertyBagSchema = z.record(z.string(), ScalarPropertySchema);

const EVENT_PROPERTY_CONTRACT: Record<
  CustomerEventName,
  { required: readonly string[]; allowed: readonly string[] }
> = {
  page_viewed: {
    required: ["page_path", "page_type", "referrer_class"],
    allowed: ["page_path", "page_type", "referrer_class"],
  },
  qr_opened: {
    required: ["qr_source_id", "campaign_id", "placement_id", "destination_path"],
    allowed: ["qr_source_id", "campaign_id", "placement_id", "destination_path"],
  },
  section_viewed: {
    required: ["section_id", "page_path", "position", "visible_ms"],
    allowed: ["section_id", "page_path", "position", "visible_ms"],
  },
  section_engaged: {
    required: ["section_id", "active_ms", "max_visible_ratio"],
    allowed: ["section_id", "active_ms", "max_visible_ratio"],
  },
  scroll_depth_reached: {
    required: ["depth_percent", "page_path"],
    allowed: ["depth_percent", "page_path"],
  },
  content_clicked: {
    required: ["element_id", "content_id", "content_type", "section_id"],
    allowed: ["element_id", "content_id", "content_type", "section_id"],
  },
  destination_viewed: {
    required: ["destination_id", "source_section_id"],
    allowed: ["destination_id", "source_section_id"],
  },
  service_viewed: {
    required: ["service_id", "category", "price_band"],
    allowed: ["service_id", "category", "price_band"],
  },
  plan_started: {
    required: ["entry_point"],
    allowed: ["entry_point"],
  },
  plan_generated: {
    required: ["journey_intent_id", "party_band", "budget_band", "pace", "visit_date"],
    allowed: [
      "journey_intent_id",
      "party_band",
      "budget_band",
      "pace",
      "walking_tolerance_band",
      "visit_date",
    ],
  },
  recommendation_shown: {
    required: ["recommendation_id", "rule_version", "service_id", "reason_code", "slot"],
    allowed: ["recommendation_id", "rule_version", "service_id", "reason_code", "slot"],
  },
  recommendation_clicked: {
    required: ["recommendation_id", "rule_version", "service_id", "reason_code", "position"],
    allowed: [
      "recommendation_id",
      "rule_version",
      "service_id",
      "reason_code",
      "position",
    ],
  },
  recommendation_accepted: {
    required: ["recommendation_id", "order_id", "service_id", "quantity"],
    allowed: ["recommendation_id", "order_id", "service_id", "quantity"],
  },
  booking_started: {
    required: ["site_id", "service_id", "visit_date"],
    allowed: ["site_id", "service_id", "visit_date"],
  },
  slot_hold_created: {
    required: ["order_id", "slot_id", "expires_at", "party_size"],
    allowed: ["order_id", "slot_id", "expires_at", "party_size"],
  },
  payment_completed: {
    required: ["order_id", "payment_id", "amount", "currency", "provider"],
    allowed: ["order_id", "payment_id", "amount", "currency", "provider"],
  },
  ticket_issued: {
    required: ["order_id", "ticket_id", "channel"],
    allowed: ["order_id", "ticket_id", "channel"],
  },
  ticket_checked_in: {
    required: ["ticket_id", "site_id", "scan_mode"],
    allowed: ["ticket_id", "site_id", "scan_mode"],
  },
  contact_submitted: {
    required: ["customer_profile_id", "purpose"],
    allowed: ["customer_profile_id", "purpose"],
  },
  identity_linked: {
    required: ["method", "reason"],
    allowed: ["method", "reason"],
  },
  consent_updated: {
    required: ["purpose", "status", "policy_version", "channel"],
    allowed: ["purpose", "status", "policy_version", "channel"],
  },
  marketing_message_outcome: {
    required: ["connector", "external_delivery_id", "outcome", "channel"],
    allowed: ["connector", "external_delivery_id", "outcome", "channel"],
  },
};

const SOURCE_CONTEXT_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "qr_source_id",
  "campaign_id",
  "placement_id",
  "referrer_class",
  "partner_id",
  "click_id",
]);

const PII_KEY_PATTERN =
  /email|e_mail|phone|mobile|telephone|full_?name|first_?name|last_?name|contact|address|raw_?text|prompt|message/i;
const EMAIL_PATTERN = /(^|[^\w.%+-])[\w.%+-]+@[\w.-]+\.[a-z]{2,}($|[^\w.%+-])/i;
const PHONE_PATTERN = /(^|\D)(?:\+?84|0)[\d .-]{8,12}($|\D)/;

export function containsDirectPii(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsDirectPii);
  if (typeof value === "string") {
    return EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
  }
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, child]) => PII_KEY_PATTERN.test(key) || containsDirectPii(child),
  );
}

export const CustomerEventRequestSchema = z
  .object({
    event_id: z.string().uuid(),
    event_name: z.enum(CUSTOMER_EVENT_NAMES),
    schema_version: z.literal(1),
    occurred_at: z.string().datetime({ offset: true }),
    anonymous_id: z.string().uuid(),
    session_id: z.string().uuid(),
    page_view_id: z.string().uuid().nullable().optional(),
    source_context: PropertyBagSchema.default({}),
    consent_snapshot: z
      .object({
        product_analytics: z.enum([
          "granted",
          "denied",
          "revoked",
          "not-required",
        ]),
        policy_version: z.string().min(1).max(80),
        essential_service: z
          .enum(["granted", "denied", "revoked", "not-requested"])
          .optional(),
        marketing_communications: z
          .enum(["granted", "denied", "revoked", "not-requested"])
          .optional(),
      })
      .strict(),
    properties: PropertyBagSchema.default({}),
  })
  .strict()
  .superRefine((value, context) => {
    const contract = EVENT_PROPERTY_CONTRACT[value.event_name];
    const keys = Object.keys(value.properties);
    const unknownKeys = keys.filter((key) => !contract.allowed.includes(key));
    const missingKeys = contract.required.filter(
      (key) => !(key in value.properties),
    );

    if (unknownKeys.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["properties"],
        message: `Thuộc tính không thuộc contract: ${unknownKeys.join(", ")}`,
      });
    }
    if (missingKeys.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["properties"],
        message: `Thiếu thuộc tính bắt buộc: ${missingKeys.join(", ")}`,
      });
    }

    const unknownSourceKeys = Object.keys(value.source_context).filter(
      (key) => !SOURCE_CONTEXT_KEYS.has(key),
    );
    if (unknownSourceKeys.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["source_context"],
        message: `Nguồn không thuộc contract: ${unknownSourceKeys.join(", ")}`,
      });
    }

    if (
      containsDirectPii(value.properties) ||
      containsDirectPii(value.source_context) ||
      containsDirectPii(value.consent_snapshot)
    ) {
      context.addIssue({
        code: "custom",
        path: ["properties"],
        message: "Event analytics không được chứa dữ liệu định danh trực tiếp.",
      });
    }

    if (
      value.event_name !== "consent_updated" &&
      !["granted", "not-required"].includes(
        value.consent_snapshot.product_analytics,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["consent_snapshot", "product_analytics"],
        message: "Không được ghi hành vi khi analytics consent không hợp lệ.",
      });
    }

    if (value.event_name === "scroll_depth_reached") {
      const depth = value.properties.depth_percent;
      if (![25, 50, 75, 90].includes(Number(depth))) {
        context.addIssue({
          code: "custom",
          path: ["properties", "depth_percent"],
          message: "Scroll depth chỉ nhận mốc 25, 50, 75 hoặc 90.",
        });
      }
    }

    if (value.event_name === "section_engaged") {
      const activeMs = Number(value.properties.active_ms);
      const ratio = Number(value.properties.max_visible_ratio);
      if (!Number.isFinite(activeMs) || activeMs < 5_000 || activeMs > 86_400_000) {
        context.addIssue({
          code: "custom",
          path: ["properties", "active_ms"],
          message: "Active dwell phải từ 5 giây đến 24 giờ.",
        });
      }
      if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 1) {
        context.addIssue({
          code: "custom",
          path: ["properties", "max_visible_ratio"],
          message: "Visible ratio phải nằm trong khoảng 0.5 đến 1.",
        });
      }
    }
  });

export type CustomerEventRequest = z.infer<typeof CustomerEventRequestSchema>;
