import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * TC-10 — "Những nơi bạn đã đi qua" trên `/doan/[ma]` và `/doan/truong/[ma]`.
 *
 * Không ghi một dòng dữ liệu nào: mọi lời gọi GET tới kho đều bị chặn lại bằng
 * `page.route` và trả dữ liệu dựng sẵn. Nhờ vậy bài chạy được trước khi
 * migration `202609180077` được áp, và không bao giờ đụng dữ liệu thật.
 *
 * Luôn đặt `PLAYWRIGHT_BASE_URL` rõ ràng khi chạy.
 */

const MA = "TV-AB12CD34EF";
const MA_DOAN = "DOAN-AB12CD34EF";
const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const CO_DO_HOA_LU = "10000000-0000-4000-8000-000000000002";
const TAM_COC = "10000000-0000-4000-8000-000000000005";
const BAI_DINH = "10000000-0000-4000-8000-000000000003";

const CHU_CAM = ["soát vé", "quét mã", "điểm chạm", "check-in"];

type Entry = { siteId: string; scannedAt: string };

function journey(entries: Entry[]) {
  return {
    accepted: true,
    journey: {
      memberCode: MA,
      guestGroup: "adult",
      displayName: "",
      visitDate: "2026-09-18",
      entries,
    },
  };
}

const HAI_NOI: Entry[] = [
  { siteId: TRANG_AN, scannedAt: "2026-09-18T01:42:00+00:00" },
  // Hoa Lư không có trên bản đồ: lượt này phải bị bỏ qua.
  { siteId: CO_DO_HOA_LU, scannedAt: "2026-09-18T04:00:00+00:00" },
  { siteId: TAM_COC, scannedAt: "2026-09-18T06:15:00+00:00" },
  // Vào lại Tràng An: vẫn là một nơi, giữ giờ sớm nhất.
  { siteId: TRANG_AN, scannedAt: "2026-09-18T08:00:00+00:00" },
];

/** Chặn đúng lời gọi GET hành trình; POST ghi tên đi tiếp như thường. */
async function chanHanhTrinh(page: Page, tra: () => { status: number; body: unknown }) {
  const calls: string[] = [];
  await page.route(
    (url) => url.pathname === "/api/customer-group-members",
    async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      calls.push(route.request().url());
      const { status, body } = tra();
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    },
  );
  return calls;
}

async function khongTranNgang(page: Page) {
  const tran = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tran, "không có thanh cuộn ngang").toBeLessThanOrEqual(0);
}

async function khongChuCam(page: Page, selector = "main") {
  const chu = (await page.locator(selector).innerText()).toLowerCase();
  for (const cam of CHU_CAM) expect(chu, `không dùng chữ "${cam}" với khách`).not.toContain(cam);
}

test.use({ timezoneId: "Europe/London" });

