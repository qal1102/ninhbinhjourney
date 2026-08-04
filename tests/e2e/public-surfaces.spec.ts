import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// T2 removed "/demo/ops": it is the console of the abandoned stack and now
// answers 404 in production. Auditing the accessibility of a page nobody can
// reach was measuring the wrong thing.
const criticalRoutes = ["/", "/explore", "/packages", "/plan"] as const;

test("home intro keeps all four identity words with separated timing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?lang=vi&presentation=1", {
    waitUntil: "domcontentloaded",
  });

  const words = page.locator(
    '[data-testid="opening-intro"] .opening-sequence span',
  );
  await expect(words).toHaveCount(4);
  await expect(words).toHaveText(["Ninh Bình", "Thiên nhiên", "Di sản", "Kỳ quan"]);

  const delays = await words.evaluateAll((items) =>
    items.map((item) => Number.parseFloat(getComputedStyle(item).animationDelay)),
  );
  expect(delays).toEqual([0.35, 1.55, 2.75, 3.95]);

  await page.getByRole("button", { name: "Bỏ qua intro" }).click();
  await expect(page.getByTestId("opening-intro")).toHaveCount(0);
});

test("language switch updates immediately, persists and preserves source", async ({
  page,
}) => {
  await page.goto("/?lang=vi&source=trang_an");
  const skipIntro = page.getByRole("button", { name: "Bỏ qua intro" });
  if (await skipIntro.isVisible()) await skipIntro.click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Bình",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "EN" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Binh",
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveURL(/source=trang_an/);

  await page.reload();
  const skipEnglishIntro = page.getByRole("button", { name: "Skip intro" });
  if (await skipEnglishIntro.isVisible()) await skipEnglishIntro.click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Binh",
    }),
  ).toBeVisible();
});

test("Build a route opens the real planner", async ({ page }) => {
  await page.goto("/?lang=vi&source=trang_an");
  const skipIntro = page.getByRole("button", { name: "Bỏ qua intro" });
  if (await skipIntro.isVisible()) await skipIntro.click();
  await page.getByRole("link", { name: "Lập hành trình" }).first().click();
  await expect(page).toHaveURL(/\/plan\?lang=vi&source=trang_an/);
  await expect(page.getByRole("main")).toBeVisible();
});

for (const route of criticalRoutes) {
  test(`${route} has no critical accessibility violation or overflow`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious",
      ),
    ).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("NBJ-I06 production mode hides concept and demonstration controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Concept Collaborations")).toHaveCount(0);
  await expect(page.getByText(/Client demonstration/i)).toHaveCount(0);

  await page.goto("/plan");
  await expect(
    page.getByRole("button", { name: "Run demo command" }),
  ).toHaveCount(0);

  await page.goto("/packages");
  await expect(page.getByRole("link", { name: /Chọn gói/i })).toHaveCount(0);
});

test("discovery list mode works without waiting on the map", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.getByRole("main")).toBeVisible();
  // Nhãn nav từng là "Lập hành trình / Plan" (song ngữ trộn trên trang không
  // có nút đổi ngôn ngữ) — đã gọn lại còn tiếng Việt ngày 04/08.
  await expect(
    page.getByRole("link", { name: "Lập hành trình" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Danh sách" }).click();
  await expect(page.locator("article").first()).toBeVisible();
});

test("discovery map mode renders a real interactive map, not a static canvas", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: "Bản đồ", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
});

test("captures local responsive evidence", async ({ page }, testInfo) => {
  await page.goto("/?lang=vi");
  const skipIntro = page.getByRole("button", { name: "Bỏ qua intro" });
  if (await skipIntro.isVisible()) await skipIntro.click();
  await page.screenshot({
    path: testInfo.outputPath("home-full-page.png"),
    fullPage: true,
  });

  await page.goto("/explore");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: testInfo.outputPath("explore-full-page.png"),
    fullPage: true,
  });
});
