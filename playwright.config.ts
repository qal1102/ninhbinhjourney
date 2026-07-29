import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = remoteBaseUrl ?? `http://127.0.0.1:${port}`;
const erpPersistenceMode =
  process.env.ERP_PERSISTENCE_MODE ?? "demo-cookie";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "artifacts/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  fullyParallel: true,
  workers: 4,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: `http://127.0.0.1:${port}`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ??
            "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            "test-publishable-key",
          NEXT_PUBLIC_EXPERIENCE_MODE: "production",
          NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED: "false",
          NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
          ERP_PERSISTENCE_MODE: erpPersistenceMode,
          ERP_SHIFT_CLOSE_COOKIE_SECRET:
            "playwright-shift-close-cookie-secret-at-least-32-chars",
          ...(supabaseSecretKey
            ? { SUPABASE_SECRET_KEY: supabaseSecretKey }
            : {}),
        },
      },
});
