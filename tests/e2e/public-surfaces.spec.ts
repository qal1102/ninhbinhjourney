import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// T2 removed "/demo/ops": it is the console of the abandoned stack and now
// answers 404 in production. Auditing the accessibility of a page nobody can
// reach was measuring the wrong thing.
const criticalRoutes = ["/", "/explore", "/packages", "/plan"] as const;

// WEB-PERF-01 (31/08): màn mở đầu nay nhớ bằng `sessionStorage` nên nó chỉ
// chạy một lần cho mỗi lượt vào thăm (F5/quay lại vẫn nhớ, tab mới thì
// không). Playwright Test đã cấp một context/tab MỚI cho mỗi test nên
// `sessionStorage` vốn đã trống, nhưng dọn tường minh trước mỗi lần `goto`
// dưới đây để bài kiểm không bao giờ phụ thuộc ngầm vào việc đó.
async function clearIntroSession(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.removeItem("nbj-intro-played");
    } catch {
      // Chế độ riêng tư chặn sessionStorage -- không sao, intro vẫn chạy.
    }
  });
}

test("home intro keeps all four identity words with separated timing, then auto-dismisses with no skip control", async ({
  page,
}) => {
  await clearIntroSession(page);
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

test("home intro does not replay on reload or back-navigation within the same tab", async ({
  page,
}) => {
  await clearIntroSession(page);
  // Chế độ giảm chuyển động (mặc định của config) cho tắt nhanh ở 900ms,
  // đủ để bài kiểm chờ intro chạy xong lần đầu mà không phải đợi 6,5 giây.
  await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 4000 });

  // F5: sessionStorage của tab vẫn còn nguyên qua một lần tải lại trang.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0);

  // Bấm "quay lại" sau khi rời trang: vẫn cùng một tab, sessionStorage vẫn
  // còn, nên intro không được chạy lại lần nữa.
  await page.goto("/explore?lang=vi", { waitUntil: "domcontentloaded" });
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0);
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

test("Mid-Autumn campaign publishes distinct service layouts, a campaign archive and a Hermès finale", async ({
  page,
}) => {
  test.slow();
  await page.addInitScript(() => {
    localStorage.setItem("nbj-customer-analytics-consent", JSON.stringify({
      product_analytics: "denied",
      marketing_communications: "denied",
      policy_version: "xuan-truong-analytics-draft-v1",
    }));
  });
  await page.goto("/?lang=en&presentation=1", { waitUntil: "domcontentloaded" });

  const campaign = page.locator("#mid-autumn");
  await expect(campaign.getByRole("heading", { name: /Moonrise over the Ngo Dong River/i })).toBeVisible();
  await expect(campaign.getByRole("link", { name: "Explore by occasion" })).toHaveAttribute("href", "#seasonal-moon-gifts");
  await expect(campaign.getByRole("link", { name: "Plan a moonlit journey" })).toHaveAttribute(
    "href",
    "/plan?lang=en&source=mid-autumn-2026",
  );
  await expect(campaign).toContainText("VND 390,000");
  await expect(campaign).toContainText("VND 2,480,000 / table");
  await expect(campaign.locator("[data-seasonal-card]")).toHaveCount(31);
  await expect(campaign.getByRole("heading", { name: "When the landscape becomes part of dinner." })).toBeVisible();
  await expect(campaign.getByRole("heading", { name: "Heritage, seen in another light." })).toBeVisible();
  await expect(campaign.getByRole("heading", { name: "Ninh Binh is an open invitation." })).toBeVisible();
  await expect(campaign.getByRole("heading", { name: "When a house finds a landscape of its own." })).toBeVisible();
  await expect(campaign.getByRole("heading", { name: "Five houses, one heritage landscape." })).toBeVisible();

  const serviceLayouts = await campaign.locator("[data-seasonal-layout]").evaluateAll((layouts) =>
    layouts.map((layout) => layout.getAttribute("data-seasonal-layout")),
  );
  expect(serviceLayouts).toEqual(["catalog", "feature", "stories", "mosaic", "index"]);

  const archive = campaign.locator("#seasonal-luxury-campaign-archive");
  await expect(archive.locator("[data-seasonal-card]")).toHaveCount(8);
  await expect(archive.getByRole("button", { name: "Select story: Hermès · The river keeps the final light" })).toBeVisible();
  await archive.getByRole("button", { name: "Select story: Dior · A lotus note through limestone country" }).click();
  const diorStage = archive.locator("[data-luxury-stage]");
  await expect(diorStage).toHaveAccessibleName("Open details: Dior · A lotus note through limestone country");
  expect(await diorStage.locator("img").getAttribute("src")).toContain("dior-lotus-beauty");
  await archive.getByRole("button", { name: "Campaign frames 2: Dior · A lotus note through limestone country" }).click();
  expect(await diorStage.locator("img").getAttribute("src")).toContain("dior-lotus-atelier");

  const atelier = campaign.locator("#seasonal-brand-atelier");
  await expect(atelier.locator("[data-seasonal-card]")).toHaveCount(5);
  const atelierOrder = await atelier.locator("[data-atelier-chapter]").evaluateAll((chapters) =>
    chapters.map((chapter) => chapter.getAttribute("data-atelier-chapter")),
  );
  expect(atelierOrder).toEqual([
    "celine-concept",
    "chanel-concept",
    "prada-concept",
    "bottega-veneta-concept",
    "hermes-concept",
  ]);
  await expect(atelier.locator("[data-atelier-finale='true']")).toHaveAttribute("data-seasonal-card", "hermes-concept");
  expect(await atelier.locator("[data-atelier-finale='true'] img").first().getAttribute("src")).toContain("hermes-on-the-river");
  for (const title of [
    "Celine · A study in stillness",
    "Chanel · Flowers against ancient stone",
    "Prada · A sharper kind of calm",
    "Bottega Veneta · Beauty in the making",
    "Hermès · Far away, then home",
  ]) {
    await expect(atelier.getByRole("button", { name: `Open details: ${title}` })).toBeVisible();
  }

  const separatePlanes = await campaign.locator("[data-seasonal-card]").evaluateAll((cards) =>
    cards.every((card) => {
      const button = card.querySelector(":scope > button");
      const media = button?.querySelector(":scope > [data-seasonal-card-media]");
      const copy = button?.querySelector(":scope > [data-seasonal-card-copy]");
      return Boolean(media && copy && media.parentElement === copy.parentElement);
    }),
  );
  expect(separatePlanes).toBe(true);

  await campaign.getByRole("button", { name: "Open details: Moon Table by the Ngo Dong" }).click();
  const bookingDialog = page.getByRole("dialog");
  await expect(bookingDialog.getByRole("heading", { name: "Moon Table by the Ngo Dong" })).toBeVisible();
  await expect(bookingDialog.getByRole("link", { name: "View dates and hold a table" })).toHaveAttribute(
    "href",
    "/packages/ban-trang-tam-coc-2026?lang=en&source=mid-autumn-2026",
  );
  await page.keyboard.press("Escape");
  await expect(bookingDialog).toHaveCount(0);

  await campaign.getByRole("button", { name: "Open details: Hermès · Far away, then home" }).click();
  const contactDialog = page.getByRole("dialog");
  await expect(contactDialog.getByRole("heading", { name: "Hermès · Far away, then home" })).toBeVisible();
  await expect(contactDialog.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(contactDialog.getByRole("link", { name: "Start a conversation" })).toHaveAttribute("href", /^mailto:xuantruong_nb@hn\.vnn\.vn/);
  await expect(contactDialog.getByRole("link", { name: "Call the team" })).toHaveAttribute("href", "tel:+842293876930");
  await expect(contactDialog).toContainText("independent editorial series for brand outreach");
  await page.keyboard.press("Shift+Tab");
  await expect(contactDialog.getByRole("link", { name: "Send an email" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(contactDialog).toHaveCount(0);
  await expect(campaign.getByRole("button", { name: "Open details: Hermès · Far away, then home" })).toBeFocused();
});

test("cinematic panel uses local MP4 without embedded player controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });

  // WEB-PERF-01 (31/08): chỉ còn ĐÚNG MỘT băng video nền -- chủ dự án yêu
  // cầu bỏ hai băng phía dưới trang, hai tệp .mp4 tương ứng cũng đã bị xoá
  // khỏi public/.
  const panels = page.locator(".cinematic-frame");
  const videos = panels.locator("video");
  await expect(panels).toHaveCount(1);
  await expect(videos).toHaveCount(1, { timeout: 10000 });
  await expect(panels.locator("iframe")).toHaveCount(0);

  const sources = await videos.evaluateAll((items) =>
    items.map((item) => ({
      controls: (item as HTMLVideoElement).controls,
      path: new URL((item as HTMLVideoElement).currentSrc).pathname,
    })),
  );
  expect(sources).toEqual([
    { controls: false, path: "/videos/cinematic/ninh-binh-water.mp4" },
  ]);

  await expect(panels.nth(0)).toContainText("Đỉnh Ngọa Long · Hang Múa");
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

/*
 * Đọc lại cấu hình mà chính trang đang khai ra DOM. Hai thuộc tính này do
 * `config/experience.ts#getExperienceSurfaceAttributes` sinh ra, dùng chung
 * cho `/`, `/plan` và `/packages`, nên bài kiểm không phải đoán xem máy chủ
 * đang chạy biến môi trường nào.
 */
async function readSurfaceConfig(page: import("@playwright/test").Page) {
  const root = page.locator("[data-experience-mode]");
  // Đúng một phần tử gốc được khai, không hơn: nếu một khối con nào đó cũng
  // tự khai mode thì cả bài kiểm dưới đây đang đọc nhầm chỗ.
  await expect(root).toHaveCount(1);
  const mode = await root.getAttribute("data-experience-mode");
  const checkout = await root.getAttribute("data-checkout-available");
  expect(["client-demo", "production"]).toContain(mode);
  expect(["true", "false"]).toContain(checkout);
  return { mode, checkoutAvailable: checkout === "true" };
}

/*
 * NBJ-I06. Bài này trước đây tên là "production mode hides concept and
 * demonstration controls" và ĐỎ ở mọi đợt deploy suốt nhiều tháng, vì nó ôm
 * một kỳ vọng cũ: hễ chạy trên production thì `NEXT_PUBLIC_EXPERIENCE_MODE`
 * phải là `production`. Thực tế `vercel.json` cố ý build `client-demo` và bật
 * `CUSTOMER_BOOKING_ENABLED` để luồng trình diễn và giữ chỗ chạy được — nút
 * "Run demo command" và "Chọn gói" hiện ra là ĐÚNG ý chủ dự án. Một bài kiểm
 * đỏ vĩnh viễn thì không ai còn nhìn nó nữa, và nó che mất lỗi thật; chính
 * kiểu này đã đẻ ra một báo cáo "lỗi nghiêm trọng" sai trong dự án.
 *
 * Nay bài kiểm đọc cấu hình trang tự khai rồi khẳng định theo đúng nhánh đó.
 * Cả hai nhánh đều có thể đỏ: khai `production` mà còn nút demo là sai, khai
 * `client-demo` mà nút biến mất cũng sai.
 *
 * Hai khẳng định cũ trên `/` đã bỏ vì chúng không bao giờ đỏ được: chữ
 * "Concept Collaborations" nằm trong `components/discovery/home-editorial.tsx`
 * mà không file nào import, còn nhãn "Client demonstration" chỉ dựng ở
 * `/explore`. Đếm trên trang chủ thì cả hai luôn bằng 0, bất kể cấu hình nào.
 */
test("NBJ-I06 public surfaces match the experience mode they declare", async ({
  page,
}) => {
  // `domcontentloaded` chứ không chờ `load`: hai thuộc tính cần đọc đều do máy
  // chủ dựng sẵn trong HTML, trong khi trang chủ còn kéo băng video nền nên sự
  // kiện `load` có khi mãi không tới (cùng lý do đã ghi ở bài axe phía trên).
  await page.goto("/plan", { waitUntil: "domcontentloaded" });
  const plan = await readSurfaceConfig(page);
  const demoCommand = page.getByRole("button", { name: "Run demo command" });
  if (plan.mode === "production") {
    await expect(demoCommand).toHaveCount(0);
  } else {
    // Nút nạp transcript mẫu là thứ giữ cho buổi trình diễn chạy được khi
    // micro không dùng được. Mất nó trên bản demo là mất một đường lui.
    await expect(demoCommand.first()).toBeAttached();
  }

  await page.goto("/packages", { waitUntil: "domcontentloaded" });
  const packages = await readSurfaceConfig(page);
  const choosePackage = page.getByRole("link", { name: /Chọn gói/i });
  if (packages.checkoutAvailable) {
    await expect(choosePackage.first()).toBeAttached();
  } else {
    await expect(choosePackage).toHaveCount(0);
  }
  // Chế độ trình diễn luôn kèm thanh toán sandbox, nên đã khai `client-demo`
  // thì không có cách nào khoá đường đi tiếp của khách.
  if (packages.mode === "client-demo") {
    expect(packages.checkoutAvailable).toBe(true);
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const home = await readSurfaceConfig(page);
  // Ba bề mặt cùng đọc một hàm nên phải khai giống nhau. Lệch nhau nghĩa là
  // có trang tự dựng logic riêng, đúng cái bẫy đã làm bài này đỏ trường kỳ.
  expect(home.mode).toBe(plan.mode);
  expect(home.checkoutAvailable).toBe(packages.checkoutAvailable);
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
