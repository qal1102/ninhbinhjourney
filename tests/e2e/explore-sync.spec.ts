import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * EXPLORE-SYNC-09 is a read-only public-surface contract. These interactions
 * only change client state; blocking the analytics endpoint keeps the suite
 * equally safe when it is deliberately pointed at a production candidate.
 *
 * The data attributes below are the public interaction contract. In
 * particular, do not replace slug selectors with card copy or positional
 * locators: destination names are bilingual editorial content, whereas the
 * slug is the stable list-map-detail identity.
 */
async function prepareExplore(page: Page) {
  await page.route("**/api/customer-events", async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nbj-customer-analytics-consent",
      JSON.stringify({
        product_analytics: "denied",
        marketing_communications: "denied",
        policy_version: "xuan-truong-analytics-draft-v1",
      }),
    );
  });
  // This suite exercises hydrated client state. On a cold production cache,
  // DOMContentLoaded can precede the deferred Next.js bundle, so a click can
  // land on server-rendered controls before React has attached its handlers.
  await page.goto("/explore?lang=vi", { waitUntil: "load" });
  await expect(page.locator("[data-explore-list]")).toHaveCount(1);
}

function card(page: Page, slug: string): Locator {
  return page.locator(`[data-explore-destination="${slug}"]`);
}

function marker(page: Page, slug: string): Locator {
  return page.locator(`[data-map-destination="${slug}"]`);
}

function focusControl(page: Page, slug: string): Locator {
  return page.locator(`[data-explore-focus="${slug}"]`);
}

async function visibleDestinationSlugs(page: Page) {
  const slugs = await page.locator("[data-explore-destination]").evaluateAll((cards) =>
    cards
      .filter((item) => {
        const style = getComputedStyle(item);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((item) => item.getAttribute("data-explore-destination"))
      .filter((slug): slug is string => Boolean(slug)),
  );
  expect(slugs.length).toBeGreaterThanOrEqual(2);
  return slugs;
}

async function expectSynchronizedActive(page: Page, slug: string) {
  await expect(card(page, slug)).toHaveAttribute("data-active", "true");
  await expect(marker(page, slug)).toHaveClass(/\bnb-marker-active\b/);
}

async function closeDetailIfOpen(page: Page) {
  const dialog = page.getByRole("dialog");
  if ((await dialog.count()) === 0) return;

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

test("desktop focus control synchronizes card and map marker without opening detail", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "desktop-only visibility contract");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareExplore(page);

  const [slug] = await visibleDestinationSlugs(page);
  await focusControl(page, slug).click();

  await expectSynchronizedActive(page, slug);
  await expect(card(page, slug)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("clicking a map marker synchronizes and reveals its corresponding card", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "desktop split-view contract");
  await prepareExplore(page);
  const slugs = await visibleDestinationSlugs(page);
  const secondMarkerSlug = slugs[1];

  await marker(page, secondMarkerSlug).click();
  // A detail sheet is an allowed product choice for marker activation. The
  // list-map synchronization must be observable once that transient layer is
  // closed, rather than being hidden behind the dialog.
  await closeDetailIfOpen(page);

  await expectSynchronizedActive(page, secondMarkerSlug);
  await expect(card(page, secondMarkerSlug)).toBeInViewport();
  // The active identity must survive the complete smooth-scroll tail, not
  // merely the first frame after the marker click.
  await page.waitForTimeout(900);
  await expectSynchronizedActive(page, secondMarkerSlug);
});

test("deliberate list scrolling changes the active destination", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "desktop nested-scroll contract");
  await page.setViewportSize({ width: 1440, height: 700 });
  await prepareExplore(page);

  const list = page.locator("[data-explore-list]");
  const slugs = await visibleDestinationSlugs(page);
  const firstSlug = slugs[0];
  const targetSlug = slugs[Math.min(2, slugs.length - 1)];
  await focusControl(page, firstSlug).click();
  await expectSynchronizedActive(page, firstSlug);
  // The product deliberately ignores the tiny browser-generated reveal scroll
  // that can follow a button click near the edge of a nested scroller.
  await page.waitForTimeout(220);

  await list.evaluate((container, slug) => {
    const listElement = container as HTMLElement;
    const target = listElement.querySelector<HTMLElement>(
      `[data-explore-destination="${slug}"]`,
    );
    if (!target) throw new Error(`Missing destination card: ${slug}`);
    target.scrollIntoView({ block: "center", behavior: "auto" });
  }, targetSlug);
  await expect(card(page, targetSlug)).toBeInViewport();
  await expectSynchronizedActive(page, targetSlug);
  await expect(list).toBeVisible();
});

