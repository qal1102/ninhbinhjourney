import { expect, test, type Page } from "@playwright/test";

const CONTINUITY_SOURCE = "page-continuity-e2e";
const CONTINUITY_JOURNEY = "continuity-journey";

async function installViewTransitionProbe(page: Page) {
  await page.addInitScript(() => {
    const documentWithTransitions = document as Document & {
      startViewTransition?: (...args: unknown[]) => unknown;
    };
    const startViewTransition = documentWithTransitions.startViewTransition;
    const events: Array<{
      at: number;
      animations?: Array<{
        name: string;
        duration: number;
        pseudoElement: string;
      }>;
    }> = [];

    Object.defineProperty(window, "__pageContinuityTransitions", {
      configurable: true,
      value: events,
    });

    if (typeof startViewTransition !== "function") return;

    Object.defineProperty(documentWithTransitions, "startViewTransition", {
      configurable: true,
      value: (...args: unknown[]) => {
        const event: (typeof events)[number] = { at: performance.now() };
        events.push(event);
        const transition = startViewTransition.apply(document, args) as {
          ready?: Promise<unknown>;
        };
        transition.ready?.then(() => {
          requestAnimationFrame(() => {
            event.animations = document.getAnimations().map((animation) => {
              const effect = animation.effect as KeyframeEffect | null;
              return {
                name: (animation as CSSAnimation).animationName || "view-transition",
                duration: Number(effect?.getTiming().duration ?? 0),
                pseudoElement:
                  (
                    effect as (KeyframeEffect & { pseudoElement?: string }) | null
                  )?.pseudoElement ?? "",
              };
            });
          });
        });
        return transition;
      },
    });
  });
}

async function transitionCount(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & {
        __pageContinuityTransitions?: Array<{ at: number }>;
      }).__pageContinuityTransitions?.length ?? 0,
  );
}

async function expectOneSharedImage(page: Page, name: string) {
  await expect(page.locator(`[data-continuity-image="${name}"]`)).toHaveCount(1);
}

async function recordedAnimationNames(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __pageContinuityTransitions?: Array<{
          animations?: Array<{
            name: string;
            duration: number;
            pseudoElement: string;
          }>;
        }>;
      }
    ).__pageContinuityTransitions?.flatMap(
      (event) => event.animations?.map((animation) => animation.name) ?? [],
    ) ?? [],
  );
}

async function recordedAnimations(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __pageContinuityTransitions?: Array<{
          animations?: Array<{
            name: string;
            duration: number;
            pseudoElement: string;
          }>;
        }>;
      }
    ).__pageContinuityTransitions?.flatMap(
      (event) => event.animations ?? [],
    ) ?? [],
  );
}

async function waitForClientRouter(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.dataset.nbjRouterReady ?? "false",
      ),
    )
    .toBe("true");
}

