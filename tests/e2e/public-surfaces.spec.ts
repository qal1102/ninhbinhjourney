import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// T2 removed "/demo/ops": it is the console of the abandoned stack and now
// answers 404 in production. Auditing the accessibility of a page nobody can
// reach was measuring the wrong thing.
const criticalRoutes = ["/", "/explore", "/packages", "/plan"] as const;

test("home intro keeps all four identity words with separated timing, then auto-dismisses with no skip control", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?lang=vi&presentation=1", {
    waitUntil: "domcontentloaded",
  });

  const intro = page.getByTestId("opening-intro");
  const words = page.locator(
    '[data-testid="opening-intro"] .opening-sequence span',
  );

  /*
   * Kiểm phần NHẠY THỜI GIAN trước tiên: màn intro chỉ sống 6,5 giây, nên
   * mọi khẳng định "nó vẫn còn đó" phải chạy ngay đầu. Trước đây khối này
   * nằm sau các phép đo chữ và độ trễ, và khi trang nặng thêm (nạp sẵn cả
   * ba trình phát video từ 06/08) thì tới lượt nó intro đã tự tắt -- bài
   * test đỏ vì đua thời gian chứ không phải vì sản phẩm sai.
   *
   * Cố ý KHÔNG có nút "Bỏ qua intro", và bấm vào đâu cũng không tắt được:
   * khung 6,5 giây này là khoảng duy nhất để ba trình phát kịp boot xong
   * trước khi khách cuộn tới.
   */
  await expect(intro).toHaveCount(1);
  await expect(intro.locator(".opening-palette")).toHaveCount(1);
  const openingImageOpacity = await intro
    .locator(".opening-image")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
  expect(openingImageOpacity).toBeGreaterThan(0.7);
  await expect(page.getByRole("button", { name: /skip|bỏ qua/i })).toHaveCount(0);
  // Bấm bằng chuột vào giữa màn hình thay vì `locator.click()`: đây đúng
  // là thứ khách làm khi muốn bỏ qua, và không vướng phép kiểm "visible"
  // của Playwright trên một lớp phủ đang chạy animation.
  const box = page.viewportSize()!;
  await page.mouse.click(box.width / 2, box.height / 2);
  await expect(intro).toHaveCount(1);

  await expect(words).toHaveCount(4);
  await expect(words).toHaveText(["Ninh Bình", "Thiên nhiên", "Di sản", "Kỳ quan"]);

  const delays = await words.evaluateAll((items) =>
    items.map((item) => Number.parseFloat(getComputedStyle(item).animationDelay)),
  );
  expect(delays).toEqual([0.35, 1.55, 2.75, 3.95]);

  // Tự tắt đúng lúc animation CSS kết thúc (~6,5s) -- không phải hẹn giờ
  // đoán mò trong bài test.
  await expect(intro).toHaveCount(0, { timeout: 12000 });
});

test("home does not repeat the intro slogan and presents routes after the destination catalog", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });

  const hero = page.locator("main > section").first();
  await expect(hero).not.toContainText("Thiên nhiên. Di sản. Kỳ quan.");

  const sectionOrder = await page
    .locator("#destination-index, #curated-routes")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(sectionOrder).toEqual(["destination-index", "curated-routes"]);
  await expect(page.locator("#curated-routes .route-progress-track")).toHaveCount(1);
});

test("Mid-Autumn campaign links the existing planner and marks brand work as concepts", async ({
  page,
}) => {
  await page.goto("/?lang=en&presentation=1", { waitUntil: "domcontentloaded" });

  const campaign = page.locator("#mid-autumn");
  await expect(campaign.getByRole("heading", { name: /Mid-Autumn season/i })).toBeVisible();
  await expect(campaign.getByRole("link", { name: "Plan a Mid-Autumn escape" })).toHaveAttribute(
    "href",
    "/plan?lang=en&source=mid-autumn-2026",
  );
  await expect(campaign.locator("img")).toHaveCount(9);
  await expect(campaign).toContainText("independent creative concepts");
  await expect(campaign).toContainText("do not confirm a commercial partnership");
});

