import { expect, test, type Page } from "@playwright/test";

async function prepareReadOnlyHero(page: Page) {
  await page.route("**/api/customer-events", async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("nbj-intro-played", "1");
    window.localStorage.setItem(
      "nbj-customer-analytics-consent",
      JSON.stringify({
        product_analytics: "denied",
        marketing_communications: "denied",
        essential_service: "not-requested",
        policy_version: "xuan-truong-analytics-draft-v1",
        marketing_policy_version: "xuan-truong-marketing-draft-v1",
      }),
    );
  });
}

async function waitForHero(page: Page, motion: "full" | "reduced") {
  const hero = page.locator("[data-hero-scene]");
  await expect(hero).toHaveAttribute("data-motion", motion);
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero.locator("[data-hero-depth-window]")).toBeVisible();
  await expect(page.locator("[data-hero-cinematic-handoff]")).toHaveCount(1);
  await expect(page.getByTestId("trang-an-scroll-story")).toHaveCount(1);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

test("hero depth remains legible and geometry-stable at the required widths", async ({
  page,
}, testInfo) => {
  test.slow();
  await prepareReadOnlyHero(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
    await waitForHero(page, "full");
    await expect
      .poll(() =>
        page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .some((entry) => entry.name.includes("/_next/image") && entry.name.includes("intro-trang-an-rain")),
        ),
      )
      .toBe(true);

    const start = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-hero-scene]")!;
      const title = hero.querySelector<HTMLElement>(".hero-signature-title")!;
      const copy = hero.querySelector<HTMLElement>(".hero-copy-safe")!;
      const subtitle = copy.querySelector<HTMLElement>("p")!;
      const plan = hero.querySelector<HTMLElement>('[data-customer-track="home-hero-plan"]')!;
      const explore = hero.querySelector<HTMLElement>('[data-customer-track="home-hero-explore"]')!;
      const packageCue = hero.querySelector<HTMLElement>('[data-customer-track="home-hero-packages"]')!;
      const concierge = document.querySelector<HTMLElement>("[data-journey-concierge-trigger]");
      const heroRect = hero.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const subtitleRect = subtitle.getBoundingClientRect();
      const planRect = plan.getBoundingClientRect();
      const exploreRect = explore.getBoundingClientRect();
      const packageCueRect = packageCue.getBoundingClientRect();
      const conciergeRect = concierge?.getBoundingClientRect();
      const sceneImage = hero.querySelector<HTMLElement>(".hero-scene-image")!;
      const depthWindow = hero.querySelector<HTMLElement>("[data-hero-depth-window]")!;
      const sceneContent = hero.querySelector<HTMLElement>(".hero-scene-content")!;
      const overlaps = (first: DOMRect, second?: DOMRect) =>
        Boolean(
          second &&
            first.left < second.right &&
            first.right > second.left &&
            first.top < second.bottom &&
            first.bottom > second.top,
        );
      return {
        documentHeight: document.documentElement.scrollHeight,
        heroHeight: heroRect.height,
        titleInside: titleRect.left >= heroRect.left && titleRect.right <= heroRect.right + 1,
        copyInside: copyRect.left >= heroRect.left && copyRect.right <= heroRect.right + 1,
        controlsInside:
          planRect.bottom <= heroRect.bottom + 1 &&
          exploreRect.bottom <= heroRect.bottom + 1 &&
          planRect.left >= heroRect.left &&
          exploreRect.right <= heroRect.right + 1,
        titleBeforeCopy: titleRect.bottom <= subtitleRect.top + 1,
        floatingControlClear:
          !overlaps(planRect, conciergeRect) &&
          !overlaps(exploreRect, conciergeRect) &&
          !overlaps(packageCueRect, conciergeRect),
        visualMotion: {
          imageOpacity: getComputedStyle(sceneImage).opacity,
          imageTransform: getComputedStyle(sceneImage).transform,
          windowOpacity: getComputedStyle(depthWindow).opacity,
          contentTransform: getComputedStyle(sceneContent).transform,
        },
        rawDepthAssetRequested: performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.endsWith("/images/destinations/intro-trang-an-rain.png")),
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(start.heroHeight).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(start.titleInside).toBe(true);
    expect(start.copyInside).toBe(true);
    expect(start.controlsInside).toBe(true);
    expect(start.titleBeforeCopy).toBe(true);
    expect(start.floatingControlClear).toBe(true);
    expect(start.rawDepthAssetRequested).toBe(false);
    expect(start.horizontalOverflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: testInfo.outputPath(`hero-${viewport.width}.png`),
      animations: "disabled",
    });

    await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-hero-scene]")!;
      window.scrollTo({ top: hero.offsetHeight * 0.64, behavior: "auto" });
    });
    await expect
      .poll(() =>
        page.locator("[data-hero-scene]").evaluate((hero) =>
          Number.parseFloat(getComputedStyle(hero).getPropertyValue("--hero-progress")),
        ),
      )
      .toBeGreaterThan(0.55);

    const settled = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-hero-scene]")!;
      const sceneImage = hero.querySelector<HTMLElement>(".hero-scene-image")!;
      const depthWindow = hero.querySelector<HTMLElement>("[data-hero-depth-window]")!;
      const sceneContent = hero.querySelector<HTMLElement>(".hero-scene-content")!;
      return {
        documentHeight: document.documentElement.scrollHeight,
        heroHeight: hero.getBoundingClientRect().height,
        visualMotion: {
          imageOpacity: getComputedStyle(sceneImage).opacity,
          imageTransform: getComputedStyle(sceneImage).transform,
          windowOpacity: getComputedStyle(depthWindow).opacity,
          contentTransform: getComputedStyle(sceneContent).transform,
        },
      };
    });
    expect(settled.documentHeight).toBe(start.documentHeight);
    expect(settled.heroHeight).toBe(start.heroHeight);
    expect(settled.visualMotion.imageOpacity).not.toBe(start.visualMotion.imageOpacity);
    expect(settled.visualMotion.imageTransform).not.toBe(start.visualMotion.imageTransform);
    expect(settled.visualMotion.windowOpacity).not.toBe(start.visualMotion.windowOpacity);
    expect(settled.visualMotion.contentTransform).not.toBe(start.visualMotion.contentTransform);
    await page.locator("[data-hero-cinematic-handoff] h2").scrollIntoViewIfNeeded();
    const cinematicOverlap = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>("[data-hero-cinematic-handoff] h2")!;
      const concierge = document.querySelector<HTMLElement>("[data-journey-concierge-trigger]");
      if (!concierge) return { overlaps: false };
      const titleRect = title.getBoundingClientRect();
      const conciergeRect = concierge.getBoundingClientRect();
      return {
        overlaps:
          titleRect.left < conciergeRect.right &&
          titleRect.right > conciergeRect.left &&
          titleRect.top < conciergeRect.bottom &&
          titleRect.bottom > conciergeRect.top,
        title: titleRect.toJSON(),
        concierge: conciergeRect.toJSON(),
      };
    });
    expect(cinematicOverlap.overlaps, JSON.stringify(cinematicOverlap)).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`handoff-${viewport.width}.png`),
      animations: "disabled",
    });
  }
});