async function waitForStableMain(page: Page, selector: string) {
  await page.evaluate(
    (stableSelector) =>
      new Promise<void>((resolve) => {
        let stableSince = 0;
        const check = (now: number) => {
          if (document.querySelector(stableSelector)) {
            stableSince ||= now;
            if (now - stableSince >= 500) {
              resolve();
              return;
            }
          } else {
            stableSince = 0;
          }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    selector,
  );
}

test("experience portals preserve language and source, then offer a stable return to travel", async ({
  page,
}) => {
  await installViewTransitionProbe(page);
  await page.goto(`/?lang=en&source=${CONTINUITY_SOURCE}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForClientRouter(page);

  const beforeForward = await transitionCount(page);
  await page
    .locator('[data-experience-portal="collaboration"]:visible')
    .first()
    .click();
  await expect(page).toHaveURL(
    /\/collaborations\?lang=en&source=page-continuity-e2e$/,
  );
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeForward);
  await expect
    .poll(() => recordedAnimationNames(page))
    .toContain("portal-root-reveal");
  await expect
    .poll(async () =>
      (await recordedAnimations(page)).find(
        (animation) => animation.name === "portal-root-reveal",
      )?.duration,
    )
    .toBe(0);

  const beforeReturn = await transitionCount(page);
  // Bám THUỘC TÍNH, không bám câu chữ. Ngày 22/09 đường về của mọi chương
  // chuyển sang thanh chuyển thế giới dùng chung và nhãn đổi thành "Back to
  // Ninh Binh" — bài này đỏ ngay, đúng việc của nó. Nhưng thứ đáng canh là
  // "luôn có một đường về giữ nguyên ngôn ngữ và nguồn", không phải bảy chữ
  // cụ thể; nhãn còn đổi nữa, hợp đồng thì không.
  await page.locator("[data-world-back]").first().click();
  await expect(page).toHaveURL(/\/?\?lang=en&source=page-continuity-e2e$/);
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeReturn);
  await expect
    .poll(() => recordedAnimationNames(page))
    .toContain("route-root-new");
});

test("package continuity preserves only allowed context across forward navigation and browser Back", async ({
  page,
}) => {
  await installViewTransitionProbe(page);
  await page.goto(
    `/packages?lang=en&source=${CONTINUITY_SOURCE}&journey=${CONTINUITY_JOURNEY}`,
    { waitUntil: "domcontentloaded" },
  );
  await waitForClientRouter(page);
  await page.waitForLoadState("networkidle");
  await waitForStableMain(page, 'main[data-customer-section="packages-catalog"]');
  await expectOneSharedImage(page, "package-image-heritage-day");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 420);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const packageScrollBeforeForward = await page.evaluate(() => window.scrollY);

  const beforeForward = await transitionCount(page);
  await page.locator('[data-customer-track="package-detail"]').first().evaluate(
    (link) => (link as HTMLAnchorElement).click(),
  );
  await expect(page).toHaveURL(
    /\/packages\/heritage-day\?lang=en&source=page-continuity-e2e&journey=continuity-journey&from=catalog$/,
  );
  await expectOneSharedImage(page, "package-image-heritage-day");
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeForward);

  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(
    /\/packages\?lang=en&source=page-continuity-e2e&journey=continuity-journey$/,
  );
  await expectOneSharedImage(page, "package-image-heritage-day");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(packageScrollBeforeForward, 0);
});

test("explore sheet hands its destination image to the route without duplicate names or a leaked body lock", async ({
  page,
}) => {
  await installViewTransitionProbe(page);
  await page.goto(
    `/explore?lang=en&source=${CONTINUITY_SOURCE}&journey=${CONTINUITY_JOURNEY}`,
    { waitUntil: "domcontentloaded" },
  );
  await waitForClientRouter(page);
  await page.getByRole("button", { name: "Danh sách" }).click();
  await page
    .locator('[data-testid="explore-detail-trang-an"]:visible')
    .first()
    .click();
  await expect(page.getByTestId("explore-detail-sheet")).toBeVisible();
  await expectOneSharedImage(page, "destination-image-trang-an");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const beforeForward = await transitionCount(page);
  await page
    .getByTestId("explore-detail-sheet")
    .getByRole("link", { name: "Xem câu chuyện" })
    .click();
  await expect(page).toHaveURL(
    /\/destination\/trang-an\?lang=en&source=page-continuity-e2e&journey=continuity-journey&from=explore$/,
  );
  await expectOneSharedImage(page, "destination-image-trang-an");
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeForward);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");

  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(
    /\/explore\?lang=en&source=page-continuity-e2e&journey=continuity-journey$/,
  );
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("package-to-destination hierarchy returns to the deterministic parent", async ({ page }) => {
  await installViewTransitionProbe(page);
  await page.goto(
    `/packages/heritage-day?lang=en&source=${CONTINUITY_SOURCE}&journey=${CONTINUITY_JOURNEY}&from=home`,
    { waitUntil: "domcontentloaded" },
  );
  await waitForClientRouter(page);
  await expectOneSharedImage(page, "package-image-heritage-day");

  const beforeForward = await transitionCount(page);
  await page.locator('[data-customer-track="package-destination"]').first().click();
  await expect(page).toHaveURL(
    /\/destination\/trang-an\?lang=en&source=page-continuity-e2e&journey=continuity-journey&from=package&package=heritage-day&parent=home$/,
  );
  await expectOneSharedImage(page, "destination-image-trang-an");
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeForward);

  const beforeBack = await transitionCount(page);
  await page.getByRole("link", { name: /Khám phá/ }).click();
  await expect(page).toHaveURL(
    /\/packages\/heritage-day\?lang=en&source=page-continuity-e2e&journey=continuity-journey&from=home$/,
  );
  await expectOneSharedImage(page, "package-image-heritage-day");
  await expect.poll(() => transitionCount(page)).toBeGreaterThan(beforeBack);
});

test.describe("motion-enabled continuity", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("portal navigation runs the cinematic reveal when motion is allowed", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await installViewTransitionProbe(page);
    await page.goto(`/?lang=en&source=${CONTINUITY_SOURCE}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForClientRouter(page);

    await page
      .locator('[data-experience-portal="collaboration"]:visible')
      .first()
      .click();
    await expect(page).toHaveURL(/\/collaborations/);
    await expect
      .poll(async () =>
        (await recordedAnimations(page)).find(
          (animation) => animation.name === "portal-root-reveal",
        )?.duration,
      )
      .toBeGreaterThanOrEqual(600);
  });
});
