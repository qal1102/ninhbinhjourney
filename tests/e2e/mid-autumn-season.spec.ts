import { expect, test } from "@playwright/test";

/**
 * A15-TRUNG-THU-01 (phần còn lại). Sau khi Bàn Trăng hết bán (27/09/2026
 * 23:59 giờ VN, `lib/seasonal/mid-autumn-season.ts`), cổng trang chủ, hộp
 * trợ lý hành trình và `/seasonal/mid-autumn` phải tự đổi sang trạng thái
 * "mùa đã khép" mà KHÔNG cần build hay deploy lại — cờ tính bằng đồng hồ
 * thật của trình duyệt lúc trang dựng xong (client check, xem
 * `lib/seasonal/use-mid-autumn-season.ts`).
 *
 * Ép đồng hồ trình duyệt bằng `page.clock.setFixedTime()` để đo được cả hai
 * trạng thái ngay hôm nay, không phải chờ tới 28/09/2026 thật. Giá trị ép
 * là một `Date` tuyệt đối (epoch), nên không phụ thuộc múi giờ của máy chạy
 * Playwright.
 */
const IN_SEASON_INSTANT = new Date("2026-09-27T23:59:30+07:00");
const CLOSED_INSTANT = new Date("2026-09-28T00:00:30+07:00");

async function prepareReadOnly(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("nbj-intro-played", "1");
      window.localStorage.setItem(
        "nbj-customer-analytics-consent",
        JSON.stringify({
          product_analytics: "denied",
          marketing_communications: "denied",
          policy_version: "xuan-truong-analytics-draft-v1",
        }),
      );
    } catch {
      // Chế độ riêng tư chặn storage -- không sao, trang vẫn dựng được.
    }
  });
}

test.describe("A15-TRUNG-THU-01: cờ mùa Trung thu tính theo đồng hồ thật", () => {
  test("trước 27/09 23:59 giờ VN: cổng trang chủ và trang mùa giữ nguyên, chưa đổi gì", async ({ page }) => {
    await prepareReadOnly(page);
    await page.clock.setFixedTime(IN_SEASON_INSTANT);

    await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });
    await expect(
      page.getByRole("link", { name: "Sự kiện theo mùa · Trung thu" }).first(),
    ).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await expect(page.getByText("Sự kiện theo mùa · Mùa đã khép")).toHaveCount(0);

    await page.goto("/seasonal/mid-autumn?lang=en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mid-autumn-season-closed]")).toHaveCount(0);

    const campaign = page.locator("#mid-autumn");
    await campaign.getByRole("button", { name: "Open details: Moon Table by the Ngo Dong" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "View dates and hold a table" })).toHaveAttribute(
      "href",
      "/packages/ban-trang-tam-coc-2026?lang=en&source=mid-autumn-2026",
    );
    await page.keyboard.press("Escape");
  });

  test("từ 28/09 00:00 giờ VN: cổng trang chủ nói thẳng mùa đã khép, không CTA nào dẫn tới lượt giữ chỗ hỏng", async ({
    page,
  }) => {
    await prepareReadOnly(page);
    await page.clock.setFixedTime(CLOSED_INSTANT);

    // --- Trang chủ: nhãn cổng đổi, đường dẫn tới trang mùa vẫn còn ---
    await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });
    const closedPortal = page.getByRole("link", { name: "Sự kiện theo mùa · Mùa đã khép" }).first();
    await expect(closedPortal).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await expect(page.getByRole("link", { name: "Sự kiện theo mùa · Trung thu" })).toHaveCount(0);

    // Hộp trợ lý hành trình: world "seasonal" không còn mời như dịp sắp tới.
    const trigger = page.getByRole("button", { name: "Mở trợ lý hành trình" });
    await page.mouse.wheel(0, -60);
    await trigger.click();
    const conciergeDialog = page.getByRole("dialog", { name: "Bạn muốn xem phần nào?" });
    await expect(conciergeDialog).toBeVisible();
    const seasonalWorldLink = conciergeDialog.getByRole("link", { name: /Mùa Trăng 2026/ });
    await expect(seasonalWorldLink).toContainText("đã khép");
    await expect(seasonalWorldLink).not.toContainText("Xem hộp bánh, bàn tối và lịch sự kiện Trung thu");
    await expect(seasonalWorldLink).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await page.keyboard.press("Escape");

    // --- /seasonal/mid-autumn: mở đầu bằng thông báo mùa đã khép ---
    await page.goto("/seasonal/mid-autumn?lang=en", { waitUntil: "domcontentloaded" });
    const banner = page.locator("[data-mid-autumn-season-closed]");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("The 2026 moon season has closed");
    await expect(banner.getByRole("link", { name: "Browse open packages" })).toHaveAttribute(
      "href",
      "/packages?lang=en",
    );

    // Bàn Trăng: không còn nút dẫn tới một lượt giữ chỗ chắc chắn hỏng.
    const campaign = page.locator("#mid-autumn");
    await expect(campaign.locator('[data-seasonal-card="moon-table-ngo-dong"]')).toContainText(
      "2026 season closed",
    );
    await campaign.getByRole("button", { name: "Open details: Moon Table by the Ngo Dong" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Moon Table closed — see you in 2027");
    await expect(dialog.getByRole("link", { name: "View dates and hold a table" })).toHaveCount(0);
    const fallbackCta = dialog.getByRole("link", { name: "Browse open packages" });
    await expect(fallbackCta).toHaveAttribute("href", "/packages?lang=en&source=mid-autumn-2026");
    await page.keyboard.press("Escape");
  });
});
