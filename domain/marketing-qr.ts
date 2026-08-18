import { z } from "zod";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,47}$/;
const SAFE_INTERNAL_PATH = /^\/(?!\/)[^\u0000-\u001f]*$/;

export const MarketingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CODE_PATTERN, "Mã chỉ gồm A-Z, số, _ hoặc -, dài 3–48 ký tự.");

export const MarketingLabelSchema = z
  .string()
  .trim()
  .min(2, "Nhãn cần ít nhất 2 ký tự.")
  .max(160, "Nhãn tối đa 160 ký tự.")
  .refine(
    (value) =>
      !/(^|[^\w.%+-])[\w.%+-]+@[\w.-]+\.[a-z]{2,}($|[^\w.%+-])|(^|\D)(?:\+?84|0)[\d .-]{8,12}($|\D)/i.test(
        value,
      ),
    "Nhãn marketing không được chứa dữ liệu liên hệ.",
  );

export const MarketingDestinationPathSchema = z
  .string()
  .trim()
  .min(1, "Cần có đường dẫn đích nội bộ.")
  .max(1_024, "Đường dẫn đích quá dài.")
  .refine(
    (value) => SAFE_INTERNAL_PATH.test(value) && !value.includes("://"),
    "QR chỉ được chuyển đến đường dẫn nội bộ bắt đầu bằng /.",
  );

export const MarketingCampaignInputSchema = z.object({
  code: MarketingCodeSchema,
  name: MarketingLabelSchema,
  status: z.enum(["draft", "active", "paused"]),
});

export const MarketingQrSourceInputSchema = z.object({
  campaignId: z.string().uuid("Campaign không hợp lệ."),
  code: MarketingCodeSchema,
  placementId: MarketingCodeSchema,
  placementLabel: MarketingLabelSchema,
  destinationPath: MarketingDestinationPathSchema,
  status: z.enum(["active", "paused"]),
});

export const MarketingQrDestinationUpdateSchema = z.object({
  sourceId: z.string().uuid("Mã QR không hợp lệ."),
  expectedVersion: z.coerce.number().int().positive(),
  destinationPath: MarketingDestinationPathSchema,
});

export function destinationPathWithAttribution(
  input: {
    destinationPath: string;
    sourceCode: string;
    campaignCode: string;
    placementId: string;
  },
  origin: string,
) {
  const destination = new URL(input.destinationPath, origin);
  if (destination.origin !== origin) {
    throw new Error("QR destination escaped the first-party origin.");
  }
  destination.searchParams.set("qr_source_id", input.sourceCode);
  destination.searchParams.set("campaign_id", input.campaignCode);
  destination.searchParams.set("placement_id", input.placementId);
  destination.searchParams.set("utm_source", "qr");
  destination.searchParams.set("utm_medium", "offline");
  destination.searchParams.set("utm_campaign", input.campaignCode);
  return destination;
}

export type MarketingCampaignInput = z.infer<typeof MarketingCampaignInputSchema>;
export type MarketingQrSourceInput = z.infer<typeof MarketingQrSourceInputSchema>;

export type MarketingCampaignRecord = {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "paused";
};

export type MarketingQrSourceRecord = {
  id: string;
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  code: string;
  placementId: string;
  placementLabel: string;
  destinationPath: string;
  status: "active" | "paused" | "retired";
  version: number;
  scanCount: number;
  lastScannedAt: string | null;
};

export type MarketingQrConfig = {
  campaigns: MarketingCampaignRecord[];
  sources: MarketingQrSourceRecord[];
};