test("hai trong bốn nơi đã sáng, giờ ghi theo giờ Việt Nam", async ({ page }) => {
  await chanHanhTrinh(page, () => ({ status: 200, body: journey(HAI_NOI) }));
  await page.goto(`/doan/${MA}`);

  await expect(page.getByRole("heading", { level: 1, name: "Những nơi bạn đã đi qua" })).toBeVisible();
  const passport = page.getByTestId("trip-passport");
  await expect(passport).toHaveAttribute("data-lit-count", "2");
  await expect(page.getByTestId("trip-passport-lead")).toHaveText(
    "Bạn đã ghé 2 trong 4 nơi trên tấm bản đồ này. Nơi nào bạn vào, nơi ấy sáng lên.",
  );

  // Máy đặt giờ London, trang vẫn ghi giờ Việt Nam.
  const daSang = page.getByTestId("trip-passport-lit").getByRole("listitem");
  await expect(daSang).toHaveCount(2);
  await expect(daSang.nth(0)).toContainText("Tràng An");
  await expect(daSang.nth(0)).toContainText("08:42 · 18/09");
  await expect(daSang.nth(1)).toContainText("Tam Cốc – Bích Động");
  await expect(daSang.nth(1)).toContainText("13:15 · 18/09");
  await expect(page.getByTestId("trip-passport-dim").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Cố đô Hoa Lư")).toHaveCount(0);

  // Trên bản đồ: hai điểm sáng, hai điểm mờ.
  await expect(page.locator(".nb-passport-pin.is-lit")).toHaveCount(2);
  await expect(page.locator('.nb-passport-pin[data-lit="false"]')).toHaveCount(2);
  // Lần mở đầu không nơi nào nhấp nháy.
  await expect(page.locator(".nb-passport-pin.is-fresh")).toHaveCount(0);

  await expect(page.getByText("Ai cầm mã này cũng mở được trang này")).toBeVisible();
  await khongChuCam(page);

  // Bản đồ nằm trong một ngữ cảnh xếp lớp riêng: không lớp nào của nó vượt
  // được ra ngoài để đè lên hộp thoại.
  await expect(page.locator(".nb-passport-map")).toHaveCSS("isolation", "isolate");
});

test("chưa vào nơi nào: bản đồ còn mờ, không đếm ngược", async ({ page }) => {
  await chanHanhTrinh(page, () => ({ status: 200, body: journey([]) }));
  await page.goto(`/doan/${MA}`);

  await expect(page.getByTestId("trip-passport")).toHaveAttribute("data-lit-count", "0");
  await expect(page.getByTestId("trip-passport-lead")).toHaveText(
    "Bản đồ còn mờ, vì bạn chưa vào nơi nào. Tới đâu, nơi ấy sáng lên ở đây.",
  );
  await expect(page.getByTestId("trip-passport-lit")).toHaveCount(0);
  await expect(page.getByTestId("trip-passport-dim").getByRole("listitem")).toHaveCount(4);
  await expect(page.locator(".nb-passport-pin.is-lit")).toHaveCount(0);
  const chu = (await page.locator("main").innerText()).toLowerCase();
  expect(chu).not.toMatch(/còn \d+ nơi|nhanh lên|sắp hết|chỉ còn/);
  await khongChuCam(page);
});

test("migration chưa áp: trang nói phần này sắp có, chỗ ghi tên vẫn dùng được", async ({ page }) => {
  await chanHanhTrinh(page, () => ({
    status: 503,
    body: { accepted: false, error: { code: "VISITOR_GROUP_JOURNEY_NOT_READY", message: "chưa mở" } },
  }));
  await page.goto(`/doan/${MA}`);

  const trangThai = page.getByTestId("trip-passport-state");
  await expect(trangThai).toHaveAttribute("data-state", "not-ready");
  await expect(page.getByText("Tấm bản đồ này sắp có")).toBeVisible();
  await expect(page.getByText(/kết nối|trục trặc|lỗi/i)).toHaveCount(0);
  await expect(page.locator(".nb-passport-map")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lưu tên" })).toBeEnabled();
  await khongChuCam(page);
});

test("mã sai khuôn: báo không tìm thấy, không gọi kho", async ({ page }) => {
  const calls = await chanHanhTrinh(page, () => ({ status: 200, body: journey([]) }));
  await page.goto("/doan/TV-SAI");
  await expect(page.getByTestId("trip-passport-state")).toHaveAttribute("data-state", "not-found");
  await expect(page.getByText("Em không tìm thấy mã này")).toBeVisible();
  expect(calls).toHaveLength(0);
});

test("tiếng Anh: Places you've been", async ({ page }) => {
  await chanHanhTrinh(page, () => ({ status: 200, body: journey(HAI_NOI) }));
  await page.goto(`/doan/${MA}?lang=en`);
  await expect(page.getByRole("heading", { level: 1, name: "Places you've been" })).toBeVisible();
  await expect(page.getByTestId("trip-passport-lit").getByRole("listitem").nth(0)).toContainText("08:42 · 18 Sep");
  await expect(page.locator("main")).toHaveAttribute("lang", "en");
});

test("làm mới 15 giây một lượt khi tab đang mở, thôi hỏi khi tab bị ẩn", async ({ page }) => {
  await page.clock.install();
  const calls = await chanHanhTrinh(page, () => ({ status: 200, body: journey(HAI_NOI) }));
  await page.goto(`/doan/${MA}`);
  await expect(page.getByTestId("trip-passport")).toBeVisible();
  expect(calls).toHaveLength(1);

  await page.clock.runFor(15_000);
  await expect.poll(() => calls.length).toBe(2);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(60_000);
  expect(calls, "tab ẩn thì không hỏi thêm").toHaveLength(2);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls.length, { message: "quay lại tab là hỏi ngay" }).toBe(3);
});

async function moRoiSangThem(page: Page) {
  let lan = 0;
  await chanHanhTrinh(page, () => {
    lan += 1;
    return {
      status: 200,
      body: journey(lan === 1 ? [HAI_NOI[0]] : [HAI_NOI[0], { siteId: BAI_DINH, scannedAt: "2026-09-18T03:30:00+00:00" }]),
    };
  });
  await page.goto(`/doan/${MA}`);
  await expect(page.getByTestId("trip-passport")).toHaveAttribute("data-lit-count", "1");
  // Khách quay lại tab: trang hỏi ngay một lượt.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByTestId("trip-passport")).toHaveAttribute("data-lit-count", "2");
  const moi = page.locator(`.nb-passport-pin[data-place-id="${BAI_DINH}"]`);
  await expect(moi).toHaveClass(/is-fresh/);
  await expect(page.locator(`.nb-passport-pin[data-place-id="${TRANG_AN}"]`)).not.toHaveClass(/is-fresh/);
  return moi;
}

test.describe("nơi vừa sáng", () => {
  test.describe("khi khách để chuyển động bình thường", () => {
    test.use({ contextOptions: { reducedMotion: "no-preference" } });
    test("có một nhịp chuyển nhẹ, chỉ ở nơi vừa sáng", async ({ page }) => {
      const moi = await moRoiSangThem(page);
      await expect(moi).toHaveCSS("animation-name", "nb-passport-light");
    });
  });

  test.describe("khi khách chọn giảm chuyển động", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });
    test("không có chuyển động nào", async ({ page }) => {
      const moi = await moRoiSangThem(page);
      await expect(moi).toHaveCSS("animation-name", "none");
      await expect(page.locator(`[data-testid="trip-passport-lit"] li[data-place-id="${BAI_DINH}"]`)).toHaveCSS(
        "animation-name",
        "none",
      );
    });
  });
});

