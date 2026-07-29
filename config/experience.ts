import { z } from "zod";

export const ExperienceModeSchema = z.enum(["client-demo", "production"]);

const BooleanStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const ExperienceConfigSchema = z
  .object({
    mode: ExperienceModeSchema,
    dataMode: z.literal("supabase-shared"),
    tenantId: z.uuid(),
    regionId: z.uuid(),
    operatorId: z.uuid(),
    brandConceptsEnabled: z.boolean(),
    sandboxPaymentEnabled: z.boolean(),
    deterministicAiEnabled: z.boolean(),
    voiceDemoFallbackEnabled: z.boolean(),
    presenterPersonaPreviewEnabled: z.boolean(),
    resetDemoStateEnabled: z.boolean(),
    realtimeRequired: z.literal(true),
  })
  .superRefine((config, context) => {
    if (config.mode === "production") {
      if (config.presenterPersonaPreviewEnabled) {
        context.addIssue({
          code: "custom",
          message: "Production mode cannot enable presenter persona preview.",
          path: ["presenterPersonaPreviewEnabled"],
        });
      }
      if (config.resetDemoStateEnabled) {
        context.addIssue({
          code: "custom",
          message: "Production mode cannot enable demo reset controls.",
          path: ["resetDemoStateEnabled"],
        });
      }
      if (config.sandboxPaymentEnabled) {
        context.addIssue({
          code: "custom",
          message: "Production mode cannot silently enable sandbox checkout.",
          path: ["sandboxPaymentEnabled"],
        });
      }
    }
  });

export type ExperienceMode = z.infer<typeof ExperienceModeSchema>;
export type ExperienceConfig = z.infer<typeof ExperienceConfigSchema>;

export const CORE_IDS = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  regionId: "00000000-0000-4000-8000-000000000002",
  operatorId: "00000000-0000-4000-8000-000000000003",
} as const;

export type PublicEnvironment =
  | {
      status: "ready";
      config: ExperienceConfig;
      supabaseUrl: string;
      supabasePublishableKey: string;
      siteUrl?: string;
    }
  | {
      status: "missing";
      missing: string[];
      issues: string[];
    };

export function readPublicEnvironment(): PublicEnvironment {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const modeValue = process.env.NEXT_PUBLIC_EXPERIENCE_MODE;
  const brandConceptsValue = process.env.NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const missing = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !supabasePublishableKey ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : null,
    !modeValue ? "NEXT_PUBLIC_EXPERIENCE_MODE" : null,
    !brandConceptsValue ? "NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED" : null,
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    return { status: "missing", missing, issues: [] };
  }

  const mode = ExperienceModeSchema.safeParse(modeValue);
  const brandConceptsEnabled = BooleanStringSchema.safeParse(brandConceptsValue);
  const issues: string[] = [];

  if (!mode.success) {
    issues.push("NEXT_PUBLIC_EXPERIENCE_MODE must be client-demo or production.");
  }
  if (!brandConceptsEnabled.success) {
    issues.push("NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED must be true or false.");
  }
  if (supabaseUrl) {
    const parsedUrl = z.url().safeParse(supabaseUrl);
    if (!parsedUrl.success || !supabaseUrl.startsWith("https://")) {
      issues.push("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
    }
  }

  if (!mode.success || !brandConceptsEnabled.success || issues.length > 0) {
    return { status: "missing", missing: [], issues };
  }

  const isDemo = mode.data === "client-demo";
  const configResult = ExperienceConfigSchema.safeParse({
    mode: mode.data,
    dataMode: "supabase-shared",
    ...CORE_IDS,
    brandConceptsEnabled: brandConceptsEnabled.data,
    sandboxPaymentEnabled: isDemo,
    deterministicAiEnabled: true,
    voiceDemoFallbackEnabled: isDemo,
    presenterPersonaPreviewEnabled: isDemo,
    resetDemoStateEnabled: isDemo,
    realtimeRequired: true,
  });

  if (!configResult.success) {
    return {
      status: "missing",
      missing: [],
      issues: configResult.error.issues.map((issue) => issue.message),
    };
  }

  return {
    status: "ready",
    config: configResult.data,
    supabaseUrl: supabaseUrl!,
    supabasePublishableKey: supabasePublishableKey!,
    siteUrl,
  };
}

export function isClientDemo(environment: PublicEnvironment) {
  return environment.status === "ready" && environment.config.mode === "client-demo";
}

export function getExperiencePresentationFlags(
  environment: PublicEnvironment,
) {
  return {
    clientDemo: isClientDemo(environment),
    showConcepts:
      environment.status === "ready" &&
      environment.config.brandConceptsEnabled,
    showDemoCommands:
      environment.status === "ready" &&
      environment.config.voiceDemoFallbackEnabled,
    sandboxCheckout:
      environment.status === "ready" &&
      environment.config.sandboxPaymentEnabled,
  };
}
