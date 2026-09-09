import { expect, test } from "@playwright/test";

/**
 * CREATIVE-FRONTEND-08 is deliberately a read-only public-surface suite. The
 * opt-out and the intercepted event endpoint make the same suite safe when a
 * release candidate is pointed at production.
 */
async function prepareStory(page: import("@playwright/test").Page) {
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
        policy_version: "xuan-truong-analytics-draft-v1",
      }),
    );
  });
}

async function openStory(
  page: import("@playwright/test").Page,
  lang: "vi" | "en",
) {
  await prepareStory(page);
  await page.goto(`/?lang=${lang}&presentation=1`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("opening-intro")).toHaveCount(0, {
    timeout: 12000,
  });

  const story = page.getByTestId("trang-an-scroll-story");
  await expect(story).toBeVisible();
  await story.scrollIntoViewIfNeeded();
  return story;
}

test("Tràng An scroll story keeps exactly five editorial beats in Vietnamese and English", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const lang of ["vi", "en"] as const) {
    const story = await openStory(page, lang);
    await expect(story.locator("[data-story-beat]")).toHaveCount(5);
    await expect(story.locator("[data-story-route-progress]")).toHaveCount(1);
  }
});

test("desktop motion keeps the Tràng An story in the viewport without horizontal overflow", async ({
  page,
}) => {
  // Nine deliberate scroll checkpoints include 6.48s of scrub settling.
  // Production cold starts under four parallel workers can consume most of
  // the default 30s before those assertions even begin.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const story = await openStory(page, "en");

  await expect(story.locator("[data-story-route-progress]")).toBeVisible();
  await expect(story.locator("[data-story-beat][aria-hidden='true']")).toHaveCount(0);
  const semanticallyExposed = await story.locator("[data-story-copy]").evaluateAll((copies) =>
    copies.every((copy) => {
      const style = getComputedStyle(copy);
      return style.display !== "none" && style.visibility !== "hidden";
    }),
  );
  expect(semanticallyExposed).toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const moveToProgress = async (progress: number) => {
    await story.evaluate((element, nextProgress) => {
      const rect = element.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      const travel = Math.max(0, rect.height - window.innerHeight);
      window.scrollTo(0, top + travel * nextProgress);
    }, progress);
    // The scene intentionally uses a 0.65s scrub, so wait for the visual
    // state rather than asserting against the first intermediate frame.
    await page.waitForTimeout(720);
  };

  const checkpoints = [
    { progress: 0, activeIndex: 0 },
    { progress: 0.26, activeIndex: 1 },
    { progress: 0.51, activeIndex: 2 },
    { progress: 0.76, activeIndex: 3 },
    { progress: 0.99, activeIndex: 4 },
    // Regression: callback-only state used to leave the rail on the wrong
    // stop when a visitor scrolled backwards.
    { progress: 0.74, activeIndex: 3 },
    { progress: 0.49, activeIndex: 2 },
    { progress: 0.24, activeIndex: 1 },
    { progress: 0, activeIndex: 0 },
  ];

  for (const checkpoint of checkpoints) {
    await moveToProgress(checkpoint.progress);
    const beats = story.locator("[data-story-beat]");
    await expect(beats).toHaveCount(5);
    await expect(beats.nth(checkpoint.activeIndex)).toHaveAttribute("data-active", "true");
    await expect(story.locator("[data-story-current]")).toHaveText(
      String(checkpoint.activeIndex + 1).padStart(2, "0"),
    );
  }
});

test("mobile uses five readable story beats in ordinary one-finger vertical flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const story = await openStory(page, "vi");
  const beats = story.locator("[data-story-beat]");
  await expect(beats).toHaveCount(5);

  const mobileFlow = await story.evaluate((element) => {
    const rootStyle = getComputedStyle(element);
    const beatElements = Array.from(
      element.querySelectorAll<HTMLElement>("[data-story-beat]"),
    );
    const positions = beatElements.map((beat) => getComputedStyle(beat).position);
    const bounds = beatElements.map((beat) => beat.getBoundingClientRect());
    return {
      rootOverflowX: rootStyle.overflowX,
      noPinnedBeats: positions.every(
        (position) => position !== "fixed" && position !== "sticky",
      ),
      distinctVerticalPositions:
        new Set(bounds.map((bound) => Math.round(bound.top))).size === bounds.length,
      scrollableDocument: document.documentElement.scrollHeight > window.innerHeight,
    };
  });
  expect(mobileFlow.rootOverflowX).not.toBe("scroll");
  expect(mobileFlow.noPinnedBeats).toBe(true);
  expect(mobileFlow.distinctVerticalPositions).toBe(true);
  expect(mobileFlow.scrollableDocument).toBe(true);

  for (let index = 0; index < 5; index += 1) {
    await beats.nth(index).scrollIntoViewIfNeeded();
    await expect(beats.nth(index)).toBeVisible();
  }
});

test("the minimum pinned breakpoint reserves a clear column for its route rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const story = await openStory(page, "en");

  const metrics = await story.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: window.scrollY + rect.top,
      travel: Math.max(0, rect.height - window.innerHeight),
    };
  });
  await page.evaluate(
    ({ top, travel }) => window.scrollTo(0, top + travel * 0.5),
    metrics,
  );
  await page.waitForTimeout(720);

  const spacing = await story.evaluate((element) => {
    const active = element.querySelector<HTMLElement>("[data-story-beat][data-active='true']");
    const rail = element.querySelector<HTMLElement>("[data-story-stop]")?.parentElement;
    if (!active || !rail) throw new Error("Pinned story is missing its active beat or route rail");
    const copyLines = Array.from(
      active.querySelectorAll<HTMLElement>("[data-story-copy] > *"),
    );
    if (copyLines.length === 0) throw new Error("Active story beat has no copy lines");
    const contentRight = Math.max(...copyLines.map((line) => line.getBoundingClientRect().right));
    const railLeft = rail.getBoundingClientRect().left;
    return { contentRight, railLeft };
  });
  expect(spacing.contentRight + 8).toBeLessThanOrEqual(spacing.railLeft);
});

test("reduced motion exposes the complete Tràng An story without a pin or hidden transform state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const story = await openStory(page, "en");
  const beats = story.locator("[data-story-beat]");
  await expect(beats).toHaveCount(5);

  const reducedMotionState = await story.evaluate((element) => {
    const beatElements = Array.from(
      element.querySelectorAll<HTMLElement>("[data-story-beat]"),
    );
    const styles = beatElements.map((beat) => getComputedStyle(beat));
    const pinSpacers = Array.from(document.querySelectorAll(".pin-spacer")).filter(
      (spacer) => spacer.contains(element),
    );
    return {
      hasPinSpacer: pinSpacers.length > 0,
      allVisible: styles.every(
        (style) =>
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity) >= 0.99,
      ),
      noPositionalTransform: styles.every(
        (style) => style.transform === "none" && style.position !== "fixed",
      ),
    };
  });
  expect(reducedMotionState.hasPinSpacer).toBe(false);
  expect(reducedMotionState.allVisible).toBe(true);
  expect(reducedMotionState.noPositionalTransform).toBe(true);
});
