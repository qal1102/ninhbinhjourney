import { afterEach, describe, expect, it } from "vitest";
import {
  ExperienceConfigSchema,
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";

const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_EXPERIENCE_MODE",
  "NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const originalValues = Object.fromEntries(
  publicKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of publicKeys) {
    const original = originalValues[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("experience environment", () => {
  it("NBJ-D15 reports every missing required public variable without fallback data", () => {
    for (const key of publicKeys) delete process.env[key];

    expect(readPublicEnvironment()).toEqual({
      status: "missing",
      missing: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_EXPERIENCE_MODE",
        "NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED",
      ],
      issues: [],
    });
  });

  it("rejects non-HTTPS Supabase endpoints", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    process.env.NEXT_PUBLIC_EXPERIENCE_MODE = "client-demo";
    process.env.NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED = "true";

    const result = readPublicEnvironment();
    expect(result.status).toBe("missing");
    if (result.status === "missing") {
      expect(result.issues).toContain(
        "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.",
      );
    }
  });

  it("keeps production-only controls disabled", () => {
    const result = ExperienceConfigSchema.safeParse({
      mode: "production",
      dataMode: "supabase-shared",
      tenantId: "00000000-0000-4000-8000-000000000001",
      regionId: "00000000-0000-4000-8000-000000000002",
      operatorId: "00000000-0000-4000-8000-000000000003",
      brandConceptsEnabled: true,
      sandboxPaymentEnabled: true,
      deterministicAiEnabled: true,
      voiceDemoFallbackEnabled: false,
      presenterPersonaPreviewEnabled: true,
      resetDemoStateEnabled: true,
      realtimeRequired: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          "sandboxPaymentEnabled",
          "presenterPersonaPreviewEnabled",
          "resetDemoStateEnabled",
        ]),
      );
    }
  });

  it("NBJ-I06 hides concepts, demo commands and sandbox checkout in production", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "test-publishable-key";
    process.env.NEXT_PUBLIC_EXPERIENCE_MODE = "production";
    process.env.NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED = "false";

    expect(getExperiencePresentationFlags(readPublicEnvironment())).toEqual({
      clientDemo: false,
      showConcepts: false,
      showDemoCommands: false,
      sandboxCheckout: false,
    });
  });

  it("normalizes deployment-provider whitespace around public values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://example.supabase.co\r\n";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = " publishable-key\r\n";
    process.env.NEXT_PUBLIC_EXPERIENCE_MODE = " production\r\n";
    process.env.NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED = " false\r\n";
    process.env.NEXT_PUBLIC_SITE_URL = " https://ninhbinhjourney.vercel.app\r\n";

    const result = readPublicEnvironment();
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.config.mode).toBe("production");
      expect(result.config.brandConceptsEnabled).toBe(false);
      expect(result.siteUrl).toBe("https://ninhbinhjourney.vercel.app");
    }
  });
});
