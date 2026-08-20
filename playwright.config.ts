import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = remoteBaseUrl ?? `http://127.0.0.1:${port}`;
const erpPersistenceMode =
  process.env.ERP_PERSISTENCE_MODE ?? "demo-cookie";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const customerAnalyticsEnabled =
  process.env.NBJ_E2E_CUSTOMER_ANALYTICS === "1" ||
  process.env.NBJ_E2E_CUSTOMER_IDENTITY === "1"
    ? "true"
    : "false";
const customerIdentityEnabled =
  process.env.NBJ_E2E_CUSTOMER_IDENTITY === "1" ? "true" : "false";
const customerBookingEnabled =
  process.env.NBJ_E2E_CUSTOMER_BOOKING === "1" ? "true" : "false";
const offlineGateEnabled =
  process.env.NBJ_E2E_OFFLINE_GATE === "1" ? "true" : "false";

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
  // `NEXT_PUBLIC_*` được Next **nhúng vào bundle lúc build**, không đọc lúc
  // chạy. Đặt chúng ở `env` bên dưới chỉ phục vụ phần chạy trên máy chủ; nếu
  // bản build được dựng mà thiếu chúng thì `/plan` trả về màn hình "thiếu cấu
  // hình" và ba bài journey-planner đỏ vì một lý do không liên quan gì tới sản
  // phẩm. Vì thế webServer tự dựng lại với đúng bộ biến, thay vì chỉ `start`.
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: `http://127.0.0.1:${port}`,
        // Đủ chỗ cho cả bước build ở trên.
        timeout: 300_000,
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
          NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED: customerAnalyticsEnabled,
          CUSTOMER_CONSENT_MANAGEMENT_ENABLED: customerIdentityEnabled,
          CUSTOMER_IDENTITY_COLLECTION_ENABLED: customerIdentityEnabled,
          CUSTOMER_BOOKING_ENABLED: customerBookingEnabled,
          ERP_OFFLINE_GATE_ENABLED: offlineGateEnabled,
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64:
            Buffer.alloc(32, 9).toString("base64"),
          CUSTOMER_IDENTITY_HASH_KEY:
            "playwright-customer-identity-hash-key-at-least-32-chars",
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: "playwright-v1",
          CUSTOMER_ANALYTICS_POLICY_VERSION: "xuan-truong-analytics-draft-v1",
          CUSTOMER_SERVICE_POLICY_VERSION: "xuan-truong-service-draft-v1",
          CUSTOMER_MARKETING_POLICY_VERSION: "xuan-truong-marketing-draft-v1",
          ERP_PERSISTENCE_MODE: erpPersistenceMode,
          ERP_SHIFT_CLOSE_COOKIE_SECRET:
            "playwright-shift-close-cookie-secret-at-least-32-chars",
          ...(supabaseSecretKey
            ? { SUPABASE_SECRET_KEY: supabaseSecretKey }
            : {}),
        },
      },
});