test("filtering never leaves active state pointing at a removed destination", async ({ page }) => {
  await prepareExplore(page);
  if ((await page.locator('[data-explore-view="list"]').getAttribute("aria-pressed")) !== "true") {
    await page.locator('[data-explore-view="list"]').click();
  }
  const [oldSlug] = await visibleDestinationSlugs(page);
  await focusControl(page, oldSlug).click();
  await expectSynchronizedActive(page, oldSlug);

  const interestFilter = page.locator('[data-explore-filter="interest"]');
  const options = await interestFilter.locator("option").evaluateAll((items) =>
    items
      .map((item) => item.getAttribute("value"))
      .filter((value): value is string => Boolean(value && value !== "all")),
  );

  let removed = false;
  for (const value of options) {
    await interestFilter.selectOption(value);
    if ((await card(page, oldSlug).count()) === 0) {
      removed = true;
      break;
    }
  }
  expect(removed, "a destination focus must be testable against a removing filter").toBe(true);
  await expect(card(page, oldSlug)).toHaveCount(0);
  await expect(marker(page, oldSlug)).toHaveCount(0);

  await expect(
    page.locator('[data-explore-destination][data-active="true"]'),
  ).toHaveCount(0);
  await expect(page.locator(".nb-marker-active")).toHaveCount(0);
});

test("mobile list selection returns to the map with the matching active marker", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile mode-switch contract");
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareExplore(page);

  await page.locator('[data-explore-view="list"]').click();
  const [slug] = await visibleDestinationSlugs(page);
  await focusControl(page, slug).click();

  await expect(page.locator('[data-explore-view-panel="map"]')).toBeVisible();
  await expectSynchronizedActive(page, slug);
  await expect(page.locator("[data-explore-map-focus]")).toBeFocused();
});

test("keyboard focus and reduced-motion selection keep the core map-list contract usable", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile keyboard contract");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareExplore(page);

  await page.locator('[data-explore-view="list"]').click();
  const [slug] = await visibleDestinationSlugs(page);
  await focusControl(page, slug).focus();
  await expect(focusControl(page, slug)).toBeFocused();
  await page.keyboard.press("Enter");

  await expectSynchronizedActive(page, slug);
  await expect(page.locator('[data-explore-view-panel="map"]')).toBeVisible();
  await expect(page.locator("[data-explore-map-focus]")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile can hide and reveal Leaflet repeatedly without crashing the route", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile map-resize regression");
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareExplore(page);

  for (let turn = 0; turn < 4; turn += 1) {
    await page.locator('[data-explore-view="list"]').click();
    await expect(page.locator('[data-explore-view-panel="list"]')).toBeVisible();
    await page.locator('[data-explore-view="map"]').click();
    await expect(page.locator('[data-explore-view-panel="map"]')).toBeVisible();
    await expect
      .poll(() =>
        page.locator("[data-brand-map]").evaluate((map) => {
          const mapRect = map.getBoundingClientRect();
          const marker = map.querySelector<HTMLElement>(".nb-marker");
          const markerRect = marker?.getBoundingClientRect();
          return {
            hasUsableSize: mapRect.width > 300 && mapRect.height > 400,
            markerInside:
              Boolean(markerRect) &&
              Number.isFinite(markerRect!.left) &&
              Number.isFinite(markerRect!.top) &&
              markerRect!.right > mapRect.left &&
              markerRect!.left < mapRect.right &&
              markerRect!.bottom > mapRect.top &&
              markerRect!.top < mapRect.bottom,
            // Ghim của MapLibre được đặt bằng `transform: translate(...)`.
            // Khung 0×0 từng làm phép chiếu ra NaN và ghim bay đi mất — đó là
            // lý do phép đo này tồn tại, giữ nguyên ý sau khi đổi thư viện.
            hasInvalidTransform: Array.from(
              map.querySelectorAll<HTMLElement>(".maplibregl-marker, .maplibregl-canvas"),
            ).some((element) => element.style.transform.includes("NaN")),
          };
        }),
      )
      .toEqual({
        hasUsableSize: true,
        markerInside: true,
        hasInvalidTransform: false,
      });
  }

  await expect(page.getByRole("button", { name: /Thử lại/ })).toHaveCount(0);
  await expect(page.locator("[data-brand-map]")).toBeVisible();
});

test("destination detail traps focus, locks the page and restores its trigger", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "desktop dialog contract");
  await prepareExplore(page);
  const [slug] = await visibleDestinationSlugs(page);
  const detailTrigger = page.getByTestId(`explore-detail-${slug}`);

  await detailTrigger.click();
  const dialog = page.getByTestId("explore-detail-sheet");
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(dialog.getByRole("button", { name: "Đóng chi tiết điểm đến" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(detailTrigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("explore interaction state has no serious accessibility violations", async ({
  page,
}) => {
  await prepareExplore(page);
  if ((await page.locator('[data-explore-view="list"]').getAttribute("aria-pressed")) !== "true") {
    await page.locator('[data-explore-view="list"]').click();
  }
  const [slug] = await visibleDestinationSlugs(page);
  await page.getByTestId(`explore-detail-${slug}`).click();
  await expect(page.getByTestId("explore-detail-sheet")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
});