for (const khung of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`trang thành viên vừa khổ ${khung.width}px, không tràn ngang`, async ({ page }) => {
    await page.setViewportSize(khung);
    await chanHanhTrinh(page, () => ({ status: 200, body: journey(HAI_NOI) }));
    await page.goto(`/doan/${MA}`);
    await expect(page.locator(".nb-passport-pin.is-lit")).toHaveCount(2);
    await khongTranNgang(page);
    const map = await page.locator(".nb-passport-map").boundingBox();
    expect(map?.width ?? 0).toBeGreaterThan(300);
    expect((map?.x ?? 0) + (map?.width ?? 0)).toBeLessThanOrEqual(khung.width);
  });

  test(`trang trưởng đoàn gộp cả đoàn, khổ ${khung.width}px, không gọi thêm lượt nào`, async ({ page }) => {
    await page.setViewportSize(khung);
    const goiHanhTrinh = await chanHanhTrinh(page, () => ({ status: 200, body: journey([]) }));
    await page.route(
      (url) => url.pathname === "/api/customer-visitor-groups",
      (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          group: {
            groupCode: MA_DOAN,
            groupLabel: "Đoàn Kim Sơn",
            orderCode: "",
            leaderName: "Trần Văn A",
            visitDate: "2026-09-18",
            memberCount: 3,
            activatedCount: 0,
            members: [
              { memberIndex: 1, memberCode: "TV-AAAAAAAAAA", guestGroup: "adult", displayName: "", careNeed: "none", activated: false,
                entries: [{ siteId: TRANG_AN, scannedAt: "2026-09-18T01:40:00+00:00" }, { siteId: TAM_COC, scannedAt: "2026-09-18T06:00:00+00:00" }] },
              { memberIndex: 2, memberCode: "TV-BBBBBBBBBB", guestGroup: "adult", displayName: "", careNeed: "none", activated: false,
                entries: [{ siteId: TRANG_AN, scannedAt: "2026-09-18T01:45:00+00:00" }] },
              { memberIndex: 3, memberCode: "TV-CCCCCCCCCC", guestGroup: "child", displayName: "", careNeed: "none", activated: false, entries: [] },
            ],
          },
        }),
      }),
    );
    await page.goto(`/doan/truong/${MA_DOAN}`);

    await expect(page.getByRole("heading", { level: 2, name: "Những nơi cả đoàn đã đi qua" })).toBeVisible();
    await expect(page.getByTestId("trip-passport")).toHaveAttribute("data-lit-count", "2");
    const daSang = page.getByTestId("trip-passport-lit").getByRole("listitem");
    await expect(daSang.nth(0)).toContainText("08:40 · 18/09 · 2 trong 3 người đã vào");
    await expect(daSang.nth(1)).toContainText("1 trong 3 người đã vào");
    await expect(page.locator(".nb-passport-pin.is-lit")).toHaveCount(2);
    await khongChuCam(page, '[data-testid="trip-passport"]');
    await khongTranNgang(page);
    expect(goiHanhTrinh, "trang trưởng đoàn không gọi thêm đường đọc hành trình").toHaveLength(0);
  });
}
