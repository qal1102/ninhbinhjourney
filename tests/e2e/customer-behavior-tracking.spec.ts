import { expect, test } from "@playwright/test";

const enabled = process.env.NBJ_E2E_CUSTOMER_ANALYTICS === "1";

test.describe("CUS-02 customer behavior collector", () => {
  test.skip(!enabled, "Run with NBJ_E2E_CUSTOMER_ANALYTICS=1.");

  test("does not collect before explicit analytics consent", async ({ page }) => {
    const requests: unknown[] = [];
    await page.route("**/api/customer-events", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true }),
      });
    });

    await page.goto("/?source=organic", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    expect(requests).toEqual([]);
  });

  test("records semantic page, section, active dwell, scroll and CTA events", async ({
    page,
  }) => {
    const events: Array<Record<string, unknown>> = [];
    await page.addInitScript(() => {
      localStorage.setItem(
        "nbj-customer-analytics-consent",
        JSON.stringify({
          product_analytics: "granted",
          policy_version: "analytics-e2e-v1",
          marketing_communications: "not-requested",
        }),
      );
    });
    await page.route("**/api/customer-events", async (route) => {
      events.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true }),
      });
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?source=instagram", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, {
      timeout: 4000,
    });
    await expect.poll(() => events.some((event) => event.event_name === "page_viewed")).toBe(true);

    await page.locator("#map").scrollIntoViewIfNeeded();
    await page.mouse.move(24, 240);
    await page.waitForTimeout(5400);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.3));

    await expect.poll(() =>
      events.some(
        (event) =>
          event.event_name === "section_viewed" &&
          (event.properties as Record<string, unknown>).section_id === "home-map",
      ),
    ).toBe(true);
    await expect.poll(() =>
      events.some(
        (event) =>
          event.event_name === "section_engaged" &&
          (event.properties as Record<string, unknown>).section_id === "home-map",
      ),
    ).toBe(true);
    await expect.poll(() =>
      events.some((event) => event.event_name === "scroll_depth_reached"),
    ).toBe(true);

    await page.goto("/?source=instagram", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, {
      timeout: 4000,
    });
    await page.locator('[data-customer-track="home-hero-plan"]').click();
    await expect.poll(() =>
      events.some(
        (event) =>
          event.event_name === "content_clicked" &&
          (event.properties as Record<string, unknown>).element_id === "home-hero-plan",
      ),
    ).toBe(true);

    const pageView = events.find((event) => event.event_name === "page_viewed");
    expect(pageView).toMatchObject({
      source_context: { utm_source: "instagram" },
      consent_snapshot: {
        product_analytics: "granted",
        policy_version: "analytics-e2e-v1",
      },
      properties: { page_path: "/", page_type: "home" },
    });
    expect(JSON.stringify(events)).not.toContain("guest@example.com");
  });

  test("records qr_opened only after consent and preserves the QR source contract", async ({ page }) => {
    const events: Array<Record<string, unknown>> = [];
    await page.addInitScript(() => {
      localStorage.setItem(
        "nbj-customer-analytics-consent",
        JSON.stringify({ product_analytics: "granted", policy_version: "analytics-e2e-v1" }),
      );
    });
    await page.route("**/api/customer-events", async (route) => {
      events.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ accepted: true }) });
    });

    await page.goto(
      "/plan?qr_source_id=TC-WHARF-01&campaign_id=TAMCOC-AUG&placement_id=TAMCOC-WHARF&utm_source=qr&utm_medium=offline&utm_campaign=TAMCOC-AUG",
      { waitUntil: "domcontentloaded" },
    );
    await expect.poll(() => events.some((event) => event.event_name === "qr_opened")).toBe(true);
    expect(events.find((event) => event.event_name === "qr_opened")).toMatchObject({
      source_context: { qr_source_id: "TC-WHARF-01", campaign_id: "TAMCOC-AUG", placement_id: "TAMCOC-WHARF" },
      properties: { qr_source_id: "TC-WHARF-01", campaign_id: "TAMCOC-AUG", placement_id: "TAMCOC-WHARF", destination_path: "/plan" },
    });
  });
});
