import { expect, test, type Page } from "@playwright/test";

/**
 * Bản đồ sau khi đổi sang MapLibre + OpenFreeMap.
 *
 * Bài quan trọng nhất ở đây là bài **chặn đường lui**: không một yêu cầu nào
 * được bắn tới `tile.openstreetmap.org` nữa. Máy chủ ảnh nền miễn phí của
 * OpenStreetMap cấm dùng cho mục đích thương mại và bóp lưu lượng — đó mới là
 * nguyên nhân thật của chuyện "bản đồ liên tục bị lỗi", và nếu ai đó vô tình
 * gọi lại nó thì lỗi ấy quay lại y nguyên mà không ai biết cho tới khi khách
 * mở web.
 */

async function chuanBi(page: Page) {
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
      // Chế độ riêng tư chặn storage — trang vẫn dựng được.
    }
  });
}

function theoDoiYeuCau(page: Page) {
  const openfreemap: number[] = [];
  const osmCu: string[] = [];
  page.on("response", (r) => {
    const url = r.url();
    if (url.includes("tiles.openfreemap.org")) openfreemap.push(r.status());
  });
  page.on("request", (r) => {
    if (r.url().includes("tile.openstreetmap.org")) osmCu.push(r.url());
  });
  return { openfreemap, osmCu };
}

test.describe("Bản đồ thương hiệu", () => {
  test("trang khám phá vẽ được bản đồ vector và lấy dữ liệu từ OpenFreeMap", async ({
    page,
  }) => {
    await chuanBi(page);
    const { openfreemap, osmCu } = theoDoiYeuCau(page);
    await page.goto("/explore");
    await page.getByRole("button", { name: "Bản đồ", exact: true }).click().catch(() => {});

    await expect(page.locator("[data-brand-map]")).toBeVisible();
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.locator(".nb-marker").first()).toBeVisible();

    // Khung phải có kích thước thật. Đã từng đo ra 654×0 vì MapLibre tự đặt
    // `position: relative` lên chính khung của nó và đè mất lớp định vị.
    const o = await page.locator("[data-brand-map]").boundingBox();
    expect(o!.width).toBeGreaterThan(200);
    expect(o!.height).toBeGreaterThan(200);

    await expect
      .poll(() => openfreemap.filter((s) => s === 200).length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    expect(osmCu, "đã gọi lại máy chủ ảnh nền cấm dùng thương mại").toEqual([]);
  });

  test("ghi nguồn dữ liệu bản đồ vẫn còn — đây là điều kiện bắt buộc để được dùng", async ({
    page,
  }) => {
    await chuanBi(page);
    await page.goto("/explore");
    await page.getByRole("button", { name: "Bản đồ", exact: true }).click().catch(() => {});
    await expect(page.locator("[data-brand-map]")).toBeVisible();
    const ghiCong = page.locator(".maplibregl-ctrl-attrib");
    await expect(ghiCong).toContainText(/OpenStreetMap/);
    await expect(ghiCong).toContainText(/OpenFreeMap/);
  });

  test("bấm một ghim ở trang chủ thì mở tấm thiệp của trang, không phải bong bóng mặc định", async ({
    page,
  }) => {
    await chuanBi(page);
    await page.goto("/?lang=vi");
    await page.locator("#map").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-brand-map]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".nb-marker").first()).toBeVisible();

    // Trước khi bấm, bản đồ đang tự giới thiệu.
    await expect(
      page.getByRole("button", { name: "Đóng lời giới thiệu bản đồ" }),
    ).toBeVisible();

    await page.locator(".nb-marker").first().click();
    const dong = page.getByRole("button", { name: "Đóng thẻ điểm đến" });
    await expect(dong).toBeVisible();
    // Bong bóng mặc định của thư viện không được xuất hiện ở đâu cả.
    await expect(page.locator(".maplibregl-popup")).toHaveCount(0);

    await dong.click();
    await expect(dong).toHaveCount(0);
  });

  test("ghim đang chọn nhìn ra được giữa những ghim khác", async ({ page }) => {
    await chuanBi(page);
    await page.goto("/explore");
    await page.getByRole("button", { name: "Bản đồ", exact: true }).click().catch(() => {});
    await expect(page.locator(".nb-marker").first()).toBeVisible();
    await expect(page.locator(".nb-marker-active")).toHaveCount(0);

    await page.locator(".nb-marker").first().click();
    await expect(page.locator(".nb-marker-active")).toHaveCount(1);
  });
});