test("reduced motion exposes the complete static hero and static cinematic fallback", async ({
  page,
}, testInfo) => {
  await prepareReadOnlyHero(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=en&presentation=1", { waitUntil: "domcontentloaded" });
  await waitForHero(page, "reduced");

  const hero = page.locator("[data-hero-scene]");
  await expect(hero.getByRole("heading", { level: 1, name: "Ninh Binh" })).toBeVisible();
  await expect(hero.locator('[data-customer-track="home-hero-plan"]')).toBeVisible();
  await expect(hero.locator('[data-customer-track="home-hero-explore"]')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("hero-reduced-motion.png"),
    animations: "disabled",
  });

  await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-hero-scene]")!;
    window.scrollTo({ top: scene.offsetHeight * 0.5, behavior: "auto" });
  });

  const state = await hero.evaluate((scene) => {
    const content = scene.querySelector<HTMLElement>(".hero-scene-content")!;
    const background = scene.querySelector<HTMLElement>(".hero-scene-image")!;
    return {
      progress: getComputedStyle(scene).getPropertyValue("--hero-progress").trim(),
      contentOpacity: getComputedStyle(content).opacity,
      contentTransform: getComputedStyle(content).transform,
      backgroundTransform: getComputedStyle(background).transform,
    };
  });
  expect(state).toEqual({
    progress: "0",
    contentOpacity: "1",
    contentTransform: "none",
    backgroundTransform: "none",
  });
  await expect(page.locator("[data-hero-cinematic-handoff] video")).toHaveCount(0);
  await expect(page.getByTestId("trang-an-scroll-story")).toHaveAttribute("data-motion", "reduced");

  await page.screenshot({
    path: testInfo.outputPath("handoff-reduced-motion.png"),
    animations: "disabled",
  });
});
