import { expect, test } from "@playwright/test";
import { CONTACT, contactMailto } from "@/content/contact";

const enabled = process.env.NBJ_E2E_CUSTOMER_IDENTITY === "1";

// A15-PHAP-LY-01 (17/09/2026): bài này chỉ đọc, không cần cờ CUS-05, nên được
// để ngoài khối `test.skip` bên dưới và chạy an toàn cả trên production. Chặn
// `/api/customer-events` chỉ là lớp phòng thủ thứ hai: chưa ai bấm đồng ý thì
// trình theo dõi vốn không gửi gì.
test.describe("A15-PHAP-LY-01 privacy notice legal basis", () => {
  test("cites the law in force, names the request channel and keeps the email out of served HTML", async ({ page, request }) => {
    const response = await request.get("/quyen-rieng-tu");
    expect(response.ok()).toBe(true);
    const served = await response.text();
    expect(served).toContain("91/2025/QH15");
    expect(served).toContain("356/2025/NĐ-CP");
    expect(served).not.toContain([CONTACT.emailUser, CONTACT.emailDomain].join("@"));
    expect(served).not.toContain(CONTACT.emailDomain);

    await page.route("**/api/customer-events", async (route) => {
      await route.fulfill({ status: 204 });
    });
    await page.goto("/quyen-rieng-tu", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Hai văn bản làm căn cứ" })).toBeVisible();
    await expect(page.getByText("Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15", { exact: true })).toBeVisible();
    await expect(page.getByText("Nghị định 356/2025/NĐ-CP", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Gửi yêu cầu về dữ liệu" })).toBeVisible();
    // Địa chỉ thư chỉ được ghép sau khi trang chạy trên trình duyệt.
    await expect(page.getByRole("link", { name: "Gửi thư yêu cầu" })).toHaveAttribute(
      "href",
      contactMailto("Yêu cầu về dữ liệu cá nhân"),
    );
    await expect(page.getByRole("link", { name: `Gọi ${CONTACT.phoneLabel}` })).toHaveAttribute("href", CONTACT.phoneHref);

    await expect(page.getByText("Tokyo, Nhật Bản", { exact: true })).toBeVisible();
    await expect(page.getByText("02 ngày làm việc", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

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
    // Bám VÙNG hỏi quyền, không bám riêng dòng tiêu đề. Ngày 21/09 dải này
    // rút từ một thẻ ba tầng xuống một dòng, và tiêu đề chuyển thành chữ chỉ
    // dành cho trình đọc màn hình — `toBeVisible()` trên một phần tử bị kẹp
    // 1×1px luôn sai, dù cây trợ năng vẫn có đủ tên. Điều bài này thật sự
    // cần canh là: hỏi quyền PHẢI hiện ra trước khi ghi nhận bất cứ gì.
    const daiQuyen = page.getByRole("complementary", { name: "Lựa chọn quyền riêng tư" });
    await expect(daiQuyen).toBeVisible();
    await expect(
      daiQuyen.getByRole("heading", { name: "Cho phép ghi nhận nội dung hữu ích?" }),
    ).toBeAttached();
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
    await page.getByLabel("Hoặc kể bằng lời của bạn").fill("Tôi muốn đi Tam Cốc một ngày, nhịp thư thả.");
    await page.getByRole("button", { name: "Xem thử một ngày cho tôi" }).click();
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