test("cinematic panels use local MP4 without embedded player controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });

  const panels = page.locator(".cinematic-frame");
  const videos = panels.locator("video");
  await expect(panels).toHaveCount(3);
  await expect(videos).toHaveCount(3, { timeout: 10000 });
  await expect(panels.locator("iframe")).toHaveCount(0);

  const sources = await videos.evaluateAll((items) =>
    items.map((item) => ({
      controls: (item as HTMLVideoElement).controls,
      path: new URL((item as HTMLVideoElement).currentSrc).pathname,
    })),
  );
  expect(sources).toEqual([
    { controls: false, path: "/videos/cinematic/ninh-binh-water.mp4" },
    { controls: false, path: "/videos/cinematic/tam-coc-river.mp4" },
    { controls: false, path: "/videos/cinematic/trang-an-heritage.mp4" },
  ]);

  await expect(panels.nth(0)).toContainText("Đỉnh Ngọa Long · Hang Múa");
  await expect(panels.nth(1)).toContainText("Quần thể danh thắng Tràng An · UNESCO 2014");
  await expect(panels.nth(2)).toContainText("Tuyến 1 · Tràng An");
});

test("route showcase changes image and label with the selected stop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });

  const routes = page.locator("#curated-routes [data-route-card]");
  await expect(routes).toHaveCount(4);

  const waterRoute = routes.nth(0);
  await waterRoute.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await expect(waterRoute).toHaveAttribute("data-active-stop", "trang_an");
  await waterRoute.getByRole("button", { name: /Tam Cốc/ }).click();
  await expect(waterRoute).toHaveAttribute("data-active-stop", "tam_coc");
  await expect(waterRoute.getByRole("img", { name: "Tam Cốc" })).toBeVisible();

  const eveningRoute = routes.nth(3);
  await eveningRoute.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await eveningRoute.getByRole("button", { name: /Phố cổ Hoa Lư/ }).click();
  await expect(eveningRoute).toHaveAttribute("data-active-stop", "hoa_lu_old_town");
  await expect(eveningRoute.getByRole("img", { name: "Phố cổ Hoa Lư" })).toBeVisible();
});

test("language switch updates immediately, persists and preserves source", async ({
  page,
}) => {
  // Không còn nút bỏ qua intro -- dùng reduced-motion để đi qua khung
  // intro nhanh (CSS rút còn 1,4s), không phải để kiểm reduced-motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=vi&source=trang_an");
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Bình",
    }),
  ).toBeVisible();

  // `exact` tránh bắt nhầm nút "Open Next.js Dev Tools" của môi trường
  // development, vốn cũng chứa chuỗi "en" khi Playwright so khớp mờ.
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Binh",
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveURL(/source=trang_an/);

  await page.reload();
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ninh Binh",
    }),
  ).toBeVisible();
});

test("Build a route opens the real planner", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=vi&source=trang_an");
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });
  await page.getByRole("link", { name: "Lập hành trình" }).first().click();
  await expect(page).toHaveURL(/\/plan\?lang=vi&source=trang_an/);
  await expect(page.getByRole("main")).toBeVisible();
});

for (const route of criticalRoutes) {
  test(`${route} has no critical accessibility violation or overflow`, async ({
    page,
  }) => {
    // KHÔNG dùng `networkidle` cho các trang này. Từ 06/08 trang chủ nạp
    // sẵn cả ba trình phát YouTube ngay khi mở (để cụm nút khởi động kịp
    // tan trước khi khách cuộn tới), nên luồng mạng gần như không bao giờ
    // "rảnh" và `networkidle` sẽ chờ tới hết giờ. Chờ theo trạng thái DOM
    // rồi để yên một nhịp cho bố cục ổn định là đủ cho axe.
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.waitForTimeout(2500);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=vi");
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });
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
