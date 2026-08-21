import { expect, test } from "@playwright/test";

const enabled = process.env.NBJ_E2E_CUSTOMER_IDENTITY === "1";

test.describe("CUS-05 progressive identity and consent", () => {
  test.skip(!enabled, "Run with NBJ_E2E_CUSTOMER_IDENTITY=1.");

  test("keeps the public privacy notice readable and explicit", async ({ page }, testInfo) => {
    await page.goto("/quyen-rieng-tu", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dữ liệu của bạn vẫn là lựa chọn của bạn." })).toBeVisible();
    await expect(page.getByText("Xuân Trường vận hành Ninh Bình Journey và chịu trách nhiệm", { exact: false })).toBeVisible();
    await expect(page.getByText("Dữ liệu được bảo vệ thế nào", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    if (process.env.NBJ_E2E_CAPTURE_VISUALS === "1") {
      await testInfo.attach("cus05-privacy-notice", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  });

  test("records an explicit analytics choice before tracking starts", async ({ page }) => {
    const consentWrites: Array<Record<string, unknown>> = [];
    const analyticsEvents: Array<Record<string, unknown>> = [];
    await page.route("**/api/customer-consents", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      consentWrites.push(body);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        headers: { "Set-Cookie": `nbj-customer-journey-anonymous-id=${body.anonymous_id}; Path=/; HttpOnly; SameSite=Lax` },
        body: JSON.stringify({
          accepted: true,
          consent: {
            product_analytics: body.product_analytics ? "granted" : "denied",
            marketing_communications: body.marketing_communications ? "granted" : "denied",
            essential_service: "not-requested",
            policy_version: "xuan-truong-analytics-draft-v1",
            marketing_policy_version: "xuan-truong-marketing-draft-v1",
          },
        }),
      });
    });
    await page.route("**/api/customer-events", async (route) => {
      analyticsEvents.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ accepted: true }) });
    });

    await page.goto("/plan", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Giúp chúng tôi làm hành trình phù hợp hơn?" })).toBeVisible();
    await page.waitForTimeout(1200);
    expect(analyticsEvents).toHaveLength(0);
    await page.getByRole("button", { name: "Đồng ý" }).click();
    await expect(page.getByRole("button", { name: "Mở trung tâm quyền riêng tư" })).toBeVisible();
    await expect.poll(() => analyticsEvents.some((event) => event.event_name === "page_viewed")).toBe(true);
    expect(consentWrites[0]).toMatchObject({ product_analytics: true, marketing_communications: false });
  });

  test("keeps service contact separate from marketing and never claims a real send", async ({ page }) => {
    const contactWrites: Array<Record<string, unknown>> = [];
    await page.addInitScript(() => {
      localStorage.setItem("nbj-customer-analytics-consent", JSON.stringify({
        product_analytics: "denied",
        marketing_communications: "denied",
        policy_version: "xuan-truong-analytics-draft-v1",
      }));
    });
    await page.route("**/api/journeys", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const intentId = "10000000-0000-4000-8000-000000000701";
      const itineraryId = "10000000-0000-4000-8000-000000000702";
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "Set-Cookie": "nbj-customer-journey-anonymous-id=10000000-0000-4000-8000-000000000703; Path=/; HttpOnly; SameSite=Lax" },
        body: JSON.stringify({
          persisted: true,
          persistence: "anonymous",
          intent: {
            id: intentId,
            demoRunId: "10000000-0000-4000-8000-000000000704",
            rawText: String(body.text),
            locale: "vi",
            durationMinutes: body.durationMinutes,
            party: body.party,
            partyContext: body.partyContext,
            interests: ["nature"],
            pace: body.pace,
            walkingTolerance: body.walkingTolerance,
            budgetVnd: body.budgetVnd,
            visitDate: body.visitDate,
            confirmed: true,
          },
          itinerary: {
            id: itineraryId,
            intentId,
            items: [],
            totalMinutes: 0,
            estimatedPriceVnd: 0,
            explanation: "Hành trình thử nghiệm.",
            validation: { valid: true, issues: [] },
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route("**/api/customer-contact", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      contactWrites.push(body);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          request_id: body.request_id,
          delivery_status: "staged",
          contact_type: "email",
          marketing_status: "denied",
          marketing_policy_version: "xuan-truong-marketing-draft-v1",
        }),
      });
    });

    await page.goto("/plan", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Yêu cầu bằng văn bản").fill("Tôi muốn đi Tam Cốc một ngày, nhịp thư thả.");
    await page.getByRole("button", { name: "Hiểu yêu cầu" }).click();
    await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();
    await expect(page.getByRole("heading", { name: "Một cách liên hệ, do bạn tự chọn." })).toBeVisible();
    await page.getByLabel("Email hoặc số điện thoại").fill("guest@example.com");
    await page.getByRole("button", { name: "Lưu cách nhận hành trình" }).click();
    await expect(page.getByText("Bản thử nghiệm chưa gửi email thật.")).toBeVisible();
    expect(contactWrites[0]).toMatchObject({
      contact: "guest@example.com",
      marketing_communications: false,
    });
    await expect(page.getByLabel("Email hoặc số điện thoại")).toHaveValue("");
  });
});
