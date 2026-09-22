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
    // Trang chủ nặng: ảnh đầu trang, video mở đầu, rồi mới tới bản đồ — mà
    // bản đồ lại chỉ gắn khi sắp vào khung nhìn. Chạy một mình thì kịp, chạy
    // cùng cả bộ ở khổ điện thoại thì chạm trần 30 giây.
    test.slow();
    await chuanBi(page);
    await page.goto("/?lang=vi");
    // Bản đồ trang chủ chỉ được gắn khi khối `#map` sắp vào khung nhìn
    // (IntersectionObserver, để không kéo gói bản đồ ngay lúc mở trang). Một
    // lần cuộn không phải lúc nào cũng đủ: trang dài, ảnh về dần và mốc cuộn
    // trôi theo. Cuộn lại cho tới khi bản đồ có mặt.
    await expect(async () => {
      await page.locator("#map").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-brand-map]")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 40_000 });
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

  /**
   * Ba bản đồ nhỏ — vị trí điểm đến, các chặng trong gói, tấm hộ chiếu chuyến
   * đi — trước đây chạy bằng Leaflet và ảnh nền OpenStreetMap. Chúng là chỗ
   * dễ bị bỏ quên nhất khi đổi nhà cung cấp, vì nằm sâu trong trang và không
   * ai mở tới hằng ngày.
   */
  test("bản đồ nhỏ ở trang điểm đến cũng là bản đồ thương hiệu, không còn Leaflet", async ({
    page,
  }) => {
    await chuanBi(page);
    const { osmCu } = theoDoiYeuCau(page);
    await page.goto("/destination/trang-an");

    // Bản đồ chỉ gắn khi sắp vào khung nhìn, nên phải cuộn tới nơi.
    await expect(async () => {
      await page.getByText("Vị trí", { exact: false }).first().scrollIntoViewIfNeeded();
      await expect(page.locator("[data-brand-map]")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000 });

    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
    expect(osmCu, "đã gọi lại máy chủ ảnh nền cấm dùng thương mại").toEqual([]);
  });

  test("các chặng trong gói nối thành một đường trên bản đồ tối", async ({ page }) => {
    await chuanBi(page);
    await page.goto("/packages/heritage-day");
    await expect(async () => {
      await page
        .getByText("Các điểm trong gói", { exact: false })
        .first()
        .scrollIntoViewIfNeeded();
      await expect(page.locator("[data-brand-map]")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000 });

    // Trang gói nằm trên nền xanh đậm: bản đồ phải đổi sang bảng màu chương
    // tối, không phải một ô giấy trắng trợn giữa trang.
    await expect(page.locator("[data-brand-map]")).toHaveAttribute("data-brand-map", "dem");
    await expect(page.locator(".nb-marker")).toHaveCount(2);
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });

  test("dòng ghi nguồn thu lại thành một chữ, không nằm đè lên ghim ở mép dưới", async ({
    page,
  }) => {
    // Lỗi đo được bằng ảnh chụp: MapLibre bày sẵn cả dòng ghi nguồn ra, và
    // trên bản đồ cao 254px của trang gói nó thành một thanh trắng dài đè
    // đúng lên cái ghim ở phía nam. Ghi nguồn vẫn phải còn — bấm vào là đọc
    // được — nhưng không được chiếm chỗ.
    await chuanBi(page);
    await page.goto("/packages/heritage-day");
    await expect(async () => {
      await page
        .getByText("Các điểm trong gói", { exact: false })
        .first()
        .scrollIntoViewIfNeeded();
      await expect(page.locator("[data-brand-map]")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000 });

    const ghiCong = page.locator("details.maplibregl-ctrl-attrib");
    await expect(ghiCong).toHaveCount(1);
    expect(await ghiCong.evaluate((o) => (o as HTMLDetailsElement).open)).toBe(false);

    const khung = (await page.locator("[data-brand-map]").boundingBox())!;
    const hopGhiCong = (await ghiCong.boundingBox())!;
    expect(
      hopGhiCong.width,
      "dòng ghi nguồn chiếm quá một phần ba bề ngang bản đồ",
    ).toBeLessThan(khung.width / 3);
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
