import { expect, test } from "@playwright/test";

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill("Giamdoc@2026");
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("desktop ERP navigation fits, opens one group and supports the keyboard", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Desktop navigation is replaced by the mobile hamburger.",
  );

  await loginAsDirector(page);

  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/erp/trang-an");

    const navigation = page.getByRole("navigation", { name: "Module Tràng An" });
    await expect(navigation).toBeVisible();
    const row = navigation.locator(":scope > div");
    const geometry = await row.evaluate((element) => {
      const items = Array.from(element.children).map((child) => {
        const rect = child.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, height: rect.height };
      });
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        viewportWidth: window.innerWidth,
        items,
      };
    });

    expect(geometry.scrollWidth - geometry.clientWidth).toBeLessThanOrEqual(1);
    expect(Math.max(...geometry.items.map((item) => item.right))).toBeLessThanOrEqual(
      geometry.viewportWidth,
    );
    expect(new Set(geometry.items.map((item) => Math.round(item.top))).size).toBe(1);

    const summaries = navigation.locator("summary");
    for (let index = 0; index < (await summaries.count()); index += 1) {
      const summary = summaries.nth(index);
      await summary.click();
      await expect(navigation.locator("details[open]")).toHaveCount(1);
      const panel = summary.locator("xpath=.." ).locator(":scope > div");
      const panelRect = await panel.boundingBox();
      expect(panelRect).not.toBeNull();
      expect(panelRect!.x).toBeGreaterThanOrEqual(0);
      expect(panelRect!.x + panelRect!.width).toBeLessThanOrEqual(width);
    }

    await page.screenshot({
      path: `artifacts/nav-audit-${width}.png`,
      fullPage: false,
    });
  }

  const navigation = page.getByRole("navigation", { name: "Module Tràng An" });
  const overview = navigation.getByRole("link", { name: "Tổng quan" });
  const booking = navigation.locator("summary").filter({ hasText: "Booking" });
  await overview.focus();
  await page.keyboard.press("Tab");
  await expect(booking).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(booking.locator("xpath=..")).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(booking.locator("xpath=..")).not.toHaveAttribute("open", "");

  await booking.click();
  await expect(booking.locator("xpath=..")).toHaveAttribute("open", "");
  await page.getByRole("heading", { name: "Tràng An" }).click();
  await expect(booking.locator("xpath=..")).not.toHaveAttribute("open", "");
});
