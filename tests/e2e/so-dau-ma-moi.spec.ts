import { expect, test } from "@playwright/test";

/*
 * Chương trình kéo khách quay lại (13/10/2026): sổ dấu không cần đăng nhập,
 * lời hứa giữ di sản, mã mời giảm 10%. Máy cục bộ không có kho, nên trang
 * thanh toán chặn hai lời gọi khung giờ và giữ chỗ: thứ được kiểm là màn hình
 * tính đúng và gửi đúng mã mời lên máy chủ.
 */

const GIO = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

test.describe("sổ dấu", () => {
  test("quét mã Hoa Lư thì dấu vào sổ, mở lại vẫn còn, điểm còn thiếu mời mua vé", async ({ page }) => {
    await page.goto("/dau/hoa-lu-l5h");
    await expect(page.getByTestId("dau-vua-dong")).toContainText("Đã đóng dấu Cố đô Hoa Lư");
    await expect(page.locator('[data-co-dau="co"]')).toHaveCount(1);
    await page.goto("/so-dau");
    await expect(page.getByTestId("so-dau-dem")).toContainText("Bạn có 1 trên 6 dấu");
    await expect(page.getByTestId("so-dau-luoi").getByRole("link", { name: "Mua vé" })).toHaveCount(4);
    await page.goto("/dau/hoa-lu-l5h");
    await expect(page.getByTestId("dau-vua-dong")).toContainText("đã có dấu Cố đô Hoa Lư từ trước");
  });

  test("gõ tên điểm không có khoá thì không đóng được dấu", async ({ page }) => {
    // Trang truyền dần nên Next trả màn "không tìm thấy" kèm mã 200: soát nội dung, không soát mã.
    await page.goto("/dau/hoa-lu");
    await expect(page.getByTestId("so-dau")).toHaveCount(0);
    await page.goto("/so-dau");
    await expect(page.getByTestId("so-dau-dem")).toContainText("Bạn có 0 trên 6 dấu");
  });

  test("hứa năm điều giữ di sản thì được dấu lời hứa", async ({ page }) => {
    await page.goto("/loi-hua");
    await expect(page.getByTestId("loi-hua").locator("ol li")).toHaveCount(5);
    await page.getByTestId("nut-toi-hua").click();
    await expect(page.getByTestId("dau-vua-dong")).toContainText("Đã đóng dấu Lời hứa giữ di sản");
  });

  test("thẻ Sổ dấu đứng cạnh hai thẻ vé", async ({ page }) => {
    await page.goto("/tra-cuu-ve");
    await page.getByTestId("chon-trang-ve-dau").click();
    await expect(page).toHaveURL(/\/so-dau/);
    await expect(page.getByRole("heading", { name: "Sổ dấu Ninh Bình" })).toBeVisible();
  });
});

test.describe("mã mời và giá trẻ em", () => {
  test("đường dẫn mời sai mã thì trang Mua vé nói rõ, vẫn mua giá thường được", async ({ page }) => {
    await page.goto("/moi/MOI-ZZZZZZ");
    await expect(page).toHaveURL(/\/packages\?moi=sai/);
    await expect(page.getByTestId("bao-ma-moi")).toContainText("không có trong hệ thống");
  });

  test("gói hai điểm ghi giá mua lẻ, trẻ em có giá riêng, mã mời trừ 10% và đi lên máy chủ", async ({ page }) => {
    let guiLen: Record<string, unknown> = {};
    await page.route("**/api/customer-booking-slots**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          slots: [{
            startsAt: GIO,
            endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
            siteIds: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000003"],
            remaining: 12,
            capacitySourceKind: "estimate",
            bookable: true,
            blockedReason: null,
          }],
        }),
      }),
    );
    await page.route("**/api/customer-booking-holds", async (route) => {
      guiLen = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          order: { id: "50000000-0000-4000-8000-000000000009", code: "NBJ-ABCDEF123499" },
          hold: { id: "60000000-0000-4000-8000-000000000009", status: "active", expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
          amount: { total_vnd: 624_000, discount_vnd: 69_000, currency: "VND" },
          slots: [],
        }),
      });
    });
    await page.goto("/checkout?package=family-discovery");
    // Gia đình khám phá: Tràng An + Bái Đính, mua lẻ 310.000, gói giảm 10% còn 279.000; trẻ 135.000.
    await expect(page.getByText("310.000 VND")).toBeVisible();
    await page.getByLabel("Số trẻ cao từ 1m tới 1m3").fill("1");
    await expect(page.getByTestId("tong-tien-don")).toHaveText("693.000 VND");
    await page.getByTestId("o-ma-moi").getByRole("textbox").fill("moi-ab12cd");
    await expect(page.getByTestId("o-ma-moi")).toContainText("bớt 69.000 đ");
    await expect(page.getByTestId("tong-tien-don")).toHaveText("624.000 VND");
    await page.getByRole("button", { name: /Khung .*còn (khoảng )?12 chỗ/i }).click();
    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await expect(page.getByTestId("dong-giam-ma-moi")).toContainText("69.000");
    expect(guiLen.ma_moi).toBe("MOI-AB12CD");
    expect(guiLen.adults).toBe(2);
    expect(guiLen.children).toBe(1);
  });
});
